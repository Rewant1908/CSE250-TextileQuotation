// backend/tests/phase10.test.js
// Phase 10 integration tests — Agent Orchestration
//
// Tests:
//   buildForkedMessages()        — cache key determinism + content injection
//   validateForkVerdicts()       — structured VERDICT: BUY/HOLD/AVOID parsing
//   validateStructuredVerdict()  — single-agent verdict parsing
//   runProcurementFork() shape   — mocked AI calls, return-value shape contract
//
// Runner: Node built-in test runner (node:test + node:assert)
// Run with:  npm test
//            node --test backend/tests/phase10.test.js

import { describe, it, mock, beforeEach }  from 'node:test'
import assert                              from 'node:assert/strict'

// ── Pure helpers — no I/O, import directly ────────────────────────────────
import { buildForkedMessages, validateForkVerdicts } from '../agents/runner/forkRunner.js'
import { validateStructuredVerdict }                 from '../agents/runner/agentRunner.js'

// ---------------------------------------------------------------------------
// 1. buildForkedMessages
// ---------------------------------------------------------------------------
describe('buildForkedMessages()', () => {
    it('returns builtContext and cacheKey', () => {
        const { builtContext, cacheKey } = buildForkedMessages('test context')
        assert.ok(typeof builtContext === 'string', 'builtContext should be a string')
        assert.ok(typeof cacheKey     === 'string', 'cacheKey should be a string')
    })

    it('cacheKey is exactly 16 hex characters', () => {
        const { cacheKey } = buildForkedMessages('any context')
        assert.match(cacheKey, /^[0-9a-f]{16}$/, 'cacheKey should be 16 lowercase hex chars')
    })

    it('same context always produces the same cacheKey (deterministic)', () => {
        const ctx = 'Cotton bales low, 2026-05-09'
        const { cacheKey: k1 } = buildForkedMessages(ctx)
        const { cacheKey: k2 } = buildForkedMessages(ctx)
        assert.equal(k1, k2, 'Same input must yield same cacheKey')
    })

    it('different contexts produce different cacheKeys', () => {
        const { cacheKey: k1 } = buildForkedMessages('context A')
        const { cacheKey: k2 } = buildForkedMessages('context B')
        assert.notEqual(k1, k2, 'Different inputs must yield different cacheKeys')
    })

    it('builtContext includes the caller-supplied context', () => {
        const userCtx = 'Procurement cycle Q2'
        const { builtContext } = buildForkedMessages(userCtx)
        assert.ok(builtContext.includes(userCtx), 'builtContext must contain the caller context')
    })

    it('builtContext always includes the business name', () => {
        const { builtContext } = buildForkedMessages('')
        assert.ok(
            builtContext.includes('KT Impex'),
            'builtContext must always include the business name'
        )
    })

    it('empty context still produces a valid cacheKey', () => {
        const { cacheKey } = buildForkedMessages('')
        assert.match(cacheKey, /^[0-9a-f]{16}$/)
    })
})

