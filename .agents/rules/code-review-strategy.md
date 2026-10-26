# Three-Agent Code Review Strategy (2 Blue Team + 1 Red Team)

When a code review is requested for changes, branches, or PRs in `class_attend`, always execute this tri-agent review protocol using 3 parallel subagents: **2 Blue Team reviewers** and **1 Red Team reviewer**.

---

## 1. Tri-Agent Subagent Workflow

Whenever the user asks to "do code review", "review this PR/branch", or "review feature", dispatch three subagents in parallel:

```
                               User: "perform code review"
                                            │
        ┌───────────────────────────────────┼───────────────────────────────────┐
        ▼                                   ▼                                   ▼
[Blue Team: Architecture]          [Blue Team: UI & Testing]         [Red Team: Adversarial]
`code-reviewer-architecture`       `code-reviewer-ui-testing`        `red-team-reviewer`
• Architecture & Design Patterns   • Bilingual i18n Completeness     • Injection & DDE Attacks
• React 19 & TypeScript Types      • Bi-directional RTL Compliance   • Auth, Session & Data Integrity
• Backend & DB Synchronous Rules   • Accessibility & Visual UX       • Crash Probing & Fuzzing
• Performance & Memory Discipline  • Vitest & Playwright Isolation   • DoS & Edge Case Failures
        │                                   │                                   │
        └───────────────────────────────────┼───────────────────────────────────┘
                                            ▼
                         Unified Tri-Agent Review Synthesis & Verdict
```

### A. Blue Team 1: Architecture & Code Quality Reviewer (`code-reviewer-architecture`)
- **Focus**: System architecture, type safety, framework conventions, performance, and clean code.
- **Checklist**:
  1. **Stack Compliance**: Strict adherence to React 19 (functional components, standard ref prop, no forwardRef), TypeScript 6, Vite 7, Radix UI primitives, Express 5, Better-SQLite3 synchronous API.
  2. **Type Safety & Contracts**: Accurate TypeScript interfaces in `src/types.ts` or module exports. No `any` type escapes unless strictly justified.
  3. **Data Access & Scoping**: Parameterized queries (`?`), multi-tenant scoping (`user_id = ?`), WAL mode safety, and proper foreign key cascade definitions.
  4. **Performance & Lifecycle**: Memoization of expensive operations (`useMemo`, `useCallback`), proper hook dependency arrays, clean resource allocation and teardown.

### B. Blue Team 2: UI/UX, Bilingual i18n & Test Integrity Reviewer (`code-reviewer-ui-testing`)
- **Focus**: User experience, internationalization, bidirectional RTL layouts, and testing rigor.
- **Checklist**:
  1. **Bilingual i18n Completeness**: Zero hardcoded strings in JSX or UI. Every label, toast, dialog, and message must exist in *both* `src/locales/en.json` and `src/locales/he.json`.
  2. **Bi-directional & RTL Discipline**: Strictly use logical Tailwind CSS classes (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`, `text-start`, `text-end`). Zero physical directional classes (`pl-`, `pr-`, `ml-`, `mr-`, `text-left`, `text-right`). Pass `dir={i18n.dir()}` to popovers/dropdowns.
  3. **Vitest Unit & Component Coverage**: Validates pure functions, calculation logic, edge inputs, and component state transitions inside `src/`.
  4. **Playwright E2E Isolation**: Tests located strictly in `e2e/`, using isolated temporary users (`createTestUser` and `deleteTestUser`) in `beforeEach`/`afterEach`. Zero pollution of CI workflows or production admin records.

### C. Red Team: Adversarial Security & Reliability Reviewer (`red-team-reviewer`)
- **Focus**: Exploitation vectors, stress testing, data integrity, and failure modes.
- **Checklist**:
  1. **Injection Vectors**: SQL injection, XSS, CSV formula injection (CWE-1236 / DDE triggers: `=`, `+`, `-`, `@`, `\t`, `\r`).
  2. **Encoding & Format Hardening**: Unicode handling, UTF-8 BOM, control character stripping, BIDI override attack prevention (`\u202E`).
  3. **Boundary Conditions**: Null/undefined inputs, empty datasets, malformed dates, extreme payloads, and client-side error boundary resilience.
  4. **Resource Exhaustion & Concurrency**: Memory leaks (unrevoked Object URLs, unbounded arrays), CPU stalls, rapid click spamming, race conditions.

---

## 2. Review Output Format

The parent agent aggregates all 3 reviews into a consolidated, actionable report:
1. **Executive Verdict**: `APPROVED`, `APPROVED WITH MINOR SUGGESTIONS`, or `CHANGES REQUESTED`.
2. **Blue Team 1 (Architecture & Code Quality)**: Structural findings, stack compliance, maintainability.
3. **Blue Team 2 (UI, i18n, RTL & Testing)**: Bilingual dictionary checks, RTL layout verification, test coverage & isolation.
4. **Red Team (Adversarial Security & Edge Cases)**: Vulnerability probing, injection defense, reliability risks.
5. **Actionable Recommendations & Remediation Plan**: Prioritized list of concrete fixes.
