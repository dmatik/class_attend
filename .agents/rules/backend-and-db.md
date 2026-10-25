# Backend & SQLite Database Rules

## 1. Better-SQLite3 Synchronous Architecture

The database engine is `better-sqlite3`.

### Critical Rule: Synchronous Calls Only
* `better-sqlite3` is **100% synchronous**.
* **DO NOT** use `await` or callbacks when executing database statements.
* Correct patterns:
  ```js
  // Insert / Update / Delete
  const result = db.prepare('INSERT INTO ... VALUES (?, ?)').run(val1, val2);

  // Single row query
  const row = db.prepare('SELECT * FROM ... WHERE id = ?').get(id);

  // Multi-row query
  const rows = db.prepare('SELECT * FROM ... WHERE user_id = ?').all(userId);
  ```

---

## 2. Multi-Tenant Scoping & Security

`class_attend` is a multi-user system where all business entities belong to a specific user.

1. **Always Scope by `user_id`**:
   * Any query fetching or modifying `courses` or `sessions` **must** filter by `user_id`:
     ```js
     const courses = db.prepare('SELECT * FROM courses WHERE user_id = ?').all(req.user.id);
     ```
   * Never query `SELECT * FROM courses` without a user filter (unless specifically building an admin system-wide audit).
2. **Prevent SQL Injection**:
   * **Always** use parameterized statements (`?`).
   * Never concatenate or interpolate variables into SQL query strings.
3. **Foreign Keys & Cascade Deletes**:
   * SQLite runs with `PRAGMA foreign_keys = ON;`.
   * Tables have `REFERENCES users(id) ON DELETE CASCADE`.
   * Deleting a user automatically cascades to all courses, sessions, and passkey authenticators.

---

## 3. Express 5 & API Architecture

* **Authentication Middleware**: All `/api/*` endpoints (except `/api/auth/login` and WebAuthn authentication) require the `authenticate` middleware, which validates JWT Bearer tokens and attaches `req.user`.
* **Caching Headers**: All `/api/*` routes must return `Cache-Control: no-store, no-cache, must-revalidate` to prevent stale client caching.
* **Error Handling**: Use structured JSON error responses: `res.status(4xx/5xx).json({ error: 'Descriptive message' })`.

