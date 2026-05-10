// routes/agents.js — Express router for /api/agents/*
// Phase 4 / Phase 6: Technical Foundation + AI Memory Design
// Phase 11: Multi-turn conversation history via sessionStore.
//
// NEW in Phase 11:
//   POST /api/agents/chat   — stateful multi-turn endpoint (replaces raw /query for UI)
//   DELETE /api/agents/session/:sessionId — clear a session
//   GET  /api/agents/session/:sessionId  — inspect session metadata
//
// Existing endpoints (unchanged behaviour, now also thread history-aware via /spawn):
//   POST /api/agents/query          → single agent dispatch with live DB context
//   POST /api/agents/procurement    → parallel 3-agent fork
//   POST /api/agents/spawn          → programmatic agent delegation
//   GET  /api/agents/retailer/search
//   GET/PUT/POST /api/agents/memory/*
//
// Session lifecycle:
//   - Frontend sends a `sessionId` (UUID) per chat window.
//   - Backend stores history in sessionStore (in-memory, 30-min TTL).
//   - Each /chat call loads history, runs agent with it, then appends Q+A.
//   - VERDICT and internal scaffold stripped before response sent to client.
//   - Frontend can DELETE /session/:id to start a fresh conversation.

import { Router }              from 'express'
import { runAgent, spawnAgent } from '../agents/runner/agentRunner.js'
import { runProcurementFork }  from '../agents/runner/forkRunner.js'
import { readMemory, writeMemorySnapshot, appendMemory, listMemoryFiles } from '../agents/runner/agentMemory.js'
import { buildLiveContext }    from '../agents/runner/memoryManager.js'
import { checkPermission }     from '../middleware/checkPermission.js'
import { scopeGuardMiddleware } from '../middleware/scopeGuard.js'
import {
    getHistory,
    appendToSession,
    clearSession,
    sessionInfo,
}                              from '../agents/runner/sessionStore.js'
import logger                  from '../logger.js'
import { randomUUID }          from 'crypto'

const router = Router()

const VALID_AGENTS = [
    'inventory', 'retailer', 'procurement', 'warehouse',
    'pricing', 'sales', 'coordinator', 'quotation-summary',
]

// ---------------------------------------------------------------------------
// POST /api/agents/chat — Phase 11: stateful multi-turn chat
//
// Body: { agent, query, sessionId? }
//   agent     — one of VALID_AGENTS (default: 'coordinator')
//   query     — the user's message
//   sessionId — optional; if omitted, a new session is created and returned
//
// Response: { agent, response, sessionId, turns, durationMs, model, provider }
//   `response` is fully cleaned — no VERDICT, no Invoking, no JSON blocks.
// ---------------------------------------------------------------------------
router.post('/chat', checkPermission('VIEW_OPERATIONS'), async (req, res) => {
    const { query, sessionId: incomingSessionId } = req.body
    const agent     = req.body.agent || 'coordinator'
    const sessionId = incomingSessionId || randomUUID()

    if (!query?.trim())
        return res.status(400).json({ error: 'query is required' })
    if (!VALID_AGENTS.includes(agent))
        return res.status(400).json({ error: `Unknown agent. Valid: ${VALID_AGENTS.join(', ')}` })
    if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY)
        return res.status(503).json({ error: 'No AI API key configured.' })

    try {
        // 1. Load conversation history for this session
        const history = getHistory(sessionId)

        // 2. Build live DB context (inventory levels, recent sales, etc.)
        const db          = req.app.locals.db
        const liveContext = db ? await buildLiveContext(agent, db) : ''

        // 3. Run agent with full history
        const result = await runAgent({
            agentName: agent,
            query:     query.trim(),
            context:   liveContext,
            username:  req.user.username,
            history,                    // ← conversation memory
        })

        // 4. Persist this turn to session (user msg + assistant reply)
        appendToSession(sessionId, 'user',      query.trim())
        appendToSession(sessionId, 'assistant', result.fullResponse)

        // 5. Session metadata for client
        const info = sessionInfo(sessionId)

        res.json({
            agent:      result.agentName,
            response:   result.fullResponse,    // clean, no scaffolding
            sessionId,
            turns:      info?.turns ?? 0,
            durationMs: result.durationMs,
            model:      result.model,
            provider:   result.provider,
        })
    } catch (err) {
        logger.error({ err: err.message }, '[agentRoute] chat error')
        res.status(500).json({ error: err.message })
    }
})

