# Local Draft Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render ignored article and portfolio drafts at dedicated development-only URLs without changing public URLs or exporting draft content.

**Architecture:** Move the existing portfolio validator into runtime-neutral `lib/`, then add one `NODE_ENV === "development"` filesystem reader. Development-only `page.dev.tsx` routes consume it; `next.config.ts` excludes those route files from production page discovery, while the reader guard remains a second defense. Article previews share the public article Server Component and portfolio previews use `MDXRemote` plus native media.

**Tech Stack:** Next.js 16 App Router/static export, React 19 Server Components, strict TypeScript, ESM, `gray-matter`, `next-mdx-remote/rsc`, `node:test`.

## Global Constraints

- Stay in `/Users/celan/.herdr/worktrees/ValseLee.github.io/feature-local-draft-preview` on `feature/local-draft-preview`; create no worktree, child, or subagent.
- Use only `/drafts`, `/drafts/articles/<slug>`, and `/drafts/portfolio/<slug>`; never override `/posts/<slug>` or alter public navigation.
- Draft filesystem access is enabled only by `NODE_ENV === "development"`; no other flag may enable it during `next build`.
- Add no API, Client Component, dependency, public portfolio route, authoring behavior, media move, or CSS file.
- Every production edit follows an observed assertion or HTTP RED for that exact behavior.
- Preserve unrelated changes and never stage this plan file in product commits.

## File Map

- Task 1: create `lib/portfolio.mjs` and `scripts/portfolio-shared-boundary.test.mjs`; modify `scripts/article-dashboard.mjs` and `scripts/verify-content.mjs`.
- Task 2: create `lib/draft-preview.mjs`, `lib/draft-preview.d.mts`, and `lib/draft-preview.test.mjs`.
- Task 3: create `components/PostArticle.tsx`, `app/drafts/page.dev.tsx`, and `app/drafts/[kind]/[slug]/page.dev.tsx`; modify `app/posts/[slug]/page.tsx`, `next.config.ts`, and remove the moved validator's unused imports from `scripts/article-dashboard.mjs`.

---

### Task 1: Move Portfolio Validation Behind a Shared Boundary

**Interfaces:**
- `lib/portfolio.mjs` exports `PORTFOLIO_IMAGE_EXTENSIONS`, `PORTFOLIO_VIDEO_EXTENSIONS`, `createSlug(title, date?)`, `normalizePortfolioSrc(value, field)`, `normalizePortfolioProject(rawProject)`, `normalizePortfolioContent(rawContent)`, and `mergePortfolioProject(content, project)`.
- `scripts/article-dashboard.mjs` re-exports the four helpers already imported by its tests.

- [ ] **Step 1: Add the source-boundary assertion before production changes**

Create `scripts/portfolio-shared-boundary.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("portfolio validation is owned by lib and consumed without importing the dashboard server", () => {
  const dashboard = fs.readFileSync("scripts/article-dashboard.mjs", "utf8");
  const verifier = fs.readFileSync("scripts/verify-content.mjs", "utf8");
  assert.match(dashboard, /from "\.\.\/lib\/portfolio\.mjs"/);
  assert.match(verifier, /from "\.\.\/lib\/portfolio\.mjs"/);
  assert.doesNotMatch(verifier, /article-dashboard\.mjs/);
});
```

- [ ] **Step 2: Observe RED, then confirm existing behavior is green**

```bash
node --test scripts/portfolio-shared-boundary.test.mjs
node --test scripts/article-dashboard.test.mjs
npm run verify:content
```

Expected: boundary test assertion `FAIL` because neither consumer imports `../lib/portfolio.mjs`; dashboard tests and content verification exit `0`.

- [ ] **Step 3: Move the exact validator behavior into `lib/portfolio.mjs`**

