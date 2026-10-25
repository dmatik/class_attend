# Antigravity AI Agent Guidelines — `class_attend`

Welcome to `class_attend`. This document serves as the primary project-level instruction manual for all AI agents operating in this repository. Follow these guidelines strictly on every task.

---

## 1. Non-Negotiable Operational Boundaries

1. **Never Commit or Push Autonomously**:
   * **DO NOT** run `git commit`, `git push`, or alter remote branches unless the user gives an explicit, direct command in the current turn (e.g., "commit and push").
   * Keep all file changes local and uncommitted until instructed otherwise.
2. **Never Push Directly to `main` (Always Use Side Branches)**:
   * **DO NOT** push commits directly to the `main` branch under any circumstances.
   * Always create and work on a dedicated side branch (e.g., `feature/<name>`, `fix/<name>`, `chore/<name>`).
   * When instructed by the user to commit and push, always push to the side branch and open a Pull Request.
3. **Testing & Runner Discipline**:
   * **Vitest** runs unit and component tests (`src/**/*.{test,spec}.{ts,tsx}`) inside `happy-dom`. This is the **only** test suite that runs in GitHub Actions CI.
   * **Playwright** runs end-to-end browser tests (`e2e/*.spec.ts`) **locally only**. Never add Playwright commands or browser installs to `.github/workflows/`.
   * **Zero Test Pollution**: All Playwright E2E tests **must** create a dedicated, uniquely-named temporary user (`createTestUser('admin')` from `e2e/helpers/auth.ts`) and tear it down in `afterEach`. Never mutate or log in as existing production records (`admin-default`).
3. **Bilingual & RTL Integrity**:
   * The app supports **Hebrew (RTL, default)** and **English (LTR)**.
   * Never hardcode user-facing strings in JSX. Always add translation keys to **both** [`src/locales/he.json`](src/locales/he.json) and [`src/locales/en.json`](src/locales/en.json).
   * Never use physical CSS directions (`left-`, `right-`, `pl-`, `pr-`, `ml-`, `mr-`, `text-left`, `text-right`). Always use logical Tailwind properties: `start-`, `end-`, `ps-`, `pe-`, `ms-`, `me-`, `text-start`, `text-end`.

---

## 2. Approved Technology Stack & Conventions

To prevent hallucinated dependencies and architectural mismatches, adhere strictly to the existing stack:

| Layer | Standard In This Project | Strict Rules & What NOT to Do |
| :--- | :--- | :--- |
| **Frontend Framework** | **React 19** + **TypeScript 6** + **Vite 7** | Ref is a standard prop in React 19 (no `forwardRef`). Use functional components and hooks only. |
| **UI Components** | **Radix UI Primitives** + **Tailwind CSS 3.4** | All headless components live in [`src/components/ui/`](src/components/ui). Combine classes using `cn()` from `@/lib/utils`. Do not install extra component libraries (MUI, Chakra, AntD). |
| **Icons** | **Lucide React** (`lucide-react`) | Use existing Lucide icons. |
| **State & HTTP** | React Hooks (`useState`, `useEffect`) + Native `fetch` | No Axios, Redux, or TanStack Query. Use native `fetch` with `Authorization: Bearer ${token}`. |
| **Dates** | **`date-fns` v3** (`format`, `parseISO`, `addDays`, `he`/`enUS` locales) | Do not install `moment` or `dayjs`. |
| **Backend API** | **Express 5** (`server/index.js`) | Express 5 handles rejected Promises natively. Routes are proxied from Vite via `/api` to port 3001. |
| **Database** | **Better-SQLite3** (`server/db.js` $\rightarrow$ `data/class_attend.db`) | **SYNCHRONOUS API ONLY**: `db.prepare(...).run()`, `.get()`, `.all()`. Never write `await db...`. All queries must use parameterized bindings (`?`). |
| **Authentication** | **JWT** (`jsonwebtoken`) + **Bcrypt** (`bcryptjs`) + **WebAuthn** (`@simplewebauthn`) | Passwords hashed with salt 10. Sessions verified via Bearer tokens. |
| **PWA** | `vite-plugin-pwa` | Web app manifest with standalone display, RTL support, and mobile icons in `public/`. |

---

## 3. Directory Layout & Key Entry Points

* `src/`: React 19 application
  * `src/components/`: Primary application views (`AttendanceCard`, `CoursesPage`, `DailyView`, `Dashboard`, `AccountPage`, `AdminPage`, `LoginView`, `LanguageSwitcher`).
  * `src/components/ui/`: Headless Radix UI primitives styled with Tailwind.
  * `src/locales/`: Localization files (`he.json` and `en.json`).
  * `src/lib/`: Utilities (`cn`, `uuidv4`, `webauthn.ts`).
  * `src/types.ts`: TypeScript interfaces (`User`, `Course`, `Session`, `AbsenceReason`).
* `server/`: Node.js Express 5 backend
  * `server/index.js`: Express REST API endpoints, JWT auth middleware, WebAuthn passkey routes.
  * `server/db.js`: Better-SQLite3 initialization (`initDb()`), WAL mode, schema declarations, default admin seeder.
* `data/`: SQLite database storage (`class_attend.db`, `class_attend.db-wal`, `class_attend.db-shm`).
* `e2e/`: Local Playwright test suites (`auth.spec.ts`, `courses.spec.ts`, `attendance.spec.ts`, `daily-view.spec.ts`, `dashboard.spec.ts`, `navigation.spec.ts`).
  * `e2e/helpers/auth.ts` & `test-user.ts`: Utilities for isolated test user creation and automatic teardown.

---

## 4. Skills & Runbooks

Specialized skills are available in `.agents/skills/`:
* `feature-dev`: Step-by-step procedure for building full-stack features (schema $\rightarrow$ API $\rightarrow$ i18n $\rightarrow$ UI $\rightarrow$ tests).
* `code-review`: Security, architecture, and regression inspection checklist.
* `test-writing`: Recipes for Vitest component tests and Playwright E2E tests.
* `db-migration`: Safe SQLite schema migrations with WAL mode and foreign keys.

---

## 5. Available Subagents & Roles

Whenever delegating specialized tasks, use these exact role names:
* **`code-reviewer`**: Audits diffs for security vulnerabilities (SQL injection, auth checks), multi-tenant data scoping, bilingual i18n completeness (`he.json` + `en.json`), and RTL layout compliance.
* **`red-team-reviewer`**: Adversarial security researcher that stress-tests architectures, probes for exploit vectors (DoS, XSS, auth bypasses, timing attacks, data loss), and audits proposed remediations for flaws or regressions.
* **`test-engineer`**: Writes and maintains Vitest component tests and Playwright E2E test suites with strict temporary user isolation and cleanup.
* **`fullstack-engineer`**: Builds end-to-end features adhering to the project's exact stack (React 19, Radix UI, Express 5, Better-SQLite3).

---

## 6. Verification Commands

Before completing any task, always verify your changes:
```bash
# 1. Typecheck & Build
npm run build

# 2. Linting
npm run lint

# 3. Unit & Component Tests (Vitest)
npm test

# 4. Local E2E Tests (Playwright)
npm run test:e2e
```

