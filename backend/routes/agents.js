// routes/agents.js — Express router for /api/agents/*
// Phase 4 / Phase 6: Technical Foundation + AI Memory Design
//
// POST /api/agents/query                → single agent dispatch with live DB context
// POST /api/agents/procurement          → parallel 3-agent procurement fork
// POST /api/agents/spawn                → Issue 2: programmatic agent delegation (coordinator → sub-agent)
// GET  /api/agents/memory/:scope        → read a specific agent memory file
// GET  /api/agents/memory/:scope/list   → list all memory files in scope
// PUT  /api/agents/memory/:scope        → admin: overwrite memory file  (MANAGE_SYSTEM — Issue 1 fix)
// POST /api/agents/memory/:scope/append → admin: append to memory file  (MANAGE_SYSTEM — Issue 1 fix)

import { Router }             from 'express'
import { runAgent, spawnAgent } from '../agents/runner/agentRunner.js'  // Issue 2: import spawnAgent
import { runProcurementFork } from '../agents/runner/forkRunner.js'
import { readMemory, writeMemorySnapshot, appendMemory, listMemoryFiles } from '../agents/runner/agentMemory.js'
import { buildLiveContext }   from '../agents/runner/memoryManager.js'
import { checkPermission }    from '../middleware/checkPermission.js'

const router = Router()

const VALID_AGENTS = ['inventory', 'retailer', 'procurement', 'warehouse', 'pricing', 'sales', 'coordinator']

// ---------------------------------------------------------------------------
// POST /api/agents/query — single agent dispatch with live DB context injection
// ---------------------------------------------------------------------------
router.post('/query', checkPermission('VIEW_OPERATIONS'), async (req, res) => {
    const { agent, query, context } = req.body

    if (!agent || !query)
        return res.status(400).json({ error: 'agent and query are required' })
    if (!VALID_AGENTS.includes(agent))
        return res.status(400).json({ error: `Unknown agent. Valid: ${VALID_AGENTS.join(', ')}` })
    if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY)
        return res.status(503).json({ error: 'No AI API key configured. Set GEMINI_API_KEY or OPENAI_API_KEY.' })

    try {
        const db = req.app.locals.db
        const liveContext = db ? await buildLiveContext(agent, db) : ''
        const mergedContext = [liveContext, context || ''].filter(Boolean).join('\n\n---\n\n')

        const result = await runAgent({
            agentName: agent,
            query,
            context:  mergedContext,
            username: req.user?.username || 'system',
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
        console.error('[agentRoute] query error:', err.message)
        res.status(500).json({ error: err.message })
    }
})

// ---------------------------------------------------------------------------
// POST /api/agents/procurement — parallel 3-agent fork
// ---------------------------------------------------------------------------
router.post('/procurement', checkPermission('VIEW_OPERATIONS'), async (req, res) => {
    const { context } = req.body

    if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY)
        return res.status(503).json({ error: 'No AI API key configured. Set GEMINI_API_KEY or OPENAI_API_KEY.' })

    try {
        const result = await runProcurementFork({
            context:  context || '',
            username: req.user?.username || 'system',
        })
        res.json(result)
    } catch (err) {
        console.error('[agentRoute] procurement fork error:', err.message)
        res.status(500).json({ error: err.message })
    }
})

