// backend/agents/tools/salesTools.js
// Real database-backed tools for the Sales Agent.

export const salesTools = [
  {
    name: 'get_sales_summary',
    description:
      'Returns total revenue, units sold, and transaction count for a given period. ' +
      'Use when asked for weekly/monthly sales summary, total revenue, or sales performance.',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'this_week', 'this_month', 'last_month', 'last_30_days', 'last_90_days'],
          description: 'Time period for the summary.',
        },
      },
      required: ['period'],
    },
    execute: async (args, db) => {
      const periodMap = {
        today:        'DATE(transaction_date) = CURDATE()',
        this_week:    'YEARWEEK(transaction_date, 1) = YEARWEEK(NOW(), 1)',
        this_month:   'MONTH(transaction_date) = MONTH(NOW()) AND YEAR(transaction_date) = YEAR(NOW())',
        last_month:   'MONTH(transaction_date) = MONTH(NOW() - INTERVAL 1 MONTH) AND YEAR(transaction_date) = YEAR(NOW() - INTERVAL 1 MONTH)',
        last_30_days: 'transaction_date >= NOW() - INTERVAL 30 DAY',
        last_90_days: 'transaction_date >= NOW() - INTERVAL 90 DAY',
      }
      const condition = periodMap[args.period] || periodMap['this_month']
      const [rows] = await db.query(
        `SELECT COUNT(*)           AS transaction_count,
                SUM(total_amount)  AS total_revenue,
                SUM(quantity)      AS total_units_sold,
                AVG(total_amount)  AS avg_transaction_value
         FROM   transactions
         WHERE  ${condition} AND transaction_type = 'sale'`
      )
      return { period: args.period, summary: rows[0] }
    },
  },

  {
    name: 'get_top_selling_products',
    description:
      'Returns the best-selling products by revenue or quantity sold. ' +
      'Use when asked what is selling best, top performers, or bestsellers.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of products to return. Default 10.' },
        days:  { type: 'number', description: 'Look-back window in days. Default 30.' },
      },
      required: [],
    },
    execute: async (args, db) => {
      const limit = args.limit ?? 10
      const days  = args.days  ?? 30
      const [rows] = await db.query(
        `SELECT p.product_name, p.category,
                SUM(tx.quantity)     AS total_units_sold,
                SUM(tx.total_amount) AS total_revenue,
                COUNT(tx.id)         AS transaction_count
         FROM   transactions tx
         JOIN   products p ON p.product_id = tx.product_id
         WHERE  tx.transaction_type = 'sale'
           AND  tx.transaction_date >= NOW() - INTERVAL ? DAY
         GROUP  BY p.product_id, p.product_name, p.category
         ORDER  BY total_revenue DESC
         LIMIT  ?`,
        [days, limit]
      )
      return { top_products: rows, days, limit }
    },
  },

  {
    name: 'get_sales_by_retailer',
    description:
      'Returns sales breakdown per retailer for a given period. ' +
      'Use when asked which retailers are buying most, or retailer-wise revenue.',
    parameters: {
      type: 'object',
      properties: {
        days:  { type: 'number', description: 'Look-back window in days. Default 30.' },
        limit: { type: 'number', description: 'Number of retailers. Default 10.' },
      },
      required: [],
    },
    execute: async (args, db) => {
      const days  = args.days  ?? 30
      const limit = args.limit ?? 10
      const [rows] = await db.query(
        `SELECT r.retailer_id, r.name AS retailer_name, r.city,
                SUM(tx.total_amount) AS total_purchases,
                COUNT(tx.id)         AS transaction_count,
                SUM(tx.quantity)     AS total_units
         FROM   transactions tx
         JOIN   retailers r ON r.retailer_id = tx.retailer_id
         WHERE  tx.transaction_type = 'sale'
           AND  tx.transaction_date >= NOW() - INTERVAL ? DAY
         GROUP  BY r.retailer_id, r.name, r.city
         ORDER  BY total_purchases DESC
         LIMIT  ?`,
        [days, limit]
      )
      return { retailer_sales: rows, days, limit }
    },
  },

  {
    name: 'get_daily_sales_trend',
    description:
      'Returns day-by-day revenue and unit totals for the past N days. ' +
      'Use to identify sales trends, spikes, or slow days.',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Number of past days to return. Default 14.' },
      },
      required: [],
    },
    execute: async (args, db) => {
      const days = args.days ?? 14
      const [rows] = await db.query(
        `SELECT DATE(transaction_date)  AS sale_date,
                SUM(total_amount)       AS revenue,
                SUM(quantity)           AS units_sold,
                COUNT(*)                AS transactions
         FROM   transactions
         WHERE  transaction_type = 'sale'
           AND  transaction_date >= NOW() - INTERVAL ? DAY
         GROUP  BY sale_date
         ORDER  BY sale_date ASC`,
        [days]
      )
      return { daily_trend: rows, days }
    },
  },

  {
    name: 'get_outstanding_payments',
    description:
      'Returns retailers with unpaid or partially paid balances. ' +
      'Use when asked about dues, outstanding payments, or credit exposure.',
    parameters: {
      type: 'object',
      properties: {
        min_amount: { type: 'number', description: 'Minimum outstanding balance to include. Default 0.' },
      },
      required: [],
    },
    execute: async (args, db) => {
      const minAmount = args.min_amount ?? 0
      const [rows] = await db.query(
        `SELECT r.retailer_id, r.name AS retailer_name, r.phone, r.city,
                SUM(tx.total_amount - COALESCE(tx.amount_paid, 0)) AS outstanding_balance,
                COUNT(*) AS unpaid_invoices
         FROM   transactions tx
         JOIN   retailers r ON r.retailer_id = tx.retailer_id
         WHERE  tx.payment_status IN ('unpaid','partial')
           AND  tx.transaction_type = 'sale'
         GROUP  BY r.retailer_id, r.name, r.phone, r.city
         HAVING outstanding_balance > ?
         ORDER  BY outstanding_balance DESC
         LIMIT  50`,
        [minAmount]
      )
      return { outstanding_payments: rows, count: rows.length }
    },
  },
]
