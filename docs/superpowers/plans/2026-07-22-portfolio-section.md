# Portfolio Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish canonical portfolio projects in homepage section 2 with optional dashboard-managed covers and statically exported detail pages.

**Architecture:** Extend the existing portfolio normalizer with one optional image-only cover and add one small canonical reader for the homepage and detail route. Keep authoring in the existing localhost dashboard, reuse `/api/portfolio/media`, render the public grid without client JavaScript, and extract the current draft detail markup only when the public route becomes its second consumer.

**Tech Stack:** Next.js 16 App Router/static export, React 19 Server Components, strict TypeScript, Node.js built-ins and `node:test`, `next-mdx-remote`, CSS Modules.

## Global Constraints

- Work only in `/Users/celan/.herdr/worktrees/ValseLee.github.io/feature-portfolio-section`; execute inline with `superpowers:executing-plans`; do not create a worktree or child Codex.
- Preserve `output: "export"`; add no dependency, deployed write API, Client Component, or JavaScript hover handler.
- Reuse `content/portfolio.json`, `public/portfolio/`, `.portfolio-drafts/`, `scripts/article-dashboard.mjs`, and `/api/portfolio/media`.
- `coverImage` stays optional and separate from `media`; never infer it from the first media item.
- Covers accept only existing portfolio image extensions and require non-empty alt text; missing covers render black.
- Do not delete orphaned cover files, reorder detail media, redesign the detail body, or add crop/focal-point behavior.
- Preserve the approved homepage baseline except where Task 3 fills section 2; its recorded blobs are `app/page.tsx` = `47edb7b4c723216286f8a047410e1decd8819f36` and `app/globals.css` = `654ef0e53e7a97bbb0ff48b1d526f9a50a70f6bd`. Do not substitute a newer primary-checkout version or clean unrelated code.
- Use semantic emoji commits and do not push.

---

### Task 1: Add the canonical cover contract and content reader

**Files:**
- Modify: `lib/portfolio.mjs:1-120`
- Create: `lib/portfolio.d.mts`
- Create: `lib/portfolio-content.mjs`
- Create: `lib/portfolio-content.d.mts`
- Create: `lib/portfolio-content.test.mjs`
- Modify: `lib/draft-preview.d.mts:17-34`
- Modify: `scripts/article-dashboard.mjs:95-135`
- Modify: `scripts/article-dashboard.test.mjs:35-266`
- Modify: `package.json:13-17`

**Interfaces:**
- Consumes: existing `normalizePortfolioSrc()`, `PORTFOLIO_IMAGE_EXTENSIONS`, draft persistence, and explicit publish-path safeguards.
- Produces: `PortfolioProject.coverImage?: { src: string; alt: string }`; `getAllPortfolioProjects(root?: string): PortfolioProject[]`; `getPortfolioProjectBySlug(slug: string, root?: string): PortfolioProject | null`.

- [ ] **Step 1: Add failing cover behavior tests**

In `scripts/article-dashboard.test.mjs`, add a valid cover to the first normalization input and expected result:

```js
coverImage: { src: "/portfolio/cover.webp", alt: " Project cover " },
```

```js
coverImage: { src: "/portfolio/cover.webp", alt: "Project cover" },
```

Add this focused test after the existing invalid-field test:

```js
test("normalizePortfolioProject accepts an omitted cover and rejects invalid covers", () => {
  const valid = portfolioProject();
  assert.equal(Object.hasOwn(normalizePortfolioProject(valid), "coverImage"), false);
  for (const [coverImage, error] of [
    [null, /coverImage/i],
    [[], /coverImage/i],
    [{ src: "/portfolio/cover.webp", alt: "" }, /coverImage\.alt/i],
    [{ src: "/portfolio/demo.mp4", alt: "Demo" }, /coverImage\.src.*image/i],
    [{ src: "/portfolio/cover.txt", alt: "Cover" }, /coverImage\.src/i],
    [{ src: "/portfolio/../cover.png", alt: "Cover" }, /coverImage\.src/i],
  ]) assert.throws(() => normalizePortfolioProject({ ...valid, coverImage }), error);
});
```

