// backend/agents/tools/quotationTools.js
// Write-capable tools: accept, reject, generate quotation PDFs, list pending

export const quotationTools = [
  {
    name: 'list_pending_quotations',
    description: 'List all quotation requests with status pending or under_review. Use when user asks to see pending quotations, open requests, or what needs approval.',
    parameters: { type: 'object', properties: {
      limit: { type: 'number', description: 'Max results. Default 20.' }
    }, required: [] },
    execute: async (args, db) => {
      const limit = args.limit ?? 20
      const [rows] = await db.query(
        `SELECT qr.request_id, qr.status, qr.created_at, qr.updated_at,
                r.retailer_name, r.city,
                COUNT(qi.item_id) AS item_count,
                SUM(qi.quantity_requested) AS total_qty
         FROM   quotation_requests qr
         JOIN   retailers r ON r.retailer_id = qr.retailer_id
         LEFT JOIN quotation_items qi ON qi.request_id = qr.request_id
         WHERE  qr.status IN ('pending','under_review')
         GROUP  BY qr.request_id
         ORDER  BY qr.created_at ASC
         LIMIT  ?`, [limit]
      )
      return { pending_quotations: rows, count: rows.length }
    }
  },

  {
    name: 'get_quotation_details',
    description: 'Get full details of a specific quotation request including all line items. Use before accepting or rejecting.',
    parameters: { type: 'object', properties: {
      request_id: { type: 'number', description: 'The quotation request ID.' }
    }, required: ['request_id'] },
    execute: async (args, db) => {
      const [[qr]] = await db.query(
        `SELECT qr.*, r.retailer_name, r.city, r.phone
         FROM   quotation_requests qr
         JOIN   retailers r ON r.retailer_id = qr.retailer_id
         WHERE  qr.request_id = ?`, [args.request_id]
      )
      if (!qr) return { error: `Quotation #${args.request_id} not found` }
      const [items] = await db.query(
        `SELECT qi.*, p.product_name, p.category,
                t.than_name, t.sale_price_per_unit, t.remaining_stock
         FROM   quotation_items qi
         JOIN   products p ON p.product_id = qi.product_id
         LEFT JOIN thans t ON t.than_id = qi.than_id
         WHERE  qi.request_id = ?`, [args.request_id]
      )
      return { quotation: qr, items, item_count: items.length }
    }
  },

  {
    name: 'accept_quotation',
    description: 'Accept a quotation request and set status to approved. Optionally set a discount percentage and notes. Use when user says accept, approve, or confirm a quotation.',
    parameters: { type: 'object', properties: {
      request_id:  { type: 'number', description: 'Quotation request ID to accept.' },
      discount_pct:{ type: 'number', description: 'Optional discount % to apply (0-100).' },
      notes:       { type: 'string', description: 'Optional approval notes.' }
    }, required: ['request_id'] },
    execute: async (args, db) => {
      const [[existing]] = await db.query(
        `SELECT status FROM quotation_requests WHERE request_id = ?`, [args.request_id]
      )
      if (!existing) return { error: `Quotation #${args.request_id} not found` }
      if (existing.status === 'approved') return { error: `Quotation #${args.request_id} is already approved` }

      await db.query(
        `UPDATE quotation_requests
         SET    status = 'approved',
                admin_notes = ?,
                discount_percentage = COALESCE(?, discount_percentage),
                updated_at = NOW()
         WHERE  request_id = ?`,
        [args.notes || null, args.discount_pct ?? null, args.request_id]
      )
      return { success: true, request_id: args.request_id, new_status: 'approved', message: `Quotation #${args.request_id} has been approved.` }
    }
  },

  {
    name: 'reject_quotation',
    description: 'Reject a quotation request and set status to rejected. A rejection reason is required. Use when user says reject or decline a quotation.',
    parameters: { type: 'object', properties: {
      request_id: { type: 'number', description: 'Quotation request ID to reject.' },
      reason:     { type: 'string', description: 'Reason for rejection.' }
    }, required: ['request_id', 'reason'] },
    execute: async (args, db) => {
      const [[existing]] = await db.query(
        `SELECT status FROM quotation_requests WHERE request_id = ?`, [args.request_id]
      )
      if (!existing) return { error: `Quotation #${args.request_id} not found` }
      await db.query(
        `UPDATE quotation_requests
         SET status = 'rejected', admin_notes = ?, updated_at = NOW()
         WHERE request_id = ?`,
        [args.reason, args.request_id]
      )
      return { success: true, request_id: args.request_id, new_status: 'rejected' }
    }
  },

  {
    name: 'list_all_quotations',
    description: 'List quotations filtered by status. Use for approved, rejected, or all quotations overview.',
    parameters: { type: 'object', properties: {
      status: { type: 'string', description: 'Filter by status: pending, approved, rejected, under_review. Omit for all.' },
      limit:  { type: 'number', description: 'Max results. Default 25.' }
    }, required: [] },
    execute: async (args, db) => {
      const limit = args.limit ?? 25
      const where = args.status ? `WHERE qr.status = '${args.status}'` : ''
      const [rows] = await db.query(
        `SELECT qr.request_id, qr.status, qr.created_at, qr.admin_notes,
                r.retailer_name, r.city
         FROM   quotation_requests qr
         JOIN   retailers r ON r.retailer_id = qr.retailer_id
         ${where}
         ORDER  BY qr.updated_at DESC
         LIMIT  ?`, [limit]
      )
      return { quotations: rows, count: rows.length }
    }
  }
]
