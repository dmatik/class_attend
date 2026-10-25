import { test, expect } from '@playwright/test';
import { createTestUser, deleteTestUser, cleanupAllTestUsers, TestUser } from './helpers/auth';

test.describe('Authentication Flow', () => {
  let dedicatedUser: TestUser | null = null;

  test.beforeAll(() => {
    cleanupAllTestUsers();
  });

  test.beforeEach(async ({ page }) => {
    // Clear tokens before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test.afterEach(async () => {
    if (dedicatedUser) {
      deleteTestUser(dedicatedUser.id);
      dedicatedUser = null;
    }
  });

  test.afterAll(() => {
    cleanupAllTestUsers();
  });

  test('displays login form with username, password and submit button', async ({ page }) => {
    await page.goto('/');

    const usernameInput = page.locator('#username');
    const passwordInput = page.locator('#password');
    const submitButton = page.locator('button[type="submit"]');

    await expect(usernameInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
  });

  test('shows error notification on invalid credentials', async ({ page }) => {
    await page.goto('/');

    await page.fill('#username', 'nonexistent_user_123');
    await page.fill('#password', 'wrong_password_123');
    await page.click('button[type="submit"]');

    // Should display an error alert box
    const errorBox = page.locator('.bg-destructive\\/15');
    await expect(errorBox).toBeVisible();
  });

  test('successfully logs in with dedicated test user and logs out', async ({ page }) => {
    // 1. Create a dedicated isolated test user
    dedicatedUser = createTestUser('admin');

    await page.goto('/');
    await page.fill('#username', dedicatedUser.username);
    await page.fill('#password', dedicatedUser.password);
    await page.click('button[type="submit"]');

    // Should navigate to dashboard / authenticated shell
    const accountButton = page.locator('aside button').first();
    await expect(accountButton).toBeVisible();

    // Verify localStorage has the auth token
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(token).toBeTruthy();

    // Navigate to Account page by clicking user profile button
    await accountButton.click();

    // Click logout button
    const logoutButton = page.locator('button:has(svg.lucide-log-out)');
    await expect(logoutButton).toBeVisible();
    await logoutButton.click();

    // Should be returned to the login screen
    await expect(page.locator('#username')).toBeVisible();
    const tokenAfterLogout = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(tokenAfterLogout).toBeNull();
  });
});