Add `coverImage: { src: "/portfolio/cover.png", alt: "Cover" }` to the existing draft round-trip project. In the publish-path test, create `cover.png`, include that cover plus `demo.mp4`, and expect this path order in preflight/add/commit calls:

```js
[
  "content/portfolio.json",
  "public/portfolio/cover.png",
  "public/portfolio/demo.mp4",
]
```

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run:

```bash
node --test --test-name-pattern='normalizePortfolioProject|portfolio drafts|publishPortfolioProject updates' scripts/article-dashboard.test.mjs
```

Expected: FAIL because cover normalization and cover publish paths do not exist.

- [ ] **Step 3: Add the failing canonical reader test**

Create `lib/portfolio-content.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getAllPortfolioProjects, getPortfolioProjectBySlug } from "./portfolio-content.mjs";

test("canonical portfolio reader normalizes list and slug lookup", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-content-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "content"));
  fs.writeFileSync(path.join(root, "content", "portfolio.json"), JSON.stringify({ projects: [{
    slug: "loutine",
    name: "Loutine",
    period: "2026.06.22 — Present",
    descriptionMarkdown: "Description",
    coverImage: { src: "/portfolio/cover.png", alt: " Cover " },
    media: [],
  }] }));

  assert.equal(getAllPortfolioProjects(root)[0].coverImage.alt, "Cover");
  assert.equal(getPortfolioProjectBySlug("loutine", root)?.name, "Loutine");
  assert.equal(getPortfolioProjectBySlug("missing", root), null);
  assert.equal(getPortfolioProjectBySlug("bad%encoding", root), null);
});
```

Run `node --test lib/portfolio-content.test.mjs`.

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `lib/portfolio-content.mjs`.

- [ ] **Step 4: Implement cover normalization**

Add after `normalizePortfolioSrc()` in `lib/portfolio.mjs`:

```js
function normalizePortfolioCoverImage(rawCover) {
  if (!rawCover || typeof rawCover !== "object" || Array.isArray(rawCover)) {
    throw new Error("coverImage is invalid");
  }
  const src = normalizePortfolioSrc(rawCover.src, "coverImage.src");
  const extension = path.extname(decodeURIComponent(src)).toLowerCase();
  if (!PORTFOLIO_IMAGE_EXTENSIONS.has(extension)) {
    throw new Error("coverImage.src must be an image");
  }
  return { src, alt: requiredPortfolioText(rawCover.alt, "coverImage.alt") };
}
```

In `normalizePortfolioProject()` compute the optional field before its return:

```js
const coverImage = rawProject.coverImage === undefined
  ? undefined
  : normalizePortfolioCoverImage(rawProject.coverImage);
```

Insert this property immediately before the existing `media:` property; leave the complete existing media mapping unchanged:

```js
...(coverImage ? { coverImage } : {}),
```

- [ ] **Step 5: Add canonical declarations and the minimal reader**

Create `lib/portfolio.d.mts`:

```ts
export interface PortfolioCoverImage { src: string; alt: string }
export type PortfolioMedia =
  | { kind: "image"; src: string; caption: string; alt: string }
  | { kind: "video"; src: string; caption: string };
export interface PortfolioProject {
  slug: string;
  name: string;
  period: string;
  descriptionMarkdown: string;
  coverImage?: PortfolioCoverImage;
  media: PortfolioMedia[];
}
export interface PortfolioContent { projects: PortfolioProject[] }
export const PORTFOLIO_IMAGE_EXTENSIONS: Set<string>;
export const PORTFOLIO_VIDEO_EXTENSIONS: Set<string>;
export function createSlug(title: unknown, date?: Date): string;
export function normalizePortfolioSrc(value: unknown, field: string): string;
export function normalizePortfolioProject(rawProject: unknown): PortfolioProject;
export function normalizePortfolioContent(rawContent: unknown): PortfolioContent;
export function mergePortfolioProject(content: PortfolioContent, project: PortfolioProject): PortfolioContent;
```

Replace the duplicate portfolio types in `lib/draft-preview.d.mts` with:

