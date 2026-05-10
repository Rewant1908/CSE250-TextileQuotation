// backend/routes/agentChat.js
// SSE-streaming endpoint: POST /api/agents/chat
// Streams step events live, sends 'done' event with final response.

import express                    from 'express'
import { runCoordinator }         from '../agents/runner/coordinatorRunner.js'
import { runWithTools }           from '../agents/runner/toolRunner.js'
import { AGENT_TOOL_REGISTRY }    from '../agents/runner/agentRegistry.js'
import { getSession, saveSession } from '../agents/runner/sessionStore.js'
import { readFile }                from 'fs/promises'
import { resolve, dirname }        from 'path'
import { fileURLToPath }           from 'url'
import db                          from '../db.js'
import logger                      from '../logger.js'
import { authenticateToken }       from '../middleware/auth.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)
const router = express.Router()

router.post('/', authenticateToken, async (req, res) => {
  const { session: sessionId, agent = 'coordinator', message, history = [] } = req.body
  if (!message?.trim()) return res.status(400).json({ error: 'message is required' })

  res.setHeader('Content-Type',  'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection',    'keep-alive')
  res.flushHeaders()

  const emit = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

  try {
    const stored = await getSession(sessionId)
    const fullHistory = history.length > 0 ? history : (stored?.history || [])
    let finalResponse

    if (agent === 'coordinator') {
      finalResponse = await runCoordinator({
        query: message, history: fullHistory, db,
        sessionId: sessionId || req.user?.username || 'anon', emit
      })
    } else {
      const tools = AGENT_TOOL_REGISTRY[agent]
      if (!tools) { emit('error', { message: `Unknown agent: ${agent}` }); return res.end() }
      const agentMdPath = resolve(__dirname, `../agents/${agent}.agent.md`)
      let systemPrompt = `You are the ${agent} specialist for KT Impex textile. Use your tools only.`
      try {
        const raw = await readFile(agentMdPath, 'utf-8')
        const m = raw.match(/^---[\s\S]*?---\n([\s\S]*)$/)
        if (m) systemPrompt = m[1].trim()
      } catch (_) {}
      finalResponse = await runWithTools({ systemPrompt, tools, userMessage: message, history: fullHistory, db, emit })
    }

    await saveSession(sessionId, [
      ...fullHistory,
      { role: 'user',      content: message       },
      { role: 'assistant', content: finalResponse }
    ])

    emit('done', { response: finalResponse })
    res.end()
  } catch (err) {
    logger.error({ err }, 'Agent chat route error')
    emit('error', { message: err.message })
    res.end()
  }
})

export default router
