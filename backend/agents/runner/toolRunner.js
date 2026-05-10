// backend/agents/runner/toolRunner.js
// Real Gemini function-calling loop — calls tools against the DB and loops until done.

import logger from '../../logger.js'

const MAX_TOOL_TURNS = 10

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

    const result    = await chat.sendMessage(message)
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
