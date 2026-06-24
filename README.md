# Product Browser API

A backend for browsing **200,000+ products** with:

* Fast pagination at any page depth
* Category filtering
* Correct results while data is changing
* Proof that pagination remains correct during concurrent inserts and updates

Built as a submission for the CodeVector Backend Take-Home Task.

---

# Live Demo

**Backend URL:**
`(https://codevector-task-wbb0.onrender.com/)`

**API Endpoint:**
`(https://codevector-task-wbb0.onrender.com/api/products)`

**Health Check:**
`https://codevector-task-wbb0.onrender.com/health`

---

# Problem Statement

The task was to build a backend capable of:

1. Browsing ~200,000 products.
2. Showing newest products first.
3. Supporting category filtering.
4. Providing fast pagination.
5. Remaining correct while products are being inserted and updated concurrently.

The key requirement was not simply returning data, but ensuring users never:

* See duplicate products.
* Miss products that existed when they started browsing.

---

# Architecture

```text
Browser / Client
        │
        ▼
Node.js + Express API
        │
        ▼
Cursor Pagination Layer
        │
        ▼
PostgreSQL (Neon)
        │
        ├── Products Table
        ├── Composite Indexes
        └── Triggers
```

---

# Technology Choices

## Backend

### Node.js + Express

Chosen because:

* Lightweight
* Simple routing
* Excellent PostgreSQL support
* Easy deployment on Render

---

## Database

### PostgreSQL (Neon)

Chosen because:

* Strong support for composite indexes
* Efficient tuple comparisons
* Reliable ordering guarantees
* Excellent performance for large datasets

---

## Hosting

### Render

Used for backend deployment because:

* Free tier available
* No credit card required
* GitHub integration
* Easy deployment workflow

---

## Database Hosting

### Neon

Used because:

* Free hosted PostgreSQL
* Fast setup
* Reliable SSL connections
* Suitable for this scale of project

---

# Database Design

## Products Table

Each product contains:

```sql
id
name
category
price
created_at
updated_at
```

### Why both timestamps?

`created_at`

* Determines position in the feed.
* Never changes.

`updated_at`

* Tracks modifications.
* Changes automatically via trigger.

This separation is important because using `updated_at` for sorting would allow products to jump around in the feed and cause duplicates.

---

# Pagination Strategy

## Why Not OFFSET Pagination?

Traditional pagination:

```sql
SELECT *
FROM products
ORDER BY created_at DESC
LIMIT 20 OFFSET 100000;
```

Problems:

### Performance

PostgreSQL must:

1. Read 100,000 rows.
2. Discard them.
3. Return 20 rows.

Performance degrades as pages get deeper.

---

### Consistency

If new rows are inserted:

```text
Page 1 viewed
New products inserted
Page 2 requested
```

Users may:

* See duplicates.
* Miss records.

---

# Keyset Pagination

Instead of asking:

```text
Give me page 50
```

The client asks:

```text
Give me products older than the last product I already saw
```

Example:

```sql
WHERE (created_at, id)
<
('2026-06-24 12:00:00', 100)
```

Benefits:

* Constant performance.
* Uses indexes efficiently.
* Correct during concurrent writes.

---

# Why Use (created_at, id)?

Products can share identical timestamps.

Example:

```text
created_at = 2026-06-24 12:00:00
```

for many rows.

Using:

```sql
ORDER BY created_at DESC
```

alone is not deterministic.

Adding:

```sql
ORDER BY created_at DESC, id DESC
```

guarantees stable ordering.

---

# Indexing Strategy

## Primary Pagination Index

```sql
(created_at DESC, id DESC)
```

Supports:

```sql
ORDER BY created_at DESC, id DESC
```

and

```sql
(created_at, id) < (...)
```

efficiently.

---

## Category Filtering Index

```sql
(category, created_at DESC, id DESC)
```

Supports:

```sql
WHERE category = ?
ORDER BY created_at DESC, id DESC
```

without scanning unrelated categories.

---

# Cursor Design

The API returns:

```json
{
  "items": [...],
  "nextCursor": "...",
  "hasMore": true
}
```

The cursor contains:

```json
{
  "createdAt": "...",
  "id": ...
}
```

encoded as Base64.

Reasons:

* Keeps implementation simple.
* Prevents clients from constructing invalid cursors manually.
* Allows stateless pagination.

---

# Handling Concurrent Writes

This is the most important requirement of the assignment.

During browsing:

```text
User opens page 1
```

Then:

```text
50 inserts occur
50 updates occur
```

The system still guarantees:

* No duplicates
* No skipped rows

because:

### New Inserts

New products receive:

```text
created_at = now()
```

which is newer than the user's cursor.

Therefore they appear ahead of the user's browsing position.

---

### Updates

Updates modify:

```text
updated_at
```

only.

They do NOT modify:

```text
created_at
```

Therefore updated products never move position.

---

# Concurrency Verification

A dedicated script:

```bash
npm run test:concurrency
```

proves correctness.

The script:

1. Takes a snapshot of all IDs.
2. Begins paginating.
3. Inserts 50 new products.
4. Updates 50 products.
5. Verifies:

   * No duplicates.
   * No missing rows.

The test runs:

* Unfiltered
* Category filtered

Both must pass.

---

# Seed Strategy

200,000 products are generated using:

```bash
npm run seed
```

Instead of:

```text
1 INSERT per product
```

the script performs:

```text
1000-row batched inserts
```

reducing database round trips dramatically.

This makes seeding significantly faster.

---

# API

## Get Products

```http
GET /api/products
```

### Query Parameters

```http
limit=20
category=Electronics
cursor=<opaque_cursor>
```

### Example

```http
GET /api/products?limit=20&category=Books
```

---

## Response

```json
{
  "items": [...],
  "nextCursor": "...",
  "hasMore": true
}
```

---

# Running Locally

## Install

```bash
npm install
```

---

## Environment

Create:

```env
DATABASE_URL=your_database_url
PORT=3000
```

---

## Create Schema

```bash
psql "$DATABASE_URL" -f schema.sql
```

---

## Seed Data

```bash
npm run seed
```

---

## Start Server

```bash
npm start
```

---

## Run Concurrency Verification

```bash
npm run test:concurrency
```

---

# What I Would Improve With More Time

### API Improvements

* Rate limiting
* Request validation middleware
* API versioning

### Database Improvements

* Partitioning for larger datasets
* Read replicas
* Materialized views for analytics

### Infrastructure

* Docker support
* CI/CD pipeline
* Automated integration testing

### Observability

* Structured logging
* Metrics collection
* Performance dashboards

---

# How I Used AI

AI was used as an engineering assistant, not as a replacement for understanding.

It helped with:

* Exploring pagination approaches
* Reviewing database indexing strategies
* Generating initial implementation ideas
* Refining documentation

All implementation details were reviewed, tested, and modified manually.

One bug that was caught and fixed during development involved cursor decoding, where a typo in the cursor payload field caused paginated requests to fail after the first page. The issue was diagnosed through logging and corrected after inspecting the pagination flow.

---

# What I Learned

This project reinforced several important backend engineering concepts:

* Why keyset pagination is superior to OFFSET pagination for large datasets.
* How concurrent writes affect pagination correctness.
* How composite indexes influence query performance.
* How PostgreSQL tuple comparisons work.
* Why deterministic ordering is critical when building scalable APIs.

The most valuable takeaway was learning how to design for correctness first, then performance, rather than treating them as separate concerns.
