// backend/agents/runner/coordinatorRunner.js
// Real coordinator: routes to specialists OR executes action tools directly.
// Streams every step via SSE.

import { readFile }         from 'fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath }    from 'url'
import { runWithTools }     from './toolRunner.js'
import { ALL_ACTION_TOOLS, AGENT_TOOL_REGISTRY } from './agentRegistry.js'
import { readMemory }       from './agentMemory.js'
import logger               from '../../logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)

function buildInvokeSpecialistTool(db, emit) {
  return {
    name: 'invoke_specialist_agent',
    description: 'Delegate a sub-task to a specialist agent. Specialists: inventory, sales, quotation, product, retailer, warehouse.',
    parameters: {
      type: 'object',
      properties: {
        specialist: { type: 'string', enum: ['inventory','sales','quotation','product','retailer','warehouse'] },
        task:       { type: 'string', description: 'Exact task for the specialist.' }
      },
      required: ['specialist', 'task']
    },
    execute: async ({ specialist, task }) => {
      const tools = AGENT_TOOL_REGISTRY[specialist]
      if (!tools) return { error: `Unknown specialist: ${specialist}` }
      emit('step', { type: 'spawn', agent: specialist, task, message: `Spawning ${specialist} specialist...` })
      const agentMdPath = resolve(__dirname, `../${specialist}.agent.md`)
      let agentPrompt = `You are the ${specialist} specialist for KT Impex. Use only your tools.`
      try {
        const raw = await readFile(agentMdPath, 'utf-8')
        const m = raw.match(/^---[\s\S]*?---\n([\s\S]*)$/)
        if (m) agentPrompt = m[1].trim()
      } catch (_) {}
      const result = await runWithTools({
        systemPrompt: agentPrompt, tools,
        userMessage: task, history: [], db,
        emit: (event, data) => emit(event, { ...data, agent: specialist })
      })
      emit('step', { type: 'spawn_complete', agent: specialist, message: `${specialist} agent finished.` })
      return { specialist, result }
    }
  }
}

export async function runCoordinator({ query, history = [], db, sessionId = 'system', emit = () => {} }) {
  const start = Date.now()

  let systemPrompt = `You are the KT Impex AI Coordinator for a premium textile wholesale business.

You have tools to READ data and PERFORM ACTIONS:
- READ: inventory, sales, stock levels, product catalogue, retailer info
- ACTIONS: accept/reject quotations, add/update products, adjust stock, intake bales, update retailer credit

Rules:
1. Always use tools for real data — never make up numbers.
2. For multi-domain tasks, use invoke_specialist_agent to delegate.
3. For single-domain tasks, call the relevant tool directly.
4. When performing an action, confirm by fetching current state first.
5. If the user says "accept quotation 5", call accept_quotation with request_id=5 immediately.
6. Be decisive. Complete the task, then report clearly.`

  try {
    const agentMdPath = resolve(__dirname, '../coordinator.agent.md')
    const raw = await readFile(agentMdPath, 'utf-8')
    const m = raw.match(/^---[\s\S]*?---\n([\s\S]*)$/)
    if (m) systemPrompt = m[1].trim()
  } catch (_) {}

  const memory = await readMemory('project', 'coordinator', sessionId).catch(() => '')
  if (memory) systemPrompt += `\n\n## Business Memory\n${memory}`

  const coordinatorTools = [...ALL_ACTION_TOOLS, buildInvokeSpecialistTool(db, emit)]

  emit('step', { type: 'coordinator_start', message: 'Coordinator agent started' })

  const response = await runWithTools({
    systemPrompt,
    tools:       coordinatorTools,
    userMessage: query,
    history,
    db,
    emit
  })

  logger.info({ sessionId, durationMs: Date.now() - start, query: query.slice(0,80) }, 'Coordinator run complete')
  return response
}
