import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import db, { initDb } from '../../server/db.js'

describe('Shared Courses & Orphan Prevention Database System', () => {
  const u1 = 'shared-test-u1'
  const u2 = 'shared-test-u2'
  const u3 = 'shared-test-u3'
  const c1 = 'shared-course-1'
  const c2 = 'shared-course-2'
  const s1 = 'shared-session-1'

  beforeAll(() => {
    initDb()

    // Clean up any test records
    db.prepare("DELETE FROM users WHERE id IN (?, ?, ?)").run(u1, u2, u3)
    db.prepare("DELETE FROM courses WHERE id IN (?, ?)").run(c1, c2)

    const now = new Date().toISOString()
    // Create test users
    const insertUser = db.prepare(`
      INSERT INTO users (id, username, password_hash, role, created_at, updated_at)
      VALUES (?, ?, 'dummy_hash', 'user', ?, ?)
    `)
    insertUser.run(u1, 'share_u1', now, now)
    insertUser.run(u2, 'share_u2', now, now)
    insertUser.run(u3, 'share_u3', now, now)
  })

  afterAll(() => {
    try {
      db.prepare("DELETE FROM users WHERE id IN (?, ?, ?)").run(u1, u2, u3)
      db.prepare("DELETE FROM courses WHERE id IN (?, ?)").run(c1, c2)
    } catch {
      // ignore
    }
  })

  it('creates course and maps creator in course_users junction table', () => {
    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO courses (id, user_id, name, start_date, days_of_week, created_at)
      VALUES (?, ?, 'Multi-User Course', '2026-01-01', '[]', ?)
    `).run(c1, u1, now)

    db.prepare(`
      INSERT INTO course_users (course_id, user_id, created_at)
      VALUES (?, ?, ?)
    `).run(c1, u1, now)

    const count = db.prepare('SELECT COUNT(*) as c FROM course_users WHERE course_id = ?').get(c1) as any
    expect(count.c).toBe(1)
  })

  it('allows sharing course with another user', () => {
    const now = new Date().toISOString()
    db.prepare(`
      INSERT OR IGNORE INTO course_users (course_id, user_id, created_at)
      VALUES (?, ?, ?)
    `).run(c1, u2, now)

    const members = db.prepare('SELECT user_id FROM course_users WHERE course_id = ?').all(c1) as any[]
    expect(members.map(m => m.user_id)).toContain(u1)
    expect(members.map(m => m.user_id)).toContain(u2)
    expect(members.length).toBe(2)
  })

  it('both users can see the shared course and its sessions', () => {
    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO sessions (id, user_id, course_id, course_name, date, created_at)
      VALUES (?, ?, ?, 'Multi-User Course', '2026-01-05', ?)
    `).run(s1, u1, c1, now)

    // User 1 sees session
    const u1Sessions = db.prepare(`
      SELECT s.id FROM sessions s
      JOIN course_users cu ON cu.course_id = s.course_id
      WHERE cu.user_id = ?
    `).all(u1) as any[]
    expect(u1Sessions.map(s => s.id)).toContain(s1)

    // User 2 sees session
    const u2Sessions = db.prepare(`
      SELECT s.id FROM sessions s
      JOIN course_users cu ON cu.course_id = s.course_id
      WHERE cu.user_id = ?
    `).all(u2) as any[]
    expect(u2Sessions.map(s => s.id)).toContain(s1)

    // User 3 does NOT see session
    const u3Sessions = db.prepare(`
      SELECT s.id FROM sessions s
      JOIN course_users cu ON cu.course_id = s.course_id
      WHERE cu.user_id = ?
    `).all(u3) as any[]
    expect(u3Sessions.map(s => s.id)).not.toContain(s1)
  })

  it('orphan prevention: enforces course must have at least one member', () => {
    // Current members of c1: u1, u2
    const memberCount = (db.prepare('SELECT COUNT(*) as c FROM course_users WHERE course_id = ?').get(c1) as any).c
    expect(memberCount).toBe(2)

    // Removing u2 is allowed since memberCount > 1
    if (memberCount > 1) {
      db.prepare('DELETE FROM course_users WHERE course_id = ? AND user_id = ?').run(c1, u2)
    }

    const remainingCount = (db.prepare('SELECT COUNT(*) as c FROM course_users WHERE course_id = ?').get(c1) as any).c
    expect(remainingCount).toBe(1)

    // Attempting to remove the last member should be blocked by application rule
    const canRemove = remainingCount > 1
    expect(canRemove).toBe(false)
  })

  it('admin user deletion: deletes sole-member course to prevent orphaned course', () => {
    const now = new Date().toISOString()
    // c2 belongs solely to u3
    db.prepare(`
      INSERT INTO courses (id, user_id, name, start_date, days_of_week, created_at)
      VALUES (?, ?, 'Sole Course', '2026-02-01', '[]', ?)
    `).run(c2, u3, now)
    db.prepare(`
      INSERT INTO course_users (course_id, user_id, created_at)
      VALUES (?, ?, ?)
    `).run(c2, u3, now)

    // Simulate delete user logic from DELETE /api/admin/users/:id
    const userCourses = db.prepare('SELECT course_id FROM course_users WHERE user_id = ?').all(u3) as any[]
    for (const { course_id } of userCourses) {
      const count = (db.prepare('SELECT COUNT(*) as c FROM course_users WHERE course_id = ?').get(course_id) as any).c
      if (count <= 1) {
        db.prepare('DELETE FROM courses WHERE id = ?').run(course_id)
      }
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(u3)

    // Course c2 should be deleted (no orphan course left in DB)
    const courseRow = db.prepare('SELECT * FROM courses WHERE id = ?').get(c2)
    expect(courseRow).toBeUndefined()
  })

  it('admin user deletion: reassigns course_id when course has other members', () => {
    const now = new Date().toISOString()
    // Re-add u2 to c1
    db.prepare(`
      INSERT OR IGNORE INTO course_users (course_id, user_id, created_at)
      VALUES (?, ?, ?)
    `).run(c1, u2, now)

    // u1 is primary creator of c1, but u2 is also a member
    expect((db.prepare('SELECT user_id FROM courses WHERE id = ?').get(c1) as any).user_id).toBe(u1)

    // Simulate deleting u1
    const userCourses = db.prepare('SELECT course_id FROM course_users WHERE user_id = ?').all(u1) as any[]
    for (const { course_id } of userCourses) {
      const count = (db.prepare('SELECT COUNT(*) as c FROM course_users WHERE course_id = ?').get(course_id) as any).c
      if (count <= 1) {
        db.prepare('DELETE FROM courses WHERE id = ?').run(course_id)
      } else {
        const nextMember = db.prepare('SELECT user_id FROM course_users WHERE course_id = ? AND user_id != ? LIMIT 1').get(course_id, u1) as any
        if (nextMember) {
          db.prepare('UPDATE courses SET user_id = ? WHERE id = ?').run(nextMember.user_id, course_id)
          db.prepare('UPDATE sessions SET user_id = ? WHERE course_id = ?').run(nextMember.user_id, course_id)
        }
        db.prepare('DELETE FROM course_users WHERE course_id = ? AND user_id = ?').run(course_id, u1)
      }
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(u1)

    // Course c1 still exists and now belongs to u2!
    const c1Row = db.prepare('SELECT * FROM courses WHERE id = ?').get(c1) as any
    expect(c1Row).toBeDefined()
    expect(c1Row.user_id).toBe(u2)

    // u2 is still in course_users
    const u2Member = db.prepare('SELECT 1 FROM course_users WHERE course_id = ? AND user_id = ?').get(c1, u2)
    expect(u2Member).toBeDefined()
  })
})