```ts
import type { PortfolioProject } from "./portfolio.mjs";
export type { PortfolioProject } from "./portfolio.mjs";
```

Create `lib/portfolio-content.mjs`:

```js
import fs from "node:fs";
import path from "node:path";
import { normalizePortfolioContent } from "./portfolio.mjs";

export function getAllPortfolioProjects(root = process.cwd()) {
  const filePath = path.join(root, "content", "portfolio.json");
  return normalizePortfolioContent(JSON.parse(fs.readFileSync(filePath, "utf8"))).projects;
}

export function getPortfolioProjectBySlug(slug, root = process.cwd()) {
  if (typeof slug !== "string") return null;
  let decodedSlug;
  try { decodedSlug = decodeURIComponent(slug); } catch { return null; }
  return getAllPortfolioProjects(root).find((project) => project.slug === decodedSlug) ?? null;
}
```

Create `lib/portfolio-content.d.mts`:

```ts
import type { PortfolioProject } from "./portfolio.mjs";
export function getAllPortfolioProjects(root?: string): PortfolioProject[];
export function getPortfolioProjectBySlug(slug: string, root?: string): PortfolioProject | null;
```

- [ ] **Step 6: Include the cover in explicit publish paths**

Replace the `mediaPaths` construction in `publishPortfolioProject()` with:

```js
const mediaSources = [project.coverImage?.src, ...project.media.map(({ src }) => src)].filter(Boolean);
const mediaPaths = [...new Set(mediaSources.map((src) => path.join("public", src.slice(1))))];
```

Do not change overlap preflight, atomic replacement, build, rollback, `commit --only`, or push behavior.

- [ ] **Step 7: Register and run the green tests**

Add `"test:portfolio-content": "node --test lib/portfolio-content.test.mjs"` to `package.json` and insert it into the existing `test` chain. Do not modify dependencies or `package-lock.json`.

Run:

```bash
node --test lib/portfolio-content.test.mjs
node --test --test-name-pattern='normalizePortfolioProject|portfolio drafts|publishPortfolioProject updates' scripts/article-dashboard.test.mjs
npm run test:article-dashboard
npm run verify:content
```

Expected: all PASS; `verify:content` reports one portfolio project.

- [ ] **Step 8: Commit Task 1**

```bash
git add lib/portfolio.mjs lib/portfolio.d.mts lib/portfolio-content.mjs lib/portfolio-content.d.mts lib/portfolio-content.test.mjs lib/draft-preview.d.mts scripts/article-dashboard.mjs scripts/article-dashboard.test.mjs package.json
git diff --cached --check
git diff --cached --stat
git commit -m "✨ feat: add portfolio cover contract"
```

Expected: only listed paths are committed; `app/page.tsx` and `app/globals.css` remain unstaged.

---

### Task 2: Add dashboard cover upload, replace, and remove

**Files:**
- Modify: `scripts/article-dashboard.mjs:984-1378`
- Modify: `scripts/article-dashboard.test.mjs:373-569`

**Interfaces:**
- Consumes: `PortfolioProject.coverImage`, existing `/api/portfolio/media` response `{ ok, kind, src }`, and the existing project-state/draft/publish flow.
- Produces: controls `cover-input`, `cover-preview`, `cover-alt`, `remove-cover`; failed replacement preserves the current cover; successful replacement submits the new cover with unchanged ordinary media.

- [ ] **Step 1: Add failing served-HTML and browser behavior assertions**

Add the four cover IDs to the existing dashboard ID list and assert:

```js
assert.match(html, /id="cover-input" type="file" accept="image\/\*"/);
```

Keep the existing `assert.doesNotThrow(() => new vm.Script(browserScript[1]))` check so every dashboard change still proves the served inline JavaScript compiles under `node:vm`.

Because `renderPreview()` will prepend the initial cover image, its stable child order becomes cover `0`, title `1`, period `2`, Markdown `3`, then ordinary media. Update every existing period assertion in this browser test to `preview.children[2]`, including all three current forms:

