
require('dotenv').config();
const pool = require('../src/db/pool');

const CATEGORIES = [
  'Electronics', 'Books', 'Clothing', 'Home & Kitchen', 'Sports',
  'Toys', 'Beauty', 'Automotive', 'Garden', 'Groceries',
];

const TOTAL_PRODUCTS = 200000;
const BATCH_SIZE = 1000;

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPrice() {
  return (Math.random() * 49900 + 99).toFixed(2); // ₹99.00 - ₹49,999.00
}

function randomPastDate(maxDaysAgo = 90) {
  const ms = Math.random() * maxDaysAgo * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - ms);
}

async function insertBatch(batch) {
  
  const values = [];
  const rowsSql = batch.map((p, i) => {
    const base = i * 4;
    values.push(p.name, p.category, p.price, p.createdAt);
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
  }).join(', ');

  const sql = `
    INSERT INTO products (name, category, price, created_at)
    VALUES ${rowsSql}
  `;

  await pool.query(sql, values);
}

async function main() {
  console.log(`Seeding ${TOTAL_PRODUCTS} products in batches of ${BATCH_SIZE}...`);
  const start = Date.now();

  for (let inserted = 0; inserted < TOTAL_PRODUCTS; inserted += BATCH_SIZE) {
    const batch = [];
    for (let j = 0; j < BATCH_SIZE; j++) {
      const category = randomFrom(CATEGORIES);
      batch.push({
        name: `${category} Item ${inserted + j + 1}`,
        category,
        price: randomPrice(),
        createdAt: randomPastDate(),
      });
    }
    await insertBatch(batch);

    if ((inserted / BATCH_SIZE) % 20 === 0) {
      console.log(`  inserted ${inserted + BATCH_SIZE} / ${TOTAL_PRODUCTS}`);
    }
  }

  console.log(`Done in ${(Date.now() - start) / 1000}s`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
