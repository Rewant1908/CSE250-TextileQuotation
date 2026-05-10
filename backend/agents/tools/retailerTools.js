// backend/agents/tools/retailerTools.js
export const retailerTools = [
  {
    name: 'list_retailers',
    description: 'List all retailers with optional city filter.',
    parameters: { type: 'object', properties: {
      city:  { type: 'string' },
      limit: { type: 'number' }
    }, required: [] },
    execute: async (args, db) => {
      const limit = args.limit ?? 30
      const where = args.city ? `WHERE r.city LIKE '%${args.city}%'` : ''
      const [rows] = await db.query(
        `SELECT r.retailer_id, r.retailer_name, r.city, r.phone, r.email,
                r.credit_limit, r.outstanding_balance, r.status,
                COUNT(qr.request_id) AS total_orders
         FROM retailers r
         LEFT JOIN quotation_requests qr ON qr.retailer_id = r.retailer_id
         ${where}
         GROUP BY r.retailer_id ORDER BY r.retailer_name LIMIT ?`, [limit]
      )
      return { retailers: rows, count: rows.length }
    }
  },

  {
    name: 'get_retailer_details',
    description: 'Get full details and order history of a retailer.',
    parameters: { type: 'object', properties: {
      retailer_id: { type: 'number' }
    }, required: ['retailer_id'] },
    execute: async (args, db) => {
      const [[r]] = await db.query(`SELECT * FROM retailers WHERE retailer_id = ?`, [args.retailer_id])
      if (!r) return { error: `Retailer #${args.retailer_id} not found` }
      const [orders] = await db.query(
        `SELECT request_id, status, created_at FROM quotation_requests WHERE retailer_id = ? ORDER BY created_at DESC LIMIT 10`,
        [args.retailer_id]
      )
      return { retailer: r, recent_orders: orders }
    }
  },

  {
    name: 'update_retailer_credit_limit',
    description: 'Update the credit limit for a retailer.',
    parameters: { type: 'object', properties: {
      retailer_id:  { type: 'number' },
      credit_limit: { type: 'number' }
    }, required: ['retailer_id', 'credit_limit'] },
    execute: async (args, db) => {
      await db.query(`UPDATE retailers SET credit_limit = ?, updated_at = NOW() WHERE retailer_id = ?`, [args.credit_limit, args.retailer_id])
      return { success: true, retailer_id: args.retailer_id, new_credit_limit: args.credit_limit }
    }
  }
]