```js
assert.equal(preview.children[2].textContent, "2026.02.03 — 2026.08.22");
assert.equal(preview.children[2].textContent, "");
assert.deepEqual(
  { end: end.value, disabled: end.disabled, required: end.required, preview: preview.children[2].textContent },
  { end: "", disabled: true, required: false, preview: "2026.02.03 — Present" },
);
```

Rename the browser behavior test to `portfolio controls retain browser behavior`, add an initial cover and media to its project, and add the four IDs to its fake selector list:

```js
const project = portfolioProject({
  period: "2026.01.02 — 2026.07.21",
  coverImage: { src: "/portfolio/old-cover.png", alt: "Old cover" },
  media: [{ kind: "video", src: "/portfolio/demo.mp4", caption: "Demo" }],
});
```

Make consecutive `/api/portfolio/media` fake responses return a video and an image, then assert:

```js
coverInput.files = [{ name: "rejected.mp4", type: "video/mp4" }];
await coverInput.dispatch("change");
assert.equal(coverPreview.children[0].src, "/portfolio/old-cover.png");

coverInput.files = [{ name: "new-cover.png", type: "image/png" }];
await coverInput.dispatch("change");
assert.equal(coverPreview.children[0].src, "/portfolio/new-cover.png");
assert.equal(coverAlt.required, true);
assert.equal(coverAlt.value, "");

coverAlt.value = "New cover";
coverAlt.dispatch("input");
assert.equal(preview.children[0].src, "/portfolio/new-cover.png");

formValid = true;
await elements.get("#save-draft").dispatch("click");
await settle();
const coverDraft = JSON.parse(requests.filter(({ url, options }) =>
  url === "/api/portfolio/draft" && options.method === "POST").at(-1).options.body);
assert.deepEqual(coverDraft.coverImage, { src: "/portfolio/new-cover.png", alt: "New cover" });
assert.equal(coverDraft.media.length, 1);

removeCover.dispatch("click");
assert.equal(coverAlt.disabled, true);
assert.match(coverPreview.children[0].textContent, /No cover/i);
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
node --test --test-name-pattern='portfolio mode serves|portfolio controls retain' scripts/article-dashboard.test.mjs
```

Expected: FAIL because cover markup and listeners do not exist.

- [ ] **Step 3: Add cover controls and state rendering**

Insert after the period fields in the portfolio form:

```html
<div class="field">
  <label for="cover-input">Cover image</label>
  <input id="cover-input" type="file" accept="image/*" />
  <div id="cover-preview" class="cover-preview"></div>
  <label for="cover-alt">Cover alt</label>
  <input id="cover-alt" disabled />
  <button id="remove-cover" type="button" class="secondary" disabled>Remove Cover</button>
</div>
```

Add embedded dashboard styles:

```css
.cover-preview { min-height:160px; margin:10px 0; display:grid; place-items:center; border-radius:10px; background:#050505; color:var(--subtext); overflow:hidden; }
.cover-preview img { width:100%; max-height:280px; object-fit:contain; }
```

Query the four controls and add:

```js
function renderCoverControls() {
  const cover = state.project.coverImage;
  coverAltInput.disabled = !cover;
  coverAltInput.required = Boolean(cover);
  coverAltInput.value = cover?.alt || "";
  removeCoverButton.disabled = !cover;
  if (cover) {
    const image = document.createElement("img");
    image.src = cover.src;
    image.alt = cover.alt;
    coverPreview.replaceChildren(image);
  } else {
    const empty = document.createElement("span");
    empty.textContent = "No cover";
    coverPreview.replaceChildren(empty);
  }
}
```

Call `renderCoverControls()` from `syncFields()`. Keep `emptyProject()` cover-free so removal serializes as omission.

- [ ] **Step 4: Add upload, alt, remove, and preview behavior**

Add:

