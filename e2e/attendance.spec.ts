import { test, expect, Page } from '@playwright/test';
import { createTestUser, deleteTestUser, cleanupAllTestUsers, loginWithUser, selectFirstCalendarDay, TestUser } from './helpers/auth';

async function createCourseForUser(page: Page) {
  // Navigate to Courses tab and add a course
  await page.locator('aside nav button').nth(2).click();
  await page.getByRole('button', { name: /add course|הוסף חוג/i }).click();

  const dialog = page.locator('[role="dialog"]');
  await dialog.locator('#name').fill(`Attendance Course ${Date.now()}`);

  // Select start date
  const dateBtn = dialog.locator('button').filter({ hasText: /select start date|תאריך/i }).first();
  await dateBtn.click();
  await selectFirstCalendarDay(page);

  // Select first day of week
  const dayButtons = dialog.locator('form div.flex-wrap button[type="button"]');
  await dayButtons.nth(0).click();

  // Fill lessons
  await dialog.locator('input[type="number"]').fill('10');
  await dialog.locator('button[type="submit"]').click();
  await expect(dialog).not.toBeVisible();

  // Wait for auto-save debounce
  await page.waitForTimeout(1000);
}

test.describe('Attendance Recording and Reasons', () => {
  let testUser: TestUser;

  test.beforeAll(() => {
    cleanupAllTestUsers();
  });

  test.beforeEach(async ({ page }) => {
    testUser = createTestUser('admin');
    await loginWithUser(page, testUser);
    await createCourseForUser(page);
  });

  test.afterEach(async () => {
    if (testUser) {
      deleteTestUser(testUser.id);
    }
  });

  test.afterAll(() => {
    cleanupAllTestUsers();
  });

  test('toggles attendance to Absent, fills reason & notes, and verifies persistence', async ({ page }) => {
    // Navigate to Calendar (DailyView)
    await page.locator('aside nav button').nth(0).click();

    const absentButton = page.getByRole('button', { name: /absent|נעדר/i }).first();
    await expect(absentButton).toBeVisible();
    await absentButton.click();

    // The reason form should now appear inside the card
    const reasonSelectTrigger = page.locator('button[role="combobox"], [data-radix-select-trigger]').first();
    await expect(reasonSelectTrigger).toBeVisible();

    // Open reason select
    await reasonSelectTrigger.click();
    const firstOption = page.locator('[role="option"]').first();
    await expect(firstOption).toBeVisible();
    await firstOption.click();

    // Enter notes in the textarea
    const notesArea = page.locator('textarea').first();
    if (await notesArea.isVisible()) {
      await notesArea.fill('Absent due to doctor appointment');
    }

    // Wait for auto-save debounce (500ms)
    await page.waitForTimeout(1200);

    // 2. Reload and verify persistence from DB
    await page.reload();
    await page.locator('aside nav button').nth(0).click();

    // Card should still show reason dropdown
    await expect(page.locator('button[role="combobox"], [data-radix-select-trigger]').first()).toBeVisible();

    // 3. Toggle back to Present (Click Attended button)
    const presentButton = page.getByRole('button', { name: /attended|נוכח/i }).first();
    await presentButton.click();

    // Reason form should now disappear
    await expect(page.locator('button[role="combobox"], [data-radix-select-trigger]')).not.toBeVisible();

    // Wait for save
    await page.waitForTimeout(1000);
  });
});
