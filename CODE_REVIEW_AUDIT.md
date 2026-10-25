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

### ⚠️ High Severity (P1) — Urgent Fix Recommended
*Bcrypt DoS vectors, layout breakage in RTL, WebAuthn phishing/bypass risks, and session invalidation.*

- [ ] **P1-1: Add Rate Limiting to Auth Endpoints (Bcrypt DoS Protection)**
  * **File**: [`server/index.js:108-136`](file:///Users/dmitryt/GitHub/class_attend/server/index.js#L108-L136)
  * **Threat**: No rate limiting on `/api/auth/login`. Synchronous `bcrypt.compareSync` blocks Node's single-threaded event loop under heavy load.
  * **Remediation**: Add in-memory sliding-window rate limiter middleware for `/api/auth/login` and passkey endpoints.

- [ ] **P1-2: Invert Card & Sidebar Accent Borders to Logical Properties (RTL Fix)**
  * **Files**: [`src/components/AttendanceCard.tsx:165-170`](file:///Users/dmitryt/GitHub/class_attend/src/components/AttendanceCard.tsx#L165-L170), [`src/App.tsx:436`](file:///Users/dmitryt/GitHub/class_attend/src/App.tsx#L436)
  * **Threat**: `border-l-4` places colored accent on the trailing edge in RTL; `border-l` on sidebar attaches to outer window in LTR.
  * **Remediation**: Replace `border-l-4` with `border-s-4` on `AttendanceCard`; replace `border-l` with `border-e` on sidebar.

- [ ] **P1-3: Revoke JWTs on Password Change via `token_version` (NOT `updated_at`)**
  * **Files**: [`server/db.js`](file:///Users/dmitryt/GitHub/class_attend/server/db.js), [`server/index.js:71-96, 415-436, 586-610`](file:///Users/dmitryt/GitHub/class_attend/server/index.js#L71-L96)
  * **Threat**: JWTs remain valid for 30 days after password change.
  * **Remediation**: Add `token_version INTEGER NOT NULL DEFAULT 0` to `users`. Increment `token_version` on password change. Verify `payload.tokenVersion === user.token_version` in `authenticate`.

- [ ] **P1-4: Fix Auto-Save Exit Flush using `fetch` with `keepalive: true` (NOT `sendBeacon`)**
  * **File**: [`src/App.tsx:217-250`](file:///Users/dmitryt/GitHub/class_attend/src/App.tsx#L217-L250)
  * **Threat**: Unsaved edits within 500ms debounce window are lost on tab close; initial mount causes redundant server writes.
  * **Remediation**: Add `isDirty` ref to skip mount save. Use `fetch('/api/data', { method: 'POST', headers: { Authorization: ... }, keepalive: true })` on `beforeunload`.

- [ ] **P1-5: Prevent WebAuthn Origin Phishing via Dynamic Header Reflection**
  * **File**: [`server/index.js:36-51`](file:///Users/dmitryt/GitHub/class_attend/server/index.js#L36-L51)
  * **Threat**: `getWebAuthnConfig` dynamically trusts untrusted client `Origin`/`Referer` headers when environment variables are not set.
  * **Remediation**: Hardcode a default origin / RP_ID or enforce configuration in production.

- [ ] **P1-6: Enforce WebAuthn User Verification (Biometric / PIN)**
  * **Files**: [`server/index.js:198`](file:///Users/dmitryt/GitHub/class_attend/server/index.js#L198), [`server/index.js:309`](file:///Users/dmitryt/GitHub/class_attend/server/index.js#L309)
  * **Threat**: `requireUserVerification: false` allows passkey authentication with a mere physical tap without biometric or PIN verification.
  * **Remediation**: Change `requireUserVerification: true` for passkey authentication.

- [ ] **P1-7: WebAuthn Challenge Atomic Delete-on-Read**
  * **Files**: [`server/index.js:180-205, 280-324`](file:///Users/dmitryt/GitHub/class_attend/server/index.js#L180-L205)
  * **Threat**: Challenges are deleted only upon success; failed attempts leave challenges active in memory for 5 minutes, vulnerable to replay and race conditions.
  * **Remediation**: Delete challenge immediately upon retrieval (`webauthnChallenges.delete(challengeId)`).

- [ ] **P1-8: Extract Hardcoded English Strings to `he.json` and `en.json`**
  * **Files**: [`src/components/AccountPage.tsx:91, 545`](file:///Users/dmitryt/GitHub/class_attend/src/components/AccountPage.tsx#L91), [`src/components/AdminPage.tsx:515`](file:///Users/dmitryt/GitHub/class_attend/src/components/AdminPage.tsx#L515)
  * **Remediation**: Add translation keys to both locales and wrap with `t()`.

- [ ] **P1-9: Add `dir={i18n.dir()}` to Portaled Radix Components**
  * **Files**: [`src/components/AttendanceCard.tsx:326`](file:///Users/dmitryt/GitHub/class_attend/src/components/AttendanceCard.tsx#L326), [`src/components/CoursesPage.tsx:193`](file:///Users/dmitryt/GitHub/class_attend/src/components/CoursesPage.tsx#L193)
  * **Remediation**: Ensure dialogs and dropdowns receive direction attributes.

- [ ] **P1-10: Fix Toast Listener Re-subscription Churn**
  * **File**: [`src/hooks/use-toast.ts:169-178`](file:///Users/dmitryt/GitHub/class_attend/src/hooks/use-toast.ts#L169-L178)
  * **Remediation**: Change dependency array to `[]`.

---

### 🔧 Medium Severity (P2) — Quality & Robustness Improvements

- [ ] **P2-1: Configure SQLite `busy_timeout` and Pragmas**
  * **File**: [`server/db.js:20-23`](file:///Users/dmitryt/GitHub/class_attend/server/db.js#L20-L23)
  * **Remediation**: Add `db.pragma('busy_timeout = 5000');` and `db.pragma('synchronous = NORMAL');`.

- [ ] **P2-2: Fix Bcrypt Login Timing Attack User Enumeration**
  * **File**: [`server/index.js:114-117`](file:///Users/dmitryt/GitHub/class_attend/server/index.js#L114-L117)
  * **Remediation**: Run a dummy `bcrypt.compareSync` on non-existent users to eliminate ~100ms timing discrepancy.

- [ ] **P2-3: Passkey Re-registration & Pre-Check**
  * **File**: [`server/index.js:210-225`](file:///Users/dmitryt/GitHub/class_attend/server/index.js#L210-L225)
  * **Remediation**: Check existing authenticator ownership before insert; reject 409 if owned by another user.

- [ ] **P2-4: Validate Course Scoping in `/api/data`**
  * **File**: [`server/index.js:695-748`](file:///Users/dmitryt/GitHub/class_attend/server/index.js#L695-L748)
  * **Remediation**: Ensure all submitted session `courseId`s exist within submitted courses for `req.user.id`.

- [ ] **P2-5: Convert Physical Tailwind Directional Classes to Logical Properties**
  * **Files**: `src/components/DailyView.tsx`, `src/components/LoginView.tsx`, `src/components/ui/calendar.tsx`, `src/components/ui/dropdown-menu.tsx`
  * **Remediation**: Replace with `ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`, `text-start`.

- [ ] **P2-6: Add Composite Index on `sessions(user_id, date ASC)`**
  * **File**: [`server/db.js:63-65`](file:///Users/dmitryt/GitHub/class_attend/server/db.js#L63-L65)
  * **Remediation**: Add `CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON sessions(user_id, date ASC);`.

- [ ] **P2-7: Group Dashboard Sessions by Course ID Rather Than Course Name**
  * **File**: [`src/components/Dashboard.tsx:14-19`](file:///Users/dmitryt/GitHub/class_attend/src/components/Dashboard.tsx#L14-L19)
  * **Remediation**: Group by `session.courseId`.

- [ ] **P2-8: Modernize React 19 Component Refs in UI Primitives**
  * **Files**: `src/components/ui/*.tsx`
  * **Remediation**: Refactor components to standard function components accepting `ref`.

- [ ] **P2-9: Safe `JSON.parse` with Fallbacks**
  * **File**: [`server/index.js:147, 254, 314, 657`](file:///Users/dmitryt/GitHub/class_attend/server/index.js#L147)
  * **Remediation**: Wrap with `safeJsonParse(val, fallback)`.

- [ ] **P2-10: Replace Loose `any` Types with Strict TypeScript Types**
  * **Files**: `src/App.tsx:676`, `src/components/AdminPage.tsx:83`, `src/components/AccountPage.tsx:113`
  * **Remediation**: Replace with typed components and `unknown` + type guards.

---

### 💡 Low Severity (P3) — Minor Polish & Cleanup

- [ ] **P3-1: Pin Dependencies in Dockerfile**
  * **File**: [`Dockerfile:16-18`](file:///Users/dmitryt/GitHub/class_attend/Dockerfile#L16-L18)
  * **Remediation**: Use `npm ci --omit=dev` with `package-lock.json`.

- [ ] **P3-2: Memoize Dashboard Calculations**
  * **File**: [`src/components/Dashboard.tsx:14-61`](file:///Users/dmitryt/GitHub/class_attend/src/components/Dashboard.tsx#L14-L61)
  * **Remediation**: Wrap calculations with `useMemo`.

- [ ] **P3-3: Mask Raw SQLite Errors in API Error Handler**
  * **File**: [`server/index.js:761-768`](file:///Users/dmitryt/GitHub/class_attend/server/index.js#L761-L768)
  * **Remediation**: Return generic `{ error: 'Internal server error' }` in production.

- [ ] **P3-4: Clean Up Dead Commented-Out CSS**
  * **File**: [`src/index.css:7-37, 88-116`](file:///Users/dmitryt/GitHub/class_attend/src/index.css#L7-L37)
  * **Remediation**: Delete unused comments.
