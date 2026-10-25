import db from '../../server/db.js';
import bcrypt from 'bcryptjs';
import { Page, expect } from '@playwright/test';

export interface TestUser {
  id: string;
  username: string;
  password: string;
  role: 'admin' | 'user';
}

/**
 * Creates a unique dedicated test user directly in the database.
 */
export function createTestUser(role: 'admin' | 'user' = 'admin'): TestUser {
  const uniqueId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const username = `e2e_user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const password = `Pass_${Date.now()}!`;
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, username, password_hash, first_name, last_name, avatar, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uniqueId,
    username,
    passwordHash,
    'E2E',
    'TestUser',
    '',
    role,
    now,
    now
  );

  return { id: uniqueId, username, password, role };
}

/**
 * Deletes a dedicated test user and all associated courses/sessions from the database.
 */
export function deleteTestUser(userId: string) {
  try {
    // Delete user (foreign key CASCADE removes courses and sessions)
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    // Explicit safety sweep for any orphaned courses/sessions for this user
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM courses WHERE user_id = ?').run(userId);
  } catch (err) {
    console.error(`Failed to delete test user ${userId}:`, err);
  }
}

/**
 * Sweeps any lingering E2E test users (prefixed with e2e_).
 */
export function cleanupAllTestUsers() {
  try {
    db.prepare("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'e2e_%' OR id LIKE 'e2e_%')").run();
    db.prepare("DELETE FROM courses WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'e2e_%' OR id LIKE 'e2e_%')").run();
    db.prepare("DELETE FROM users WHERE username LIKE 'e2e_%' OR id LIKE 'e2e_%'").run();
  } catch (err) {
    console.error('Failed to cleanup all test users:', err);
  }
}

/**
 * Logs in with a specific test user in Playwright.
 */
export async function loginWithUser(page: Page, user: TestUser) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.fill('#username', user.username);
  await page.fill('#password', user.password);
  await page.click('button[type="submit"]');

  // Wait until logged in (desktop sidebar button visible)
  await expect(page.locator('aside button').first()).toBeVisible();
}
