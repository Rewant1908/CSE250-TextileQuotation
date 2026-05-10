// backend/agents/tools/warehouseTools.js
export const warehouseTools = [
  {
    name: 'get_warehouse_summary',
    description: 'Get total bales, total stock units, and storage utilization.',
    parameters: { type: 'object', properties: {}, required: [] },
    execute: async (_args, db) => {
      const [[summary]] = await db.query(
        `SELECT COUNT(*) AS total_bales, SUM(remaining_stock) AS total_units,
                SUM(CASE WHEN status = 'sold_out' THEN 1 ELSE 0 END) AS sold_out_bales,
                SUM(CASE WHEN movement_speed = 'dead' THEN 1 ELSE 0 END) AS dead_stock_bales
         FROM thans`
      )
      return { warehouse_summary: summary }
    }
  },

  {
    name: 'intake_bale',
    description: 'Record a new bale/than intake into the warehouse.',
    parameters: { type: 'object', properties: {
      product_id:              { type: 'number' },
      than_name:               { type: 'string' },
      total_quantity:          { type: 'number' },
      purchase_price_per_unit: { type: 'number' },
      sale_price_per_unit:     { type: 'number' },
      supplier_id:             { type: 'number' }
    }, required: ['product_id', 'than_name', 'total_quantity', 'purchase_price_per_unit', 'sale_price_per_unit'] },
    execute: async (args, db) => {
      const [result] = await db.query(
        `INSERT INTO thans (product_id, than_name, total_quantity, remaining_stock, purchase_price_per_unit, sale_price_per_unit, status, movement_speed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'active', 'normal', NOW(), NOW())`,
        [args.product_id, args.than_name, args.total_quantity, args.total_quantity, args.purchase_price_per_unit, args.sale_price_per_unit]
      )
      await db.query(
        `INSERT INTO inventory_movements (than_id, movement_type, quantity, notes, movement_date) VALUES (?, 'IN', ?, 'Bale intake via AI agent', NOW())`,
        [result.insertId, args.total_quantity]
      )
      return { success: true, than_id: result.insertId, than_name: args.than_name, message: `Bale "${args.than_name}" added with ${args.total_quantity} units.` }
    }
  },

  {
    name: 'list_recent_intakes',
    description: 'List recently added bales/thans.',
    parameters: { type: 'object', properties: {
      limit: { type: 'number' }
    }, required: [] },
    execute: async (args, db) => {
      const limit = args.limit ?? 15
      const [rows] = await db.query(
        `SELECT t.than_id, t.than_name, t.total_quantity, t.remaining_stock,
                t.purchase_price_per_unit, t.sale_price_per_unit, t.created_at,
                p.product_name, p.category
         FROM thans t JOIN products p ON p.product_id = t.product_id
         ORDER BY t.created_at DESC LIMIT ?`, [limit]
      )
      return { recent_intakes: rows, count: rows.length }
    }
  }
]
