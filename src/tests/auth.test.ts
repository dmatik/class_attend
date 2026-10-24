import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import db, { initDb } from '../../server/db.js'
import bcrypt from 'bcryptjs'

describe('SQLite Database & Auth System', () => {
  beforeAll(() => {
    // Ensure database and tables are created first
    initDb()
    // Clean up any leftovers from prior runs
    db.prepare("DELETE FROM users WHERE id IN ('u1', 'test-user-1', 'test-user-2', 'temp-user')").run()
    db.prepare("UPDATE users SET username = 'admin', password_hash = ? WHERE id = 'admin-default'")
      .run(bcrypt.hashSync('admin', 10))
  })

  afterAll(() => {
    try {
      db.prepare("DELETE FROM users WHERE id IN ('u1', 'test-user-1', 'test-user-2', 'temp-user')").run()
      if (db.open) {
        db.close()
      }
    } catch {
      // ignore
    }
  })

  it('initializes database with default admin user (admin / admin)', () => {
    const adminUser = db.prepare('SELECT * FROM users WHERE role = ?').get('admin') as any
    expect(adminUser).toBeDefined()
    expect(adminUser.username).toBe('admin')
    expect(adminUser.role).toBe('admin')
    expect(bcrypt.compareSync('admin', adminUser.password_hash)).toBe(true)
  })

  it('allows updating admin credentials in database', () => {
    const newHash = bcrypt.hashSync('newSecretPassword123', 10)
    db.prepare("UPDATE users SET username = 'admin_updated', password_hash = ? WHERE id = 'admin-default'")
      .run(newHash)

    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get('admin-default') as any
    expect(updatedUser.username).toBe('admin_updated')
    expect(bcrypt.compareSync('newSecretPassword123', updatedUser.password_hash)).toBe(true)

    // Restore to admin / admin
    db.prepare("UPDATE users SET username = 'admin', password_hash = ? WHERE id = 'admin-default'")
      .run(bcrypt.hashSync('admin', 10))
  })

  it('enforces unique usernames (case-insensitive)', () => {
    expect(() => {
      db.prepare(`
        INSERT INTO users (id, username, password_hash, role, created_at, updated_at)
        VALUES ('u1', 'ADMIN', 'hash', 'user', 'now', 'now')
      `).run()
    }).toThrow()
  })

  it('scopes courses and sessions per user', () => {
    const user1Id = 'test-user-1'
    const user2Id = 'test-user-2'
    const now = new Date().toISOString()

    // Create user 1 and user 2
    db.prepare(`
      INSERT OR REPLACE INTO users (id, username, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(user1Id, 'user1', 'hash', 'user', now, now)

    db.prepare(`
      INSERT OR REPLACE INTO users (id, username, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(user2Id, 'user2', 'hash', 'user', now, now)

    // Insert course for user 1
    db.prepare(`
      INSERT OR REPLACE INTO courses (id, user_id, name, start_date, days_of_week, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('c1', user1Id, 'User 1 Course', '2026-03-01', '[1]', now)

    // Insert course for user 2
    db.prepare(`
      INSERT OR REPLACE INTO courses (id, user_id, name, start_date, days_of_week, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('c2', user2Id, 'User 2 Course', '2026-03-01', '[2]', now)

    // Verify user 1 only sees user 1 courses
    const user1Courses = db.prepare('SELECT * FROM courses WHERE user_id = ?').all(user1Id) as any[]
    expect(user1Courses).toHaveLength(1)
    expect(user1Courses[0].name).toBe('User 1 Course')

    // Verify user 2 only sees user 2 courses
    const user2Courses = db.prepare('SELECT * FROM courses WHERE user_id = ?').all(user2Id) as any[]
    expect(user2Courses).toHaveLength(1)
    expect(user2Courses[0].name).toBe('User 2 Course')
  })

  it('cascades deletion of courses and sessions when user is deleted', () => {
    const tempUserId = 'temp-user'
    const now = new Date().toISOString()

    db.prepare(`
      INSERT OR REPLACE INTO users (id, username, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(tempUserId, 'tempuser', 'hash', 'user', now, now)

    db.prepare(`
      INSERT OR REPLACE INTO courses (id, user_id, name, start_date, days_of_week, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('temp-course', tempUserId, 'Temp Course', '2026-03-01', '[1]', now)

    db.prepare(`
      INSERT OR REPLACE INTO sessions (id, user_id, course_id, course_name, date, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('temp-session', tempUserId, 'temp-course', 'Temp Course', '2026-03-02', now)

    // Delete user
    db.prepare('DELETE FROM users WHERE id = ?').run(tempUserId)

    // Verify courses and sessions are deleted
    const courses = db.prepare('SELECT * FROM courses WHERE user_id = ?').all(tempUserId)
    const sessions = db.prepare('SELECT * FROM sessions WHERE user_id = ?').all(tempUserId)
    expect(courses).toHaveLength(0)
    expect(sessions).toHaveLength(0)
  })
})

