# Portfolio Period Date Picker Design

**Date:** 2026-07-21
**Status:** Approved

## Goal

Replace the portfolio dashboard's free-form period field with native date controls while preserving the existing `period` string contract used by drafts, canonical content, previews, and publishing.

## Chosen Approach

Use two native `<input type="date">` controls for the start and end dates plus a `Present` checkbox. When `Present` is checked, disable and clear the end-date input.

Before previewing, saving a draft, or publishing, derive the existing `period` field as one of:

```text
YYYY.MM.DD — YYYY.MM.DD
YYYY.MM.DD — Present
```

This keeps `content/portfolio.json`, server validation, draft storage, and public rendering unchanged. A new structured date contract or date-picker dependency is unnecessary.

## Dashboard Behavior

- Start date is always required.
- End date is required unless `Present` is checked.
- End date must not precede the start date.
- Changing any date control updates `state.project.period`, marks the form dirty, and refreshes the preview through the existing flow.
- Loading a project restores the date controls from the canonical dashboard-generated period format.
- The canonical portfolio file is currently empty, so no legacy free-form period migration or fallback editor is included.

Use a small field row within the existing form and its current responsive layout. Browser-native date selection, validation, keyboard access, and focus behavior are retained.

## Validation

The browser form prevents missing or reversed date ranges before submission. The server continues treating `period` as required text up to 80 characters because the wire and content contract does not change.

The client-side formatter must produce the period string from validated ISO date input values rather than parse locale-formatted browser display text.

## Verification

Extend the existing portfolio dashboard server test to assert that the served HTML includes required start and end `<input type="date">` controls and the `Present` checkbox. In a live dashboard check, verify a fixed range, a present range, reversed-date rejection, and restoring a saved canonical period into the controls.

Run:

```text
node --test scripts/article-dashboard.test.mjs
npm test
npm run verify:content
npm run lint
npm run build
git diff --check
```

No dependency, public renderer change, content migration, or custom date-picker component is included.