// ---------------------------------------------------------------------------
// DELETE /api/agents/session/:sessionId — clear / reset a conversation
// ---------------------------------------------------------------------------
router.delete('/session/:sessionId', checkPermission('VIEW_OPERATIONS'), (req, res) => {
    clearSession(req.params.sessionId)
    res.json({ ok: true, cleared: req.params.sessionId })
})

// ---------------------------------------------------------------------------
// GET /api/agents/session/:sessionId — inspect session metadata
// ---------------------------------------------------------------------------
router.get('/session/:sessionId', checkPermission('VIEW_OPERATIONS'), (req, res) => {
    const info = sessionInfo(req.params.sessionId)
    if (!info) return res.status(404).json({ error: 'Session not found' })
    res.json(info)
})

// ---------------------------------------------------------------------------
// POST /api/agents/query — existing single-shot endpoint (unchanged)
// Still works for programmatic calls that don't need session continuity.
// ---------------------------------------------------------------------------
router.post('/query', checkPermission('VIEW_OPERATIONS'), async (req, res) => {
    const { agent, query, context } = req.body

    if (!agent || !query)
        return res.status(400).json({ error: 'agent and query are required' })
    if (!VALID_AGENTS.includes(agent))
        return res.status(400).json({ error: `Unknown agent. Valid: ${VALID_AGENTS.join(', ')}` })
    if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY)
        return res.status(503).json({ error: 'No AI API key configured.' })

    try {
        const db          = req.app.locals.db
        const liveContext = db ? await buildLiveContext(agent, db) : ''
        const merged      = [liveContext, context || ''].filter(Boolean).join('\n\n---\n\n')

        const result = await runAgent({
            agentName: agent,
            query,
            context:   merged,
            username:  req.user.username,
        })

        res.json({
            agent:        result.agentName,
            agentName:    result.agentName,
            response:     result.fullResponse,
            fullResponse: result.fullResponse,
            verdict:      result.verdict,
            durationMs:   result.durationMs,
            model:        result.model,
            provider:     result.provider,
        })
    } catch (err) {
        logger.error({ err: err.message }, '[agentRoute] query error')
        res.status(500).json({ error: err.message })
    }
})

// ---------------------------------------------------------------------------
// POST /api/agents/procurement — parallel 3-agent fork
// ---------------------------------------------------------------------------
router.post('/procurement', checkPermission('VIEW_OPERATIONS'), async (req, res) => {
    const { context } = req.body
    if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY)
        return res.status(503).json({ error: 'No AI API key configured.' })
    try {
        const result = await runProcurementFork({ context: context || '', username: req.user.username })
        res.json(result)
    } catch (err) {
        logger.error({ err: err.message }, '[agentRoute] procurement fork error')
        res.status(500).json({ error: err.message })
    }
})

// ---------------------------------------------------------------------------
// POST /api/agents/spawn — programmatic agent delegation
// ---------------------------------------------------------------------------
router.post('/spawn', checkPermission('USE_AGENTS'), async (req, res) => {
    const { callerAgent, targetAgent, query, context, sessionId } = req.body

    if (!targetAgent || !query)
        return res.status(400).json({ error: 'targetAgent and query are required' })
    if (!VALID_AGENTS.includes(targetAgent))
        return res.status(400).json({ error: `Unknown targetAgent. Valid: ${VALID_AGENTS.join(', ')}` })
    if (callerAgent && !VALID_AGENTS.includes(callerAgent))
        return res.status(400).json({ error: `Unknown callerAgent. Valid: ${VALID_AGENTS.join(', ')}` })
    if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY)
        return res.status(503).json({ error: 'No AI API key configured.' })

    try {
        const db          = req.app.locals.db
        const liveContext = db ? await buildLiveContext(targetAgent, db) : ''
        const merged      = [liveContext, context || ''].filter(Boolean).join('\n\n---\n\n')
        const history     = sessionId ? getHistory(sessionId) : []

        const result = await spawnAgent({
            callerAgentName: callerAgent || null,
            targetAgentName: targetAgent,
            query,
            context:  merged,
            username: req.user.username,
            history,
        })

        if (sessionId) {
            appendToSession(sessionId, 'user',      query)
            appendToSession(sessionId, 'assistant', result.fullResponse)
        }

        res.json({
            caller:     callerAgent || 'direct',
            agent:      result.agentName,
            agentName:  result.agentName,
            response:   result.fullResponse,
            verdict:    result.verdict,
            durationMs: result.durationMs,
            model:      result.model,
            provider:   result.provider,
        })
    } catch (err) {
        const status = err.message.includes('not permitted') ? 403 : 500
        logger.error({ err: err.message }, '[agentRoute] spawn error')
        res.status(status).json({ error: err.message })
    }
})

