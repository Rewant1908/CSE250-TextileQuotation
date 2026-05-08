// cache.js — Redis client for KT Impex
// Uses ioredis. Graceful fallback: if Redis is unavailable,
// CACHE_ENABLED is treated as false and all operations are no-ops.
// This means the server never crashes due to Redis being down.

import Redis from 'ioredis'

const CACHE_ENABLED = process.env.CACHE_ENABLED !== 'false'
const REDIS_URL     = process.env.REDIS_URL || 'redis://127.0.0.1:6379'

let client = null
let ready  = false

if (CACHE_ENABLED) {
    client = new Redis(REDIS_URL, {
        lazyConnect:          true,
        enableOfflineQueue:   false,
        maxRetriesPerRequest: 1,
        retryStrategy:        (times) => {
            // Stop retrying after 3 attempts — don't spam logs
            if (times > 3) return null
            return Math.min(times * 200, 1000)
        },
    })

    client.on('ready', () => {
        ready = true
        console.log('[cache] Redis connected')
    })

    client.on('error', (err) => {
        ready = false
        // Only log once per disconnect, not every retry
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
            console.warn(`[cache] Redis unavailable (${err.code}) — caching disabled until reconnected`)
        }
    })

    client.on('reconnecting', () => {
        console.log('[cache] Redis reconnecting...')
    })

    // Attempt initial connection (non-blocking)
    client.connect().catch(() => {})
}

/**
 * get(key) — returns parsed value or null
 */
export async function get(key) {
    if (!ready || !client) return null
    try {
        const raw = await client.get(key)
        return raw ? JSON.parse(raw) : null
    } catch {
        return null
    }
}

/**
 * set(key, value, ttlSeconds) — stores JSON-serialized value
 */
export async function set(key, value, ttlSeconds = 60) {
    if (!ready || !client) return
    try {
        await client.set(key, JSON.stringify(value), 'EX', ttlSeconds)
    } catch {
        // Silent — caching is best-effort
    }
}

/**
 * del(...keys) — deletes one or more cache keys
 */
export async function del(...keys) {
    if (!ready || !client || keys.length === 0) return
    try {
        await client.del(...keys)
    } catch {
        // Silent
    }
}

/**
 * flush(pattern) — deletes all keys matching a glob pattern
 * Example: flush('dashboard:*')
 * Uses SCAN to avoid blocking the Redis server.
 */
export async function flush(pattern) {
    if (!ready || !client) return
    try {
        let cursor = '0'
        do {
            const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
            cursor = nextCursor
            if (keys.length > 0) await client.del(...keys)
        } while (cursor !== '0')
    } catch {
        // Silent
    }
}

export const isReady = () => ready
