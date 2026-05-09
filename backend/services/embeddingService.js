/**
 * embeddingService.js — Semantic retailer search using Gemini embeddings
 * Phase 6 Task 2
 *
 * How it works:
 *   1. Every retailer row is serialised into a short text document:
 *        "<shop_name> in <market_location>. Contact: <contact_person>.
 *         Categories: <preferred_categories>. Segment: <preferred_price_segment>.
 *         Notes: <notes>"
 *
 *   2. That document is embedded via Gemini text-embedding-004 (768-dim).
 *      Embeddings are cached in Redis (key: embed:retailer:<id>) with a 1-hour TTL
 *      so we don't re-embed on every search.
 *
 *   3. The query string is embedded on the fly (no cache — queries are unique).
 *
 *   4. Cosine similarity ranks all retailers; top-k are returned.
 *
 * Bulk re-indexing:
 *   Call rebuildRetailerIndex() manually (or via a cron) when the catalogue changes.
 *   During rebuildRetailerIndex() a simple in-memory lock prevents concurrent rebuilds.
 *
 * Redis keys:
 *   embed:retailer:<retailer_id>  → JSON array of 768 floats, TTL 1 hour
 *   embed:retailer:index          → JSON array of { retailer_id, vec } objects (full index)
 *
 * Graceful degradation:
 *   If Gemini is unavailable the function throws; the route returns 500.
 *   If Redis is unavailable, every search re-computes embeddings from the DB
 *   (slower but functional).
 *
 * Fix (Phase 6 Task 2 patch):
 *   embed() now calls the Gemini REST v1 endpoint directly instead of using the
 *   @google/generative-ai SDK. The SDK routes text-embedding-004 to v1beta which
 *   returns 404. The v1 REST endpoint works correctly.
 */

import pool    from '../db.js'
import * as cache from '../cache.js'
import logger  from '../logger.js'

const EMBEDDING_MODEL = 'text-embedding-004'     // Gemini embedding model
const EMBED_TTL       = 60 * 60                  // 1 hour in seconds
const INDEX_KEY       = 'embed:retailer:index'
const EMBED_KEY       = (id) => `embed:retailer:${id}`

let _rebuildLock  = false

// ── Gemini embedding via REST v1 ─────────────────────────────────────────────
// The @google/generative-ai SDK sends text-embedding-004 to v1beta which is
// unsupported. Calling v1 directly via fetch() fixes the 404.

