// agentRunner.js — Core agent lifecycle
// Phase 4 / Phase 6: Technical Foundation + AI Memory Design
//
// Memory update protocol:
//   Agent response MAY contain a block delimited by:
//     MEMORY_UPDATE:
//     ...new memory content...
//     END_MEMORY
//   This block is extracted, stripped from the display response, and persisted
//   via writeMemorySnapshot(). Using END_MEMORY prevents the greedy regex
//   from truncating multi-paragraph memory updates.
//
// Issue 2 fix: spawnAgent() implemented — coordinator can now programmatically
//   delegate to sub-agents at runtime. Exported for use in agents.js route.
//
// Issue 3 fix: provider abstraction layer.
//   Set AGENT_PROVIDER=openai in .env to switch to OpenAI-compatible API.
//   Defaults to 'gemini'. OPENAI_API_KEY + OPENAI_BASE_URL are used for OpenAI.
//   All .agent.md model strings are passed through as-is to the chosen provider.
//
// Issue 4 fix: allowedAgentTypes parsed from frontmatter and enforced in spawnAgent().
//   Coordinator cannot spawn an agent not listed in its allowedAgentTypes.

import { readFile } from 'fs/promises'
import { resolve }  from 'path'
import { readMemory, writeMemorySnapshot } from './agentMemory.js'

// ── Provider abstraction ─────────────────────────────────────────────────────
// Issue 3: switch provider via AGENT_PROVIDER env var ('gemini' or 'openai').
// Both providers expose an identical async generateText(model, systemPrompt, query) interface.

const AGENT_PROVIDER = (process.env.AGENT_PROVIDER || 'gemini').toLowerCase()

let _geminiClient = null
let _openaiClient = null

function getGeminiClient() {
    if (!_geminiClient) {
        const { GoogleGenerativeAI } = await import('@google/generative-ai').catch(() => {
            throw new Error('Missing dependency: @google/generative-ai. Run: npm install @google/generative-ai')
        })
        _geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    }
    return _geminiClient
}

// Issue 3: top-level await not available in CommonJS; use dynamic require pattern.
// Provider clients are initialised lazily on first call.
async function callGemini(modelName, systemPrompt, query) {
    if (!process.env.GEMINI_API_KEY)
        throw new Error('GEMINI_API_KEY not set. Add it to your .env file.')
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    if (!_geminiClient) _geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = _geminiClient.getGenerativeModel({
        model:             modelName,
        systemInstruction: systemPrompt,
    })
    const result = await model.generateContent(query)
    return result.response.text()
}

async function callOpenAI(modelName, systemPrompt, query) {
    if (!process.env.OPENAI_API_KEY)
        throw new Error('OPENAI_API_KEY not set. Add it to your .env file.')
    const OpenAI = (await import('openai')).default
    if (!_openaiClient) {
        _openaiClient = new OpenAI({
            apiKey:  process.env.OPENAI_API_KEY,
            baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        })
    }
    const resp = await _openaiClient.chat.completions.create({
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: query },
        ],
    })
    return resp.choices[0].message.content
}

/**
 * generateText — unified provider interface.
 * Routes to Gemini or OpenAI based on AGENT_PROVIDER env var.
 */
async function generateText(modelName, systemPrompt, query) {
    if (AGENT_PROVIDER === 'openai') return callOpenAI(modelName, systemPrompt, query)
    return callGemini(modelName, systemPrompt, query)
}

// ── Agent definition loader ──────────────────────────────────────────────────

const AGENTS_DIR = resolve(import.meta.dirname, '..')

/**
 * Load and parse an agent .md file.
 * Frontmatter is a YAML-like block at the top between --- markers.
 * Issue 4: also parses allowedAgentTypes (multi-line YAML list).
 * Returns { name, model, maxTurns, memoryScope, allowedAgentTypes, systemPrompt }
 */
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
            // Issue 4: parse multi-line allowedAgentTypes YAML list
            if (line.trim() === 'allowedAgentTypes:') {
                inAllowedAgentTypes = true
                continue
            }
            if (inAllowedAgentTypes) {
                const listMatch = line.match(/^\s+-\s+(.+)$/)
                if (listMatch) {
                    allowedAgentTypes.push(listMatch[1].trim())
                    continue
                } else {
                    inAllowedAgentTypes = false
                }
            }

            const [key, ...rest] = line.split(':')
            if (key && rest.length && !inAllowedAgentTypes) {
                meta[key.trim()] = rest.join(':').trim()
            }
        }

        systemPrompt = fmMatch[2].trim()
    }

    return {
        name:              meta.name        || agentName,
        model:             meta.model       || process.env.AGENT_MODEL || 'gemini-2.0-flash',
        maxTurns:          parseInt(meta.maxTurns || '3', 10),
        memoryScope:       meta.memoryScope || meta['memory'] || 'project',
        allowedAgentTypes, // Issue 4: passed through to spawnAgent guard
        systemPrompt,
    }
}

