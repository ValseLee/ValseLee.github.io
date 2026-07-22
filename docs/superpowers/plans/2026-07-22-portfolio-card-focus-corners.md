# Portfolio Card Focus Corners Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved camera-focus corner animation to portfolio-card hover and keyboard focus states, with the site's ink-shadow values applied to the gradient corners.

**Architecture:** Keep the corner behavior in the existing `app/PortfolioGrid.module.css`. Add a parallel `--ink-drop-shadow` token beside `--ink-shadow` in `app/globals.css` because the comma-separated text-shadow token cannot style background gradients, then consume the new token through one `filter` declaration on `.card::after`.

**Tech Stack:** CSS Modules, native CSS transitions, Next.js 16 static export.

## Global Constraints

- Work only in `/Users/celan/.herdr/worktrees/ValseLee.github.io/feature-portfolio-section`; do not create another worktree or child Codex.
- Modify only `app/globals.css` and `app/PortfolioGrid.module.css` during implementation.
- Preserve the existing uncommitted formatting and `.overlay { opacity: 0.3; }` change exactly.
- Preserve the later tuned `.card::after` opacity `0.3`, 250ms inset timing, 8px keyboard-focus inset, 16px pointer-hover inset, and 1px focus outline exactly.
- Add no React, JavaScript, SVG, element, dependency, global selector, or shared abstraction.
- The sole new shared value is `--ink-drop-shadow`, whose desktop and mobile layers mirror the existing `--ink-shadow` offsets, blur radii, and colors.
- Keep the current external `:focus-visible` outline and overlay transition intact.
- Limit pointer hover activation to `(hover:hover) and (pointer:fine)`; keyboard focus remains available independently.
- Disable the corner transition under `prefers-reduced-motion: reduce` without hiding the active state.
- Do not stage or commit either implementation path: `app/PortfolioGrid.module.css` contains overlapping user-owned changes, and the global token is incomplete without its consumer.

---

### Task 1: Add and verify the focus corners

**Files:**
- Modify: `app/globals.css:2-10,387-390`
- Modify: `app/PortfolioGrid.module.css:16-36`
- Reference: `docs/superpowers/specs/2026-07-22-portfolio-card-focus-corners-design.md`

**Interfaces:**
- Consumes: the existing `--ink-shadow` desktop/mobile values and `.card::after` gradient decoration.
- Produces: global `--ink-drop-shadow` desktop/mobile tokens and one visual-only filter consumer; no exported API, DOM, content, or state change.

- [ ] **Step 1: Confirm the protected baseline**

Run:

```bash
git diff -- app/globals.css app/PortfolioGrid.module.css
```

Expected: the existing diff includes formatting changes, `.overlay` opacity `0.3`, corner opacity `0.3`, 250ms inset timing, 8px focus inset, 16px hover inset, and a 1px focus outline. Stop if that baseline is missing or has changed unexpectedly.

- [ ] **Step 2: Add the global drop-shadow counterpart**

Add this declaration immediately after the root `--ink-shadow` declaration:

```css
  --ink-drop-shadow: drop-shadow(0 0 1px rgba(0, 0, 0, 0.1)) drop-shadow(1px 1px 3px rgba(0, 0, 0, 0.3)) drop-shadow(-1px -1px 2px rgba(0, 0, 0, 0.1));
```

Add this declaration immediately after the weaker `--ink-shadow` declaration inside the existing `@media (max-width: 860px)` query:

```css
    --ink-drop-shadow: drop-shadow(0 0 0.25px rgba(0, 0, 0, 0.1)) drop-shadow(0.25px 0.25px 0.75px rgba(0, 0, 0, 0.3)) drop-shadow(-0.25px -0.25px 0.5px rgba(0, 0, 0, 0.1));
```

Do not alter `--ink-shadow` or its current consumers.

- [ ] **Step 3: Apply the token to the corners**

Add one declaration to the existing `.card::after` rule immediately after its `background` declaration:

```css
  filter: var(--ink-drop-shadow);
```

Do not alter the existing corner gradients, opacity, timing, insets, outline, hover, focus, or reduced-motion declarations.

- [ ] **Step 4: Inspect the complete CSS diff**

Run:

```bash
git diff --check
git diff -- app/globals.css app/PortfolioGrid.module.css
```

Expected: `git diff --check` prints nothing. The implementation adds only two `--ink-drop-shadow` declarations to `app/globals.css` and one `filter` declaration to the protected `app/PortfolioGrid.module.css` baseline.

- [ ] **Step 5: Run release checks for the CSS surface**

Run:

```bash
npm run lint
npm run build
```

Expected: both commands exit successfully; the build completes the static export after content verification.

- [ ] **Step 6: Verify the rendered interaction**

Run:

```bash
npm run dev
```

Open the printed local URL and verify:

- Precise-pointer hover fades four white corners in while moving them from a 6px inset to a 16px inset.
- Moving the pointer away reverses the transition.
- Keyboard Tab focus shows full-opacity corners at the tuned 8px inset and retains the 1px external focus outline.
- Touch/coarse-pointer emulation does not create a persistent hover decoration.
- Reduced-motion emulation shows the active corners immediately with no movement.
- Card navigation, cover images, name, period, and overlay behavior are unchanged.
- The computed corner filter uses the desktop three-layer token above 860px and the weaker three-layer token at or below 860px.

Stop the development server after inspection.

- [ ] **Step 7: Leave the verified implementation unstaged for review**

Run:

```bash
git status --short
git diff --cached --name-only
```

Expected: `app/globals.css` and `app/PortfolioGrid.module.css` remain modified but unstaged, no implementation path is staged, and all other pre-existing modified or untracked paths remain untouched.
