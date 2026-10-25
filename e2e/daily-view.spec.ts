import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Daily View & Session Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    // Navigate to Daily/Calendar tab
    await page.locator('aside nav button').nth(0).click();
    await expect(page.locator('main')).toBeVisible();
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