// ---------------------------------------------------------------------------
// POST /api/agents/spawn — Issue 2: programmatic agent delegation
// Coordinator or any caller spawns a specialist sub-agent at runtime.
// Issue 4: allowedAgentTypes from callerAgent frontmatter is enforced.
// ---------------------------------------------------------------------------
router.post('/spawn', checkPermission('USE_AGENTS'), async (req, res) => {
    const { callerAgent, targetAgent, query, context } = req.body

    if (!targetAgent || !query)
        return res.status(400).json({ error: 'targetAgent and query are required' })
    if (!VALID_AGENTS.includes(targetAgent))
        return res.status(400).json({ error: `Unknown targetAgent. Valid: ${VALID_AGENTS.join(', ')}` })
    if (callerAgent && !VALID_AGENTS.includes(callerAgent))
        return res.status(400).json({ error: `Unknown callerAgent. Valid: ${VALID_AGENTS.join(', ')}` })
    if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY)
        return res.status(503).json({ error: 'No AI API key configured. Set GEMINI_API_KEY or OPENAI_API_KEY.' })

    try {
        const db = req.app.locals.db
        const liveContext = db ? await buildLiveContext(targetAgent, db) : ''
        const mergedContext = [liveContext, context || ''].filter(Boolean).join('\n\n---\n\n')

        const result = await spawnAgent({
            callerAgentName: callerAgent || null,
            targetAgentName: targetAgent,
            query,
            context:  mergedContext,
            username: req.user?.username || 'system',
        })

        res.json({
            caller:      callerAgent || 'direct',
            agent:       result.agentName,
            agentName:   result.agentName,
            response:    result.fullResponse,
            verdict:     result.verdict,
            durationMs:  result.durationMs,
            model:       result.model,
            provider:    result.provider,
        })
    } catch (err) {
        // allowedAgentTypes violations come through as errors here
        const status = err.message.includes('not permitted') ? 403 : 500
        console.error('[agentRoute] spawn error:', err.message)
        res.status(status).json({ error: err.message })
    }
})

// ---------------------------------------------------------------------------
// GET /api/agents/memory/:scope — read a specific agent memory file
// ---------------------------------------------------------------------------
router.get('/memory/:scope', checkPermission('VIEW_OPERATIONS'), async (req, res) => {
    const { scope } = req.params
    const { agent = 'inventory' } = req.query

    if (!['project', 'user', 'local'].includes(scope))
        return res.status(400).json({ error: 'scope must be project, user, or local' })
    if (!VALID_AGENTS.includes(agent))
        return res.status(400).json({ error: `Unknown agent. Valid: ${VALID_AGENTS.join(', ')}` })

    try {
        const content = await readMemory(scope, agent, req.user?.username || 'system')
        res.json({ scope, agent, content: content || '(no memory yet)' })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ---------------------------------------------------------------------------
// GET /api/agents/memory/:scope/list — list all memory files in scope
// ---------------------------------------------------------------------------
router.get('/memory/:scope/list', checkPermission('VIEW_OPERATIONS'), async (req, res) => {
    const { scope } = req.params

    if (!['project', 'user', 'local'].includes(scope))
        return res.status(400).json({ error: 'scope must be project, user, or local' })

    try {
        const files = await listMemoryFiles(scope, req.user?.username || 'system')
        res.json({ scope, files })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ---------------------------------------------------------------------------
// PUT /api/agents/memory/:scope — admin: overwrite a memory file
// Issue 1 fix: MANAGE_SYSTEM is now defined in checkPermission.js
// ---------------------------------------------------------------------------
router.put('/memory/:scope', checkPermission('MANAGE_SYSTEM'), async (req, res) => {
    const { scope } = req.params
    const { agent, content } = req.body

    if (!['project', 'user', 'local'].includes(scope))
        return res.status(400).json({ error: 'scope must be project, user, or local' })
    if (!agent || !VALID_AGENTS.includes(agent))
        return res.status(400).json({ error: `agent required. Valid: ${VALID_AGENTS.join(', ')}` })
    if (typeof content !== 'string')
        return res.status(400).json({ error: 'content must be a string' })

    try {
        await writeMemorySnapshot(scope, agent, req.user?.username || 'system', content)
        res.json({ ok: true, scope, agent, bytesWritten: Buffer.byteLength(content, 'utf-8') })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ---------------------------------------------------------------------------
// POST /api/agents/memory/:scope/append — admin: append to a memory file
// Issue 1 fix: MANAGE_SYSTEM is now defined in checkPermission.js
// ---------------------------------------------------------------------------
router.post('/memory/:scope/append', checkPermission('MANAGE_SYSTEM'), async (req, res) => {
    const { scope } = req.params
    const { agent, content } = req.body

    if (!['project', 'user', 'local'].includes(scope))
        return res.status(400).json({ error: 'scope must be project, user, or local' })
    if (!agent || !VALID_AGENTS.includes(agent))
        return res.status(400).json({ error: `agent required. Valid: ${VALID_AGENTS.join(', ')}` })
    if (typeof content !== 'string')
        return res.status(400).json({ error: 'content must be a string' })

    try {
        await appendMemory(scope, agent, req.user?.username || 'system', content)
        res.json({ ok: true, scope, agent, appended: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

export default router