```js
coverInput.addEventListener("change", () => withAction(coverInput, async () => {
  const file = coverInput.files[0];
  if (!file) return;
  try {
    const response = await fetch("/api/portfolio/media", {
      method:"POST",
      headers:{ "content-type":file.type, "x-file-name":encodeURIComponent(file.name) },
      body:file,
    });
    const stored = await response.json();
    if (!response.ok) throw new Error(stored.error || "Cover upload failed");
    if (stored.kind !== "image" || typeof stored.src !== "string") throw new Error("Cover must be an image");
    state.project.coverImage = { src:stored.src, alt:"" };
    markDirty();
    renderCoverControls();
  } finally {
    coverInput.value = "";
  }
}));

coverAltInput.addEventListener("input", () => {
  if (!state.project.coverImage) return;
  state.project.coverImage.alt = coverAltInput.value;
  markDirty();
});

removeCoverButton.addEventListener("click", () => {
  delete state.project.coverImage;
  markDirty();
  renderCoverControls();
});
```

Assignment occurs only after a successful image response, preserving the previous cover on every error. In `renderPreview()`, prepend the cover without changing the ordered media loop:

```js
const cover = state.project.coverImage ? mediaElement({ kind:"image", ...state.project.coverImage }) : null;
preview.replaceChildren(...(cover ? [cover] : []), title, period, markdown);
```

- [ ] **Step 5: Run green checks and commit Task 2**

```bash
node --test --test-name-pattern='portfolio mode serves|portfolio controls retain' scripts/article-dashboard.test.mjs
npm run test:article-dashboard
npm run verify:content
git add scripts/article-dashboard.mjs scripts/article-dashboard.test.mjs
git diff --cached --check
git diff --cached --stat
git commit -m "✨ feat: add portfolio cover controls"
```

Expected: tests PASS and only the existing dashboard plus its test are committed.

---

### Task 3: Publish the homepage grid and static detail route

**Files:**
- Create: `app/PortfolioGrid.tsx`
- Create: `app/PortfolioGrid.module.css`
- Create: `components/PortfolioProjectArticle.tsx`
- Create: `app/portfolio/[slug]/page.tsx`
- Modify: `app/drafts/[kind]/[slug]/page.dev.tsx:1-66`
- Modify: `app/page.tsx:1-67`
- Modify: `scripts/verify-content.mjs:69-76`
- Preserve and include approved baseline: `app/globals.css:161-189,393-422`

**Interfaces:**
- Consumes: Task 1 reader functions and `PortfolioProject`.
- Produces: `PortfolioGrid({ projects })`, `PortfolioProjectArticle({ project })`, and statically enumerated `/portfolio/[slug]` pages.

- [ ] **Step 1: Run the red static-export probe**

```bash
npm run build
node -e 'const fs=require("node:fs"); const route=["out/portfolio/loutine.html","out/portfolio/loutine/index.html"].find(fs.existsSync); if(!route) throw new Error("missing static portfolio route"); const home=fs.readFileSync("out/index.html","utf8"); if(!home.includes("/portfolio/loutine")) throw new Error("missing homepage portfolio link")'
```

Expected: build succeeds, then the probe FAILS with `missing static portfolio route`.

- [ ] **Step 2: Extract the existing detail renderer**

Create `components/PortfolioProjectArticle.tsx`:

```tsx
import { MDXRemote } from "next-mdx-remote/rsc";
import type { PortfolioProject } from "@/lib/portfolio.mjs";

export default function PortfolioProjectArticle({ project }: { project: PortfolioProject }) {
  return (
    <article className="w-full max-w-[75vw] mx-auto py-12">
      <header className="mb-12">
        <p className="text-subtext text-sm mb-2">{project.period}</p>
        <h1 className="font-serif text-4xl md:text-5xl font-semibold">{project.name}</h1>
      </header>
      <div className="prose"><MDXRemote source={project.descriptionMarkdown} /></div>
      <div className="mt-12 space-y-8">
        {project.media.map((media, index) => (
          <figure key={`${media.src}-${index}`}>
            {media.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media.src} alt={media.alt} />
            ) : <video src={media.src} controls preload="metadata" />}
            <figcaption className="text-subtext text-sm mt-2">{media.caption}</figcaption>
          </figure>
        ))}
      </div>
    </article>
  );
}
```

In the draft route, remove its `MDXRemote` import, import this component, preserve every lookup/error branch, and replace only lines 42-65 with:

