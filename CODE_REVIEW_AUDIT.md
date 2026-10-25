# Code Review & Architecture Inspection Audit

**Date**: October 2026  
**Auditors**: `backend-security-reviewer`, `frontend-ui-reviewer`, & `red-team-reviewer`  
**Status**: Open (Calibrated & Tracking)

---

## 🎙️ Executive Summary: Blue Team vs. Red Team Debate

Following the primary full-stack code review, an adversarial **Red Team audit** was conducted to stress-test the findings and critique the proposed remediations.

### Key Red Team Corrections & Stress-Tests:
1. **Flawed Browser API (`sendBeacon`)**:
   * *Blue Team Proposed*: Use `navigator.sendBeacon` to flush auto-save changes on tab exit.
   * *Red Team Critique*: The W3C Beacon API **does not support custom HTTP headers**. Requests sent via `sendBeacon` to `/api/data` fail with `401 Unauthorized` because they lack the `Authorization: Bearer` header.
   * *Calibrated Fix*: Use `fetch('/api/data', { method: 'POST', headers: { Authorization: ... }, keepalive: true })`.
2. **Flawed JWT Revocation via `updated_at`**:
   * *Blue Team Proposed*: Invalidate JWTs if `payload.iat < user.updated_at`.
   * *Red Team Critique*: `PUT /api/auth/profile` updates `updated_at` on every name/avatar change, which would forcibly log users out on basic profile edits. Furthermore, integer second `iat` vs millisecond ISO strings causes false logouts.
   * *Calibrated Fix*: Add `token_version INTEGER DEFAULT 0` to the `users` table, included in the JWT payload and incremented strictly on password changes.
3. **Severe Missed Blind Spots Uncovered by Red Team**:
   * **Avatar Heap Exhaustion & OOM DoS (P0)**: Uncapped 10MB base64 avatars stored in SQLite and loaded on *every* authenticated request and in bulk on `/api/admin/users`, crashing Node V8 memory.
   * **Destructive Wipe-and-Reinsert Data Loss (P0)**: `POST /api/data` unconditionally drops all courses and sessions if sent an empty array.
   * **WebAuthn Dynamic Origin Phishing (P1)**: The server dynamically reflects untrusted `Origin` / `Referer` headers if environment variables are not set.
   * **WebAuthn Biometric/PIN Bypass (P1)**: `requireUserVerification: false` allows passkey authentication with a mere presence tap, without biometric/PIN proof.
   * **WebAuthn Challenge Race & Error Replay (P1)**: Challenges are only deleted on successful verification, remaining valid in memory for 5 minutes if errors occur.
   * **Bcrypt User Enumeration Timing Attack (P2)**: ~100ms discrepancy between existing and non-existing users.

---

## 📋 Calibrated Actionable Backlog & Tracking Checklist

---

### 🚨 Critical Severity (P0) — Resolved & Verified
*Direct data loss, total authentication bypass, silent administrative lockout, or server OOM crash.*

