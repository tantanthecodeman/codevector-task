
const express = require('express');
const pool = require('../db/pool');
const { encodeCursor, decodeCursor } = require('../utils/cursor');

const router = express.Router();

router.get('/products', async (req, res, next) => {
  try {
    
    const category = req.query.category ? String(req.query.category) : null;

    let limit = parseInt(req.query.limit, 10);
    if (!Number.isFinite(limit) || limit <= 0) limit = 20;
    limit = Math.min(limit, 100); 

    let cursor = null;
    if (req.query.cursor) {
      cursor = decodeCursor(req.query.cursor); 
    }
    const conditions = [];
    const values = [];

    if (category) {
      values.push(category);
      conditions.push(`category = $${values.length}`);
    }

    if (cursor) {
  
      values.push(cursor.createdAt, cursor.id);
      conditions.push(`(created_at, id) < ($${values.length - 1}, $${values.length})`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    values.push(limit + 1);
    const limitParamIndex = values.length;

    const sql = `
      SELECT id, name, category, price, created_at, updated_at
      FROM products
      ${whereClause}
      ORDER BY created_at DESC, id DESC
      LIMIT $${limitParamIndex}
    `;

    const { rows } = await pool.query(sql, values);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    const last = items[items.length - 1];
    const nextCursor = hasMore && last
      ? encodeCursor({ createdAt: last.created_at, id: last.id })
      : null;

    res.json({ items, nextCursor, hasMore });
  } catch (err) {
    next(err); 
  }
});

module.exports = router;