```tsx
return <PortfolioProjectArticle project={result.project} />;
```

- [ ] **Step 3: Add the static public route**

Create `app/portfolio/[slug]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import PortfolioProjectArticle from "@/components/PortfolioProjectArticle";
import { getAllPortfolioProjects, getPortfolioProjectBySlug } from "@/lib/portfolio-content.mjs";

interface PortfolioPageProps { params: Promise<{ slug: string }> }
export const dynamicParams = false;
export function generateStaticParams() {
  return getAllPortfolioProjects().map(({ slug }) => ({ slug }));
}
export async function generateMetadata({ params }: PortfolioPageProps) {
  const project = getPortfolioProjectBySlug((await params).slug);
  if (!project) return { title: "Not Found" };
  return { title: `${project.name} | Portfolio`, description: `${project.name} · ${project.period}` };
}
export default async function PortfolioPage({ params }: PortfolioPageProps) {
  const project = getPortfolioProjectBySlug((await params).slug);
  if (!project) notFound();
  return <PortfolioProjectArticle project={project} />;
}
```

- [ ] **Step 4: Add the homepage Server Component and CSS Module**

Create `app/PortfolioGrid.tsx`:

```tsx
import Link from "next/link";
import type { PortfolioProject } from "@/lib/portfolio.mjs";
import styles from "./PortfolioGrid.module.css";

export default function PortfolioGrid({ projects }: { projects: PortfolioProject[] }) {
  return (
    <div className={`section-content ${styles.grid}`}>
      {projects.map((project) => (
        <Link key={project.slug} className={styles.card} href={`/portfolio/${project.slug}`}>
          {project.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.cover} src={project.coverImage.src} alt={project.coverImage.alt} />
          )}
          <span className={styles.overlay}>
            <span className={styles.name}>{project.name}</span>
            <span className={styles.period}>{project.period}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
```

Create `app/PortfolioGrid.module.css`:

```css
.grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:clamp(18px,2.4vw,38px); }
.card { position:relative; aspect-ratio:16/10; overflow:hidden; background:#000; color:#fff; text-decoration:none; }
.card:focus-visible { outline:2px solid var(--foreground); outline-offset:4px; }
.cover { width:100%; height:100%; object-fit:cover; }
.overlay { position:absolute; inset:0; display:flex; flex-direction:column; justify-content:flex-end; padding:clamp(18px,2.4vw,32px); background:linear-gradient(transparent 35%,rgb(0 0 0 / 78%)); opacity:1; transform:none; transition:opacity 180ms ease,transform 180ms ease; }
.name { font-size:clamp(1.5rem,3vw,2.5rem); font-weight:600; line-height:1; }
.period { margin-top:8px; font-size:.75rem; letter-spacing:.06em; text-transform:uppercase; }
@media (hover:hover) and (pointer:fine) {
  .overlay { opacity:0; transform:translateY(12px); }
  .card:hover .overlay, .card:focus-visible .overlay { opacity:1; transform:none; }
}
@media (max-width:760px) { .grid { grid-column:1/-1; grid-template-columns:1fr; } }
@media (prefers-reduced-motion:reduce) { .overlay { transform:none; transition:none; } }
```

- [ ] **Step 5: Fill only homepage section 2**

Import `PortfolioGrid` and `getAllPortfolioProjects`, add `const projects = getAllPortfolioProjects();`, and change only the empty section 2 body to:

```tsx
<section id="portfolio" className="section-grid">
  <div className="section-number" aria-hidden="true">2</div>
  <PortfolioGrid projects={projects} />
</section>
```

Keep the approved section 1/expertise relocation and `app/globals.css` baseline intact. Remove the known whitespace-only blank line at current `app/page.tsx:29` while touching the page so final `git diff --check` passes; make no other cleanup.

Update the homepage section contract in `scripts/verify-content.mjs` so verification expects the new semantic ID instead of the removed ID:

```js
for (const section of ["about", "portfolio", "articles", "experience", "contact"]) {
  assert(home.includes(`id="${section}"`), `home missing ${section} section`);
}
```