```js
import path from "node:path";

export const PORTFOLIO_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg"]);
export const PORTFOLIO_VIDEO_EXTENSIONS = new Set([".mp4"]);

function dateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createSlug(title, date = new Date()) {
  const slug = String(title ?? "").trim().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").normalize("NFC").replace(/[’']/g, "")
    .toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");
  return slug || `post-${dateString(date)}`;
}

function requiredText(value, field, maxLength) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  const normalized = value.trim();
  if (maxLength !== undefined && normalized.length > maxLength) throw new Error(`${field} must be at most ${maxLength} characters`);
  return normalized;
}

export function normalizePortfolioSrc(value, field) {
  if (typeof value !== "string" || !value.startsWith("/portfolio/")) throw new Error(`${field} must be /portfolio/<filename>`);
  const fileName = value.slice("/portfolio/".length);
  let decodedFileName;
  try { decodedFileName = decodeURIComponent(fileName); }
  catch { throw new Error(`${field} must be /portfolio/<filename>`); }
  if (!fileName || path.posix.basename(decodedFileName) !== decodedFileName || decodedFileName.includes("\\")) throw new Error(`${field} must be /portfolio/<filename>`);
  const extension = path.extname(decodedFileName).toLowerCase();
  if (!PORTFOLIO_IMAGE_EXTENSIONS.has(extension) && !PORTFOLIO_VIDEO_EXTENSIONS.has(extension)) throw new Error(`${field} has an unsupported extension`);
  return value;
}

export function normalizePortfolioProject(rawProject) {
  if (!rawProject || typeof rawProject !== "object" || Array.isArray(rawProject)) throw new Error("project must be an object");
  const name = requiredText(rawProject.name, "name", 120);
  const slug = rawProject.slug ? requiredText(rawProject.slug, "slug") : createSlug(name);
  if (!/^[\p{Letter}\p{Number}]+(?:-[\p{Letter}\p{Number}]+)*$/u.test(slug)) throw new Error("slug is invalid");
  if (typeof rawProject.descriptionMarkdown !== "string" || !rawProject.descriptionMarkdown.trim()) throw new Error("descriptionMarkdown is required");
  if (rawProject.descriptionMarkdown.length > 50_000) throw new Error("descriptionMarkdown must be at most 50000 characters");
  if (!Array.isArray(rawProject.media) || rawProject.media.length > 20) throw new Error("media must contain at most 20 items");
  return {
    slug, name, period: requiredText(rawProject.period, "period", 80), descriptionMarkdown: rawProject.descriptionMarkdown,
    media: rawProject.media.map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`media[${index}] is invalid`);
      const src = normalizePortfolioSrc(item.src, `media[${index}].src`);
      const caption = requiredText(item.caption, `media[${index}].caption`, 300);
      const extension = path.extname(src).toLowerCase();
      if (item.kind === "image" && PORTFOLIO_IMAGE_EXTENSIONS.has(extension)) return { kind: "image", src, caption, alt: requiredText(item.alt, `media[${index}].alt`) };
      if (item.kind === "video" && PORTFOLIO_VIDEO_EXTENSIONS.has(extension)) return { kind: "video", src, caption };
      throw new Error(`media[${index}].kind does not match src`);
    }),
  };
}

export function normalizePortfolioContent(rawContent) {
  if (!rawContent || typeof rawContent !== "object" || Array.isArray(rawContent) || !Array.isArray(rawContent.projects)) throw new Error("portfolio.projects must be an array");
  const projects = rawContent.projects.map(normalizePortfolioProject);
  if (new Set(projects.map(({ slug }) => slug)).size !== projects.length) throw new Error("duplicate project slug");
  return { projects };
}

export function mergePortfolioProject(content, project) {
  const projects = [...content.projects];
  const index = projects.findIndex(({ slug }) => slug === project.slug);
  if (index === -1) projects.push(project); else projects[index] = project;
  return { projects };
}
```

Import these symbols from `../lib/portfolio.mjs` in the dashboard, re-export `createSlug`, `mergePortfolioProject`, `normalizePortfolioContent`, and `normalizePortfolioProject`, delete their old definitions, and change the verifier import to:

```js
import { normalizePortfolioContent } from "../lib/portfolio.mjs";
```

- [ ] **Step 4: Run GREEN and commit**

