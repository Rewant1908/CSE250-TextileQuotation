// backend/agents/runner/toolRunner.js
// Real Gemini function-calling loop — calls tools against the DB and loops until done.
//
// 429 handling: geminiWithRetry() reads retryDelay from the error body (Google
// sends the exact seconds to wait). Falls back to exponential backoff.
// Non-429 errors are re-thrown immediately.

import logger from '../../logger.js'

const MAX_TOOL_TURNS = 10
const MAX_RETRIES    = 3

// ── Retry helper ─────────────────────────────────────────────────────────────

/**
 * Parse the retry delay (in ms) from a GoogleGenerativeAI 429 error.
 * The error message contains "Please retry in X.XXXs" — we extract that.
 * Falls back to exponential backoff: attempt 0→60s, 1→120s, 2→300s.
 */
function parseRetryDelay(err, attempt) {
  const fallbacks = [60_000, 120_000, 300_000]
  try {
    // Google error: "Please retry in 44.958643213s"
    const match = err?.message?.match(/retry in ([\d.]+)s/i)
    if (match) return Math.ceil(parseFloat(match[1]) * 1000) + 2000 // +2s buffer
  } catch (_) {}
  return fallbacks[Math.min(attempt, fallbacks.length - 1)]
}

/**
 * Wrap any async Gemini call with 429-aware retry + exponential backoff.
 * Non-429 errors (400 duplicate function, 401 auth) are thrown immediately.
 */
async function geminiWithRetry(fn, label = 'gemini call') {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const is429 = err?.status === 429
                 || err?.message?.includes('429')
                 || err?.message?.includes('Too Many Requests')
                 || err?.message?.includes('quota')

      if (!is429 || attempt === MAX_RETRIES) {
        // Surface a clean error for quota exhaustion after all retries
        if (is429) {
          throw new Error(
            `Gemini API quota exhausted after ${MAX_RETRIES} retries. ` +
            `You have hit the free-tier limit (20 req/day for gemini-2.5-flash). ` +
            `Wait until tomorrow or upgrade your plan at https://ai.dev/rate-limit`
          )
        }
        throw err
      }

      const delayMs = parseRetryDelay(err, attempt)
      logger.warn(
        { label, attempt, delayMs, error: err.message },
        `[429] Gemini rate-limited — retrying in ${Math.round(delayMs / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES})`
      )
      await new Promise(r => setTimeout(r, delayMs))
    }
  }
}

// ── Main runner ───────────────────────────────────────────────────────────────

export async function runWithTools({ systemPrompt, tools, userMessage, history = [], db, emit = () => {} }) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set')

  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

  const model = client.getGenerativeModel({
    model:             process.env.AGENT_MODEL || 'gemini-2.5-flash',
    systemInstruction: systemPrompt,
    tools: [{ functionDeclarations: tools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })) }]
  })

  const geminiHistory = history.map(h => ({
    role:  h.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: h.content }]
  }))

  const chat    = model.startChat({ history: geminiHistory })
  let   message = userMessage
  let   turn    = 0

  while (turn < MAX_TOOL_TURNS) {
    emit('step', { type: 'thinking', turn, message: turn === 0 ? 'Analysing request...' : 'Processing tool results...' })

    // ← 429-aware wrapper around every sendMessage call
    const result = await geminiWithRetry(
      () => chat.sendMessage(message),
      `turn-${turn}`
    )

    const parts     = result.response.candidates?.[0]?.content?.parts ?? []
    const toolCalls = parts.filter(p => p.functionCall)

    if (!toolCalls.length) {
      return parts.find(p => p.text)?.text || ''
    }

    const responses = []
    for (const part of toolCalls) {
      const { name, args } = part.functionCall
      const tool = tools.find(t => t.name === name)
      emit('step', { type: 'tool_call', tool: name, args })
      logger.info({ tool: name, args }, 'Agent tool call')
      let toolResult
      try {
        if (!tool) throw new Error(`Unknown tool: ${name}`)
        toolResult = await tool.execute(args, db)
        emit('step', { type: 'tool_result', tool: name, result: toolResult })
      } catch (err) {
        toolResult = { error: err.message }
        emit('step', { type: 'tool_error', tool: name, error: err.message })
        logger.error({ tool: name, error: err.message }, 'Tool execution failed')
      }
      responses.push({ functionResponse: { name, response: toolResult } })
    }

    message = responses
    turn++
  }

  return 'Maximum reasoning steps reached.'
}
