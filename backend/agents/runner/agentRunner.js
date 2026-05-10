// agentRunner.js — Core agent lifecycle
// Phase 4 / Phase 6: Technical Foundation + AI Memory Design
// Phase 10: validateStructuredVerdict() exported for integration tests and spawn route
// Phase 11: Multi-turn conversation history — agents now maintain context across messages.
// Phase 12: 429 retry with exponential backoff — geminiWithRetry() wraps all Gemini calls.
//
// KEY CHANGES in Phase 12:
//   - geminiWithRetry() added: reads retryDelay from Google's 429 body, falls back
//     to exponential backoff (60s → 120s → 300s). Max 3 retries.
//   - Non-429 errors (400 duplicate function, 401 auth) are thrown immediately.
//   - Both callGemini() and callOpenAI() route through generateText() as before;
//     retry is applied inside callGemini() only (OpenAI has its own quota model).

import { readFile }              from 'fs/promises'
import { resolve, dirname }      from 'path'
import { fileURLToPath }         from 'url'
import { readMemory, writeMemorySnapshot } from './agentMemory.js'
import logger                    from '../../logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)

// ── Retry helper ─────────────────────────────────────────────────────────────

const MAX_RETRIES = 3

function parseRetryDelay(err, attempt) {
  const fallbacks = [60_000, 120_000, 300_000]
  try {
    const match = err?.message?.match(/retry in ([\d.]+)s/i)
    if (match) return Math.ceil(parseFloat(match[1]) * 1000) + 2000
  } catch (_) {}
  return fallbacks[Math.min(attempt, fallbacks.length - 1)]
}

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

// ── Provider abstraction ──────────────────────────────────────────────────────
const AGENT_PROVIDER = (process.env.AGENT_PROVIDER || 'gemini').toLowerCase()

let _geminiClient = null
let _openaiClient = null

/**
 * callGemini — Phase 11: uses startChat() with history so the model has full
 * conversation context. history = [{role:'user'|'assistant', content:'...'}]
 * Phase 12: all sendMessage calls go through geminiWithRetry().
 */
async function callGemini(modelName, systemPrompt, query, history = []) {
    if (!process.env.GEMINI_API_KEY)
        throw new Error('GEMINI_API_KEY not set. Add it to your .env file.')
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    if (!_geminiClient) _geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

    const model = _geminiClient.getGenerativeModel({
        model:             modelName,
        systemInstruction: systemPrompt,
    })

    const geminiHistory = history.map(h => ({
        role:  h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
    }))

    const chat = model.startChat({ history: geminiHistory })
    const result = await geminiWithRetry(
      () => chat.sendMessage(query),
      `callGemini:${modelName}`
    )
    return result.response.text()
}

/**
 * callOpenAI — Phase 11: passes full messages array including history.
 */
async function callOpenAI(modelName, systemPrompt, query, history = []) {
    if (!process.env.OPENAI_API_KEY)
        throw new Error('OPENAI_API_KEY not set. Add it to your .env file.')
    const OpenAI = (await import('openai')).default
    if (!_openaiClient) {
        _openaiClient = new OpenAI({
            apiKey:  process.env.OPENAI_API_KEY,
            baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        })
    }

    const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content })),
        { role: 'user', content: query },
    ]

    const resp = await _openaiClient.chat.completions.create({ model: modelName, messages })
    return resp.choices[0].message.content
}

async function generateText(modelName, systemPrompt, query, history = []) {
    if (AGENT_PROVIDER === 'openai') return callOpenAI(modelName, systemPrompt, query, history)
    return callGemini(modelName, systemPrompt, query, history)
}

// ── Agent definition loader ───────────────────────────────────────────────────
const AGENTS_DIR = resolve(__dirname, '..')

async function loadAgentDefinition(agentName) {
    const filePath = resolve(AGENTS_DIR, `${agentName}.agent.md`)
    const raw = await readFile(filePath, 'utf-8')

    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    let meta = {}
    let systemPrompt = raw
    let allowedAgentTypes = []

    if (fmMatch) {
        const fmLines = fmMatch[1].split('\n')
        let inAllowedAgentTypes = false

        for (const line of fmLines) {
            if (line.trim() === 'allowedAgentTypes:') { inAllowedAgentTypes = true; continue }
            if (inAllowedAgentTypes) {
                const listMatch = line.match(/^\s+-\s+(.+)$/)
                if (listMatch) { allowedAgentTypes.push(listMatch[1].trim()); continue }
                else { inAllowedAgentTypes = false }
            }
            const [key, ...rest] = line.split(':')
            if (key && rest.length && !inAllowedAgentTypes)
                meta[key.trim()] = rest.join(':').trim()
        }
        systemPrompt = fmMatch[2].trim()
    }

    return {
        name:              meta.name        || agentName,
        model:             meta.model       || process.env.AGENT_MODEL || 'gemini-2.5-flash',
        maxTurns:          parseInt(meta.maxTurns || '3', 10),
        memoryScope:       meta.memoryScope || meta['memory'] || 'project',
        allowedAgentTypes,
        systemPrompt,
    }
}

// ── Response parsers ──────────────────────────────────────────────────────────

