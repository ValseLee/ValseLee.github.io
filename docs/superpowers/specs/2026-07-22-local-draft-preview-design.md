# Local Draft Preview Design

**Date:** 2026-07-22
**Status:** Approved

## Goal

Render local article and portfolio drafts with the blog's Next.js UI at dedicated development-only URLs without changing published post URLs or allowing draft content into a production static export.

## Scope

### Included

- A local draft index at `/drafts`.
- Article previews at `/drafts/articles/<slug>` from `.article-drafts/<slug>.mdx`.
- Portfolio previews at `/drafts/portfolio/<slug>` from `.portfolio-drafts/<slug>.json`.
- Server-side draft discovery, parsing, validation, and rendering during `next dev` only.
- Reuse of the published article presentation and the existing portfolio validation contract.
- Focused `node:test` coverage plus production-export leakage checks.

### Excluded

- Overriding `/posts/<slug>` with draft content.
- Adding drafts to the home, archive, categories, graph, header, or any public navigation.
- A public portfolio route or canonical portfolio page.
- Draft editing, saving, publishing, or media upload changes.
- A new API, client-side filesystem access, dependency, or runtime feature flag.

## Chosen Approach

Add one App Router subtree for all draft previews:

```text
/drafts
/drafts/articles/<slug>
/drafts/portfolio/<slug>
```

Use `app/drafts/page.dev.tsx` for the index and one detail route at `app/drafts/[kind]/[slug]/page.dev.tsx`; `kind` accepts only `articles` or `portfolio`.

`/drafts` is required because ignored draft filenames are otherwise undiscoverable from the blog. It lists article and portfolio drafts in separate sections and links only to the dedicated preview routes. No public page links back to the index.

A server-only draft reader owns access to `.article-drafts/` and `.portfolio-drafts/`. It reads from the current repository root, treats missing directories as empty, validates requested filenames before joining paths, and never accepts an arbitrary path. The route subtree remains composed in `app/`; shared parsing and content validation remain in `lib/`; the deployed app never imports from `scripts/`.

Rejected alternatives:

- Separate article and portfolio route implementations would duplicate the environment gate, lookup rules, and error handling.
- Extending the standalone dashboard server would not render drafts through the actual Next.js blog layout.
- Copying drafts into `content/` or overlaying `/posts/<slug>` would weaken the tracked-content boundary and risk publishing local state.

## Development-Only Boundary

`NODE_ENV === "development"` is the only condition that enables draft access. `next.config.ts` adds the compound `dev.tsx` page extension only in development, so production page discovery ignores both draft route files before compilation or static parameter collection. This is the primary production boundary.

- `/drafts` and its detail route exist as `page.dev.tsx` files and are discovered only by `next dev`.
- The detail route enumerates local drafts through `generateStaticParams()` during development and sets `dynamicParams = false`, so an ungenerated slug cannot render.
- The index still calls `notFound()` unless draft preview is enabled.
- Direct draft-reader calls outside development return no entries or a disabled result before touching the filesystem; this reader guard is the second defense.
- No separate environment variable can enable draft previews during `next build`.

This file-discovery boundary is required by the verified Next.js 16 behavior: with `output: "export"`, a discovered dynamic route must produce at least one prerendered route, so an empty static-parameter set is rejected rather than treated as a route-exclusion mechanism.

The production static-export check must prove that `out/` contains no generated article or portfolio draft detail pages and no draft-only title, slug, Markdown, or JSON content. Existing files already stored under `public/` retain their current public-asset behavior; this feature neither moves nor publishes media.

## Index and Lookup Behavior

The index scans only direct children with the expected extension:

- Article drafts: `.article-drafts/*.mdx`; the filename without `.mdx` is the URL slug.
- Portfolio drafts: `.portfolio-drafts/*.json`; the validated project slug is the URL slug and must match the filename.

Each section shows the draft title or project name and its slug. An empty or missing directory shows a small empty state rather than failing the page. Drafts are not merged with canonical posts or `content/portfolio.json`, even when a slug matches published content.

## Rendering

### Articles

Extract the existing published post presentation into the smallest shared Server Component needed by two consumers: `app/posts/[slug]/page.tsx` and the article draft route. Both pass a parsed post-shaped value to the same component, including frontmatter, formatted date, tags, related-link footer, and `MDXRemote` body rendering. Routing, metadata lookup, and `notFound()` remain in their respective route files.

### Portfolio

Move the existing pure portfolio project normalizer from `scripts/article-dashboard.mjs` into a runtime-neutral `lib/` module, then import it from the dashboard, `verify-content`, and the draft reader. This preserves one validation contract instead of reimplementing the JSON shape in the app.

There is no existing public portfolio renderer to extract. The draft route therefore colocates the minimum React renderer until a real second consumer exists:

- `descriptionMarkdown` renders through the already-installed `MDXRemote` path.
- Media keeps array order.
- Images use native `<img>` with the validated `alt` value.
- Videos use native `<video controls preload="metadata">`.
- Every media item uses `<figure>` and `<figcaption>` with its required caption.
- Existing `/portfolio/<filename>` paths continue to resolve through Next.js public-file serving.

No custom Markdown renderer, media component hierarchy, CSS framework, or client component is added.

## Error Handling

- A missing draft directory produces an empty index section.
- A missing slug, rejected filename, filename/portfolio-slug mismatch, or deleted draft returns the normal 404 page.
- Malformed article frontmatter, malformed portfolio JSON, or a project that fails the shared validator renders a local draft-error state instead of crashing the whole index.
- Error output identifies the draft and failure category without exposing an absolute filesystem path or stack trace.
- MDX compilation errors remain visible through the local Next.js development error surface; production never attempts to compile draft MDX.

## Smallest TDD and Verification Scope

Add one focused `node:test` file around the server-only reader using a temporary repository root. Keep the cases limited to behavior introduced here:

1. In development, list and load one valid article MDX draft and one valid portfolio JSON draft.
2. Outside development, return no draft params or content even when valid draft files exist.
3. Distinguish missing and malformed drafts without returning filesystem paths.
4. Reject traversal, wrong extensions, and a portfolio filename/slug mismatch.

Renderer markup does not need a new test framework. Existing type checking, linting, build execution, and live route checks cover the thin Server Component composition.

Implementation verification runs in this order:

```text
node --test lib/draft-preview.test.mjs
npm test
npm run lint
npm run build
git diff --check
```

After the production build, inspect `out/` for `/drafts/articles/`, `/drafts/portfolio/`, and known draft-only sentinel text. A live `next dev` check must verify the index, one article preview, one portfolio preview with Markdown and media, a missing slug returning 404, and a malformed draft returning the local error state.

## Acceptance Criteria

- Local users can discover both draft types at `/drafts` and open them only through the dedicated URLs.
- Published URLs and public navigation remain unchanged.
- Article drafts use the same presentation component and MDX renderer as published posts.
- Portfolio drafts use the shared project validator, `MDXRemote`, and native ordered media elements.
- Missing and invalid drafts fail safely and do not break other previews.
- A production static export contains no renderable draft page or draft content.
- No implementation plan, public portfolio page, authoring change, dependency, or unrelated refactor is part of this work.
