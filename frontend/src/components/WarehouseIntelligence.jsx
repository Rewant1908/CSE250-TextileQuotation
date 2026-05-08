import { useCallback, useEffect, useRef, useState } from 'react'
import API from '../api'

const QUICK_QUERIES = [
    'What are the current stock levels by category?',
    'Which thans have been idle for more than 30 days?',
    'Show me low-stock items that need reordering',
    'What is in rack A and rack B right now?',
    'Find all cotton fabric available in the warehouse',
    'Which bales arrived in the last 7 days?',
    'What is the total value of warehouse inventory?',
    'List dead stock items with cost value above NPR 5000',
]

export default function WarehouseIntelligence({ user }) {
    const [messages,  setMessages]  = useState([])
    const [input,     setInput]     = useState('')
    const [loading,   setLoading]   = useState(false)
    const [stats,     setStats]     = useState(null)
    const [sessionId] = useState(() => `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
    const bottomRef   = useRef(null)
    const inputRef    = useRef(null)

    const authHeader = useCallback(
        () => ({ 'x-user-id': String(user.user_id), 'x-user-role': user.role }),
        [user.user_id, user.role]
    )

    // Load lightweight summary stats for the header panel
    useEffect(() => {
        API.get('/operations/dashboard', { headers: authHeader() })
            .then(res => {
                const s = res.data?.summary || {}
                setStats({
                    totalThans:    s.total_thans   || 0,
                    deadCount:     s.dead_than_count || 0,
                    totalValue:    Number(s.stock_cost_value || 0),
                    availMeters:   Number(s.available_meters || 0),
                })
            })
            .catch(() => {})
    }, [authHeader])

    // Auto-scroll to bottom whenever messages change
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, loading])

    const sendMessage = useCallback(async (text) => {
        const msg = (text || input).trim()
        if (!msg || loading) return

        setMessages(prev => [...prev, { role: 'user', text: msg, ts: Date.now() }])
        setInput('')
        setLoading(true)

        try {
            const res = await API.post('/agents/query',
                { agent: 'warehouse', query: msg, session_id: sessionId },
                { headers: authHeader() }
            )
            const reply = res.data?.response || res.data?.fullResponse || 'No response from warehouse agent.'
            setMessages(prev => [...prev, { role: 'agent', text: reply, ts: Date.now() }])
        } catch (err) {
            const errMsg = err?.response?.data?.error || err.message || 'Agent unavailable.'
            setMessages(prev => [...prev, { role: 'error', text: errMsg, ts: Date.now() }])
        } finally {
            setLoading(false)
            setTimeout(() => inputRef.current?.focus(), 50)
        }
    }, [input, loading, authHeader, sessionId])

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    const money  = (v) => `NPR ${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
    const fmtNum = (v) => Number(v || 0).toLocaleString('en-IN')

    return (
        <div className="ops-page">

            {/* ── Header Stats Panel ──────────────────────────────────────── */}
            <section className="card ops-hero" style={{ marginBottom: '1.5rem' }}>
                <div>
                    <p className="eyebrow">Phase 10 · Warehouse Intelligence</p>
                    <h2>Warehouse Agent</h2>
                    <p>
                        Ask natural-language questions about stock levels, bale locations,
                        idle inventory, and procurement needs. The agent reads live DB context.
                    </p>
                </div>
                {stats && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 180 }}>
                        <div className="metric-card" style={{ padding: '0.5rem 1rem' }}>
                            <span>Total Thans</span>
                            <strong>{fmtNum(stats.totalThans)}</strong>
                        </div>
                        <div className="metric-card" style={{ padding: '0.5rem 1rem' }}>
                            <span>Dead Stock</span>
                            <strong style={{ color: stats.deadCount > 0 ? 'var(--color-error, #c0392b)' : 'inherit' }}>
                                {stats.deadCount} than{stats.deadCount !== 1 ? 's' : ''}
                            </strong>
                        </div>
                        <div className="metric-card" style={{ padding: '0.5rem 1rem' }}>
                            <span>Inventory Value</span>
                            <strong>{money(stats.totalValue)}</strong>
                        </div>
                    </div>
                )}
            </section>

            {/* ── Quick Query Chips ────────────────────────────────────────── */}
            <section className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
                <p className="muted-copy" style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                    Quick queries — click to run:
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {QUICK_QUERIES.map((q, i) => (
                        <button
                            key={i}
                            className="btn btn-outline"
                            style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
                            onClick={() => sendMessage(q)}
                            disabled={loading}
                        >
                            {q}
                        </button>
                    ))}
                </div>
            </section>

            {/* ── Chat Window ─────────────────────────────────────────────── */}
            <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Chat messages */}
                <div style={{
                    minHeight: 340,
                    maxHeight: 480,
                    overflowY: 'auto',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    background: 'var(--color-surface, #faf9f7)',
                }}>
                    {messages.length === 0 && (
                        <div style={{ textAlign: 'center', color: 'var(--color-text-muted, #888)', marginTop: '3rem' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏭</div>
                            <p>Ask the warehouse agent anything about your inventory.</p>
                            <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                                Try: <em>"Which thans are running low?"</em>
                            </p>
                        </div>
                    )}

                    {messages.map((m, i) => (
                        <div key={i} style={{
                            display: 'flex',
                            justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                        }}>
                            <div style={{
                                maxWidth: '78%',
                                padding: '0.65rem 1rem',
                                borderRadius: m.role === 'user' ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
                                background: m.role === 'user'
                                    ? 'var(--color-primary, #8B1A1A)'
                                    : m.role === 'error'
                                        ? 'var(--color-error-highlight, #fde8e8)'
                                        : 'var(--color-surface-2, #f5f3ef)',
                                color: m.role === 'user'
                                    ? '#fff'
                                    : m.role === 'error'
                                        ? 'var(--color-error, #c0392b)'
                                        : 'var(--color-text, #1a1a1a)',
                                fontSize: '0.9rem',
                                lineHeight: 1.55,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
                            }}>
                                {m.role === 'agent' && (
                                    <div style={{ fontSize: '0.72rem', opacity: 0.55, marginBottom: '0.3rem', fontWeight: 600 }}>
                                        WAREHOUSE AGENT
                                    </div>
                                )}
                                {m.text}
                            </div>
                        </div>
                    ))}

                    {/* Typing indicator */}
                    {loading && (
                        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                            <div style={{
                                padding: '0.65rem 1rem',
                                borderRadius: '1rem 1rem 1rem 0.25rem',
                                background: 'var(--color-surface-2, #f5f3ef)',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
                            }}>
                                <span style={{ display: 'inline-flex', gap: 4 }}>
                                    {[0,1,2].map(j => (
                                        <span key={j} style={{
                                            width: 7, height: 7,
                                            borderRadius: '50%',
                                            background: 'var(--color-text-muted, #999)',
                                            display: 'inline-block',
                                            animation: `wh-bounce 1.2s ease-in-out ${j * 0.2}s infinite`,
                                        }} />
                                    ))}
                                </span>
                            </div>
                        </div>
                    )}

                    <div ref={bottomRef} />
                </div>

                {/* Input row */}
                <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    padding: '0.75rem 1.25rem',
                    borderTop: '1px solid var(--color-border, #e0ddd8)',
                    background: 'var(--color-bg, #fff)',
                }}>
                    <textarea
                        ref={inputRef}
                        rows={1}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={loading}
                        placeholder="Ask about stock levels, bale locations, idle inventory… (Enter to send)"
                        style={{
                            flex: 1,
                            resize: 'none',
                            borderRadius: 8,
                            border: '1px solid var(--color-border, #d4d1ca)',
                            padding: '0.6rem 0.85rem',
                            fontSize: '0.9rem',
                            fontFamily: 'inherit',
                            background: 'var(--color-surface, #faf9f7)',
                            color: 'var(--color-text, #1a1a1a)',
                            outline: 'none',
                        }}
                    />
                    <button
                        className="btn btn-primary"
                        onClick={() => sendMessage()}
                        disabled={loading || !input.trim()}
                        style={{ alignSelf: 'flex-end', minWidth: 72 }}
                    >
                        {loading ? '…' : 'Send'}
                    </button>
                </div>
            </section>

            {/* Bounce animation for typing dots */}
            <style>{`
                @keyframes wh-bounce {
                    0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
                    40%           { transform: translateY(-5px); opacity: 1; }
                }
            `}</style>
        </div>
    )
}