// ── Response parsers ─────────────────────────────────────────────────────────

function extractMemoryUpdate(responseText) {
    const match = responseText.match(/MEMORY_UPDATE:\s*([\s\S]*?)\s*END_MEMORY/)
    if (!match) return { memoryContent: null, cleanResponse: responseText }
    const memoryContent = match[1].trim()
    const cleanResponse = responseText
        .replace(/MEMORY_UPDATE:[\s\S]*?END_MEMORY/g, '')
        .trim()
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

// ── Core runner ──────────────────────────────────────────────────────────────

/**
 * runAgent(agentName, query, context?, username?)
 *
 * Full lifecycle:
 * 1. Load agent definition (.agent.md frontmatter + system prompt)
 * 2. Load memory for scope (Redis-cached, falls back to disk)
 * 3. Build full system prompt = definition + memory + context
 * 4. Call AI provider (Gemini or OpenAI via generateText abstraction)
 * 5. Extract VERDICT block
 * 6. Extract and persist MEMORY_UPDATE...END_MEMORY block if present
 * 7. Return structured result
 */
export async function runAgent({ agentName, query, context = '', username = 'system' }) {
    const start = Date.now()

    const agent = await loadAgentDefinition(agentName)
    const memory = await readMemory(agent.memoryScope, agentName, username)

    const fullSystemPrompt = [
        agent.systemPrompt,
        memory  ? `\n\n## Agent Memory\n${memory}`   : '',
        context ? `\n\n## Query Context\n${context}` : '',
    ].join('')

    // Issue 3: use provider abstraction instead of direct Gemini call
    const rawResponse = await generateText(agent.model, fullSystemPrompt, query)

    const verdict = extractVerdict(rawResponse)
    const { memoryContent, cleanResponse } = extractMemoryUpdate(rawResponse)
    if (memoryContent) {
        await writeMemorySnapshot(agent.memoryScope, agentName, username, memoryContent)
    }

    return {
        agentName,
        verdict,
        fullResponse: cleanResponse,
        durationMs:  Date.now() - start,
        model:       agent.model,
        provider:    AGENT_PROVIDER,
    }
}

// ── Issue 2: spawnAgent ───────────────────────────────────────────────────────

/**
 * spawnAgent({ callerAgentName, targetAgentName, query, context, username })
 *
 * Programmatic agent delegation. Called by the coordinator route or any agent
 * that needs to delegate to a specialist at runtime.
 *
 * Guards:
 * - Issue 4: if the calling agent has an allowedAgentTypes list, targetAgentName
 *   must appear in it (matched case-insensitively against both raw name and
 *   the PascalCase "AgentName" pattern used in coordinator.agent.md).
 * - Anti-recursion: a fork child (_FORK_CHILD=true) cannot call spawnAgent.
 *
 * Returns the same structured result as runAgent.
 */
export async function spawnAgent({
    callerAgentName,
    targetAgentName,
    query,
    context = '',
    username = 'system',
}) {
    // Anti-recursion guard (same as forkRunner)
    if (process.env._FORK_CHILD === 'true') {
        throw new Error('Fork children cannot spawn further agents.')
    }

    // Issue 4: enforce allowedAgentTypes if defined on caller
    if (callerAgentName) {
        const caller = await loadAgentDefinition(callerAgentName)
        if (caller.allowedAgentTypes && caller.allowedAgentTypes.length > 0) {
            // allowedAgentTypes in .md are PascalCase e.g. "InventoryAgent"
            // targetAgentName in code is lowercase e.g. "inventory"
            // normalise both to lowercase for comparison
            const allowed = caller.allowedAgentTypes.map(a =>
                a.toLowerCase().replace(/agent$/, '')
            )
            const target = targetAgentName.toLowerCase().replace(/agent$/, '')
            if (!allowed.includes(target)) {
                throw new Error(
                    `Agent '${callerAgentName}' is not permitted to spawn '${targetAgentName}'. ` +
                    `Allowed: ${caller.allowedAgentTypes.join(', ')}`
                )
            }
        }
    }

    return runAgent({ agentName: targetAgentName, query, context, username })
}
