# Text Shadow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the reference site's ink-like text shadow to the blog's body copy, links, controls, and small headings.

**Architecture:** Keep the existing desktop shadow token in `app/globals.css`, apply it through one global selector group, and override only the token on narrow screens. No component or JavaScript changes are needed.

**Tech Stack:** CSS, Next.js 16, Tailwind CSS 4

## Global Constraints

- Reuse the existing `--ink-shadow` token.
- Apply the shadow only to `a`, `button`, `h3`, `h4`, and `p`.
- Keep `h1` and `h2` free of the effect.
- Use the reference site's quarter-strength shadow below `860px`.
- Add no dependency or abstraction.

---

### Task 1: Apply and verify the text shadow

**Files:**
- Modify: `app/globals.css:33-35`
- Modify: `app/globals.css:421-490`

**Interfaces:**
- Consumes: existing `--ink-shadow` custom property
- Produces: inherited visual styling for the approved element selectors

- [ ] **Step 1: Apply the desktop shadow to the approved selectors**

Add this rule after the `body` rule:

```css
a,
button,
h3,
h4,
p {
  text-shadow: var(--ink-shadow);
}
```

- [ ] **Step 2: Add the narrow-screen token override**

Add this media query before the existing `@media (max-width: 760px)` block:

```css
@media (max-width: 860px) {
  :root {
    --ink-shadow: 0 0 0.25px rgba(0, 0, 0, 0.1), 0.25px 0.25px 0.75px rgba(0, 0, 0, 0.3), -0.25px -0.25px 0.5px rgba(0, 0, 0, 0.1);
  }
}
```

- [ ] **Step 3: Run repository checks**

Run:

```bash
npm run lint
npm run build
```

Expected: both commands exit with status `0`.

- [ ] **Step 4: Inspect the rendered result**

Run the site locally and inspect desktop and mobile widths. Confirm `p`, `a`, `button`, `h3`, and `h4` have a computed `text-shadow`, while `h1` and `h2` compute to `none` unless they contain a styled descendant.

- [ ] **Step 5: Commit only the implementation**

```bash
git add app/globals.css
git commit -m "🎨 style: add ink text shadow"
```