// ---------------------------------------------------------------------------
// GET /api/agents/retailer/search
// ---------------------------------------------------------------------------
router.get('/retailer/search', checkPermission('USE_AGENTS'), async (req, res) => {
    const { q, limit = '5' } = req.query
    if (!q?.trim()) return res.status(400).json({ error: 'q (query) is required' })
    try {
        const { searchRetailers } = await import('../services/embeddingService.js')
        const results = await searchRetailers(q.trim(), parseInt(limit, 10))
        res.json({ query: q, results })
    } catch (err) {
        logger.error({ err: err.message }, '[agentRoute] retailer search error')
        res.status(500).json({ error: err.message })
    }
})

// ---------------------------------------------------------------------------
// Memory endpoints (unchanged)
// ---------------------------------------------------------------------------
router.get(
    '/memory/:scope',
    checkPermission('VIEW_OPERATIONS'), scopeGuardMiddleware('READ'),
    async (req, res) => {
        const { scope } = req.params
        const { agent = 'inventory' } = req.query
        const username = req.resolvedMemoryUsername
        if (!VALID_AGENTS.includes(agent)) return res.status(400).json({ error: `Unknown agent.` })
        try {
            const content = await readMemory(scope, agent, username)
            res.json({ scope, agent, username, content: content || '(no memory yet)' })
        } catch (err) { res.status(500).json({ error: err.message }) }
    }
)

router.get(
    '/memory/:scope/list',
    checkPermission('VIEW_OPERATIONS'), scopeGuardMiddleware('READ'),
    async (req, res) => {
        const { scope } = req.params
        const username  = req.resolvedMemoryUsername
        try {
            const files = await listMemoryFiles(scope, username)
            res.json({ scope, username, files })
        } catch (err) { res.status(500).json({ error: err.message }) }
    }
)

router.put(
    '/memory/:scope',
    checkPermission('MANAGE_SYSTEM'), scopeGuardMiddleware('WRITE'),
    async (req, res) => {
        const { scope }         = req.params
        const { agent, content } = req.body
        const username          = req.resolvedMemoryUsername
        if (!agent || !VALID_AGENTS.includes(agent)) return res.status(400).json({ error: 'agent required.' })
        if (typeof content !== 'string') return res.status(400).json({ error: 'content must be a string' })
        try {
            await writeMemorySnapshot(scope, agent, username, content)
            res.json({ ok: true, scope, agent, username, bytesWritten: Buffer.byteLength(content, 'utf-8') })
        } catch (err) { res.status(500).json({ error: err.message }) }
    }
)

router.post(
    '/memory/:scope/append',
    checkPermission('MANAGE_SYSTEM'), scopeGuardMiddleware('WRITE'),
    async (req, res) => {
        const { scope }         = req.params
        const { agent, content } = req.body
        const username          = req.resolvedMemoryUsername
        if (!agent || !VALID_AGENTS.includes(agent)) return res.status(400).json({ error: 'agent required.' })
        if (typeof content !== 'string') return res.status(400).json({ error: 'content must be a string' })
        try {
            await appendMemory(scope, agent, username, content)
            res.json({ ok: true, scope, agent, username, appended: true })
        } catch (err) { res.status(500).json({ error: err.message }) }
    }
)

export default router