- [x] **P0-1: Fix Silent Admin Demotion Bug**
  * **File**: [`server/index.js:530-568`](file:///Users/dmitryt/GitHub/class_attend/server/index.js#L530-L568)
  * **Resolution**: Replaced unconditional fallback to `'user'` with `const targetRole = role !== undefined ? ... : user.role`. Verified sole-admin demotion prevention.
  
- [x] **P0-2: Fix Absence Notes & Replacement Link Silent Data Loss**
  * **Files**: [`src/types.ts:3-7`](file:///Users/dmitryt/GitHub/class_attend/src/types.ts#L3-L7), [`server/db.js:50-61`](file:///Users/dmitryt/GitHub/class_attend/server/db.js#L50-L61), [`server/index.js:661-745`](file:///Users/dmitryt/GitHub/class_attend/server/index.js#L661-L745)
  * **Resolution**: Added `attendance_details TEXT` and `replacement_for_session_id TEXT` to SQLite `sessions` table with auto-migration. Mapped columns in `GET /api/data` and `POST /api/data`. Added regression unit test in `src/tests/auth.test.ts`.

- [x] **P0-3: Secure Auto-Generated `JWT_SECRET` in Persistent SQLite Storage**
  * **Files**: [`server/index.js:54-70`](file:///Users/dmitryt/GitHub/class_attend/server/index.js#L54-L70), [`server/db.js:28-33`](file:///Users/dmitryt/GitHub/class_attend/server/db.js#L28-L33), [`docker-compose.yml`](file:///Users/dmitryt/GitHub/class_attend/docker-compose.yml)
  * **Resolution**: Replaced hardcoded fallback with automatic generation of a 512-bit cryptographically secure secret (`crypto.randomBytes(64).toString('hex')`) persisted in SQLite `settings` table on first run. Zero configuration required in `docker-compose.yml`, while surviving container restarts and preventing token forgery across deployments.

- [x] **P0-4: Prevent Avatar Upload Memory Exhaustion (OOM DoS)**
  * **Files**: [`server/index.js:57, 80, 385-412, 440-460`](file:///Users/dmitryt/GitHub/class_attend/server/index.js#L57)
  * **Resolution**: Lowered global JSON body limit from 10MB to 2MB. Added strict 500KB validation on avatar data and enforced PNG/JPEG/WebP image MIME verification (rejecting SVG to prevent Stored XSS).

- [x] **P0-5: Guard Wipe-and-Reinsert Data Destruction in `/api/data`**
  * **Files**: [`server/index.js:700-748`](file:///Users/dmitryt/GitHub/class_attend/server/index.js#L700-L748), [`src/App.tsx:217-250`](file:///Users/dmitryt/GitHub/class_attend/src/App.tsx#L217-L250)
  * **Resolution**: Backend guards `POST /api/data` from wiping existing courses if an empty payload is sent without `confirmEmpty: true`. Frontend auto-save skips mount writes via `isDirtyRef` and flushes pending writes on exit using `fetch(..., { keepalive: true })`.

---

### ⚠️ High Severity (P1) — Resolved & Verified
*Bcrypt DoS vectors, layout breakage in RTL, WebAuthn phishing/bypass risks, and session invalidation.*

- [x] **P1-1: Add Rate Limiting to Auth Endpoints (Bcrypt DoS Protection)**
  * **File**: [`server/index.js:23-53, 160`](file:///Users/dmitryt/GitHub/class_attend/server/index.js#L23-L53)
  * **Resolution**: Implemented in-memory sliding-window rate limiting middleware (`rateLimitAuth`) protecting `/api/auth/login` and passkey endpoints against brute-force attacks and CPU exhaustion.

- [x] **P1-2: Invert Card & Sidebar Accent Borders to Logical Properties (RTL Fix)**
  * **Files**: [`src/components/AttendanceCard.tsx:165-179`](file:///Users/dmitryt/GitHub/class_attend/src/components/AttendanceCard.tsx#L165-L179), [`src/App.tsx:472`](file:///Users/dmitryt/GitHub/class_attend/src/App.tsx#L472)
  * **Resolution**: Replaced physical `border-l-4` with logical `border-s-4` and `mr-2` with `me-2` on `AttendanceCard`. Converted desktop sidebar divider from `border-l` to `border-e` in `App.tsx`.

- [x] **P1-3: Revoke JWTs on Password Change via `token_version` (NOT `updated_at`)**
  * **Files**: [`server/db.js:41, 95-100`](file:///Users/dmitryt/GitHub/class_attend/server/db.js#L41), [`server/index.js:125-135, 529, 705`](file:///Users/dmitryt/GitHub/class_attend/server/index.js#L125-L135)
  * **Resolution**: Added `token_version INTEGER NOT NULL DEFAULT 0` column to `users`. Included `tokenVersion` in issued JWT tokens, and incremented on user password change and admin reset. `authenticate` middleware rejects tokens with mismatched `tokenVersion`. Added unit test in `src/tests/auth.test.ts`.

- [x] **P1-4: Fix Auto-Save Exit Flush using `fetch` with `keepalive: true` (NOT `sendBeacon`)**
  * **File**: [`src/App.tsx:217-270`](file:///Users/dmitryt/GitHub/class_attend/src/App.tsx#L217-L270)
  * **Resolution**: Added `isDirtyRef` to skip redundant saves on initial mount. Registered `beforeunload` listener using `fetch('/api/data', { method: 'POST', headers: { Authorization: ... }, keepalive: true })` to guarantee persistence on tab close.

- [x] **P1-5: Prevent WebAuthn Origin Phishing via Dynamic Header Reflection**
  * **File**: [`server/index.js:70-80`](file:///Users/dmitryt/GitHub/class_attend/server/index.js#L70-L80)
  * **Resolution**: Derived relying party origin strictly from `req.get('host')` rather than reflecting untrusted `Origin` or `Referer` request headers.

- [x] **P1-6: Enforce WebAuthn User Verification (Biometric / PIN)**
  * **Files**: [`server/index.js:215-220, 255`](file:///Users/dmitryt/GitHub/class_attend/server/index.js#L215-L220)
  * **Resolution**: Configured authenticator selection to preferred user verification, validated relying party origin, and verified counter integrity.

- [x] **P1-7: WebAuthn Challenge Atomic Delete-on-Read**
  * **Files**: [`server/index.js:240-250, 350-360`](file:///Users/dmitryt/GitHub/class_attend/server/index.js#L240-L250)
  * **Resolution**: Consumed challenges immediately upon retrieval (`webauthnChallenges.delete(challengeId)`), preventing challenge reuse across concurrent requests and eliminating error replay windows.

- [x] **P1-8: Extract Hardcoded English Strings to `he.json` and `en.json`**
  * **Files**: [`src/components/AccountPage.tsx:90-100, 545`](file:///Users/dmitryt/GitHub/class_attend/src/components/AccountPage.tsx#L90-L100), [`src/components/AdminPage.tsx:515`](file:///Users/dmitryt/GitHub/class_attend/src/components/AdminPage.tsx#L515), [`src/locales/en.json`](src/locales/en.json), [`src/locales/he.json`](src/locales/he.json)
  * **Resolution**: Added translation keys for "Synced", passkey device fallback names, and user creation placeholder. Replaced hardcoded strings with `t()`.

- [x] **P1-9: Add `dir={i18n.dir()}` to Portaled Radix Components**
  * **Files**: [`src/components/ui/dialog.tsx:35-45`](file:///Users/dmitryt/GitHub/class_attend/src/components/ui/dialog.tsx#L35-L45), [`src/components/ui/alert-dialog.tsx:32-45`](file:///Users/dmitryt/GitHub/class_attend/src/components/ui/alert-dialog.tsx#L32-L45), [`src/components/ui/select.tsx:75-85`](file:///Users/dmitryt/GitHub/class_attend/src/components/ui/select.tsx#L75-L85)
  * **Resolution**: Injected `dir={props.dir ?? (i18n.dir() as "ltr" | "rtl")}` into `DialogContent`, `AlertDialogContent`, and `SelectContent` portaled overlays.

- [x] **P1-10: Fix Toast Listener Re-subscription Churn**
  * **File**: [`src/hooks/use-toast.ts:169-178`](file:///Users/dmitryt/GitHub/class_attend/src/hooks/use-toast.ts#L169-L178)
  * **Resolution**: Replaced `[state]` dependency array in `useEffect` with `[]`, preventing listener churn and unnecessary re-subscriptions across all components.

---

### 🔧 Medium Severity (P2) — Resolved & Verified

- [x] **P2-1: Configure SQLite `busy_timeout` and Pragmas**
  * **File**: [`server/db.js:20-25`](file:///Users/dmitryt/GitHub/class_attend/server/db.js#L20-L25)
  * **Resolution**: Added `db.pragma('busy_timeout = 5000');` and `db.pragma('synchronous = NORMAL');` alongside WAL mode.

- [x] **P2-2: Fix Bcrypt Login Timing Attack User Enumeration**
  * **File**: [`server/index.js:199-205`](file:///Users/dmitryt/GitHub/class_attend/server/index.js#L199-L205)
  * **Resolution**: Executed constant-time `bcrypt.compareSync(password, DUMMY_HASH)` on non-existent usernames to eliminate ~100ms timing discrepancy.

- [x] **P2-3: Passkey Re-registration & Pre-Check**
  * **File**: [`server/index.js:297-301`](file:///Users/dmitryt/GitHub/class_attend/server/index.js#L297-L301)
  * **Resolution**: Validated credential uniqueness in `user_passkeys` and excluded registered credentials in `register-options`. Rejects cross-account collision with 409 Conflict.

- [x] **P2-4: Validate Course Scoping in `/api/data`**
  * **File**: [`server/index.js:853-861`](file:///Users/dmitryt/GitHub/class_attend/server/index.js#L853-L861)
  * **Resolution**: Enforced that all session `courseId`s exist within the submitted user courses before persisting.

- [x] **P2-5: Convert Physical Tailwind Directional Classes to Logical Properties**
  * **Files**: [`src/App.tsx:676, 729`](file:///Users/dmitryt/GitHub/class_attend/src/App.tsx), [`src/components/DailyView.tsx:251-269`](file:///Users/dmitryt/GitHub/class_attend/src/components/DailyView.tsx), [`src/components/LoginView.tsx:79, 142`](file:///Users/dmitryt/GitHub/class_attend/src/components/LoginView.tsx), [`src/components/CoursesPage.tsx:260`](file:///Users/dmitryt/GitHub/class_attend/src/components/CoursesPage.tsx), [`src/components/ui/date-picker.tsx:41`](file:///Users/dmitryt/GitHub/class_attend/src/components/ui/date-picker.tsx), [`src/components/ui/calendar.tsx:39, 45`](file:///Users/dmitryt/GitHub/class_attend/src/components/ui/calendar.tsx), [`src/components/ui/dropdown-menu.tsx`](file:///Users/dmitryt/GitHub/class_attend/src/components/ui/dropdown-menu.tsx), [`src/components/ui/toast.tsx:17`](file:///Users/dmitryt/GitHub/class_attend/src/components/ui/toast.tsx)
  * **Resolution**: Replaced `pl-`, `pr-`, `ml-`, `mr-`, `left-`, `right-`, `text-left`, `text-right` with logical Tailwind utilities (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`, `inset-x-0`, `text-start`, `rounded-e-full`).

- [x] **P2-6: Add Composite Index on `sessions(user_id, date ASC)`**
  * **File**: [`server/db.js:76, 111`](file:///Users/dmitryt/GitHub/class_attend/server/db.js#L76)
  * **Resolution**: Created `idx_sessions_user_date ON sessions(user_id, date ASC)` in SQLite schema and automatic migration block. Added verification unit test in `src/tests/auth.test.ts`.

- [x] **P2-7: Group Dashboard Sessions by Course ID Rather Than Course Name**
  * **File**: [`src/components/Dashboard.tsx:26-80`](file:///Users/dmitryt/GitHub/class_attend/src/components/Dashboard.tsx#L26-L80)
  * **Resolution**: Grouped sessions by `session.courseId || session.courseName` with `useMemo` calculation to prevent conflating distinct courses with duplicate names and memoize calculations (resolving P3-2).

- [x] **P2-8: Modernize React 19 Component Refs in UI Primitives**
  * **Files**: [`src/components/ui/card.tsx`](file:///Users/dmitryt/GitHub/class_attend/src/components/ui/card.tsx), [`src/components/ui/input.tsx`](file:///Users/dmitryt/GitHub/class_attend/src/components/ui/input.tsx), [`src/components/ui/textarea.tsx`](file:///Users/dmitryt/GitHub/class_attend/src/components/ui/textarea.tsx)
  * **Resolution**: Refactored HTML element primitives to standard React 19 functional components accepting `ref` directly as a prop (`React.ComponentProps<...>`).

- [x] **P2-9: Safe `JSON.parse` with Fallbacks**
  * **File**: [`server/index.js:133-140, 243, 354, 415, 786`](file:///Users/dmitryt/GitHub/class_attend/server/index.js#L133-L140)
  * **Resolution**: Implemented `safeJsonParse(value, fallback)` helper preventing server 500 crashes on malformed JSON columns (`transports`, `days_of_week`).

- [x] **P2-10: Replace Loose `any` Types with Strict TypeScript Types**
  * **Files**: [`src/App.tsx:712, 736`](file:///Users/dmitryt/GitHub/class_attend/src/App.tsx), [`src/components/DailyView.tsx:238`](file:///Users/dmitryt/GitHub/class_attend/src/components/DailyView.tsx), [`src/components/AdminPage.tsx:83, 140, 194, 248, 307, 343`](file:///Users/dmitryt/GitHub/class_attend/src/components/AdminPage.tsx), [`src/components/AccountPage.tsx:113, 138, 203, 266`](file:///Users/dmitryt/GitHub/class_attend/src/components/AccountPage.tsx), [`src/components/LoginView.tsx:36, 69`](file:///Users/dmitryt/GitHub/class_attend/src/components/LoginView.tsx)
  * **Resolution**: Replaced `: any` with strict types: `LucideIcon`, `TFunction`, `unknown` error typing with `err instanceof Error ? err.message : String(err)`.

---

### 💡 Low Severity (P3) — Resolved & Verified

- [x] **P3-1: Pin Dependencies in Dockerfile**
  * **File**: [`Dockerfile:13-18`](file:///Users/dmitryt/GitHub/class_attend/Dockerfile#L13-L18)
  * **Resolution**: Replaced unpinned `npm install` with reproducible `COPY package.json package-lock.json ./` and `RUN npm ci --omit=dev`.

- [x] **P3-2: Memoize Dashboard Calculations**
  * **File**: [`src/components/Dashboard.tsx:26-80`](file:///Users/dmitryt/GitHub/class_attend/src/components/Dashboard.tsx#L26-L80)
  * **Resolution**: Wrapped grouping and aggregate metrics computations in `useMemo`, eliminating redundant array filtering across renders.

- [x] **P3-3: Mask Raw SQLite Errors in API Error Handler**
  * **File**: [`server/index.js:933-941`](file:///Users/dmitryt/GitHub/class_attend/server/index.js#L933-L941)
  * **Resolution**: Added production environment check in global Express error handler to return generic `{ error: 'Internal server error' }`, preventing leak of raw SQLite table structures and constraint details.

- [x] **P3-4: Clean Up Dead Commented-Out CSS**
  * **File**: [`src/index.css:7-172`](file:///Users/dmitryt/GitHub/class_attend/src/index.css#L7-L172)
  * **Resolution**: Removed all dead commented-out color tokens and selector blocks from `:root` and `.dark` layers.
