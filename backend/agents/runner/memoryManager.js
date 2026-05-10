// memoryManager.js — Live DB → Agent Memory injection layer
// Phase 6: AI Memory Design
//
// Fix: _salesContext and _quotationSummaryContext were joining 'customers'
//      and 'quotation_items' which do not exist in the real schema.
//      Real schema uses 'retailers' (PK: retailer_id) and quotation line
//      data is not stored in a separate items table.
//      'customers' references replaced with 'retailers'.
//      All quotation_items queries removed / simplified.

export async function buildLiveContext(agentName, db) {
    try {
        switch (agentName) {
            case 'inventory':          return await _inventoryContext(db)
            case 'retailer':           return await _retailerContext(db)
            case 'procurement':        return await _procurementContext(db)
            case 'warehouse':          return await _warehouseContext(db)
            case 'pricing':            return await _pricingContext(db)
            case 'sales':              return await _salesContext(db)
            case 'coordinator':        return await _coordinatorContext(db)
            case 'quotation-summary':  return await _quotationSummaryContext(db)
            default:                   return ''
        }
    } catch (err) {
        console.error(`[memoryManager] buildLiveContext(${agentName}) failed:`, err.message)
        return `(live context unavailable: ${err.message})`
    }
}

// ---------------------------------------------------------------------------
// Inventory Agent
// ---------------------------------------------------------------------------
async function _inventoryContext(db) {
    const rows = await db.query(`
        SELECT
            COUNT(*)                                          AS total_thans,
            SUM(remaining_stock)                              AS total_meters,
            SUM(CASE WHEN movement_speed = 'dead'   THEN 1 ELSE 0 END) AS dead_count,
            SUM(CASE WHEN movement_speed = 'slow'   THEN 1 ELSE 0 END) AS slow_count,
            SUM(CASE WHEN movement_speed = 'fast'   THEN 1 ELSE 0 END) AS fast_count,
            SUM(CASE WHEN movement_speed = 'new'    THEN 1 ELSE 0 END) AS new_count,
            ROUND(SUM(remaining_stock * cost_per_meter), 2)  AS total_stock_value
        FROM thans
        WHERE status != 'sold'
    `)
    const totals = rows[0] ?? {}

    const deadRows = await db.query(`
        SELECT fabric_type, color, design,
               remaining_stock, warehouse_location,
               DATEDIFF(NOW(), updated_at) AS days_stagnant
        FROM thans
        WHERE movement_speed = 'dead' AND status != 'sold'
        ORDER BY days_stagnant DESC
        LIMIT 10
    `)

    const categoryRows = await db.query(`
        SELECT p.category,
               COUNT(t.than_id)        AS than_count,
               SUM(t.remaining_stock)  AS meters_remaining,
               ROUND(AVG(t.selling_price - t.cost_per_meter), 2) AS avg_margin
        FROM thans t
        JOIN products p ON t.product_id = p.product_id
        WHERE t.status != 'sold'
        GROUP BY p.category
        ORDER BY meters_remaining DESC
    `)

    const lines = [
        `## Live Inventory Snapshot — ${_today()}`,
        `Total Thans: ${totals.total_thans ?? 0} | Total Meters: ${totals.total_meters ?? 0} | Stock Value: ₹${totals.total_stock_value ?? 0}`,
        `Movement: Fast=${totals.fast_count ?? 0} Slow=${totals.slow_count ?? 0} Dead=${totals.dead_count ?? 0} New=${totals.new_count ?? 0}`,
        '',
        '### Dead Stock (top 10 by days stagnant)',
        deadRows.length
            ? deadRows.map(r =>
                `- ${r.fabric_type} ${r.color} ${r.design || ''} | ${r.remaining_stock}m | Loc: ${r.warehouse_location || 'unassigned'} | ${r.days_stagnant}d stagnant`
              )
            : ['- No dead stock at this time.'],
        '',
        '### Category Breakdown',
        categoryRows.length
            ? categoryRows.map(r =>
                `- ${r.category}: ${r.than_count} thans, ${r.meters_remaining}m remaining, avg margin ₹${r.avg_margin}/m`
              )
            : ['- No category data available.'],
    ].flat()
    return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Retailer Agent
// ---------------------------------------------------------------------------
async function _retailerContext(db) {
    const topRetailers = await db.query(`
        SELECT r.shop_name, r.market_location, r.payment_pattern,
               r.outstanding_balance, r.preferred_price_segment,
               COUNT(t.transaction_id)      AS total_orders,
               ROUND(SUM(t.price * t.quantity), 2) AS total_revenue,
               MAX(t.created_at)            AS last_order_date
        FROM retailers r
        LEFT JOIN transactions t ON r.retailer_id = t.retailer_id
        WHERE (r.is_deleted = 0 OR r.is_deleted IS NULL)
        GROUP BY r.retailer_id
        ORDER BY total_revenue DESC
        LIMIT 15
    `)

    const overdueRows = await db.query(`
        SELECT shop_name, market_location,
               outstanding_balance, payment_pattern
        FROM retailers
        WHERE outstanding_balance > 0
          AND (is_deleted = 0 OR is_deleted IS NULL)
        ORDER BY outstanding_balance DESC
        LIMIT 10
    `)

    const lines = [
        `## Live Retailer Snapshot — ${_today()}`,
        '',
        '### Top 15 Retailers by Revenue',
        topRetailers.length
            ? topRetailers.map(r =>
                `- ${r.shop_name} (${r.market_location}): ${r.total_orders} orders, ₹${r.total_revenue} revenue, last order: ${_dateStr(r.last_order_date)}, payment: ${r.payment_pattern}, balance: ₹${r.outstanding_balance}`
              )
            : ['- No retailer data available.'],
        '',
        '### Outstanding Balances (top 10)',
        overdueRows.length
            ? overdueRows.map(r =>
                `- ${r.shop_name} (${r.market_location}): ₹${r.outstanding_balance} outstanding, pattern: ${r.payment_pattern}`
              )
            : ['- No outstanding balances.'],
    ].flat()
    return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Procurement Agent
// ---------------------------------------------------------------------------
async function _procurementContext(db) {
    const baleRows = await db.query(`
        SELECT b.bale_code, b.fabric_category, b.purchase_cost,
               b.arrival_date, b.status, s.supplier_name,
               s.quality_rating, s.delay_frequency
        FROM bales b
        JOIN suppliers s ON b.supplier_id = s.supplier_id
        ORDER BY b.arrival_date DESC
        LIMIT 20
    `)

    const supplierPerf = await db.query(`
        SELECT s.supplier_name, s.quality_rating, s.delay_frequency,
               s.trend_alignment, s.price_range,
               COUNT(b.bale_id) AS total_bales_purchased
        FROM suppliers s
        LEFT JOIN bales b ON s.supplier_id = b.supplier_id
        WHERE (s.is_deleted = 0 OR s.is_deleted IS NULL)
        GROUP BY s.supplier_id
        ORDER BY s.quality_rating DESC
    `)

    const lowStockCats = await db.query(`
        SELECT p.category, SUM(t.remaining_stock) AS meters_left
        FROM thans t
        JOIN products p ON t.product_id = p.product_id
        WHERE t.status != 'sold'
        GROUP BY p.category
        HAVING meters_left < 200
        ORDER BY meters_left ASC
    `)

    const lines = [
        `## Live Procurement Snapshot — ${_today()}`,
        '',
        '### Recent Bale Purchases (last 20)',
        baleRows.length
            ? baleRows.map(r =>
                `- ${r.bale_code} | ${r.fabric_category} | ${r.supplier_name} (quality: ${r.quality_rating}, delays: ${r.delay_frequency}) | ₹${r.purchase_cost} | arrived: ${_dateStr(r.arrival_date)} | status: ${r.status}`
              )
            : ['- No bale purchase records.'],
        '',
        '### Supplier Performance',
        supplierPerf.length
            ? supplierPerf.map(r =>
                `- ${r.supplier_name}: quality=${r.quality_rating}/5, delay_freq=${r.delay_frequency}, trend_align=${r.trend_alignment}, price_range=${r.price_range}, bales_bought=${r.total_bales_purchased}`
              )
            : ['- No supplier data.'],
        '',
        '### Low Stock Categories (<200m remaining)',
        lowStockCats.length
            ? lowStockCats.map(r => `- ${r.category}: ${r.meters_left}m left`)
            : ['- No critical low-stock categories at this time.'],
    ].flat()
    return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Warehouse Agent
// ---------------------------------------------------------------------------
async function _warehouseContext(db) {
    const locationRows = await db.query(`
        SELECT warehouse_location,
               COUNT(*)              AS than_count,
               SUM(remaining_stock)  AS total_meters,
               SUM(CASE WHEN movement_speed = 'dead' THEN 1 ELSE 0 END) AS dead_count
        FROM thans
        WHERE status != 'sold'
        GROUP BY warehouse_location
        ORDER BY total_meters DESC
    `)

    const unassignedRows = await db.query(`
        SELECT COUNT(*) AS count FROM thans
        WHERE (warehouse_location IS NULL OR warehouse_location = '') AND status != 'sold'
    `)
    const unassignedCount = unassignedRows[0]?.count ?? 0

    const recentMovements = await db.query(`
        SELECT im.movement_type, im.quantity,
               t.fabric_type, t.color, im.notes, im.movement_date
        FROM inventory_movements im
        JOIN thans t ON im.than_id = t.than_id
        ORDER BY im.movement_date DESC
        LIMIT 20
    `)

    const lines = [
        `## Live Warehouse Snapshot — ${_today()}`,
        `Unassigned thans (no location): ${unassignedCount}`,
        '',
        '### Stock by Location',
        locationRows.length
            ? locationRows.map(r =>
                `- ${r.warehouse_location || 'unassigned'}: ${r.than_count} thans, ${r.total_meters}m, dead=${r.dead_count}`
              )
            : ['- No warehouse location data.'],
        '',
        '### Recent Inventory Movements (last 20)',
        recentMovements.length
            ? recentMovements.map(r =>
                `- [${_dateStr(r.movement_date)}] ${r.movement_type} | ${r.fabric_type} ${r.color} | qty: ${r.quantity} | ${r.notes || ''}`
              )
            : ['- No recent movements.'],
    ].flat()
    return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Pricing Agent
// ---------------------------------------------------------------------------
async function _pricingContext(db) {
    const marginRows = await db.query(`
        SELECT p.category,
               ROUND(AVG(t.margin), 2)        AS avg_margin,
               ROUND(MIN(t.margin), 2)        AS min_margin,
               ROUND(MAX(t.margin), 2)        AS max_margin,
               COUNT(t.transaction_id)        AS txn_count,
               ROUND(SUM(t.margin * t.quantity), 2) AS total_margin_earned
        FROM transactions t
        JOIN thans th ON t.than_id = th.than_id
        JOIN products p ON th.product_id = p.product_id
        WHERE t.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
        GROUP BY p.category
        ORDER BY avg_margin DESC
    `)

    const discountRows = await db.query(`
        SELECT ROUND(AVG(discount), 2) AS avg_discount,
               MAX(discount)           AS max_discount,
               COUNT(*)                AS txn_with_discount
        FROM transactions
        WHERE discount > 0
          AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `)
    const disc = discountRows[0] ?? {}

    const lowMarginThans = await db.query(`
        SELECT fabric_type, color, design,
               cost_per_meter, selling_price,
               (selling_price - cost_per_meter) AS margin,
               remaining_stock
        FROM thans
        WHERE status != 'sold'
          AND (selling_price - cost_per_meter) < 10
        ORDER BY margin ASC
        LIMIT 10
    `)

    const lines = [
        `## Live Pricing Snapshot — ${_today()}`,
        '',
        '### Margin by Category (last 90 days)',
        marginRows.length
            ? marginRows.map(r =>
                `- ${r.category}: avg ₹${r.avg_margin}/m, min ₹${r.min_margin}/m, max ₹${r.max_margin}/m, ${r.txn_count} txns, total margin ₹${r.total_margin_earned}`
              )
            : ['- No transaction data in last 90 days.'],
        '',
        `### Discount Activity (last 30 days): avg=${disc.avg_discount ?? 0}%, max=${disc.max_discount ?? 0}%, ${disc.txn_with_discount ?? 0} discounted txns`,
        '',
        '### Low Margin Thans (<₹10/m margin)',
        lowMarginThans.length
            ? lowMarginThans.map(r =>
                `- ${r.fabric_type} ${r.color} ${r.design || ''}: cost ₹${r.cost_per_meter}/m, selling ₹${r.selling_price}/m, margin ₹${r.margin}/m, ${r.remaining_stock}m left`
              )
            : ['- No critically low-margin stock at this time.'],
    ].flat()
    return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Sales Agent — FIXED: was joining non-existent 'customers' table
//               now joins 'retailers' (the real table in this schema)
// ---------------------------------------------------------------------------
async function _salesContext(db) {
    const recentTxns = await db.query(`
        SELECT r.shop_name, t.quantity, t.price, t.margin,
               t.payment_method, t.discount, t.created_at,
               th.fabric_type, th.color
        FROM transactions t
        JOIN retailers r  ON t.retailer_id = r.retailer_id
        JOIN thans th     ON t.than_id     = th.than_id
        ORDER BY t.created_at DESC
        LIMIT 20
    `)

    // FIXED: was 'JOIN customers c ON q.customer_id = c.customer_id'
    //        Real schema: quotations.retailer_id → retailers.retailer_id
    const pendingQuotes = await db.query(`
        SELECT q.quotation_number, r.retailer_name,
               q.total_amount, q.status, q.created_at
        FROM quotations q
        JOIN retailers r ON q.retailer_id = r.retailer_id
        WHERE q.status IN ('draft', 'pending', 'sent')
        ORDER BY q.created_at DESC
        LIMIT 10
    `)

    const lines = [
        `## Live Sales Snapshot — ${_today()}`,
        '',
        '### Recent Transactions (last 20)',
        recentTxns.length
            ? recentTxns.map(r =>
                `- ${_dateStr(r.created_at)} | ${r.shop_name} | ${r.fabric_type} ${r.color} | ${r.quantity}m @ ₹${r.price}/m | margin ₹${r.margin}/m | ${r.payment_method}${r.discount ? ` | disc ${r.discount}%` : ''}`
              )
            : ['- No recent transactions.'],
        '',
        '### Pending Quotations',
        pendingQuotes.length
            ? pendingQuotes.map(r =>
                `- ${r.quotation_number} | ${r.retailer_name} | ₹${r.total_amount} | status: ${r.status} | created: ${_dateStr(r.created_at)}`
              )
            : ['- No pending quotations.'],
    ].flat()
    return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Coordinator Agent
// ---------------------------------------------------------------------------
async function _coordinatorContext(db) {
    const [inv, ret, proc, price] = await Promise.all([
        _inventoryContext(db),
        _retailerContext(db),
        _procurementContext(db),
        _pricingContext(db),
    ])

    return [
        `## Coordinator Live Context — ${_today()}`,
        '(Cross-domain operational snapshot for synthesis)',
        '',
        inv,
        '',
        ret,
        '',
        proc,
        '',
        price,
    ].join('\n')
}

// ---------------------------------------------------------------------------
// Quotation Summary Agent — FIXED:
//   - Removed all references to non-existent 'customers' table
//   - Removed all references to non-existent 'quotation_items' table
//   - Now joins 'retailers' for retailer name
// ---------------------------------------------------------------------------
async function _quotationSummaryContext(db) {
    // 1. Aggregate stats per status
    const statusStats = await db.query(`
        SELECT status,
               COUNT(*)                    AS count,
               ROUND(SUM(total_amount), 2) AS total_value,
               ROUND(AVG(total_amount), 2) AS avg_value,
               ROUND(AVG(DATEDIFF(NOW(), created_at)), 1) AS avg_age_days
        FROM quotations
        GROUP BY status
        ORDER BY FIELD(status, 'draft', 'pending', 'sent', 'accepted', 'declined')
    `)

    // 2. Per-retailer summary — FIXED: was joining non-existent 'customers' table
    const retailerStats = await db.query(`
        SELECT r.retailer_name,
               COUNT(q.quotation_id)                               AS total_quotes,
               ROUND(SUM(CASE WHEN q.status IN ('draft','pending','sent')
                    THEN q.total_amount ELSE 0 END), 2)            AS open_value,
               SUM(CASE WHEN q.status = 'declined' THEN 1 ELSE 0 END) AS decline_count,
               SUM(CASE WHEN q.status = 'accepted' THEN 1 ELSE 0 END) AS accept_count,
               MAX(q.created_at)                                   AS last_quote_date
        FROM quotations q
        JOIN retailers r ON q.retailer_id = r.retailer_id
        GROUP BY q.retailer_id
        ORDER BY open_value DESC
        LIMIT 15
    `)

    // 3. High-risk: retailer has outstanding_balance > 0 AND open quotation
    const riskRows = await db.query(`
        SELECT r.retailer_name,
               q.quotation_number, q.status, q.total_amount,
               q.created_at,
               DATEDIFF(NOW(), q.created_at) AS age_days,
               r.outstanding_balance
        FROM quotations q
        JOIN retailers r ON q.retailer_id = r.retailer_id
        WHERE q.status IN ('draft', 'pending', 'sent')
          AND r.outstanding_balance > 0
        ORDER BY r.outstanding_balance DESC
        LIMIT 10
    `)

    // 4. Stale drafts older than 7 days
    const staleDrafts = await db.query(`
        SELECT q.quotation_number, r.retailer_name,
               q.total_amount,
               DATEDIFF(NOW(), q.created_at) AS age_days
        FROM quotations q
        JOIN retailers r ON q.retailer_id = r.retailer_id
        WHERE q.status = 'draft'
          AND DATEDIFF(NOW(), q.created_at) > 7
        ORDER BY age_days DESC
        LIMIT 10
    `)

    const lines = [
        `## Live Quotation Summary Context — ${_today()}`,
        '',
        '### Status Breakdown',
        statusStats.length
            ? statusStats.map(r =>
                `- ${r.status}: ${r.count} quotes | total ₹${r.total_value} | avg ₹${r.avg_value} | avg age ${r.avg_age_days} days`
              )
            : ['- No quotation records found.'],
        '',
        '### Retailer Summary (top 15 by open value)',
        retailerStats.length
            ? retailerStats.map(r =>
                `- ${r.retailer_name}: ${r.total_quotes} quotes | open ₹${r.open_value} | accepted=${r.accept_count} declined=${r.decline_count} | last: ${_dateStr(r.last_quote_date)}`
              )
            : ['- No retailer quotation data.'],
        '',
        '### High-Risk Open Quotations (retailer has outstanding balance)',
        riskRows.length
            ? riskRows.map(r =>
                `⚠️ ${r.quotation_number} | ${r.retailer_name} | ₹${r.total_amount} | status: ${r.status} | ${r.age_days} days old | balance: ₹${r.outstanding_balance}`
              )
            : ['- No high-risk open quotations.'],
        '',
        '### Stale Drafts (> 7 days old)',
        staleDrafts.length
            ? staleDrafts.map(r =>
                `- ${r.quotation_number} | ${r.retailer_name} | ₹${r.total_amount} | ${r.age_days} days stale`
              )
            : ['- No stale drafts.'],
    ].flat()
    return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function _today() {
    return new Date().toISOString().split('T')[0]
}

function _dateStr(d) {
    if (!d) return 'N/A'
    return new Date(d).toISOString().split('T')[0]
}
