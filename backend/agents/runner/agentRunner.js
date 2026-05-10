// agentRunner.js — Core agent lifecycle
// Phase 4 / Phase 6: Technical Foundation + AI Memory Design
// Phase 10: validateStructuredVerdict() exported for integration tests and spawn route
// Phase 11: Multi-turn conversation history — agents now maintain context across messages.
//
// KEY CHANGES in Phase 11:
//   - callGemini / callOpenAI now accept a `history` array of {role, content} messages.
//     The history is passed to the model so follow-up questions resolve correctly.
//   - runAgent() accepts an optional `history` param (from sessionStore).
//   - VERDICT / internal scaffold lines are STRIPPED from the response sent to the user.
//     They are still extracted for backend logging/routing but never shown in the UI.
//   - generateText() remains the single abstraction point — both providers handle history.
//
// Memory update protocol (unchanged):
//   MEMORY_UPDATE:\n...\nEND_MEMORY — extracted, persisted, stripped from display.

import { readFile }              from 'fs/promises'
import { resolve, dirname }      from 'path'
import { fileURLToPath }         from 'url'
import { readMemory, writeMemorySnapshot } from './agentMemory.js'
import logger                    from '../../logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)

// ── Provider abstraction ──────────────────────────────────────────────────────
const AGENT_PROVIDER = (process.env.AGENT_PROVIDER || 'gemini').toLowerCase()

let _geminiClient = null
let _openaiClient = null

/**
 * callGemini — Phase 11: uses startChat() with history so the model has full
 * conversation context. history = [{role:'user'|'assistant', content:'...'}]
 * Gemini uses role 'model' for assistant turns.
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

    // Map history to Gemini's expected format
    const geminiHistory = history.map(h => ({
        role:  h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
    }))

    const chat   = model.startChat({ history: geminiHistory })
    const result = await chat.sendMessage(query)
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

    // Build full messages array: system + history + current query
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

/**
 * stripInternalScaffolding — Phase 11: removes all internal agent markup
 * that is meant for the backend only and should never be shown to users.
 *
 * Strips:
 *   - VERDICT: ... lines
 *   - RETAILER SIGNAL / PROCUREMENT VERDICT / PRICING VERDICT / SALES SIGNAL / WAREHOUSE VERDICT lines
 *   - "Invoking: AgentName" lines
 *   - "To AgentName: ..." delegation headers
 *   - "AgentName Output:" section headers
 *   - Triple-backtick json blocks that are raw structured output (not code examples)
 *   - Confidence: HIGH/MEDIUM/LOW suffixes on verdict lines
 *   - Leading/trailing whitespace
 */
function stripInternalScaffolding(text) {
    return text
        // Remove verdict/signal lines entirely
        .replace(/^(VERDICT|RETAILER SIGNAL|PROCUREMENT VERDICT|PRICING VERDICT|RETRIEVAL|WAREHOUSE VERDICT|SALES SIGNAL)[^\n]*/gm, '')
        // Remove "Invoking: XAgent" lines
        .replace(/^Invoking:\s*.+$/gm, '')
        // Remove "To XAgent:" delegation headers
        .replace(/^To \w+Agent?:\s*/gm, '')
        // Remove "XAgent Output:" section headers
        .replace(/^\w+(?:Agent|Manager)?\s+Output:\s*/gm, '')
        // Remove raw JSON blocks (triple backtick json) — these are internal structured output
        .replace(/```json[\s\S]*?```/g, '')
        // Remove Confidence: HIGH/MEDIUM/LOW trailing annotations
        .replace(/\|\s*Confidence:\s*(HIGH|MEDIUM|LOW)/gi, '')
        // Collapse multiple blank lines into one
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

/**
 * runAgent({ agentName, query, context?, username?, history? })
 *
 * Phase 11 additions:
 *   - `history` param: [{role:'user'|'assistant', content:'...'}]
 *     Passed directly to the LLM so prior turns are in context.
 *   - Response is cleaned with stripInternalScaffolding() before returning,
 *     so VERDICT / Invoking / Output: lines are never visible to end users.
 *
 * Full lifecycle:
 * 1. Load agent definition
 * 2. Load long-term memory (project/user scope)
 * 3. Build system prompt = definition + memory + context
 * 4. Call LLM with history + current query
 * 5. Extract VERDICT (for backend routing only)
 * 6. Extract & persist MEMORY_UPDATE
 * 7. Strip all internal scaffolding from display response
 * 8. Return structured result
 */
export async function runAgent({ agentName, query, context = '', username = 'system', history = [] }) {
    const start = Date.now()
    logger.debug({ agentName, username, historyLen: history.length }, 'Agent run started')

    const agent  = await loadAgentDefinition(agentName)
    const memory = await readMemory(agent.memoryScope, agentName, username)

    const fullSystemPrompt = [
        agent.systemPrompt,
        memory  ? `\n\n## Agent Memory\n${memory}`   : '',
        context ? `\n\n## Live Context\n${context}`  : '',
        // Remind the agent it is in a multi-turn conversation
        history.length > 0
            ? `\n\n## Conversation\nYou are mid-conversation. The message history above is your prior context. Answer follow-up questions naturally without re-introducing yourself.`
            : '',
    ].join('')

    // Phase 11: pass history to LLM
    const rawResponse = await generateText(agent.model, fullSystemPrompt, query, history)

    // Extract VERDICT for backend use (not shown to user)
    const verdict = extractVerdict(rawResponse)

    // Extract and persist long-term memory updates
    const { memoryContent, cleanResponse: afterMemoryStrip } = extractMemoryUpdate(rawResponse)
    if (memoryContent) {
        await writeMemorySnapshot(agent.memoryScope, agentName, username, memoryContent)
        logger.debug({ agentName, scope: agent.memoryScope }, 'Memory snapshot written')
    }

    // Phase 11: strip all internal scaffolding — clean response is what the user sees
    const displayResponse = stripInternalScaffolding(afterMemoryStrip)

    const durationMs = Date.now() - start
    logger.info({ agentName, durationMs, model: agent.model, provider: AGENT_PROVIDER, verdict }, 'Agent run complete')

    return {
        agentName,
        verdict,
        fullResponse: displayResponse,   // clean, user-facing
        rawResponse,                     // unstripped, for internal/debug use
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
