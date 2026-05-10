// backend/agents/tools/productTools.js
// CRUD tools for products and bales (thans)

export const productTools = [
  {
    name: 'list_products',
    description: 'List all products with optional category filter.',
    parameters: { type: 'object', properties: {
      category: { type: 'string', description: 'Optional category to filter by.' },
      limit:    { type: 'number', description: 'Max results. Default 30.' }
    }, required: [] },
    execute: async (args, db) => {
      const limit = args.limit ?? 30
      const where = args.category ? `WHERE category = '${args.category}'` : ''
      const [rows] = await db.query(
        `SELECT product_id, product_name, category, description, base_price, unit, created_at
         FROM products ${where} ORDER BY product_name LIMIT ?`, [limit]
      )
      return { products: rows, count: rows.length }
    }
  },

  {
    name: 'add_product',
    description: 'Add a new product to the catalogue. Use when user says add product, create product, or new product.',
    parameters: { type: 'object', properties: {
      product_name: { type: 'string' },
      category:     { type: 'string' },
      description:  { type: 'string' },
      base_price:   { type: 'number' },
      unit:         { type: 'string' }
    }, required: ['product_name', 'category', 'base_price', 'unit'] },
    execute: async (args, db) => {
      const [result] = await db.query(
        `INSERT INTO products (product_name, category, description, base_price, unit, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [args.product_name, args.category, args.description || '', args.base_price, args.unit]
      )
      return { success: true, product_id: result.insertId, product_name: args.product_name, message: `Product "${args.product_name}" added with ID ${result.insertId}.` }
    }
  },

  {
    name: 'update_product',
    description: 'Update product details like price, description, or category.',
    parameters: { type: 'object', properties: {
      product_id:   { type: 'number' },
      product_name: { type: 'string' },
      base_price:   { type: 'number' },
      description:  { type: 'string' },
      category:     { type: 'string' }
    }, required: ['product_id'] },
    execute: async (args, db) => {
      const fields = []; const vals = []
      if (args.product_name) { fields.push('product_name = ?'); vals.push(args.product_name) }
      if (args.base_price  ) { fields.push('base_price = ?');   vals.push(args.base_price)   }
      if (args.description ) { fields.push('description = ?');  vals.push(args.description)  }
      if (args.category    ) { fields.push('category = ?');     vals.push(args.category)     }
      if (!fields.length) return { error: 'No fields to update.' }
      vals.push(args.product_id)
      await db.query(`UPDATE products SET ${fields.join(', ')}, updated_at = NOW() WHERE product_id = ?`, vals)
      return { success: true, product_id: args.product_id, updated_fields: fields.map(f => f.split(' ')[0]) }
    }
  },

  {
    name: 'update_stock_quantity',
    description: 'Manually adjust stock quantity for a bale (than). Use when user says update stock, set stock to X, or adjust inventory.',
    parameters: { type: 'object', properties: {
      than_id:   { type: 'number' },
      new_stock: { type: 'number' },
      reason:    { type: 'string' }
    }, required: ['than_id', 'new_stock'] },
    execute: async (args, db) => {
      const [[than]] = await db.query(`SELECT than_id, than_name, remaining_stock FROM thans WHERE than_id = ?`, [args.than_id])
      if (!than) return { error: `Bale #${args.than_id} not found` }
      const oldStock = than.remaining_stock
      await db.query(`UPDATE thans SET remaining_stock = ?, updated_at = NOW() WHERE than_id = ?`, [args.new_stock, args.than_id])
      await db.query(
        `INSERT INTO inventory_movements (than_id, movement_type, quantity, notes, movement_date) VALUES (?, 'ADJUSTMENT', ?, ?, NOW())`,
        [args.than_id, args.new_stock - oldStock, args.reason || 'Manual adjustment by AI agent']
      )
      return { success: true, than_id: args.than_id, old_stock: oldStock, new_stock: args.new_stock }
    }
  },

  {
    name: 'get_product_by_name',
    description: 'Search for a product by name and return its ID and details.',
    parameters: { type: 'object', properties: {
      name: { type: 'string' }
    }, required: ['name'] },
    execute: async (args, db) => {
      const [rows] = await db.query(
        `SELECT product_id, product_name, category, base_price, unit FROM products WHERE product_name LIKE ? LIMIT 5`,
        [`%${args.name}%`]
      )
      return { products: rows, count: rows.length }
    }
  }
]
