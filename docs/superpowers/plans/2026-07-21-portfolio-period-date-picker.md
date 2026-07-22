# Portfolio Period Date Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the portfolio dashboard's free-form period input with native start/end date controls and a Present checkbox while preserving the existing `period` string contract.

**Architecture:** Keep the change inside the existing inline portfolio dashboard HTML and browser script in `scripts/article-dashboard.mjs`. Derive the existing `state.project.period` string from ISO date input values and parse only that canonical dashboard-generated string when loading projects or drafts; server normalization, storage, preview APIs, publishing, and public rendering remain unchanged.

**Tech Stack:** Node.js 20, `node:http`, browser-native HTML form controls, inline JavaScript/CSS, `node:test`, `node:assert/strict`.

## Global Constraints

- Start date is always required.
- End date is required unless `Present` is checked.
- End date must not precede the start date.
- The derived wire value is exactly `YYYY.MM.DD — YYYY.MM.DD` or `YYYY.MM.DD — Present`.
- Changing a date control updates `state.project.period`, marks the form dirty, and refreshes the existing preview.
- Loading a canonical dashboard-generated period restores all three date controls.
- Keep server validation as required text up to 80 characters.
- Do not add a dependency, public renderer change, content migration, legacy fallback editor, or custom date-picker component.

---

### Task 1: Native Portfolio Period Controls

**Files:**
- Modify: `scripts/article-dashboard.mjs`
- Modify: `scripts/article-dashboard.test.mjs`
- Add: `docs/superpowers/plans/2026-07-21-portfolio-period-date-picker.md`

**Interfaces:**
- Consumes: the existing `state.project.period` string and `markDirty()` preview flow inside `renderPortfolioDashboard(root)`.
- Produces: required `#period-start` and `#period-end` date inputs plus `#period-present`; date controls serialize to the unchanged `state.project.period` contract.

- [ ] **Step 1: Write the failing served-HTML regression test**

In `portfolio mode serves the local dashboard and portfolio JSON APIs`, replace the old `period` ID expectation with `period-start`, `period-end`, and `period-present`, then add boundary assertions:

```js
assert.match(html, /<input id="period-start" type="date" required/);
assert.match(html, /<input id="period-end" type="date" required/);
assert.match(html, /<input id="period-present" type="checkbox"/);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test --test-name-pattern="portfolio mode serves" scripts/article-dashboard.test.mjs`

Expected: FAIL because the served dashboard still contains only `id="period"`.

- [ ] **Step 3: Replace the free-form input with native controls**

Use the existing `.controls` and `.field` layout. Add only the local checkbox styling needed to prevent the general input width rule from stretching the checkbox:

```html
<div class="field">
  <label>Period</label>
  <div class="controls">
    <div class="field"><label for="period-start">Start date</label><input id="period-start" type="date" required /></div>
    <div class="field"><label for="period-end">End date</label><input id="period-end" type="date" required /></div>
    <label class="checkbox"><input id="period-present" type="checkbox" /> Present</label>
  </div>
</div>
```

Keep the responsive behavior in the existing wrapping controls row.

- [ ] **Step 4: Add minimal canonical parsing, formatting, and validation**

Inside the existing portfolio browser script:

```js
const canonicalPeriod = /^(\d{4}\.\d{2}\.\d{2}) — (Present|\d{4}\.\d{2}\.\d{2})$/;
const toIsoDate = (value) => value.replaceAll(".", "-");
const toPeriodDate = (value) => value.replaceAll("-", ".");

function syncPeriodFields() {
  const match = canonicalPeriod.exec(state.project.period);
  periodStartInput.value = match ? toIsoDate(match[1]) : "";
  periodPresentInput.checked = match?.[2] === "Present";
  periodEndInput.value = match && !periodPresentInput.checked ? toIsoDate(match[2]) : "";
  periodEndInput.disabled = periodPresentInput.checked;
  periodEndInput.required = !periodPresentInput.checked;
  periodEndInput.min = periodStartInput.value;
}

function updatePeriod() {
  periodEndInput.disabled = periodPresentInput.checked;
  periodEndInput.required = !periodPresentInput.checked;
  periodEndInput.min = periodStartInput.value;
  if (periodPresentInput.checked) periodEndInput.value = "";
  const start = periodStartInput.value;
  const end = periodEndInput.value;
  state.project.period = start && (periodPresentInput.checked || (end && end >= start))
    ? toPeriodDate(start) + " — " + (periodPresentInput.checked ? "Present" : toPeriodDate(end))
    : "";
  markDirty();
}
```

Call `syncPeriodFields()` from the existing `syncFields()`, attach `updatePeriod` to each date control's `input` or `change` event, remove the old free-form period binding, and call `form.reportValidity()` before the Save Draft request so its button-only path receives the same browser validation as form submission.

- [ ] **Step 5: Run focused and broad verification**

Run:

```text
node --test --test-name-pattern="portfolio mode serves" scripts/article-dashboard.test.mjs
node --test scripts/article-dashboard.test.mjs
npm test
npm run verify:content
npm run lint
npm run build
git diff --check
```

Expected: all commands pass.

- [ ] **Step 6: Perform the live dashboard check**

Run the portfolio dashboard on an available localhost port and verify:

- `2026-01-02` through `2026-07-21` produces `2026.01.02 — 2026.07.21` in the preview.
- Selecting Present clears and disables the end date and produces `2026.01.02 — Present`.
- An end date before the start date is rejected by browser validity.
- Loading a project or draft with `2026.01.02 — 2026.07.21` restores both date inputs and leaves Present unchecked.

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/plans/2026-07-21-portfolio-period-date-picker.md scripts/article-dashboard.mjs scripts/article-dashboard.test.mjs
git commit -m "📅 feat: add portfolio period date controls"
```
