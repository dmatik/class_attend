# UI & Internationalization (RTL / Bi-directional) Rules

## 1. Bi-directional (RTL / LTR) Layouts

The application defaults to Hebrew (`dir="rtl"`) and supports English (`dir="ltr"`).

### Mandatory Styling Rules
* **No Physical Directions**: Never use `left-`, `right-`, `pl-`, `pr-`, `ml-`, `mr-`, `text-left`, or `text-right` for layout positioning.
* **Use Logical Properties**:
  * Padding: `ps-` (padding-inline-start) and `pe-` (padding-inline-end) instead of `pl-` / `pr-`.
  * Margin: `ms-` (margin-inline-start) and `me-` (margin-inline-end) instead of `ml-` / `mr-`.
  * Positioning: `start-` and `end-` instead of `left-` and `right-`.
  * Text Alignment: `text-start` and `text-end` instead of `text-left` and `text-right`.
* **Direction Provider**: All root-level modals, dialogs, and views must be wrapped with `<DirectionProvider dir={i18n.dir()}>` to ensure Radix primitives align to the correct side.
* **Dropdowns & Popovers**: Radix Select and Dropdown components must pass `dir={i18n.dir()}`.

---

## 2. Bilingual Text & Translation Management

### Mandatory Rules
1. **Zero Hardcoded Text**: No user-facing strings may appear directly in JSX.
2. **Synchronized Updates**: Whenever adding or modifying a translation key, **both** files must be updated simultaneously:
   * [`src/locales/he.json`](../../src/locales/he.json) (Hebrew translation)
   * [`src/locales/en.json`](../../src/locales/en.json) (English translation)
3. **Namespacing**: Keep keys grouped logically under their feature area:
   * `common.*`: Shared button labels, titles, error messages.
   * `auth.*`: Login, credentials, logout, passkeys.
   * `management.*`: Course creation, editing, deletion.
   * `attendance_card.*`: Attendance statuses, session actions.
   * `daily_view.*`: Daily calendar view, filter modal.
   * `dashboard.*`: Statistics, metrics, charts.
   * `account.*`: User profile, password, passkey registration.
   * `admin.*`: User administration, user lists.

---

## 3. Component Architecture

* **UI Primitives**: Headless Radix UI components live in `src/components/ui/`. Use existing primitives (`Button`, `Card`, `Dialog`, `Select`, `Input`, `Switch`, `Tabs`, `Toast`).
* **Class Merging**: Always use `cn(...)` from `@/lib/utils` to merge conditional Tailwind classes.
* **Lazy Loading**: Major views must be lazy-loaded in `src/App.tsx` and wrapped with `<Suspense fallback={<LoadingSpinner />}>`.

