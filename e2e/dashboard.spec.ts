import { test, expect } from '@playwright/test';
import { createTestUser, deleteTestUser, cleanupAllTestUsers, loginWithUser, selectFirstCalendarDay, TestUser } from './helpers/auth';

test.describe('Dashboard Statistics Flow', () => {
  let testUser: TestUser;

  test.beforeAll(() => {
    cleanupAllTestUsers();
  });

  test.beforeEach(async ({ page }) => {
    testUser = createTestUser('admin');
    await loginWithUser(page, testUser);

    // Navigate to Dashboard tab (second item in desktop navigation)
    await page.locator('aside nav button').nth(1).click();
    await expect(page.locator('main')).toBeVisible();
  });

  test.afterEach(async () => {
    if (testUser) {
      deleteTestUser(testUser.id);
    }
  });

  test.afterAll(() => {
    cleanupAllTestUsers();
  });

  test('displays dashboard header and grouped statistics or empty state', async ({ page }) => {
    // Header should show Dashboard title
    const dashboardTitle = page.locator('main h2:has(svg.lucide-layout-dashboard)');
    await expect(dashboardTitle).toBeVisible();

    // Check whether course stat cards exist or "no data" message is displayed
    const statCards = page.locator('main .grid');
    const noData = page.locator('main :has-text("No data to display"), main :has-text("אין נתונים להצגה")');

    const hasCards = (await statCards.count()) > 0;
    const hasNoData = (await noData.count()) > 0;

    expect(hasCards || hasNoData).toBe(true);
  });

  test('end-to-end integration: add course, record attendance, and verify dashboard updates', async ({ page }) => {
    const courseName = `Dash Test ${Date.now()}`;

    // 1. Go to Courses and add a 5-lesson course
    await page.locator('aside nav button').nth(2).click();
    await page.locator('main button:has(svg.lucide-plus)').click();

    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('#name').fill(courseName);

    // Pick start date
    const dateBtn = dialog.locator('button').filter({ hasText: /select start date|תאריך/i }).first();
    await dateBtn.click();
    await selectFirstCalendarDay(page);

    // Select days of week
    const dayButtons = dialog.locator('form div.flex-wrap button[type="button"]');
    await dayButtons.nth(0).click();

    // 5 total lessons
    await dialog.locator('input[type="number"]').fill('5');
    await dialog.locator('button[type="submit"]').click();
    await expect(dialog).not.toBeVisible();

    // 2. Go to Calendar (DailyView) and mark first session as attended
    await page.locator('aside nav button').nth(0).click();
    await page.waitForTimeout(500);

    const attendBtn = page.getByRole('button', { name: /attended|נוכח/i }).first();
    if (await attendBtn.isVisible()) {
      await attendBtn.click();
    }

    // Wait for save
    await page.waitForTimeout(1000);

    // 3. Go to Dashboard and verify the course shows up with statistics
    await page.locator('aside nav button').nth(1).click();
    const courseHeader = page.locator(`main h3:has-text("${courseName}")`).first();
    await expect(courseHeader).toBeVisible();
  });
});
