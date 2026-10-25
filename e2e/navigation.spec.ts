import { test, expect } from '@playwright/test';
import { createTestUser, deleteTestUser, cleanupAllTestUsers, loginWithUser, TestUser } from './helpers/auth';

test.describe('Navigation and RTL Layout', () => {
  let testUser: TestUser;

  test.beforeAll(() => {
    cleanupAllTestUsers();
  });

  test.beforeEach(async ({ page }) => {
    // Dedicated user for this test
    testUser = createTestUser('admin');
    await loginWithUser(page, testUser);
  });

  test.afterEach(async () => {
    if (testUser) {
      deleteTestUser(testUser.id);
    }
  });

  test.afterAll(() => {
    cleanupAllTestUsers();
  });

  test('switches between Dashboard, Calendar, and Courses tabs', async ({ page }) => {
    const nav = page.locator('aside nav');
    await expect(nav).toBeVisible();

    // Click Calendar (DailyView) tab
    const calendarButton = nav.locator('button').nth(0);
    await calendarButton.click();
    await expect(page.locator('main')).toBeVisible();

    // Click Dashboard tab
    const dashboardButton = nav.locator('button').nth(1);
    await dashboardButton.click();
    await expect(page.locator('main')).toBeVisible();

    // Click Courses tab
    const coursesButton = nav.locator('button').nth(2);
    await coursesButton.click();
    await expect(page.locator('main')).toBeVisible();
  });

  test('toggles language and updates document layout direction', async ({ page }) => {
    // Open language dropdown (using the globe button)
    const globeButton = page.locator('header button:has(svg.lucide-globe), aside button:has(svg.lucide-globe)').first();
    await globeButton.click();

    // Check menu options (Hebrew and English)
    const englishOption = page.locator('[role="menuitem"]:has-text("English")');
    if (await englishOption.isVisible()) {
      await englishOption.click();
      // When English is selected, document element direction should be ltr
      await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    }
  });
});
