/**
 * embeddingService.js — Semantic retailer search using Gemini embeddings
 * Phase 6 Task 2
 *
 * Fix: model changed to gemini-embedding-001 on v1beta (text-embedding-004
 * is not available on this API key; gemini-embedding-001 is supported).
 */

import pool    from '../db.js'
import * as cache from '../cache.js'
import logger  from '../logger.js'

const EMBEDDING_MODEL = 'gemini-embedding-001'
const EMBED_API       = 'v1beta'
const EMBED_TTL       = 60 * 60
const INDEX_KEY       = 'embed:retailer:index'
const EMBED_KEY       = (id) => `embed:retailer:${id}`

let _rebuildLock = false

// ── Gemini embedding via REST ───────────────────────────────────────────────

async function embed(text) {
    if (!process.env.GEMINI_API_KEY)
        throw new Error('GEMINI_API_KEY not set. Cannot generate embeddings.')

    const url = `https://generativelanguage.googleapis.com/${EMBED_API}/models/${EMBEDDING_MODEL}:embedContent?key=${process.env.GEMINI_API_KEY}`

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
    return json.embedding.values   // float[]
}

// ── Retailer document builder ─────────────────────────────────────────────────

function retailerToDoc(row) {
    const parts = [
        row.shop_name,
        row.market_location ? `in ${row.market_location}` : '',
        row.contact_person  ? `Contact: ${row.contact_person}` : '',
        row.preferred_categories    ? `Categories: ${row.preferred_categories}` : '',
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

async function getOrBuildIndex(db) {
    const cached = await cache.get(INDEX_KEY)
    if (cached) return cached

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

    const index = []
    for (const row of rows) {
        let vec = await cache.get(EMBED_KEY(row.retailer_id))
        if (!vec) {
            const doc = retailerToDoc(row)
            vec = await embed(doc)
            await cache.set(EMBED_KEY(row.retailer_id), vec, EMBED_TTL)
        }
        index.push({
            retailer_id:     row.retailer_id,
            shop_name:       row.shop_name,
            market_location: row.market_location,
            vec,
        })
    }

    await cache.set(INDEX_KEY, index, EMBED_TTL)
    logger.info({ count: index.length }, '[embeddingService] retailer index built')
    return index
}

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

export async function invalidateRetailer(retailer_id) {
    await cache.del(EMBED_KEY(retailer_id), INDEX_KEY)
    logger.debug({ retailer_id }, '[embeddingService] retailer embedding invalidated')
}

// ── Public search API ─────────────────────────────────────────────────────────

export async function searchRetailers(queryText, topK = 5) {
    if (!queryText?.trim()) throw new Error('queryText is required')

    const start    = Date.now()
    const queryVec = await embed(queryText)
    const index    = await getOrBuildIndex(pool)

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
