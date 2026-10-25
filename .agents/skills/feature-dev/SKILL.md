---
name: feature-dev
description: Guided workflow for designing and implementing full-stack or frontend features in the class_attend repository. Use whenever developing new user-facing functionality or backend endpoints.
---

# Feature Development Runbook

Follow this step-by-step checklist when building new features in `class_attend`:

## Phase 1: Planning & Schema Verification
1. **Analyze Requirements**: Check if the feature impacts the database, API, UI, or i18n.
2. **Database Update (if needed)**:
   - Check schema in `server/db.js`.
   - Add new columns using `ALTER TABLE ... ADD COLUMN` inside `initDb()` with default fallback values.
   - Verify `user_id` foreign key is present if creating a new table.
3. **Type Definitions**:
   - Update `src/types.ts` to add any new interfaces, statuses, or fields.

## Phase 2: Backend API Implementation
1. In `server/index.js`, add the necessary route(s).
2. Ensure `authenticate` middleware is attached to protect user data.
3. Use parameterized queries (`?`) scoped by `req.user.id`.
4. Validate incoming payload and return clear error statuses (`400`, `404`, `500`).

## Phase 3: Internationalization (i18n)
1. Add translation keys to **both** files before writing component code:
   - `src/locales/en.json`
   - `src/locales/he.json`
2. Ensure Hebrew strings read naturally and preserve correct punctuation.

## Phase 4: Frontend UI Implementation
1. Use existing Radix UI primitives in `src/components/ui/`.
2. Apply Tailwind CSS with **logical properties** (`ps-`, `pe-`, `start-`, `end-`, `text-start`).
3. Handle loading, empty, and error states gracefully.
4. If creating a new major tab or view:
   - Wrap with `React.lazy` in `src/App.tsx`.
   - Add tab icon and label in sidebar and mobile bottom navigation.

## Phase 5: Verification & Testing
1. **Vitest Unit/Component Tests**:
   - Write or update tests in `src/components/` or `src/lib/`.
   - Run `npm test` and ensure all tests pass.
2. **Playwright E2E Tests**:
   - If user-visible workflow is changed or added, add a test in `e2e/`.
   - Use `createTestUser` and `deleteTestUser`.
   - Run `npm run test:e2e` and verify pass.
3. **Lint & Build**:
   ```bash
   npm run lint
   npm run build
   ```

