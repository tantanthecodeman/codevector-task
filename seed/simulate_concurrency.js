
require('dotenv').config();
const pool = require('../src/db/pool');

const PAGE_SIZE = 500;

async function snapshotIds(category) {
  const { rows } = category
    ? await pool.query('SELECT id FROM products WHERE category = $1', [category])
    : await pool.query('SELECT id FROM products');
  return new Set(rows.map((r) => r.id));
}

async function insertNewAndUpdateExisting(category) {
  const targetCategory = category || 'Electronics';

  const values = [];
  const rowsSql = [];
  for (let i = 0; i < 50; i++) {
    const base = i * 3;
    values.push(`Concurrency Test Item ${i}`, targetCategory, (Math.random() * 4900 + 99).toFixed(2));
    rowsSql.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
  }
  await pool.query(
    `INSERT INTO products (name, category, price) VALUES ${rowsSql.join(', ')}`,
    values,
  );

  if (category) {
    await pool.query(
      `UPDATE products SET price = price + 1
       WHERE id IN (SELECT id FROM products WHERE category = $1 ORDER BY id ASC LIMIT 50)`,
      [category],
    );
  } else {
    await pool.query(
      `UPDATE products SET price = price + 1
       WHERE id IN (SELECT id FROM products ORDER BY id ASC LIMIT 50)`,
    );
  }
}

async function runPaginationTest(category) {
  const label = category ? `category="${category}"` : 'unfiltered';
  console.log(`\n--- Running test: ${label} ---`);

  const startingIds = await snapshotIds(category);
  console.log(`Snapshot: ${startingIds.size} products exist before pagination starts.`);

  const seenSet = new Set();
  let seenCount = 0;
  let cursor = null;
  let page = 0;
  let injectedWrites = false;

  while (true) {
    
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
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT id, created_at FROM products ${where} ORDER BY created_at DESC, id DESC LIMIT ${PAGE_SIZE}`,
      values,
    );
    if (rows.length === 0) break;

    for (const r of rows) {
      if (seenSet.has(r.id)) {
        console.error(`DUPLICATE detected: id ${r.id} returned twice!`);
      }
      seenSet.add(r.id);
      seenCount += 1;
    }

    cursor = { createdAt: rows[rows.length - 1].created_at, id: rows[rows.length - 1].id };
    page += 1;

    if (!injectedWrites && page === 3) {
      console.log('Injecting 50 inserts + 50 updates mid-pagination...');
      await insertNewAndUpdateExisting(category);
      injectedWrites = true;
    }

    if (rows.length < PAGE_SIZE) break; // reached the last page
  }

  const missing = [...startingIds].filter((id) => !seenSet.has(id));
  console.log(`Pages fetched: ${page}`);
  console.log(`Total rows seen: ${seenCount}, unique: ${seenSet.size}`);
  console.log(`Missing from original snapshot: ${missing.length}`);

  const pass = missing.length === 0 && seenCount === seenSet.size;
  console.log(pass ? 'PASS' : 'FAIL — see details above.');
  return pass;
}

async function main() {
  const unfilteredPass = await runPaginationTest(null);
  const filteredPass = await runPaginationTest('Electronics');

  console.log('\n=== Summary ===');
  console.log(`Unfiltered:             ${unfilteredPass ? 'PASS' : 'FAIL'}`);
  console.log(`Filtered (Electronics): ${filteredPass ? 'PASS' : 'FAIL'}`);

  await pool.end();

  if (!unfilteredPass || !filteredPass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