function extractMemoryUpdate(responseText) {
    const match = responseText.match(/MEMORY_UPDATE:\s*([\s\S]*?)\s*END_MEMORY/)
    if (!match) return { memoryContent: null, cleanResponse: responseText }
    const memoryContent = match[1].trim()
    const cleanResponse = responseText.replace(/MEMORY_UPDATE:[\s\S]*?END_MEMORY/g, '').trim()
    return { memoryContent, cleanResponse }
}

function extractVerdict(responseText) {
    const patterns = [
        /^(VERDICT[^\n]*)/m,
        /^(RETAILER SIGNAL[^\n]*)/m,
        /^(PROCUREMENT VERDICT[^\n]*)/m,
        /^(PRICING VERDICT[^\n]*)/m,
        /^(RETRIEVAL[^\n]*)/m,
        /^(WAREHOUSE VERDICT[^\n]*)/m,
        /^(SALES SIGNAL[^\n]*)/m,
    ]
    for (const pattern of patterns) {
        const match = responseText.match(pattern)
        if (match) return match[1].trim()
    }
    return null
}

function stripInternalScaffolding(text) {
    return text
        .replace(/^(VERDICT|RETAILER SIGNAL|PROCUREMENT VERDICT|PRICING VERDICT|RETRIEVAL|WAREHOUSE VERDICT|SALES SIGNAL)[^\n]*/gm, '')
        .replace(/^Invoking:\s*.+$/gm, '')
        .replace(/^To \w+Agent?:\s*/gm, '')
        .replace(/^\w+(?:Agent|Manager)?\s+Output:\s*/gm, '')
        .replace(/```json[\s\S]*?```/g, '')
        .replace(/\|\s*Confidence:\s*(HIGH|MEDIUM|LOW)/gi, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

// ── Phase 10: validateStructuredVerdict ──────────────────────────────────────
export function validateStructuredVerdict(text) {
    const match = text.match(/VERDICT:\s*(BUY|HOLD|AVOID)\s+([\w\s]+?)\s*[-–—]\s*(.+)/i)
    if (!match) return { valid: false, action: null, category: null, reason: null }
    return {
        valid:    true,
        action:   match[1].toUpperCase(),
        category: match[2].trim(),
        reason:   match[3].trim(),
    }
}

// ── Core runner ───────────────────────────────────────────────────────────────

export async function runAgent({ agentName, query, context = '', username = 'system', history = [] }) {
    const start = Date.now()
    logger.debug({ agentName, username, historyLen: history.length }, 'Agent run started')

    const agent  = await loadAgentDefinition(agentName)
    const memory = await readMemory(agent.memoryScope, agentName, username)

    const fullSystemPrompt = [
        agent.systemPrompt,
        memory  ? `\n\n## Agent Memory\n${memory}`   : '',
        context ? `\n\n## Live Context\n${context}`  : '',
        history.length > 0
            ? `\n\n## Conversation\nYou are mid-conversation. The message history above is your prior context. Answer follow-up questions naturally without re-introducing yourself.`
            : '',
    ].join('')

    const rawResponse = await generateText(agent.model, fullSystemPrompt, query, history)

    const verdict = extractVerdict(rawResponse)

    const { memoryContent, cleanResponse: afterMemoryStrip } = extractMemoryUpdate(rawResponse)
    if (memoryContent) {
        await writeMemorySnapshot(agent.memoryScope, agentName, username, memoryContent)
        logger.debug({ agentName, scope: agent.memoryScope }, 'Memory snapshot written')
    }

    const displayResponse = stripInternalScaffolding(afterMemoryStrip)

    const durationMs = Date.now() - start
    logger.info({ agentName, durationMs, model: agent.model, provider: AGENT_PROVIDER, verdict }, 'Agent run complete')

    return {
        agentName,
        verdict,
        fullResponse: displayResponse,
        rawResponse,
        durationMs,
        model:    agent.model,
        provider: AGENT_PROVIDER,
    }
}

// ── spawnAgent ────────────────────────────────────────────────────────────────
export async function spawnAgent({
    callerAgentName,
    targetAgentName,
    query,
    context  = '',
    username = 'system',
    history  = [],
}) {
    if (process.env._FORK_CHILD === 'true')
        throw new Error('Fork children cannot spawn further agents.')

    if (callerAgentName) {
        const caller = await loadAgentDefinition(callerAgentName)
        if (caller.allowedAgentTypes?.length > 0) {
            const allowed = caller.allowedAgentTypes.map(a => a.toLowerCase().replace(/agent$/, ''))
            const target  = targetAgentName.toLowerCase().replace(/agent$/, '')
            if (!allowed.includes(target)) {
                logger.warn({ callerAgentName, targetAgentName, allowed }, 'spawnAgent blocked by allowedAgentTypes')
                throw new Error(
                    `Agent '${callerAgentName}' is not permitted to spawn '${targetAgentName}'. ` +
                    `Allowed: ${caller.allowedAgentTypes.join(', ')}`
                )
            }
        }
    }

    logger.info({ callerAgentName, targetAgentName }, 'spawnAgent delegating')
    return runAgent({ agentName: targetAgentName, query, context, username, history })
}
