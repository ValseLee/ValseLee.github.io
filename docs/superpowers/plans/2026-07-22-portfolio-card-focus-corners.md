# Portfolio Card Focus Corners Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved camera-focus corner animation to portfolio-card hover and keyboard focus states.

**Architecture:** Keep the behavior entirely in the existing `app/PortfolioGrid.module.css`. One `.card::after` pseudo-element draws four corners with native CSS backgrounds, while existing link markup, overlay behavior, focus outline, and static rendering remain unchanged.

**Tech Stack:** CSS Modules, native CSS transitions, Next.js 16 static export.

## Global Constraints

- Work only in `/Users/celan/.herdr/worktrees/ValseLee.github.io/feature-portfolio-section`; do not create another worktree or child Codex.
- Modify only `app/PortfolioGrid.module.css` during implementation.
- Preserve the existing uncommitted formatting and `.overlay { opacity: 0.3; }` change exactly.
- Add no React, JavaScript, SVG, element, dependency, global style, token, or shared abstraction.
- Keep the current external `:focus-visible` outline and overlay transition intact.
- Limit pointer hover activation to `(hover:hover) and (pointer:fine)`; keyboard focus remains available independently.
- Disable the corner transition under `prefers-reduced-motion: reduce` without hiding the active state.
- Do not stage or commit `app/PortfolioGrid.module.css`: its pre-existing overlapping changes are user-owned and cannot be safely separated from this addition as a normal hunk.

---

### Task 1: Add and verify the focus corners

**Files:**
- Modify: `app/PortfolioGrid.module.css:7-78`
- Reference: `docs/superpowers/specs/2026-07-22-portfolio-card-focus-corners-design.md`

**Interfaces:**
- Consumes: the existing `.card`, `.card:focus-visible`, precise-hover media query, and reduced-motion media query.
- Produces: a visual-only `.card::after` decoration; no exported API, DOM, content, or state change.

- [ ] **Step 1: Confirm the protected baseline**

Run:

```bash
git diff -- app/PortfolioGrid.module.css
```

Expected: the existing diff includes formatting changes and changes the precise-hover `.overlay` opacity from `0` to `0.3`. Stop if that baseline is missing or has changed unexpectedly.

- [ ] **Step 2: Add the minimal corner decoration**

Insert these rules after `.card`:

```css
.card::after {
  content: "";
  position: absolute;
  z-index: 2;
  inset: 6px;
  pointer-events: none;
  background:
    linear-gradient(currentColor 0 0) left top / 20px 2px no-repeat,
    linear-gradient(currentColor 0 0) left top / 2px 20px no-repeat,
    linear-gradient(currentColor 0 0) right top / 20px 2px no-repeat,
    linear-gradient(currentColor 0 0) right top / 2px 20px no-repeat,
    linear-gradient(currentColor 0 0) left bottom / 20px 2px no-repeat,
    linear-gradient(currentColor 0 0) left bottom / 2px 20px no-repeat,
    linear-gradient(currentColor 0 0) right bottom / 20px 2px no-repeat,
    linear-gradient(currentColor 0 0) right bottom / 2px 20px no-repeat;
  opacity: 0;
  transition: inset 220ms ease-out, opacity 160ms ease-out;
}

.card:focus-visible::after {
  inset: 16px;
  opacity: 1;
}
```

Add this rule inside the existing precise-hover media query:

```css
  .card:hover::after {
    inset: 16px;
    opacity: 1;
  }
```

Add this rule inside the existing reduced-motion media query:

```css
  .card::after {
    transition: none;
  }
```

Do not alter any existing declaration while inserting the rules.

- [ ] **Step 3: Inspect the complete CSS diff**

Run:

```bash
git diff --check
git diff -- app/PortfolioGrid.module.css
```

Expected: `git diff --check` prints nothing. The CSS diff retains the protected baseline and adds only the pseudo-element, active states, and reduced-motion override described in Step 2.

- [ ] **Step 4: Run release checks for the CSS surface**

Run:

```bash
npm run lint
npm run build
```

Expected: both commands exit successfully; the build completes the static export after content verification.

- [ ] **Step 5: Verify the rendered interaction**

Run:

```bash
npm run dev
```

Open the printed local URL and verify:

- Precise-pointer hover fades four white corners in while moving them from a 6px inset to a 16px inset.
- Moving the pointer away reverses the transition.
- Keyboard Tab focus shows the same final corners and retains the external focus outline.
- Touch/coarse-pointer emulation does not create a persistent hover decoration.
- Reduced-motion emulation shows the active corners immediately with no movement.
- Card navigation, cover images, name, period, and overlay behavior are unchanged.

Stop the development server after inspection.

- [ ] **Step 6: Leave the verified implementation unstaged for review**

Run:

```bash
git status --short
git diff --cached --name-only
```

Expected: `app/PortfolioGrid.module.css` remains modified but unstaged, no implementation path is staged, and all other pre-existing modified or untracked paths remain untouched.