```bash
node --test scripts/portfolio-shared-boundary.test.mjs
node --test scripts/article-dashboard.test.mjs
npm run verify:content
git diff --check
git add lib/portfolio.mjs scripts/article-dashboard.mjs scripts/verify-content.mjs scripts/portfolio-shared-boundary.test.mjs
git commit -m "⚙️ refactor: share portfolio content validation"
```

Expected: boundary test reports `pass 1`, dashboard tests report `fail 0`, verification exits `0`, and one semantic refactor commit is created.

---

### Task 2: Build the Draft Reader Through Strict RED-GREEN Cycles

**Interfaces:**

```ts
export type DraftKind = "articles" | "portfolio";
export interface DraftReaderOptions { root?: string; nodeEnv?: string; }
export interface DraftSummary { kind: DraftKind; slug: string; label: string; valid: boolean; }
export type DraftLoadResult =
  | { status: "disabled" }
  | { status: "missing" }
  | { status: "invalid"; kind: DraftKind; slug: string; message: string }
  | { status: "ok"; kind: "articles"; article: import("./posts").Post }
  | { status: "ok"; kind: "portfolio"; project: PortfolioProject };
export function isDraftPreviewEnabled(nodeEnv?: string): boolean;
export function listDrafts(options?: DraftReaderOptions): DraftSummary[];
export function loadDraft(kind: DraftKind, slug: string, options?: DraftReaderOptions): DraftLoadResult;
```

- [ ] **Step 1: Write only the caught dynamic-import availability test**

Create `lib/draft-preview.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";

const subjectPromise = import("./draft-preview.mjs").catch(() => null);

test("draft preview reader exposes its public API", async () => {
  const subject = await subjectPromise;
  assert.ok(subject, "draft preview module must be available");
  for (const name of ["isDraftPreviewEnabled", "listDrafts", "loadDraft"]) assert.equal(typeof subject[name], "function");
});
```

- [ ] **Step 2: Observe assertion RED, add only API stubs, then GREEN**

```bash
node --test lib/draft-preview.test.mjs
```

Expected RED: assertion `FAIL` with `draft preview module must be available`; no uncaught `ERR_MODULE_NOT_FOUND`.

Create `lib/draft-preview.mjs`:

```js
export function isDraftPreviewEnabled() { throw new Error("not implemented"); }
export function listDrafts() { throw new Error("not implemented"); }
export function loadDraft() { throw new Error("not implemented"); }
```

Run the same command. Expected GREEN: `pass 1`, `fail 0`.

- [ ] **Step 3: Append the development happy-path test and observe RED**

Append imports/helpers and one test to `lib/draft-preview.test.mjs`:

