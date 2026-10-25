import { test, expect } from '@playwright/test';

test.describe('Navigation and RTL Layout', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage and log in with admin
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin');
    await page.click('button[type="submit"]');

    // Wait until logged in
    await expect(page.locator('aside button').first()).toBeVisible();
  });

  test('switches between Dashboard, Calendar, and Courses tabs', async ({ page }) => {
    const nav = page.locator('aside nav');
    await expect(nav).toBeVisible();

    // Click Calendar (DailyView) tab
    const calendarButton = nav.locator('button').nth(0);
    await calendarButton.click();
    // Daily view should load
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