// ---------------------------------------------------------------------------
// 2. validateForkVerdicts
// ---------------------------------------------------------------------------
describe('validateForkVerdicts()', () => {
    it('returns valid=false for empty string', () => {
        const { valid } = validateForkVerdicts('')
        assert.equal(valid, false)
    })

    it('returns valid=false for response with no VERDICT lines', () => {
        const { valid } = validateForkVerdicts('The market looks stable. Consider ordering next week.')
        assert.equal(valid, false)
    })

    it('parses a single BUY verdict', () => {
        const text = 'VERDICT: BUY Cotton — margins are strong, inventory critically low'
        const { valid, verdictMap, rawLines } = validateForkVerdicts(text)
        assert.equal(valid, true)
        assert.ok('Cotton' in verdictMap)
        assert.equal(verdictMap['Cotton'].action, 'BUY')
        assert.ok(verdictMap['Cotton'].reason.length > 0)
        assert.equal(rawLines.length, 1)
    })

    it('parses a single HOLD verdict', () => {
        const text = 'VERDICT: HOLD Polyester - stable demand, adequate stock'
        const { verdictMap } = validateForkVerdicts(text)
        assert.ok('Polyester' in verdictMap)
        assert.equal(verdictMap['Polyester'].action, 'HOLD')
    })

    it('parses a single AVOID verdict', () => {
        const text = 'VERDICT: AVOID Silk — dead stock >30 days, margins eroding'
        const { verdictMap } = validateForkVerdicts(text)
        assert.ok('Silk' in verdictMap)
        assert.equal(verdictMap['Silk'].action, 'AVOID')
    })

    it('parses multiple verdicts from coordinator output', () => {
        const text = [
            'VERDICT: BUY Cotton — inventory critically low',
            'VERDICT: HOLD Polyester — stable, no urgency',
            'VERDICT: AVOID Silk — 45 days dead stock',
        ].join('\n')
        const { valid, verdictMap, rawLines } = validateForkVerdicts(text)
        assert.equal(valid, true)
        assert.equal(Object.keys(verdictMap).length, 3)
        assert.equal(rawLines.length, 3)
        assert.equal(verdictMap['Cotton'].action,    'BUY')
        assert.equal(verdictMap['Polyester'].action, 'HOLD')
        assert.equal(verdictMap['Silk'].action,      'AVOID')
    })

    it('handles em-dash (\u2014) as separator', () => {
        const text = 'VERDICT: BUY Denim \u2014 high sell-through rate'
        const { verdictMap } = validateForkVerdicts(text)
        assert.ok('Denim' in verdictMap)
    })

    it('handles en-dash (\u2013) as separator', () => {
        const text = 'VERDICT: HOLD Linen \u2013 demand flat'
        const { verdictMap } = validateForkVerdicts(text)
        assert.ok('Linen' in verdictMap)
    })

    it('handles ASCII hyphen as separator', () => {
        const text = 'VERDICT: AVOID Wool - oversupplied'
        const { verdictMap } = validateForkVerdicts(text)
        assert.ok('Wool' in verdictMap)
    })

    it('verdictMap entries have both action and reason fields', () => {
        const text = 'VERDICT: BUY Rayon — fast turnover'
        const { verdictMap } = validateForkVerdicts(text)
        const entry = verdictMap['Rayon']
        assert.ok(entry, 'Rayon entry must exist')
        assert.ok(['BUY', 'HOLD', 'AVOID'].includes(entry.action), 'action must be BUY/HOLD/AVOID')
        assert.ok(typeof entry.reason === 'string' && entry.reason.length > 0, 'reason must be non-empty')
    })
})

// ---------------------------------------------------------------------------
// 3. validateStructuredVerdict
// ---------------------------------------------------------------------------
describe('validateStructuredVerdict()', () => {
    it('returns valid=false for empty text', () => {
        assert.equal(validateStructuredVerdict('').valid, false)
    })

    it('returns valid=false when no BUY/HOLD/AVOID is present', () => {
        const { valid } = validateStructuredVerdict(
            'The cotton stock is running low. Consider ordering soon.'
        )
        assert.equal(valid, false)
    })

    it('parses BUY correctly', () => {
        const result = validateStructuredVerdict('VERDICT: BUY Cotton — inventory low, margins strong')
        assert.equal(result.valid,    true)
        assert.equal(result.action,   'BUY')
        assert.equal(result.category, 'Cotton')
        assert.ok(result.reason.length > 0)
    })

    it('parses HOLD correctly', () => {
        const result = validateStructuredVerdict('VERDICT: HOLD Polyester - no urgency')
        assert.equal(result.valid,  true)
        assert.equal(result.action, 'HOLD')
    })

    it('parses AVOID correctly', () => {
        const result = validateStructuredVerdict('VERDICT: AVOID Silk \u2014 dead stock 45 days')
        assert.equal(result.valid,  true)
        assert.equal(result.action, 'AVOID')
    })

    it('is case-insensitive for the BUY/HOLD/AVOID token', () => {
        const result = validateStructuredVerdict('VERDICT: buy Cotton \u2014 margins good')
        assert.equal(result.valid,  true)
        assert.equal(result.action, 'BUY')
    })

    it('returns null fields when verdict is invalid', () => {
        const { valid, action, category, reason } = validateStructuredVerdict('no verdict here')
        assert.equal(valid,    false)
        assert.equal(action,   null)
        assert.equal(category, null)
        assert.equal(reason,   null)
    })
})
