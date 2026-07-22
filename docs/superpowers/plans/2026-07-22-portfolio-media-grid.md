# Portfolio Media Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the portfolio detail page's vertical media list with a responsive one-, two-, and three-column grid.

**Architecture:** Keep the change inside the existing server-rendered `PortfolioProjectArticle` component. Use existing Tailwind grid utilities, remove the per-item inline width from this gallery, and leave the portfolio content contract and dashboard unchanged.

**Tech Stack:** Next.js 16 App Router, React 19 Server Components, strict TypeScript, Tailwind CSS 4.

## Global Constraints

- Change only `components/PortfolioProjectArticle.tsx` for the product implementation.
- Render one column on mobile, two columns from the `md` breakpoint, and three columns from the `xl` breakpoint.
- Preserve media order, captions, image alt text, video controls, poster images, and preload behavior.
- Preserve `media.size` in the content contract and dashboard, but do not apply it in this uniform gallery.
- Add no dependency, client-side code, abstraction, or unrelated style change.
- Preserve unrelated uncommitted changes and do not push.

---

### Task 1: Implement and verify the responsive media grid

**Files:**
- Modify: `components/PortfolioProjectArticle.tsx:1-28`

**Interfaces:**
- Consumes: `PortfolioProject.media` in its existing order.
- Produces: a CSS-only responsive grid with full-width media inside equal cells.

- [ ] **Step 1: Replace the vertical stack with the responsive grid**

Remove the unused `PORTFOLIO_MEDIA_WIDTHS` import. Replace the gallery container and opening `<figure>` with:

```tsx
<div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
  {project.media.map((media, index) => (
    <figure key={`${media.src}-${index}`}>
```

Keep the existing image, video, caption, mapping close, and container close unchanged.

- [ ] **Step 2: Run component-surface checks**

Run:

```bash
git diff --check -- components/PortfolioProjectArticle.tsx
npm run lint
npm run build
```

Expected: every command exits successfully; the build retains static portfolio routes.

- [ ] **Step 3: Verify the rendered gallery**

Open `/portfolio/loutine` from the built or development site and confirm:

- Below 768px: one media item per row.
- From 768px through 1279px: two media items per row.
- From 1280px: three media items per row.
- Captions remain below their matching media, images retain meaningful alt text, and each video remains playable with its poster.

- [ ] **Step 4: Inspect the final task diff**

Run:

```bash
git diff -- components/PortfolioProjectArticle.tsx
git status --short
```

Expected: the product diff contains only the approved component change; pre-existing modifications in `app/display-title-reveal.test.mjs`, `app/globals.css`, and `content/site.tsx` remain untouched.