async function embed(text) {
    if (!process.env.GEMINI_API_KEY)
        throw new Error('GEMINI_API_KEY not set. Cannot generate embeddings.')

    const url = `https://generativelanguage.googleapis.com/v1/models/${EMBEDDING_MODEL}:embedContent?key=${process.env.GEMINI_API_KEY}`

    const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
            model:   `models/${EMBEDDING_MODEL}`,
            content: { parts: [{ text }] },
        }),
    })

    if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Gemini embed failed: ${res.status} ${errText}`)
    }

    const json = await res.json()
    return json.embedding.values   // float[768]
}

// ── Retailer document builder ─────────────────────────────────────────────────

/**
 * retailerToDoc(row) — turns a DB row into a short searchable text document.
 * Keep it under 500 tokens — the embedding model has a 2048-token input limit
 * but shorter docs produce cleaner signal for product-preference queries.
 */
function retailerToDoc(row) {
    const parts = [
        row.shop_name,
        row.market_location ? `in ${row.market_location}` : '',
        row.contact_person  ? `Contact: ${row.contact_person}` : '',
        row.preferred_categories   ? `Categories: ${row.preferred_categories}` : '',
        row.preferred_price_segment ? `Segment: ${row.preferred_price_segment}` : '',
        row.notes ? `Notes: ${row.notes}` : '',
    ]
    return parts.filter(Boolean).join('. ')
}

// ── Cosine similarity ─────────────────────────────────────────────────────────

function cosineSimilarity(a, b) {
    let dot = 0, normA = 0, normB = 0
    for (let i = 0; i < a.length; i++) {
        dot   += a[i] * b[i]
        normA += a[i] * a[i]
        normB += b[i] * b[i]
    }
    if (normA === 0 || normB === 0) return 0
    return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

// ── Index management ─────────────────────────────────────────────────────────

/**
 * getOrBuildIndex() — returns a full in-memory index as:
 *   [{ retailer_id, shop_name, market_location, vec: float[] }, ...]
 *
 * Strategy:
 *   1. Try Redis INDEX_KEY (cached full index — fast path)
 *   2. Build from DB + per-retailer embedding cache
 *   3. Store full index in Redis for 1 hour
 */
async function getOrBuildIndex(db) {
    // Fast path: full index cached
    const cached = await cache.get(INDEX_KEY)
    if (cached) return cached

    // Fetch all active retailers
    let conn
    let rows = []
    try {
        conn = await db.getConnection()
        rows = await conn.query(
            `SELECT retailer_id, shop_name, market_location,
                    contact_person, preferred_categories,
                    preferred_price_segment, notes
             FROM retailers
             WHERE (is_deleted = 0 OR is_deleted IS NULL)`
        )
    } finally { if (conn) conn.release() }

    // Embed each retailer (cache per-row)
    const index = []
    for (const row of rows) {
        let vec = await cache.get(EMBED_KEY(row.retailer_id))
        if (!vec) {
            const doc = retailerToDoc(row)
            vec = await embed(doc)
            await cache.set(EMBED_KEY(row.retailer_id), vec, EMBED_TTL)
        }
        index.push({
            retailer_id:    row.retailer_id,
            shop_name:      row.shop_name,
            market_location: row.market_location,
            vec,
        })
    }

    // Cache the full index
    await cache.set(INDEX_KEY, index, EMBED_TTL)
    logger.info({ count: index.length }, '[embeddingService] retailer index built')
    return index
}

/**
 * rebuildRetailerIndex(db?) — force-flush and rebuild the embedding index.
 * Call this after bulk retailer imports or whenever stale results are observed.
 * A lock prevents concurrent rebuilds.
 */
export async function rebuildRetailerIndex(db) {
    if (_rebuildLock) {
        logger.warn('[embeddingService] rebuildRetailerIndex already in progress — skipping')
        return { skipped: true }
    }
    _rebuildLock = true
    try {
        await cache.del(INDEX_KEY)
        const dbPool = db || pool
        const index  = await getOrBuildIndex(dbPool)
        return { rebuilt: true, count: index.length }
    } finally {
        _rebuildLock = false
    }
}

/**
 * invalidateRetailer(retailer_id) — bust a single retailer's embedding cache.
 * Call from the retailers PUT/POST routes if you want fresh embeddings on update.
 * Also busts the full index so the next search rebuilds it.
 */
export async function invalidateRetailer(retailer_id) {
    await cache.del(EMBED_KEY(retailer_id), INDEX_KEY)
    logger.debug({ retailer_id }, '[embeddingService] retailer embedding invalidated')
}

// ── Public search API ─────────────────────────────────────────────────────────

/**
 * searchRetailers(queryText, topK = 5)
 *
 * Embeds queryText, computes cosine similarity against all cached retailer
 * embeddings, and returns the top-k matches sorted by score (desc).
 *
 * Returns:
 *   [{ retailer_id, shop_name, market_location, score: 0.xx }, ...]
 */
export async function searchRetailers(queryText, topK = 5) {
    if (!queryText?.trim()) throw new Error('queryText is required')

    const start    = Date.now()
    const queryVec = await embed(queryText)

    // Build or load the index (uses pool from db.js by default)
    const index = await getOrBuildIndex(pool)

    // Rank
    const ranked = index
        .map(entry => ({
            retailer_id:     entry.retailer_id,
            shop_name:       entry.shop_name,
            market_location: entry.market_location,
            score:           cosineSimilarity(queryVec, entry.vec),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)

    const durationMs = Date.now() - start
    logger.info({ query: queryText, topK, durationMs }, '[embeddingService] searchRetailers')

    return ranked
}
