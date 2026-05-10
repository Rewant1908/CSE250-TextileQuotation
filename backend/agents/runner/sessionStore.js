// sessionStore.js — In-memory conversation session store
//
// Stores per-user, per-agent chat history (short-term memory) so that
// follow-up questions work naturally without re-sending the full DB context.
//
// Structure:
//   sessions Map: sessionId → { history: [{role, content}], lastActive: Date, agentName }
//
// Sessions expire after SESSION_TTL_MS (default 30 min) of inactivity.
// A background interval sweeps expired sessions every 5 minutes.

const SESSION_TTL_MS  = 30 * 60 * 1000   // 30 minutes
const SWEEP_INTERVAL  =  5 * 60 * 1000   //  5 minutes
const MAX_HISTORY_LEN = 40               // max messages kept per session (20 turns)

const sessions = new Map()

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * getSession(sessionId) — returns existing session or creates a new one.
 */
export function getSession(sessionId) {
    if (!sessions.has(sessionId)) {
        sessions.set(sessionId, { history: [], lastActive: Date.now(), agentName: null })
    }
    const session = sessions.get(sessionId)
    session.lastActive = Date.now()
    return session
}

/**
 * appendToSession(sessionId, role, content)
 * role: 'user' | 'assistant'
 * Trims history to MAX_HISTORY_LEN (keeps most recent).
 */
export function appendToSession(sessionId, role, content) {
    const session = getSession(sessionId)
    session.history.push({ role, content })
    if (session.history.length > MAX_HISTORY_LEN) {
        // drop oldest messages but always keep the first (initial context message if any)
        session.history = session.history.slice(-MAX_HISTORY_LEN)
    }
    session.lastActive = Date.now()
}

/**
 * clearSession(sessionId) — wipes history (user started a new topic).
 */
export function clearSession(sessionId) {
    sessions.delete(sessionId)
}

/**
 * getHistory(sessionId) — returns [{role, content}] array or []
 */
export function getHistory(sessionId) {
    return sessions.get(sessionId)?.history || []
}

/**
 * sessionInfo(sessionId) — returns metadata for debugging.
 */
export function sessionInfo(sessionId) {
    const s = sessions.get(sessionId)
    if (!s) return null
    return {
        sessionId,
        agentName:   s.agentName,
        turns:       Math.floor(s.history.length / 2),
        messages:    s.history.length,
        lastActive:  new Date(s.lastActive).toISOString(),
    }
}

// ── Expiry sweep ──────────────────────────────────────────────────────────────
setInterval(() => {
    const now = Date.now()
    for (const [id, session] of sessions) {
        if (now - session.lastActive > SESSION_TTL_MS) {
            sessions.delete(id)
        }
    }
}, SWEEP_INTERVAL)