```js
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function fixtureRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "draft-preview-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, ".article-drafts"));
  fs.mkdirSync(path.join(root, ".portfolio-drafts"));
  return root;
}

test("development lists and loads both draft formats", async (t) => {
  const { listDrafts, loadDraft } = await subjectPromise;
  const root = fixtureRoot(t);
  fs.writeFileSync(path.join(root, ".article-drafts", "local-note.mdx"), `---\ntitle: Local Note\ndate: 2026-07-22\ncategory: engineering\ntags: [draft]\nlinks: []\ndescription: Local description\n---\n\n# Draft body\n`);
  fs.writeFileSync(path.join(root, ".portfolio-drafts", "local-project.json"), JSON.stringify({ slug: "local-project", name: "Local Project", period: "2026 — Present", descriptionMarkdown: "## Portfolio draft", media: [] }));
  assert.deepEqual(listDrafts({ root, nodeEnv: "development" }).map(({ kind, slug, label, valid }) => ({ kind, slug, label, valid })), [
    { kind: "articles", slug: "local-note", label: "Local Note", valid: true },
    { kind: "portfolio", slug: "local-project", label: "Local Project", valid: true },
  ]);
  assert.equal(loadDraft("articles", "local-note", { root, nodeEnv: "development" }).article.content.trim(), "# Draft body");
  assert.equal(loadDraft("portfolio", "local-project", { root, nodeEnv: "development" }).project.name, "Local Project");
});
```

Run `node --test --test-name-pattern="development lists" lib/draft-preview.test.mjs`.
Expected RED: `not implemented` from `listDrafts`.

- [ ] **Step 4: Implement only valid development listing/loading and observe GREEN**

Replace stubs with filesystem lookup using `gray-matter` and Task 1's `normalizePortfolioProject`. Validate article title/date/category/tags/links/description/body; accept only direct child slugs; read `.mdx` for `articles` and `.json` for `portfolio`; return `{status:"ok", ...}`. Do not catch malformed input and do not add the production gate yet.

Run the focused command again. Expected GREEN: matching test `pass 1`, `fail 0`.

- [ ] **Step 5: Append missing/malformed/path assertions, observe RED, then add safe results**

```js
test("missing malformed and unsafe drafts return safe results", async (t) => {
  const { loadDraft } = await subjectPromise;
  const root = fixtureRoot(t);
  fs.writeFileSync(path.join(root, ".article-drafts", "broken.mdx"), "not frontmatter");
  fs.writeFileSync(path.join(root, ".portfolio-drafts", "broken.json"), "{");
  fs.writeFileSync(path.join(root, ".portfolio-drafts", "wrong-name.json"), JSON.stringify({ slug: "different-name", name: "Mismatch", period: "2026", descriptionMarkdown: "Draft", media: [] }));
  for (const [kind, slug] of [["articles", "broken"], ["portfolio", "broken"]]) {
    const result = loadDraft(kind, slug, { root, nodeEnv: "development" });
    assert.equal(result.status, "invalid");
    assert.doesNotMatch(result.message, new RegExp(root));
  }
  assert.deepEqual(loadDraft("portfolio", "wrong-name", { root, nodeEnv: "development" }), { status: "missing" });
  assert.deepEqual(loadDraft("articles", "missing", { root, nodeEnv: "development" }), { status: "missing" });
  assert.deepEqual(loadDraft("articles", "../secret", { root, nodeEnv: "development" }), { status: "missing" });
  assert.deepEqual(loadDraft("articles", "secret.json", { root, nodeEnv: "development" }), { status: "missing" });
});
```

Run the matching pattern. Expected RED: malformed content throws instead of returning `invalid`.

GREEN implementation: validate `kind` and slug before joining, return `missing` for unsafe/missing/mismatched files, and catch parse/validation failures as `{ status:"invalid", kind, slug, message:"Article draft is malformed or invalid." }` or the portfolio equivalent. Re-run; expected `pass 1`, `fail 0`.

- [ ] **Step 6: Append the production no-read assertion, observe RED, then add the gate**

```js
test("production disables drafts before filesystem access", async () => {
  const { listDrafts, loadDraft } = await subjectPromise;
  const options = { root: "/path-that-must-not-be-read", nodeEnv: "production" };
  assert.deepEqual(listDrafts(options), []);
  assert.deepEqual(loadDraft("articles", "local-note", options), { status: "disabled" });
});
```

Run the matching pattern. Expected RED: development-only implementation attempts to inspect the nonexistent root or returns `missing`, not `disabled`.

GREEN implementation: add `isDraftPreviewEnabled(nodeEnv = process.env.NODE_ENV)`, return `[]` at the start of `listDrafts`, and return `{status:"disabled"}` at the start of `loadDraft`. Re-run; expected `pass 1`, `fail 0`.

- [ ] **Step 7: Add the exact declaration file, run all GREEN, and commit**

Create `lib/draft-preview.d.mts` from the Interfaces block, defining `PortfolioProject` and its image/video union exactly as normalized in Task 1.

```bash
node --test lib/draft-preview.test.mjs
npm test
git diff --check
git add lib/draft-preview.mjs lib/draft-preview.d.mts lib/draft-preview.test.mjs
git commit -m "✨ feat: add guarded local draft reader"
```

Expected: reader file reports `tests 4`, `pass 4`, `fail 0`; full tests exit `0`; one semantic reader commit is created.

---

### Task 3: Add Each Draft Route Through HTTP RED-GREEN

**Interfaces:**
- `PostArticle({ post }: { post: Post })` renders the unchanged public article presentation.
- `/drafts` lists both kinds; `/drafts/articles/<slug>` and `/drafts/portfolio/<slug>` render dedicated previews.
- `next.config.ts` recognizes the `dev.tsx` page extension only when `NODE_ENV === "development"`, excluding the draft route files from production discovery.
- The detail route enumerates listed development params with `generateStaticParams()` and sets `dynamicParams = false`; the reader's `NODE_ENV` guard remains the second defense before filesystem access.

**Verified Next.js 16 rationale:** With `output: "export"`, a discovered dynamic route must yield at least one prerendered route. The build rejected the empty static-parameter approach, so conditional `page.dev.tsx` discovery is the production boundary instead.

- [ ] **Step 1: Create worktree-local fixtures before route code**

```bash
node --input-type=module <<'NODE'
import fs from "node:fs";
import { saveDraft, savePortfolioDraft } from "./scripts/article-dashboard.mjs";
saveDraft({ title: "Draft Preview Sentinel Article", date: "2026-07-22", category: "engineering", tags: "draft", links: "", description: "Draft preview sentinel article", body: "# Draft Preview Sentinel Body" });
const canonical = JSON.parse(fs.readFileSync("content/portfolio.json", "utf8"));
const media = canonical.projects.flatMap((project) => project.media).slice(0, 1);
savePortfolioDraft({ slug: "draft-preview-sentinel-portfolio", name: "Draft Preview Sentinel Portfolio", period: "2026 — Present", descriptionMarkdown: "## Draft Preview Sentinel Portfolio Body", media });
fs.mkdirSync(".portfolio-drafts", { recursive: true });
fs.writeFileSync(".portfolio-drafts/broken.json", "{");
NODE
```

- [ ] **Step 2: Start dev and observe all four HTTP/body RED assertions**

Start `npm run dev -- --hostname 127.0.0.1 --port 4320`, then run this assertion script:

```bash
node --input-type=module <<'NODE'
import assert from "node:assert/strict";
const cases = [
  ["/drafts", /Draft Preview Sentinel Article/],
  ["/drafts/articles/draft-preview-sentinel-article", /Draft Preview Sentinel Body/],
  ["/drafts/portfolio/draft-preview-sentinel-portfolio", /Draft Preview Sentinel Portfolio Body/],
  ["/drafts/portfolio/broken", /Local draft error/],
];
for (const [pathname, pattern] of cases) {
  const response = await fetch(`http://127.0.0.1:4320${pathname}`);
  const body = await response.text();
  try { assert.equal(response.status, 200); assert.match(body, pattern); }
  catch { console.log(`EXPECTED RED ${pathname}: ${response.status}`); continue; }
  throw new Error(`${pathname} unexpectedly passed before implementation`);
}
NODE
```

Expected: four `EXPECTED RED` lines, each currently `404`. Keep the fixture and restart dev after each route edit if Next does not detect a newly created route.

- [ ] **Step 3: Establish development-only page discovery, implement `/drafts`, then make its assertion GREEN**

Change `next.config.ts` so the route filename is recognized only in development:

```ts
pageExtensions: process.env.NODE_ENV === "development"
  ? ["dev.tsx", "js", "jsx", "md", "mdx", "ts", "tsx"]
  : ["js", "jsx", "md", "mdx", "ts", "tsx"],
