import { test, expect } from '@playwright/test';
import { createTestUser, deleteTestUser, cleanupAllTestUsers, loginWithUser, selectFirstCalendarDay, TestUser } from './helpers/auth';

test.describe('Shared Courses & Collaborative Attendance', () => {
  let userA: TestUser;
  let userB: TestUser;

  test.beforeAll(() => {
    cleanupAllTestUsers();
  });

  test.beforeEach(async () => {
    userA = createTestUser('user');
    userB = createTestUser('user');
  });

  test.afterEach(async () => {
    if (userA) deleteTestUser(userA.id);
    if (userB) deleteTestUser(userB.id);
  });

  test.afterAll(() => {
    cleanupAllTestUsers();
  });

  test('User A shares course with User B, both have full control and see updates', async ({ page }) => {
    const courseName = `Shared Swimming ${Date.now()}`;

    // --- STEP 1: User A logs in and creates a course ---
    await loginWithUser(page, userA);

    // Navigate to Courses tab
    const coursesNavButton = page.locator('aside nav button').nth(2);
    await coursesNavButton.click();
    await expect(page.locator('main')).toBeVisible();

    // Click Add Course button
    await page.locator('main button:has(svg.lucide-plus)').click();
    const courseDialog = page.locator('[role="dialog"]');
    await expect(courseDialog).toBeVisible();

    await courseDialog.locator('#name').fill(courseName);

    // Pick start date
    const datePickerButton = courseDialog.locator('button').filter({ hasText: /select start date|תאריך התחלה|תאריך/i }).first();
    await datePickerButton.click();
    await selectFirstCalendarDay(page);

    // Pick days of week (first available day button)
    const firstDayBtn = courseDialog.locator('form div.flex-wrap button[type="button"]').first();
    await firstDayBtn.click();

    // Total lessons = 5
    await courseDialog.locator('input[type="number"]').fill('5');

    // Submit course form
    const submitBtn = courseDialog.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();
    await expect(courseDialog).not.toBeVisible();

    // Verify course card rendered
    const courseCard = page.locator('main div:has-text("' + courseName + '")').first();
    await expect(courseCard).toBeVisible();

    // Wait for auto-save debounce (500ms) to persist new course to SQLite DB
    await page.waitForTimeout(800);

    // --- STEP 2: Open Share Dialog and verify Orphan Guard ---
    const shareBtn = page.locator('button:has(svg.lucide-share-2)').first();
    await shareBtn.click();

    const shareDialog = page.locator('[role="dialog"]');
    await expect(shareDialog).toBeVisible();

    // Verify User A is sole member and remove button is disabled
    const soleRemoveBtn = shareDialog.locator('button:has(svg.lucide-log-out), button:has(svg.lucide-trash-2)').first();
    await expect(soleRemoveBtn).toBeDisabled();

    // --- STEP 3: Add User B to course ---
    // Open select dropdown
    const selectTrigger = shareDialog.locator('button[role="combobox"]');
    await selectTrigger.click();

    // Select User B
    const userBOption = page.locator(`[role="option"]:has-text("${userB.username}")`);
    await userBOption.click();

    // Click Add button
    const addMemberBtn = shareDialog.locator('button:has(svg.lucide-user-plus)');
    await addMemberBtn.click();

    // Verify User B is now listed in members
    await expect(shareDialog.locator(`text=${userB.username}`)).toBeVisible();

    // Close share dialog
    const closeBtn = shareDialog.locator('button:has(svg.lucide-x)');
    await closeBtn.click();
    await expect(shareDialog).not.toBeVisible();

    // Wait for auto-save sync
    await page.waitForTimeout(1000);

    // --- STEP 4: User B logs in and sees the shared course ---
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await loginWithUser(page, userB);

    // Navigate to Courses tab
    const userBCoursesNav = page.locator('aside nav button').nth(2);
    await userBCoursesNav.click();

    // User B should see the shared course card
    const userBCourseCard = page.locator('main div:has-text("' + courseName + '")').first();
    await expect(userBCourseCard).toBeVisible();

    // --- STEP 5: User B marks attendance in Calendar view ---
    const calendarNav = page.locator('aside nav button').nth(0);
    await calendarNav.click();

    // Verify User B sees the lessons for this course
    const absentButton = page.getByRole('button', { name: /absent|נעדר/i }).first();
    await expect(absentButton).toBeVisible();
    await absentButton.click();

    // Wait for debounce auto-save
    await page.waitForTimeout(1000);

    // --- STEP 6: User A logs back in and verifies collaborative update ---
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await loginWithUser(page, userA);

    // User A goes to Calendar view (nth(0))
    const userACalendarNav = page.locator('aside nav button').nth(0);
    await userACalendarNav.click();

    // User A sees the session was marked absent by User B
    const activeAbsent = page.locator('button[data-state="on"], button.bg-destructive, button:has(svg.lucide-x)').first();
    await expect(activeAbsent).toBeVisible();
  });
});
