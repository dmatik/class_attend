---
name: red-team
description: Adversarial security and reliability inspection guide. Use when stress-testing features, challenging review findings, probing edge cases, or hunting for DoS, XSS, auth bypasses, and data-loss vulnerabilities.
---

# Red Team Adversarial Security & Reliability Runbook

Use this runbook to conduct adversarial evaluations on features, APIs, and proposed fixes in `class_attend`:

## 1. Attack Vectors Checklist

### A. Authentication & Session Security
- [ ] **Token Forgery**: Does `JWT_SECRET` have an insecure default in production?
- [ ] **Token Lifetime & Invalidation**: Does changing a password increment `token_version` to immediately invalidate all existing sessions?
- [ ] **Timing Attacks**: Does username lookup or bcrypt comparison allow username enumeration via timing side-channels?
- [ ] **Rate Limiting**: Are public login/auth endpoints protected from credential brute-forcing and bcrypt CPU exhaustion?

### B. WebAuthn Passkey Resilience
- [ ] **Cryptographic Origin Binding**: Does `getWebAuthnConfig` enforce explicit static origin and RP_ID in production rather than dynamically reflecting untrusted client headers?
- [ ] **User Verification Enforcement**: Is `requireUserVerification` enforced (`true`) for passwordless access?
- [ ] **Challenge Lifecycle**: Are challenges consumed atomically on read (`delete(challengeId)`) so they cannot be reused across concurrent requests or upon verification error?

### C. Denial of Service & Memory Exhaustion (DoS / OOM)
- [ ] **Unbounded Payload Ingestion**: Are base64 avatars or payloads limited server-side to prevent V8 heap exhaustion?
- [ ] **Heavy Queries in Middleware**: Does `authenticate` avoid fetching large text/BLOB columns (like `avatar`) on every API request?
- [ ] **Database Concurrency**: Is `busy_timeout` configured in SQLite to prevent lock exceptions under concurrent writes?

### D. Data Destruction & Integrity
- [ ] **Destructive Sync Guards**: Do bulk save endpoints (`POST /api/data`) protect against accidental data wiping if an empty array is submitted?
- [ ] **Schema Coverage**: Do all client-persisted properties (`attendance.details`, `replacementForSessionId`) have corresponding database columns?
- [ ] **Cross-Tenant References**: Does foreign-key validation verify ownership within the authenticated tenant?

### E. Frontend & Browser Resilience
- [ ] **Reliable Flush on Exit**: Does auto-save use `fetch(..., { keepalive: true, headers: { Authorization: ... } })` rather than `sendBeacon` (which cannot send auth headers)?
- [ ] **Mount Race Conditions**: Does auto-save avoid redundant writes on initial component mount?

