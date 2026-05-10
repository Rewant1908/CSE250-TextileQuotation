// backend/agents/tools/inventoryTools.js
// Real database-backed tools for the Inventory Agent.
// Every function executes a parameterised MariaDB query and returns plain JSON.
// The agent runner calls execute(args, db) and feeds the result back to the LLM.

export const inventoryTools = [
  {
    name: 'get_low_stock_items',
    description:
      'Returns all thans (bales) whose remaining_stock is below their reorder threshold (default 10 units). ' +
      'Use this when the user asks what is running low, what needs restocking, or what to reorder.',
    parameters: {
      type: 'object',
      properties: {
        threshold: {
          type: 'number',
          description: 'Minimum remaining_stock level to flag. Defaults to 10.',
        },
      },
      required: [],
    },
    execute: async (args, db) => {
      const threshold = args.threshold ?? 10
      const [rows] = await db.query(
        `SELECT t.than_id, t.than_name, t.remaining_stock, t.status,
                t.movement_speed, p.product_name, p.category,
                t.purchase_price_per_unit, t.sale_price_per_unit
         FROM   thans t
         JOIN   products p ON p.product_id = t.product_id
         WHERE  t.remaining_stock < ? AND t.status NOT IN ('sold_out','cancelled')
         ORDER  BY t.remaining_stock ASC
         LIMIT  50`,
        [threshold]
      )
      return { low_stock_items: rows, threshold, count: rows.length }
    },
  },

  {
    name: 'get_dead_stock_items',
    description:
      'Returns bales classified as dead stock — no movement for 60+ days. ' +
      'Use when the user asks about slow-moving inventory, dead stock, or liquidation candidates.',
    parameters: { type: 'object', properties: {}, required: [] },
    execute: async (_args, db) => {
      const [rows] = await db.query(
        `SELECT t.than_id, t.than_name, t.remaining_stock, t.movement_speed,
                t.status, p.product_name, p.category,
                t.purchase_price_per_unit, t.sale_price_per_unit,
                DATEDIFF(NOW(), t.updated_at) AS days_idle
         FROM   thans t
         JOIN   products p ON p.product_id = t.product_id
         WHERE  t.movement_speed = 'dead'
            AND t.remaining_stock > 0
         ORDER  BY days_idle DESC
         LIMIT  50`
      )
      return { dead_stock_items: rows, count: rows.length }
    },
  },

  {
    name: 'get_stock_summary_by_category',
    description:
      'Returns total remaining stock, number of bales, and average price grouped by product category. ' +
      'Use for a high-level inventory overview or when asked "what do we have in stock?"',
    parameters: { type: 'object', properties: {}, required: [] },
    execute: async (_args, db) => {
      const [rows] = await db.query(
        `SELECT p.category,
                COUNT(t.than_id)              AS bale_count,
                SUM(t.remaining_stock)        AS total_stock,
                AVG(t.sale_price_per_unit)    AS avg_sale_price,
                AVG(t.purchase_price_per_unit) AS avg_purchase_price
         FROM   thans t
         JOIN   products p ON p.product_id = t.product_id
         WHERE  t.status NOT IN ('sold_out','cancelled')
         GROUP  BY p.category
         ORDER  BY total_stock DESC`
      )
      return { category_summary: rows }
    },
  },

  {
    name: 'search_product_stock',
    description:
      'Search for a specific product by name or category and return its current stock details. ' +
      'Use when the user asks about a particular fabric, colour, or product.',
    parameters: {
      type: 'object',
      properties: {
        search_term: {
          type: 'string',
          description: 'Product name, category, or partial name to search for.',
        },
      },
      required: ['search_term'],
    },
    execute: async (args, db) => {
      const term = `%${args.search_term}%`
      const [rows] = await db.query(
        `SELECT t.than_id, t.than_name, t.remaining_stock, t.status,
                t.movement_speed, p.product_name, p.category,
                t.purchase_price_per_unit, t.sale_price_per_unit,
                t.updated_at
         FROM   thans t
         JOIN   products p ON p.product_id = t.product_id
         WHERE  (p.product_name LIKE ? OR p.category LIKE ? OR t.than_name LIKE ?)
           AND  t.status NOT IN ('sold_out','cancelled')
         ORDER  BY t.remaining_stock DESC
         LIMIT  30`,
        [term, term, term]
      )
      return { results: rows, search_term: args.search_term, count: rows.length }
    },
  },

  {
    name: 'get_inventory_movement_history',
    description:
      'Returns recent inventory movements (IN / OUT / ADJUSTMENT) for a specific bale or all bales. ' +
      'Use when tracing what happened to stock, or when debugging discrepancies.',
    parameters: {
      type: 'object',
      properties: {
        than_id: {
          type: 'number',
          description: 'Optional bale ID to filter movements for a single bale.',
        },
        limit: {
          type: 'number',
          description: 'Max records to return. Default 20.',
        },
      },
      required: [],
    },
    execute: async (args, db) => {
      const limit = args.limit ?? 20
      if (args.than_id) {
        const [rows] = await db.query(
          `SELECT im.movement_id, im.movement_type, im.quantity, im.movement_date,
                  im.notes, t.than_name, p.product_name
           FROM   inventory_movements im
           JOIN   thans t ON t.than_id = im.than_id
           JOIN   products p ON p.product_id = t.product_id
           WHERE  im.than_id = ?
           ORDER  BY im.movement_date DESC
           LIMIT  ?`,
          [args.than_id, limit]
        )
        return { movements: rows, than_id: args.than_id }
      }
      const [rows] = await db.query(
        `SELECT im.movement_id, im.movement_type, im.quantity, im.movement_date,
                im.notes, t.than_name, p.product_name, p.category
         FROM   inventory_movements im
         JOIN   thans t ON t.than_id = im.than_id
         JOIN   products p ON p.product_id = t.product_id
         ORDER  BY im.movement_date DESC
         LIMIT  ?`,
        [limit]
      )
      return { movements: rows, count: rows.length }
    },
  },
]