```

Create `app/drafts/page.dev.tsx` as a Server Component. Call `notFound()` before listing unless `isDraftPreviewEnabled()`; group `listDrafts()` into `articles` and `portfolio`; render empty states and links `/drafts/${kind}/${slug}`; show each label and slug, and mark invalid summaries with ` · Invalid`.

Run an assertion for `/drafts` only. Expected GREEN: status `200` and body contains both sentinel labels plus `broken`; the three detail assertions remain RED.

- [ ] **Step 4: Observe article detail RED, then extract/reuse the article renderer and make GREEN**

Re-run the article HTTP assertion alone; expected RED `404`.

Create `components/PostArticle.tsx` by moving the complete JSX and `MDXRemote`/`Link` imports from `app/posts/[slug]/page.tsx` without output changes. Modify the public route to retain params/static params/metadata and return `<PostArticle post={post} />`.

Create `app/drafts/[kind]/[slug]/page.dev.tsx` with `dynamicParams = false`, development-only `generateStaticParams()`, kind narrowing, `loadDraft`, and only the successful `articles` branch; all other results call `notFound()`.

Re-run the article assertion. Expected GREEN: status `200`, body contains `Draft Preview Sentinel Body`, and the public `/posts/hello-world` still returns `200`.

- [ ] **Step 5: Observe portfolio detail RED, add only its renderer, then GREEN**

Re-run the portfolio assertion; expected RED `404`.

Add the `portfolio` success branch to the same detail route: render name and period, `descriptionMarkdown` through `MDXRemote`, preserve media order, and use `<figure>`, native `<img alt>`, native `<video controls preload="metadata">`, and `<figcaption>`. Add the narrow Next lint suppression only to the native image line.

Re-run. Expected GREEN: status `200`; body contains `Draft Preview Sentinel Portfolio Body` and a `/portfolio/` media path.

- [ ] **Step 6: Observe invalid detail RED, add the safe error state, then GREEN**

Re-run `/drafts/portfolio/broken`; expected RED `404`.

Before success-kind branching, render `status === "invalid"` as a local error `<main>` containing `Local draft error`, the safe slug, and `result.message`; keep `disabled` and `missing` as `notFound()`.

Re-run. Expected GREEN: status `200`, body contains `Local draft error` and `malformed or invalid`, and contains no absolute worktree path.

- [ ] **Step 7: Run focused/full checks and production leak scan**

```bash
node --test lib/draft-preview.test.mjs
npm test
npm run lint
npm run build
test ! -e out/drafts
test ! -e out/drafts/articles/draft-preview-sentinel-article.html
test ! -e out/drafts/articles/draft-preview-sentinel-article/index.html
test ! -e out/drafts/portfolio/draft-preview-sentinel-portfolio.html
test ! -e out/drafts/portfolio/draft-preview-sentinel-portfolio/index.html
if rg -n "Draft Preview Sentinel" out; then exit 1; fi
git diff --check
```

If an external `node_modules` symlink makes Turbopack reject the worktree, use `npm run build -- --webpack` and repeat the leak checks. Expected: the production route table and `out/` omit `/drafts` entirely, all checks exit `0`, and the final `rg` prints nothing and exits `1`.

- [ ] **Step 8: Repeat the full live GREEN matrix and missing 404**

Verify index, article, portfolio, and invalid assertions now all return `200` with their expected bodies; verify `/drafts/articles/missing` returns `404`; stop the dev server.

- [ ] **Step 9: Remove only generated fixtures and commit**

```bash
node --input-type=module <<'NODE'
import fs from "node:fs";
for (const file of [
  ".article-drafts/draft-preview-sentinel-article.mdx",
  ".portfolio-drafts/draft-preview-sentinel-portfolio.json",
  ".portfolio-drafts/broken.json",
]) fs.rmSync(file, { force: true });
NODE
git add components/PostArticle.tsx app/posts/'[slug]'/page.tsx app/drafts/page.dev.tsx app/drafts/'[kind]'/'[slug]'/page.dev.tsx next.config.ts scripts/article-dashboard.mjs
git diff --cached --check
git commit -m "✨ feat: add local draft preview routes"
```

Expected: fixtures are gone; the commit contains the shared article presentation, development-only draft routes, production discovery boundary, and lint-only import cleanup. The plan is not staged with product files.

## Final Verification

Run fresh:

```bash
npm test
npm run lint
npm run build
git diff --check
git status --short
```

Expected: tests, lint, build, and diff check exit `0`; production leak scan remains clean. After the separate documentation-alignment commit, `git status --short` is empty.

Guidance loaded: index.md, verify.md, architecture.md, react-typescript.md, content.md, local-tools.md, testing.md, worktree-dispatch.md
