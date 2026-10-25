---
name: test-writing
description: Guide and recipes for writing unit, component, and end-to-end tests in class_attend. Use when adding tests for new features, fixing regressions, or setting up test fixtures.
---

# Test Writing Runbook & Recipes

Follow these recipes when creating tests in `class_attend`:

---

## 1. Vitest Component Tests (`src/components/*.test.tsx`)

Vitest runs in simulated DOM (`happy-dom`) for fast feedback.

### Template:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyComponent } from './MyComponent';

// 1. Mock translation
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { dir: () => 'ltr', language: 'en' },
  }),
}));

describe('MyComponent', () => {
  it('renders default state correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('common.title')).toBeInTheDocument();
  });
});
```

### Best Practices:
* Test UI edge cases: empty states, invalid form submissions, disabled buttons.
* Mock heavy animation libraries (`framer-motion`) if timing causes flaky assertions.

---

## 2. Playwright E2E Tests (`e2e/*.spec.ts`)

Playwright tests run against real browsers and verify the real SQLite database and Express server.

### Template with Test User Isolation:
```ts
import { test, expect } from '@playwright/test';
import {
  createTestUser,
  deleteTestUser,
  cleanupAllTestUsers,
  loginWithUser,
  TestUser
} from './helpers/auth';

test.describe('My Feature E2E Flow', () => {
  let testUser: TestUser;

  test.beforeAll(() => {
    // Clean any orphaned records from prior aborted runs
    cleanupAllTestUsers();
  });

  test.beforeEach(async ({ page }) => {
    // Create dedicated user and log in
    testUser = createTestUser('admin');
    await loginWithUser(page, testUser);
  });

  test.afterEach(async () => {
    // Teardown: Cascading delete removes user and all associated data
    if (testUser) {
      deleteTestUser(testUser.id);
    }
  });

  test.afterAll(() => {
    cleanupAllTestUsers();
  });

  test('completes full user interaction flow', async ({ page }) => {
    // Use role-based or ID-based locators
    const actionButton = page.getByRole('button', { name: /save|שמור/i });
    await expect(actionButton).toBeVisible();
    await actionButton.click();

    // Verify persistence across page refresh
    await page.reload();
    await expect(page.locator('main')).toBeVisible();
  });
});
```

### Best Practices:
* **Never use strict CSS class chains** (e.g. `div > div > button.bg-blue`). Use accessible locators: `page.getByRole('button', { name: ... })` or `locator('#id')`.
* **Handle Strict Mode**: If a locator matches multiple elements, specify `.first()` or `.nth(i)`.
* **Headed Mode**: To watch tests execute with slow motion, run `npm run test:e2e:headed`.

