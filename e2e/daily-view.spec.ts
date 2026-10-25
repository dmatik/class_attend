import { test, expect } from '@playwright/test';
import { createTestUser, deleteTestUser, cleanupAllTestUsers, loginWithUser, selectFirstCalendarDay, TestUser } from './helpers/auth';

test.describe('Daily View & Session Filtering', () => {
  let testUser: TestUser;

  test.beforeAll(() => {
    cleanupAllTestUsers();
  });

  test.beforeEach(async ({ page }) => {
    testUser = createTestUser('admin');
    await loginWithUser(page, testUser);

    // Create a course so DailyView has active session elements
    await page.locator('aside nav button').nth(2).click();
    await page.getByRole('button', { name: /add course|הוסף חוג/i }).click();

    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('#name').fill(`Daily Course ${Date.now()}`);

    const dateBtn = dialog.locator('button').filter({ hasText: /select start date|תאריך/i }).first();
    await dateBtn.click();
    await selectFirstCalendarDay(page);

    const dayButtons = dialog.locator('form div.flex-wrap button[type="button"]');
    await dayButtons.nth(0).click();

    await dialog.locator('input[type="number"]').fill('5');
    await dialog.locator('button[type="submit"]').click();
    await expect(dialog).not.toBeVisible();
    await page.waitForTimeout(1000);

    // Navigate to Daily/Calendar tab
    await page.locator('aside nav button').nth(0).click();
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

  test('opens filter modal, modifies filters, and applies changes', async ({ page }) => {
    // Open Filter dialog
    const filterBtn = page.getByRole('button', { name: /filter|סינון|סנן/i }).first();
    await expect(filterBtn).toBeVisible();
    await filterBtn.click();

    // Verify filter modal is open
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Toggle "Show Future" switch
    const futureSwitch = dialog.locator('#future-mode');
    await expect(futureSwitch).toBeVisible();
    const isCheckedInitially = (await futureSwitch.getAttribute('data-state')) === 'checked';
    await futureSwitch.click();
    const isCheckedAfter = (await futureSwitch.getAttribute('data-state')) === 'checked';
    expect(isCheckedAfter).not.toBe(isCheckedInitially);

    // Click confirm / apply
    const applyButton = dialog.locator('button:has-text("Confirm"), button:has-text("אישור")').first();
    await applyButton.click();
    await expect(dialog).not.toBeVisible();
  });

  test('canceling filter modal leaves previous filter settings unchanged', async ({ page }) => {
    const filterBtn = page.getByRole('button', { name: /filter|סינון|סנן/i }).first();
    await filterBtn.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Toggle switch inside dialog
    const futureSwitch = dialog.locator('#future-mode');
    const wasChecked = (await futureSwitch.getAttribute('data-state')) === 'checked';
    await futureSwitch.click();

    // Click cancel button
    const cancelButton = dialog.locator('button:has-text("Cancel"), button:has-text("ביטול")').first();
    await cancelButton.click();
    await expect(dialog).not.toBeVisible();

    // Reopen dialog and verify switch remained at its original state
    await filterBtn.click();
    await expect(dialog).toBeVisible();
    const switchStateReopened = (await dialog.locator('#future-mode').getAttribute('data-state')) === 'checked';
    expect(switchStateReopened).toBe(wasChecked);
    await dialog.locator('button:has-text("Cancel"), button:has-text("ביטול")').first().click();
  });
});
