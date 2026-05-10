// backend/agents/runner/toolRunner.js
// Universal function-calling loop — works with Groq, Qwen, OpenAI, OpenRouter.
// Set AGENT_PROVIDER=openai + OPENAI_BASE_URL in .env to switch providers.
//
// Groq example:
//   AGENT_PROVIDER=openai
//   OPENAI_API_KEY=gsk_...
//   OPENAI_BASE_URL=https://api.groq.com/openai/v1
//   AGENT_MODEL=llama-3.3-70b-versatile
//
// Gemini (default, unchanged):
//   AGENT_PROVIDER=gemini
//   GEMINI_API_KEY=...
//   AGENT_MODEL=gemini-2.0-flash

import logger from '../../logger.js'

const MAX_TOOL_TURNS = 10
const MAX_RETRIES    = 3

// ── Retry helper ─────────────────────────────────────────────────────

function parseRetryDelay(err, attempt) {
  const fallbacks = [60_000, 120_000, 300_000]
  try {
    const match = err?.message?.match(/retry in ([\d.]+)s/i)
    if (match) return Math.ceil(parseFloat(match[1]) * 1000) + 2000
  } catch (_) {}
  return fallbacks[Math.min(attempt, fallbacks.length - 1)]
}

async function withRetry(fn, label = 'api call') {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const is429 = err?.status === 429
                 || err?.message?.includes('429')
                 || err?.message?.includes('Too Many Requests')
                 || err?.message?.includes('quota')
                 || err?.message?.includes('rate_limit')

      if (!is429 || attempt === MAX_RETRIES) {
        if (is429) {
          throw new Error(
            `API quota exhausted after ${MAX_RETRIES} retries. ` +
            `Check your plan limits and try again later.`
          )
        }
        throw err
      }

      const delayMs = parseRetryDelay(err, attempt)
      logger.warn(
        { label, attempt, delayMs, error: err.message },
        `[429] Rate-limited — retrying in ${Math.round(delayMs / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES})`
      )
      await new Promise(r => setTimeout(r, delayMs))
    }
  }
}

// ── Gemini function-calling loop ────────────────────────────────────────

async function runWithToolsGemini({ systemPrompt, tools, userMessage, history, db, emit }) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

  const model = client.getGenerativeModel({
    model:             process.env.AGENT_MODEL || 'gemini-2.0-flash',
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

    const result    = await withRetry(() => chat.sendMessage(message), `gemini-turn-${turn}`)
    const parts     = result.response.candidates?.[0]?.content?.parts ?? []
    const toolCalls = parts.filter(p => p.functionCall)

    if (!toolCalls.length) return parts.find(p => p.text)?.text || ''

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

// ── OpenAI-compatible function-calling loop (Groq / Qwen / OpenRouter) ──────

async function runWithToolsOpenAI({ systemPrompt, tools, userMessage, history, db, emit }) {
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({
    apiKey:  process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  })

  // Build OpenAI tool schema from our internal tool definitions
  const openaiTools = tools.map(t => ({
    type: 'function',
    function: {
      name:        t.name,
      description: t.description,
      parameters:  t.parameters,
    }
  }))

  // Build messages array: system + history + current message
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(h => ({
      role:    h.role === 'assistant' ? 'assistant' : 'user',
      content: h.content
    })),
    { role: 'user', content: userMessage }
  ]

  let turn = 0

  while (turn < MAX_TOOL_TURNS) {
    emit('step', { type: 'thinking', turn, message: turn === 0 ? 'Analysing request...' : 'Processing tool results...' })

    const response = await withRetry(() =>
      client.chat.completions.create({
        model:      process.env.AGENT_MODEL || 'llama-3.3-70b-versatile',
        messages,
        tools:      openaiTools,
        tool_choice: 'auto',
      }),
      `openai-turn-${turn}`
    )

    const choice    = response.choices[0]
    const msg       = choice.message
    const toolCalls = msg.tool_calls ?? []

    // No tool calls — final answer
    if (!toolCalls.length || choice.finish_reason === 'stop') {
      return msg.content || ''
    }

    // Append the assistant's tool-call message to history
    messages.push(msg)

    // Execute each tool and append results
    for (const tc of toolCalls) {
      const name = tc.function.name
      let   args
      try { args = JSON.parse(tc.function.arguments) } catch (_) { args = {} }

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

      messages.push({
        role:         'tool',
        tool_call_id: tc.id,
        content:      JSON.stringify(toolResult),
      })
    }

    turn++
  }

  return 'Maximum reasoning steps reached.'
}

// ── Unified entry point ──────────────────────────────────────────────────────

export async function runWithTools(opts) {
  const provider = (process.env.AGENT_PROVIDER || 'gemini').toLowerCase()

  if (provider === 'openai') {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set')
    return runWithToolsOpenAI({ ...opts, history: opts.history ?? [] })
  }

  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set')
  return runWithToolsGemini({ ...opts, history: opts.history ?? [] })
}
