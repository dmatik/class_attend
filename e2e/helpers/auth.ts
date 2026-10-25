import { Page, expect } from '@playwright/test';

export async function loginAsAdmin(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin');
  await page.click('button[type="submit"]');

  // Wait until logged in (desktop sidebar button visible)
  await expect(page.locator('aside button').first()).toBeVisible();
}

export async function selectFirstCalendarDay(page: Page) {
  // Select first available day in react-day-picker popover
  const dayBtn = page.locator('[role="gridcell"] button').first();
  await dayBtn.click();
}
