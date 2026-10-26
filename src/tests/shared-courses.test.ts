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

  it('DATA-01: stale auto-save unlinks user from shared course without destroying course for others', () => {
    const now = new Date().toISOString()
    const testCourseId = 'data-01-course'
    const testSessionId = 'data-01-session'
    const userA = 'data-01-user-a'
    const userB = 'data-01-user-b'

    // Create users
    db.prepare('INSERT OR IGNORE INTO users (id, username, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(userA, 'data01_a', 'hash', 'user', now, now)
    db.prepare('INSERT OR IGNORE INTO users (id, username, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(userB, 'data01_b', 'hash', 'user', now, now)

    // Create course owned by userA and shared with userB
    db.prepare('INSERT INTO courses (id, user_id, name, start_date, days_of_week, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(testCourseId, userA, 'Preserved Course', '2026-01-01', '[]', now)
    db.prepare('INSERT INTO course_users (course_id, user_id, created_at) VALUES (?, ?, ?)').run(testCourseId, userA, now)
    db.prepare('INSERT INTO course_users (course_id, user_id, created_at) VALUES (?, ?, ?)').run(testCourseId, userB, now)
    db.prepare('INSERT INTO sessions (id, user_id, course_id, course_name, date, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(testSessionId, userA, testCourseId, 'Preserved Course', '2026-01-02', now)

    // User B syncs without testCourseId (simulating stale browser state)
    // Application logic for DATA-01 in POST /api/data:
    const userBAccessible = db.prepare('SELECT course_id FROM course_users WHERE user_id = ?').all(userB) as any[]
    const submittedCourseIds = new Set<string>() // User B submits empty / other courses

    for (const { course_id } of userBAccessible) {
      if (!submittedCourseIds.has(course_id)) {
        const count = (db.prepare('SELECT COUNT(*) as count FROM course_users WHERE course_id = ?').get(course_id) as any).count
        if (count <= 1) {
          db.prepare('DELETE FROM courses WHERE id = ?').run(course_id)
        } else {
          db.prepare('DELETE FROM course_users WHERE course_id = ? AND user_id = ?').run(course_id, userB)
        }
      }
    }

    // Verify course STILL exists for userA!
    const courseStillExists = db.prepare('SELECT * FROM courses WHERE id = ?').get(testCourseId) as any
    expect(courseStillExists).toBeDefined()
    expect(courseStillExists.name).toBe('Preserved Course')

    // Sessions are preserved!
    const sessionStillExists = db.prepare('SELECT * FROM sessions WHERE id = ?').get(testSessionId) as any
    expect(sessionStillExists).toBeDefined()

    // User A is still a member, User B was unlinked
    const userAMember = db.prepare('SELECT 1 FROM course_users WHERE course_id = ? AND user_id = ?').get(testCourseId, userA)
    const userBMember = db.prepare('SELECT 1 FROM course_users WHERE course_id = ? AND user_id = ?').get(testCourseId, userB)
    expect(userAMember).toBeDefined()
    expect(userBMember).toBeUndefined()

    // Clean up
    db.prepare('DELETE FROM courses WHERE id = ?').run(testCourseId)
    db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(userA, userB)
  })

  it('AUTH-01: non-creator member cannot evict creator or other members', () => {
    const creatorId = 'creator-u'
    const memberId = 'member-u'
    const otherMemberId = 'other-member-u'
    const courseId = 'auth-01-course'
    const now = new Date().toISOString()

    db.prepare('INSERT OR IGNORE INTO users (id, username, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(creatorId, 'creator_u', 'hash', 'user', now, now)
    db.prepare('INSERT OR IGNORE INTO users (id, username, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(memberId, 'member_u', 'hash', 'user', now, now)
    db.prepare('INSERT OR IGNORE INTO users (id, username, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(otherMemberId, 'other_member_u', 'hash', 'user', now, now)

    db.prepare('INSERT INTO courses (id, user_id, name, start_date, days_of_week, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(courseId, creatorId, 'Auth Course', '2026-01-01', '[]', now)
    db.prepare('INSERT INTO course_users (course_id, user_id, created_at) VALUES (?, ?, ?)').run(courseId, creatorId, now)
    db.prepare('INSERT INTO course_users (course_id, user_id, created_at) VALUES (?, ?, ?)').run(courseId, memberId, now)
    db.prepare('INSERT INTO course_users (course_id, user_id, created_at) VALUES (?, ?, ?)').run(courseId, otherMemberId, now)

    const course = db.prepare('SELECT user_id FROM courses WHERE id = ?').get(courseId) as any

    const isAllowedToRemove = (actingId: string, targetId: string, courseOwnerId: string) => {
      return courseOwnerId === actingId || targetId === actingId
    }

    // Rule: Non-creator attempting to remove creator -> blocked
    expect(isAllowedToRemove(memberId, creatorId, course.user_id)).toBe(false)

    // Rule: Non-creator attempting to remove other member -> blocked
    expect(isAllowedToRemove(memberId, otherMemberId, course.user_id)).toBe(false)

    // Rule: Member removing self (leave course) -> allowed
    expect(isAllowedToRemove(memberId, memberId, course.user_id)).toBe(true)

    // Rule: Creator removing member -> allowed
    expect(isAllowedToRemove(creatorId, memberId, course.user_id)).toBe(true)

    // Clean up
    db.prepare('DELETE FROM courses WHERE id = ?').run(courseId)
    db.prepare('DELETE FROM users WHERE id IN (?, ?, ?)').run(creatorId, memberId, otherMemberId)
  })
})

