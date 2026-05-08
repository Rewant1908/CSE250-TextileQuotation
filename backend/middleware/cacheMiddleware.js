// cacheMiddleware.js — Express middleware for route-level caching
//
// Usage:
//   import { cache, invalidate } from './middleware/cacheMiddleware.js'
//
//   // Cache a GET route for 60 seconds
//   app.get('/api/operations/dashboard', checkPermission('VIEW_OPERATIONS'), cache('dashboard', 60), handler)
//
//   // Invalidate cache keys after a write
//   app.post('/api/bales', checkPermission('MANAGE_PRODUCTS'), invalidate('dashboard', 'thans'), handler)

import { get, set, del } from '../cache.js'

/**
 * cache(key, ttlSeconds)
 * Middleware: serves cached response if available, otherwise runs the handler
 * and caches its JSON response.
 *
 * Key can include req.query values for per-query caching:
 *   cache((req) => `thans:${JSON.stringify(req.query)}`, 30)
 */
export function cache(keyOrFn, ttlSeconds = 60) {
    return async (req, res, next) => {
        const key = typeof keyOrFn === 'function' ? keyOrFn(req) : keyOrFn

        // Try cache first
        const cached = await get(key)
        if (cached !== null) {
            res.setHeader('X-Cache', 'HIT')
            return res.json(cached)
        }

        // Intercept res.json to cache the response
        const originalJson = res.json.bind(res)
        res.json = async (body) => {
            // Only cache successful responses
            if (res.statusCode >= 200 && res.statusCode < 300) {
                await set(key, body, ttlSeconds)
            }
            res.setHeader('X-Cache', 'MISS')
            return originalJson(body)
        }

        next()
    }
}

/**
 * invalidate(...keys)
 * Middleware: deletes the specified cache keys AFTER the handler runs successfully.
 * Does NOT block the request — deletion happens in the background.
 *
 * Usage: place AFTER the route handler in the middleware chain via a response hook.
 */
export function invalidate(...keys) {
    return (req, res, next) => {
        // Hook into response finish event so we only invalidate on success
        res.on('finish', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                del(...keys).catch(() => {})
            }
        })
        next()
    }
}
