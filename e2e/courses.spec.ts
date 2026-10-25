import { test, expect } from '@playwright/test';
import { loginAsAdmin, selectFirstCalendarDay } from './helpers/auth';

test.describe('Courses Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    // Navigate to Courses tab (third item in desktop navigation)
    const coursesNavButton = page.locator('aside nav button').nth(2);
    await coursesNavButton.click();
    await expect(page.locator('main')).toBeVisible();
  });

  test('validates required fields before allowing course submission', async ({ page }) => {
    // Click Add Course button
    const addCourseBtn = page.locator('main button:has(svg.lucide-plus)');
    await addCourseBtn.click();

    // Verify dialog is open
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Submit button should initially be disabled
    const submitBtn = dialog.locator('button[type="submit"]');
    await expect(submitBtn).toBeDisabled();

    // Fill name only
    await dialog.locator('#name').fill('Incomplete Course');
    await expect(submitBtn).toBeDisabled();

    // Close dialog by clicking outside or pressing Escape
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('creates, edits, and deletes a course with backend persistence', async ({ page }) => {
    const courseName = `E2E Course ${Date.now()}`;
    const updatedCourseName = `${courseName} Updated`;

    // 1. CREATE COURSE
    await page.locator('main button:has(svg.lucide-plus)').click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Fill course name
    await dialog.locator('#name').fill(courseName);

    // Pick start date
    const datePickerButton = dialog.locator('button').filter({ hasText: /select start date|תאריך התחלה|תאריך/i }).first();
    await datePickerButton.click();
    await selectFirstCalendarDay(page);

    // Select first day of week button
    const firstDayBtn = dialog.locator('form div.flex-wrap button[type="button"]').first();
    await firstDayBtn.click();

    // Enter total lessons count
    const lessonsInput = dialog.locator('input[type="number"]');
    await lessonsInput.fill('8');

    // Submit button should now be enabled
    const submitBtn = dialog.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Verify dialog closes and course appears
    await expect(dialog).not.toBeVisible();
    const courseCard = page.locator(`main div:has-text("${courseName}")`).first();
    await expect(courseCard).toBeVisible();

    // Wait for auto-save debounce (500ms) and reload to ensure DB persistence
    await page.waitForTimeout(1000);
    await page.reload();
    await page.locator('aside nav button').nth(2).click();
    await expect(page.locator(`main div:has-text("${courseName}")`).first()).toBeVisible();

    // 2. EDIT COURSE
    const existingCard = page.locator('.grid > div').filter({ hasText: courseName }).first();
    await existingCard.locator('button').first().click();

    const editDialog = page.locator('[role="dialog"]');
    await expect(editDialog).toBeVisible();
    await editDialog.locator('#name').fill(updatedCourseName);
    await editDialog.locator('button[type="submit"]').click();
    await expect(editDialog).not.toBeVisible();

    // Verify updated name
    await expect(page.locator(`main div:has-text("${updatedCourseName}")`).first()).toBeVisible();

    // 3. DELETE COURSE
    await page.waitForTimeout(700);
    const updatedCard = page.locator('.grid > div').filter({ hasText: updatedCourseName }).first();
    await updatedCard.locator('button').nth(1).click();

    // Alert dialog confirmation should be visible
    const alertDialog = page.locator('[role="alertdialog"]');
    await expect(alertDialog).toBeVisible();

    // Confirm deletion
    const confirmDeleteBtn = alertDialog.locator('button:has-text("Delete"), button:has-text("מחק")').first();
    await confirmDeleteBtn.click();
    await expect(alertDialog).not.toBeVisible();

    // Verify course is removed
    await expect(page.locator(`main div:has-text("${updatedCourseName}")`)).toHaveCount(0);
  });
});
