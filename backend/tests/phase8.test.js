// backend/tests/phase8.test.js
// Phase 8 integration tests — WhatsApp AI System
//
// Tests pure functions only — no network, no DB, no AI API calls.
// Runner: node:test + node:assert (zero dependencies, ESM-compatible)
// Run: npm test  OR  node --test backend/tests/phase8.test.js

import { describe, it } from 'node:test'
import assert           from 'node:assert/strict'

import { parseIntent }      from '../services/whatsappService.js'
import { confidenceCheck }  from '../services/whatsappService.js'
import { formatReply }      from '../services/whatsappService.js'

// ── Sample DB rows for formatReply tests ─────────────────────────────────────
const SAMPLE_ROWS = [
    {
        than_id: 1, than_code: 'T-001', fabric_type: 'Cotton',
        color: 'Red', design: 'Plain', remaining_stock: 120,
        selling_price: 145, warehouse_location: 'A-1', image_url: null,
    },
    {
        than_id: 2, than_code: 'T-002', fabric_type: 'Cotton',
        color: 'Blue', design: 'Stripe', remaining_stock: 80,
        selling_price: 150, warehouse_location: 'A-2', image_url: 'https://example.com/t002.jpg',
    },
]

// ---------------------------------------------------------------------------
// 1. parseIntent
// ---------------------------------------------------------------------------
describe('parseIntent()', () => {
    it('returns help intent for greeting', () => {
        const r = parseIntent('hi')
        assert.equal(r.intent, 'help')
    })

    it('returns help intent for "hello"', () => {
        const r = parseIntent('Hello!')
        assert.equal(r.intent, 'help')
    })

    it('returns image_request for "send image of T-112"', () => {
        const r = parseIntent('send image of T-112')
        assert.equal(r.intent, 'image_request')
        assert.equal(r.than_code, 'T-112')
    })

    it('returns image_request for "photo T-005"', () => {
        const r = parseIntent('photo T-005')
        assert.equal(r.intent, 'image_request')
        assert.equal(r.than_code, 'T-005')
    })

    it('returns price_check for "price of silk"', () => {
        const r = parseIntent('price of silk')
        assert.equal(r.intent, 'price_check')
        assert.ok(r.q.includes('silk'))
    })

    it('returns stock_check for "how many meters of cotton"', () => {
        const r = parseIntent('how many meters of cotton')
        assert.equal(r.intent, 'stock_check')
        assert.ok(r.q.includes('cotton'))
    })

    it('returns search with max_price for "cotton under 150"', () => {
        const r = parseIntent('cotton under 150')
        assert.equal(r.intent, 'search')
        assert.equal(r.max_price, 150)
    })

    it('returns search with color+fabric for "red cotton"', () => {
        const r = parseIntent('red cotton')
        assert.equal(r.intent, 'search')
        assert.equal(r.color,  'red')
        assert.equal(r.fabric, 'cotton')
    })

    it('returns search for generic product query', () => {
        const r = parseIntent('polyester fabric available')
        assert.equal(r.intent, 'search')
        assert.ok(r.q.length > 0)
    })
})

// ---------------------------------------------------------------------------
// 2. confidenceCheck
// ---------------------------------------------------------------------------
describe('confidenceCheck()', () => {
    it('returns confident=false for unknown intent', () => {
        const { confident } = confidenceCheck([], { intent: 'unknown', raw: '???' })
        assert.equal(confident, false)
    })

    it('returns confident=false for empty results', () => {
        const { confident } = confidenceCheck([], { intent: 'search', q: 'silk' })
        assert.equal(confident, false)
    })

    it('returns confident=true for help intent (no results needed)', () => {
        const { confident } = confidenceCheck([], { intent: 'help' })
        assert.equal(confident, true)
    })

    it('returns confident=true when results exist', () => {
        const { confident } = confidenceCheck(SAMPLE_ROWS, { intent: 'search', q: 'cotton' })
        assert.equal(confident, true)
    })

    it('returns confident=false for query shorter than 2 chars', () => {
        const { confident } = confidenceCheck(SAMPLE_ROWS, { intent: 'search', q: 'a' })
        assert.equal(confident, false)
    })

    it('exposes reason field', () => {
        const { reason } = confidenceCheck([], { intent: 'search', q: 'silk' })
        assert.equal(reason, 'no_results')
    })
})

// ---------------------------------------------------------------------------
// 3. formatReply
// ---------------------------------------------------------------------------
describe('formatReply()', () => {
    it('returns help text for help intent', () => {
        const reply = formatReply([], { intent: 'help' })
        assert.ok(reply.includes('KT Impex'))
        assert.ok(reply.length > 20)
    })

    it('returns fallback message for empty results', () => {
        const reply = formatReply([], { intent: 'search', q: 'silk' })
        assert.ok(reply.toLowerCase().includes('sorry') || reply.toLowerCase().includes('not'))
    })

    it('includes than_code in search reply', () => {
        const reply = formatReply(SAMPLE_ROWS, { intent: 'search', q: 'cotton' })
        assert.ok(reply.includes('T-001'))
    })

    it('includes price in price_check reply', () => {
        const reply = formatReply(SAMPLE_ROWS, { intent: 'price_check', q: 'cotton' })
        assert.ok(reply.includes('Rs.'))
        assert.ok(reply.includes('145'))
    })

    it('includes stock meters in stock_check reply', () => {
        const reply = formatReply(SAMPLE_ROWS, { intent: 'stock_check', q: 'cotton' })
        assert.ok(reply.includes('120'))
    })

    it('does not contain markdown asterisks (WhatsApp safety)', () => {
        const reply = formatReply(SAMPLE_ROWS, { intent: 'search', q: 'cotton' })
        assert.ok(!reply.includes('**'), 'reply must not contain ** markdown')
    })

    it('does not contain markdown hash headers', () => {
        const reply = formatReply(SAMPLE_ROWS, { intent: 'search', q: 'cotton' })
        assert.ok(!/^#/m.test(reply), 'reply must not contain # headers')
    })

    it('includes image URL when row has image_url', () => {
        const reply = formatReply(SAMPLE_ROWS, { intent: 'search', q: 'cotton' })
        assert.ok(reply.includes('https://example.com/t002.jpg'))
    })

    it('reply length is under 4096 chars (WhatsApp limit)', () => {
        const reply = formatReply(SAMPLE_ROWS, { intent: 'search', q: 'cotton' })
        assert.ok(reply.length < 4096)
    })
})
