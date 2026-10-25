---
name: db-migration
description: Safe procedure for modifying and evolving the SQLite database schema in class_attend. Use when adding tables, columns, indexes, or running database migrations.
---

# SQLite Database Migration Runbook

Follow these steps whenever modifying the SQLite database schema in `class_attend`:

---

## 1. Golden Rules of Database Evolution in `class_attend`

1. **Database Path**: The database file is strictly [`data/class_attend.db`](../../data/class_attend.db). Never create or use any other database file (e.g. `attendance.db`).
2. **Synchronous Execution**: All schema statements must be executed synchronously using `db.exec(...)` or `db.prepare(...).run()`.
3. **Foreign Keys**: Always ensure `PRAGMA foreign_keys = ON;` is enabled.
4. **WAL Mode**: Always maintain `PRAGMA journal_mode = WAL;`.
5. **Cascading Deletes**: Every child table must reference `users(id) ON DELETE CASCADE`.

---

## 2. Adding a New Column to an Existing Table

SQLite supports `ALTER TABLE <table_name> ADD COLUMN <col_name> <type> DEFAULT <val>`.

In [`server/db.js`](../../server/db.js), append a safe idempotent migration check inside `initDb()`:
```javascript
// Example: Add status column if it doesn't exist
try {
  const tableInfo = db.prepare("PRAGMA table_info(courses)").all();
  const hasColumn = tableInfo.some(col => col.name === 'color');
  if (!hasColumn) {
    db.exec("ALTER TABLE courses ADD COLUMN color TEXT DEFAULT '#3b82f6'");
    console.log("Added 'color' column to courses table");
  }
} catch (err) {
  console.error("Migration error:", err);
}
```

---

## 3. Adding a New Table

In [`server/db.js`](../../server/db.js), add the `CREATE TABLE IF NOT EXISTS` block inside `initDb()`:
```sql
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
```

---

## 4. Verification

After updating `server/db.js`:
1. Verify database schema via CLI:
   ```bash
   sqlite3 data/class_attend.db ".schema <table_name>"
   ```
2. Run database auth tests:
   ```bash
   npx vitest run src/tests/auth.test.ts
   ```
3. Run full E2E test suite to verify no regressions:
   ```bash
   npm run test:e2e
   ```

