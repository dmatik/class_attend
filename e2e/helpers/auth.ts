import { Page } from '@playwright/test';
export * from './test-user';

export async function selectFirstCalendarDay(page: Page) {
  // Select first available day in react-day-picker popover
  const dayBtn = page.locator('[role="gridcell"] button').first();
  await dayBtn.click();
}
