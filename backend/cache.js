// cache.js — Redis client for KT Impex
// Uses ioredis. Graceful fallback: if Redis is unavailable,
// all operations are silent no-ops — the server never crashes.

import Redis from 'ioredis'

const CACHE_ENABLED = process.env.CACHE_ENABLED !== 'false'
const REDIS_URL     = process.env.REDIS_URL || 'redis://127.0.0.1:6379'

let client       = null
let ready        = false
let _loggedOnce  = false   // only print the "unavailable" line once

if (CACHE_ENABLED) {
    client = new Redis(REDIS_URL, {
        lazyConnect:          true,
        enableOfflineQueue:   false,
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
            if (times >= 3) return null   // give up silently after 3 tries
            return Math.min(times * 300, 1000)
        },
    })

    client.on('ready', () => {
        ready       = true
        _loggedOnce = false
        console.log('[cache] Redis connected')
    })

    client.on('error', (err) => {
        ready = false
        if (!_loggedOnce) {
            _loggedOnce = true
            console.warn('[cache] Redis unavailable — caching disabled (server still works normally)')
        }
    })

    // Remove 'reconnecting' listener entirely — no more spam
    client.connect().catch(() => {})
}

/** get(key) — returns parsed value or null */
export async function get(key) {
    if (!ready || !client) return null
    try {
        const raw = await client.get(key)
        return raw ? JSON.parse(raw) : null
    } catch { return null }
}

/** set(key, value, ttlSeconds) — stores JSON-serialised value */
export async function set(key, value, ttlSeconds = 60) {
    if (!ready || !client) return
    try {
        await client.set(key, JSON.stringify(value), 'EX', ttlSeconds)
    } catch {}
}

/** del(...keys) — deletes one or more cache keys */
export async function del(...keys) {
    if (!ready || !client || keys.length === 0) return
    try { await client.del(...keys) } catch {}
}

/** flush(pattern) — deletes all keys matching a glob pattern via SCAN */
export async function flush(pattern) {
    if (!ready || !client) return
    try {
        let cursor = '0'
        do {
            const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
            cursor = nextCursor
            if (keys.length > 0) await client.del(...keys)
        } while (cursor !== '0')
    } catch {}
}

export const isReady = () => ready
