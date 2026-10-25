# Testing Strategy & Test Isolation Rules

## 1. Dual Test Runner Separation

| Concern | Vitest Suite | Playwright Suite |
| :--- | :--- | :--- |
| **Location** | `src/**/*.{test,spec}.{ts,tsx}` | `e2e/*.spec.ts` |
| **Environment** | Node.js + `happy-dom` | Real Chromium Browser |
| **Execution** | Local (`npm test`) & GitHub Actions CI | Local only (`npm run test:e2e`, `npm run test:e2e:headed`) |
| **Speed** | Fast (~8s for entire suite) | Full journey (~35s for full suite) |
| **What to Test** | Pure functions, calculation logic, component states, dialogs, form validation errors | End-to-end user journeys, session persistence across refresh, SQLite roundtrip |

### Runner Configuration Rules
1. `vite.config.ts` **must** explicitly include `src/**/*.{test,spec}.{ts,tsx}` and exclude `e2e/**` so Vitest never attempts to execute Playwright specs.
2. `.github/workflows/build-and-test.yml` **must only run `npm test`**. Never add Playwright commands or browser installs to CI workflows.

---

## 2. Playwright E2E Test Isolation & Cleanup Rules

To guarantee that tests are 100% deterministic and leave zero garbage in the database:

1. **Dedicated User per Test**:
   - Every E2E test file must import helper utilities from `./helpers/auth`:
     ```ts
     import { createTestUser, deleteTestUser, cleanupAllTestUsers, loginWithUser, TestUser } from './helpers/auth';
     ```
   - In `beforeEach`, generate a fresh test user:
     ```ts
     let testUser: TestUser;
     test.beforeEach(async ({ page }) => {
       testUser = createTestUser('admin');
       await loginWithUser(page, testUser);
     });
     ```
2. **Mandatory Teardown**:
   - In `afterEach`, delete the user:
     ```ts
     test.afterEach(async () => {
       if (testUser) {
         deleteTestUser(testUser.id);
       }
     });
     ```
   - Due to SQLite `ON DELETE CASCADE`, deleting the user automatically deletes all courses, sessions, and authenticators created by that user.
3. **Safety Sweep**:
   - In `beforeAll` and `afterAll`, call `cleanupAllTestUsers()` to scrub any orphaned `e2e_*` records in case of an abrupt termination.
4. **Never Use Existing Users**:
   - Never log in as `admin` (`admin-default`) or query pre-existing records.

