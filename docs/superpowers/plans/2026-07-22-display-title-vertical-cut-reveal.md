# Display Title Vertical Cut Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reveal the home-page display title character by character from below on its first render.

**Architecture:** Keep the route as a Server Component. Change the title content to three strings, render word-preserving character wrappers in `app/page.tsx`, and animate them with native CSS in the existing global title styles.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS animations, `node:test`

## Global Constraints

- Add no dependency and no Client Component.
- Preserve the existing `h1` accessible name and natural word wrapping.
- Disable the reveal under `prefers-reduced-motion: reduce`.
- Preserve all pre-existing uncommitted changes in `app/page.tsx`, `app/globals.css`, and `app/favicon.ico`.

---

### Task 1: Implement and verify the title reveal

**Files:**
- Modify: `content/site.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Create: `app/display-title-reveal.test.mjs`

**Interfaces:**
- Consumes: `site.identity.title: string[]`
- Produces: `.display-title-line`, `.display-title-word`, `.display-title-cut`, and `.display-title-character` markup/style hooks

- [ ] **Step 1: Write the failing regression test**

Create `app/display-title-reveal.test.mjs` with `node:test` assertions that read the three implementation files and require: a string-array title contract, word and character rendering, character animation delays, clipped character wrappers, the reveal keyframes, and a reduced-motion override.

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = dirname(fileURLToPath(import.meta.url));
const [page, styles, site] = await Promise.all([
  readFile(join(appDirectory, "page.tsx"), "utf8"),
  readFile(join(appDirectory, "globals.css"), "utf8"),
  readFile(join(appDirectory, "../content/site.tsx"), "utf8"),
]);

test("display title uses a reduced-motion-safe vertical cut reveal", () => {
  assert.match(site, /title:\s*\["안녕하세요,", "iOS Product Engineer", "이승준 입니다\."\]/);
  assert.match(page, /site\.identity\.title\.map/);
  assert.match(page, /line\.split\(" "\)/);
  assert.match(page, /Array\.from\(word\)/);
  assert.match(page, /animationDelay:\s*character\.delay/);
  assert.match(page, /aria-label=\{site\.identity\.title\.join\(" "\)\}/);
  assert.match(styles, /\.display-title-cut\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(styles, /@keyframes display-title-reveal/);
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.display-title-character\s*\{[^}]*animation:\s*none/s,
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test app/display-title-reveal.test.mjs`

Expected: FAIL because the title is still JSX and the reveal selectors do not exist.

- [ ] **Step 3: Convert the title content to line strings**

Replace `site.identity.title` in `content/site.tsx` with:

```tsx
title: ["안녕하세요,", "iOS Product Engineer", "이승준 입니다."],
```

- [ ] **Step 4: Render word-preserving character cuts**

In `app/page.tsx`, derive visual title lines before the return:

```tsx
let revealIndex = 0;
const titleLines = site.identity.title.map((line) =>
  line.split(" ").map((word) => ({
    word,
    characters: Array.from(word).map((character) => ({
      character,
      delay: `${revealIndex++ * 25}ms`,
    })),
  })),
);
```

Render those lines inside the existing `h1`, using the joined title for `aria-label`; mark visual wrappers `aria-hidden="true"`; keep words in `.display-title-word`; and wrap each animated `.display-title-character` in `.display-title-cut`.

- [ ] **Step 5: Add the native CSS reveal**

Add these owned title styles to `app/globals.css`:

```css
.display-title-line {
  display: block;
}

.display-title-word,
.display-title-cut,
.display-title-character {
  display: inline-block;
}

.display-title-word {
  white-space: nowrap;
}

.display-title-cut {
  overflow: hidden;
  vertical-align: bottom;
}

.display-title-character {
  transform: translateY(110%);
  animation: display-title-reveal 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes display-title-reveal {
  to {
    transform: translateY(0);
  }
}
```

Inside the existing reduced-motion media query, add:

```css
.display-title-character {
  animation: none;
  transform: none;
}
```

- [ ] **Step 6: Run focused and repository checks**

Run:

```bash
node --test app/display-title-reveal.test.mjs
npm run lint
npm run build
```

Expected: all commands pass.

- [ ] **Step 7: Verify rendered behavior**

Open the local home page and verify desktop and mobile widths. Confirm source-order character reveal, preserved three-line/word wrapping, stable final geometry, and immediate visibility with reduced motion enabled.

- [ ] **Step 8: Inspect the final task diff**

Run `git diff --check` and inspect only the task hunks. Do not commit overlapping user changes unless the user explicitly requests a commit.