- [ ] **Step 6: Run green static checks**

```bash
npm run lint
npm run build
node -e 'const fs=require("node:fs"); const route=["out/portfolio/loutine.html","out/portfolio/loutine/index.html"].find(fs.existsSync); if(!route) throw new Error("missing static portfolio route"); const home=fs.readFileSync("out/index.html","utf8"); if(!home.includes("/portfolio/loutine")) throw new Error("missing homepage portfolio link"); const detail=fs.readFileSync(route,"utf8"); for(const text of ["Loutine","2026.06.22","컨디션별 Routine"]) if(!detail.includes(text)) throw new Error(`missing detail text: ${text}`)'
```

Expected: PASS; build lists `/portfolio/loutine`; production output has no draft route.

- [ ] **Step 7: Review and commit Task 3 with its approved baseline**

Confirm `git hash-object app/globals.css` still prints the approved baseline blob `654ef0e53e7a97bbb0ff48b1d526f9a50a70f6bd`; do not compare against the now-drifting primary checkout. Inspect the complete `app/page.tsx` diff and confirm it contains the approved baseline plus only portfolio integration and the whitespace removal. Then:

```bash
git add app/PortfolioGrid.tsx app/PortfolioGrid.module.css components/PortfolioProjectArticle.tsx 'app/portfolio/[slug]/page.tsx' 'app/drafts/[kind]/[slug]/page.dev.tsx' app/page.tsx app/globals.css scripts/verify-content.mjs
git diff --cached --check
git diff --cached --stat
git commit -m "✨ feat: publish portfolio section"
```

Expected: public surface, its content-verification contract, and approved baseline only; no dashboard, content JSON, dependency, or unrelated CSS change.

---

### Task 4: Run release verification and fresh browser proof

**Files:**
- Verify only: no planned file changes

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: command results and fresh desktop, keyboard, mobile/touch, reduced-motion, and detail-navigation evidence.

- [ ] **Step 1: Run release checks**

```bash
npm test
npm run verify:content
npm run lint
npm run build
git diff --check
git diff --cached --check
```

Expected: all PASS; record exact test counts and `/portfolio/loutine`; confirm no `out/drafts` directory.

- [ ] **Step 2: Start a fresh server**

Run in an ongoing terminal:

```bash
npm run dev -- --hostname 127.0.0.1 --port 4320
```

Expected: ready at `http://127.0.0.1:4320`; do not reuse an older process.

- [ ] **Step 3: Prove wide grid, fallback, hover, and focus**

Open `/` at `1440x900`. Inspect `#portfolio .section-content`, `#portfolio a[href="/portfolio/loutine"]`, and its `lastElementChild` overlay with `getComputedStyle()`.

Expected: two computed grid tracks; card background `rgb(0, 0, 0)` because canonical Loutine lacks a cover; overlay hidden/offset before precise hover and opacity `1`/identity transform on hover. Reload, reach the card with `Tab`, and confirm `:focus-visible`, a non-`none` outline, opacity `1`, and identity transform.

- [ ] **Step 4: Prove mobile/touch and reduced motion**

Emulate `390x844`, touch, and `hover: none`.

Expected: one computed grid track, overlay opacity `1` before interaction, no horizontal overflow, and the whole card remains a link.

Emulate `prefers-reduced-motion: reduce` and inspect the overlay.

Expected: `transitionDuration` is `0s` and transform is `none` or the identity matrix.

- [ ] **Step 5: Prove detail navigation and final state**

Activate the Loutine card. Confirm `/portfolio/loutine` contains the name, period, Markdown body, existing image alt, and native video controls in canonical order; confirm the cover is not duplicated in the detail body.

Stop only the server from Step 2, then run:

```bash
git status --short
git log --oneline -4
```

Expected: clean status, the three Task 1-3 semantic commits, and no push.

## Execution Handoff

Execution mode is already selected: **Inline Execution** in this same Herdr worktree. After this plan is reviewed, invoke `superpowers:executing-plans`, run Tasks 1-4 in order, and stop at each test and commit gate before continuing.
