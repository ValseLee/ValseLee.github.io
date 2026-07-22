# Portfolio Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish canonical portfolio projects in homepage section 2 with optional dashboard-managed covers and statically exported detail pages, let authors append ordinary image/MP4 media through the accessible file input or dashboard-wide drag-and-drop, and add fixed media sizing plus optional native first-frame video posters.

**Architecture:** Keep the portfolio normalizer as the single contract boundary for covers, fixed media-size presets, and video-only poster paths. Keep authoring in the existing localhost dashboard, reuse `/api/portfolio/media` through one file-upload request helper, and use native `<video>` plus `<canvas>` only inside that dashboard. The shared server-rendered detail component consumes normalized sizes and poster paths without public client code.

**Tech Stack:** Next.js 16 App Router/static export, React 19 Server Components, strict TypeScript, Node.js built-ins and `node:test`, `next-mdx-remote`, CSS Modules.

## Global Constraints

- Work only in `/Users/celan/.herdr/worktrees/ValseLee.github.io/feature-portfolio-section`; execute inline with `superpowers:executing-plans`; do not create a worktree or child Codex.
- Preserve `output: "export"`; add no dependency, deployed write API, Client Component, or JavaScript hover handler.
- Reuse `content/portfolio.json`, `public/portfolio/`, `.portfolio-drafts/`, `scripts/article-dashboard.mjs`, and `/api/portfolio/media`.
- `coverImage` stays optional and separate from `media`; never infer it from the first media item.
- Covers accept only existing portfolio image extensions and require non-empty alt text; missing covers render black.
- Ordinary-media input and drop share one sequential helper; a failed file stops the batch after preserving prior successes, and drop never changes `coverImage` or dispatches a synthetic input event.
- Media sizes are exactly `mini`, `small`, `medium`, `large`, and `full`, mapped to 20%, 45%, 65%, 85%, and 100%; omitted raw sizes normalize to `full`.
- `posterSrc` is optional, image-only, and valid only on video media. Generate it with native browser APIs and the existing media endpoint; never remove a video or prior poster on failure.
- Do not delete orphaned cover files, reorder detail media, redesign the detail body, or add crop/focal-point behavior.
- Do not add arbitrary percentages, `ffmpeg`, a poster endpoint, a dependency, poster cleanup, or public client-side poster logic.
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

---

### Task 5: Add dashboard-wide ordinary-media drag-and-drop

**Files:**
- Modify: `scripts/article-dashboard.mjs:995-1393`
- Modify: `scripts/article-dashboard.test.mjs:395-630`

**Interfaces:**
- Consumes: the existing `/api/portfolio/media` response `{ ok: true, kind: "image" | "video", src: string } | { ok: false, error: string }`, `state.project.media`, `withAction(control, action)`, `renderMediaRows()`, and `schedulePreview()`.
- Produces: `uploadMediaFiles(files: File[]): Promise<void>`; `#media-area`; body-level `dragenter`, `dragover`, `dragleave`, and `drop` behavior that accepts native `File` objects, highlights only `#media-area`, and never reads or mutates `state.project.coverImage`.

- [ ] **Step 1: Extend the existing node:vm test with failing drag-and-drop behavior**

In the served-dashboard test, add `media-area` to the existing ID list and require the owned drop surface:

```js
for (const id of ["project-select", "new-project", "name", "period-start", "period-end", "period-present", "cover-input", "cover-preview", "cover-alt", "remove-cover", "description-markdown", "media-area", "media-input", "media-rows", "draft-select", "load-draft", "save-draft", "publish", "preview", "status", "command-log"]) {
  assert.match(html, new RegExp(`id=["']${id}["']`));
}
assert.match(html, /id="media-area" class="media-drop-area"/);
```

In `portfolio controls retain browser behavior`, replace the fake-element event boundary with this version so the existing test can pass exact native-like drag events and inspect the highlight class:

```js
const createElement = () => {
  const listeners = new Map();
  const classes = new Set();
  return {
    value: "",
    checked: false,
    disabled: false,
    required: false,
    min: "",
    files: [],
    children: [],
    style: {},
    classList: {
      add(...names) { names.forEach((name) => classes.add(name)); },
      remove(...names) { names.forEach((name) => classes.delete(name)); },
      contains(name) { return classes.has(name); },
    },
    addEventListener(type, listener) { listeners.set(type, listener); },
    dispatch(type, event = {}) {
      return listeners.get(type)?.({ preventDefault() {}, ...event });
    },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
  };
};
const body = createElement();
```

Add `media-area` to `selectors`, and expose that same `body` to the inline script:

```js
const selectors = ["portfolio-form", "project-select", "new-project", "name", "period-start", "period-end", "period-present", "cover-input", "cover-preview", "cover-alt", "remove-cover", "description-markdown", "media-area", "media-input", "media-rows", "draft-select", "load-draft", "save-draft", "publish", "preview", "status", "command-log"];

vm.runInNewContext(browserScript[1], {
  document: {
    body,
    querySelector: (selector) => elements.get(selector),
    createElement,
  },
  fetch: browserFetch,
  confirm: () => { confirmCalls += 1; return false; },
  structuredClone,
  clearTimeout() {},
  setTimeout(callback) { callback(); return 1; },
});
```

Inside `browserFetch`, insert `let responseOk = true;` immediately after `let result;`, replace only the `/api/portfolio/media` branch with the following branch, and replace the function's final response object with the shown return. Cover and ordinary-media requests then resolve deterministically by filename, including one server rejection:

```js
else if (url === "/api/portfolio/media") {
  const fileName = decodeURIComponent(options.headers["x-file-name"]);
  if (fileName === "rejected.mp4") {
    result = { ok: true, kind: "video", src: "/portfolio/rejected.mp4" };
  } else if (fileName === "new-cover.png") {
    result = { ok: true, kind: "image", src: "/portfolio/new-cover.png" };
  } else if (fileName === "bad.txt") {
    responseOk = false;
    result = { ok: false, error: "unsupported portfolio media file" };
  } else {
    const kind = fileName.endsWith(".mp4") ? "video" : "image";
    result = { ok: true, kind, src: `/portfolio/${fileName}` };
  }
}

return { ok: responseOk, status: responseOk ? 200 : 400, json: async () => result };
```

After the existing successful cover-draft assertions and before `removeCover.dispatch("click")`, add the lifecycle, ordering, partial-success, cover-isolation, and input-regression checks:

```js
const mediaArea = elements.get("#media-area");
const mediaInput = elements.get("#media-input");
const mediaRows = elements.get("#media-rows");
const mediaPaths = () => mediaRows.children.map((row) => row.children[1].textContent);
const dropped = {
  types: ["Files"],
  files: [
    { name: "drop-one.png", type: "image/png" },
    { name: "drop-two.mp4", type: "video/mp4" },
  ],
  dropEffect: "none",
};

body.dispatch("dragenter", { dataTransfer: dropped });
body.dispatch("dragenter", { dataTransfer: dropped });
assert.equal(mediaArea.classList.contains("drag-active"), true);
assert.equal(body.classList.contains("drag-active"), false);
assert.equal(coverPreview.classList.contains("drag-active"), false);
let overPrevented = false;
body.dispatch("dragover", {
  dataTransfer: dropped,
  preventDefault() { overPrevented = true; },
});
assert.deepEqual({ overPrevented, dropEffect: dropped.dropEffect }, { overPrevented: true, dropEffect: "copy" });
body.dispatch("dragleave", { dataTransfer: dropped });
assert.equal(mediaArea.classList.contains("drag-active"), true);
body.dispatch("dragleave", { dataTransfer: dropped });
assert.equal(mediaArea.classList.contains("drag-active"), false);
body.dispatch("dragenter", { dataTransfer: dropped });

let dropPrevented = false;
await body.dispatch("drop", {
  dataTransfer: dropped,
  target: coverPreview,
  preventDefault() { dropPrevented = true; },
});
assert.equal(dropPrevented, true);
assert.equal(mediaArea.classList.contains("drag-active"), false);
assert.deepEqual(mediaPaths(), [
  "/portfolio/demo.mp4",
  "/portfolio/drop-one.png",
  "/portfolio/drop-two.mp4",
]);
assert.equal(coverPreview.children[0].src, "/portfolio/new-cover.png");

const partial = {
  types: ["Files"],
  files: [
    { name: "kept.png", type: "image/png" },
    { name: "bad.txt", type: "text/plain" },
    { name: "skipped.mp4", type: "video/mp4" },
  ],
  dropEffect: "none",
};
body.dispatch("dragenter", { dataTransfer: partial });
await body.dispatch("drop", { dataTransfer: partial, preventDefault() {} });
assert.equal(mediaArea.classList.contains("drag-active"), false);
assert.deepEqual(mediaPaths().slice(-1), ["/portfolio/kept.png"]);
assert.match(elements.get("#status").textContent, /unsupported portfolio media file/);
const uploadedNames = requests
  .filter(({ url }) => url === "/api/portfolio/media")
  .map(({ options }) => decodeURIComponent(options.headers["x-file-name"]));
assert.deepEqual(uploadedNames.slice(-4), ["drop-one.png", "drop-two.mp4", "kept.png", "bad.txt"]);
assert.equal(uploadedNames.includes("skipped.mp4"), false);

mediaInput.files = [
  { name: "input.png", type: "image/png" },
  { name: "input.mp4", type: "video/mp4" },
];
await mediaInput.dispatch("change");
assert.equal(mediaInput.value, "");
assert.deepEqual(mediaPaths().slice(-2), ["/portfolio/input.png", "/portfolio/input.mp4"]);

elements.get("#save-draft").dispatch("click");
await settle();
const mediaDraft = JSON.parse(draftPosts().at(-1).options.body);
assert.deepEqual(mediaDraft.coverImage, { src: "/portfolio/new-cover.png", alt: "New cover" });
assert.deepEqual(mediaDraft.media.map(({ kind, src }) => ({ kind, src })), [
  { kind: "video", src: "/portfolio/demo.mp4" },
  { kind: "image", src: "/portfolio/drop-one.png" },
  { kind: "video", src: "/portfolio/drop-two.mp4" },
  { kind: "image", src: "/portfolio/kept.png" },
  { kind: "image", src: "/portfolio/input.png" },
  { kind: "video", src: "/portfolio/input.mp4" },
]);
```

The exact upload-name assertions prove one sequential request per dropped file, no synthetic input redispatch, drop order, stop-on-first-failure, and continued file-input behavior. Leave every existing `preview.children[2]` period assertion unchanged.

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
node --test --test-name-pattern='portfolio mode serves|portfolio controls retain' scripts/article-dashboard.test.mjs
```

Expected: FAIL because `#media-area`, its drag-active styling, the shared upload helper, and the body drag listeners do not exist.

- [ ] **Step 3: Add the owned media area and shared sequential helper**

Wrap only the existing ordinary-media input and rows; keep the labelled multiple-file input as the keyboard and assistive-technology fallback:

```html
<div id="media-area" class="media-drop-area">
  <div class="field"><label for="media-input">Images or MP4 files</label><input id="media-input" type="file" multiple accept="image/*,video/mp4" /></div>
  <ol id="media-rows"></ol>
</div>
```

Add the highlight style beside the existing media styles. Do not animate it:

```css
.media-drop-area { border:1px solid transparent; border-radius:16px; margin:0 -12px 16px; padding:12px; }
.media-drop-area.drag-active { border-color:var(--foreground); background:rgba(255,255,255,.06); }
```

Query the new owner beside `mediaInput` and `mediaRows`:

```js
const mediaArea = document.querySelector("#media-area");
```

Replace the current `mediaInput` upload loop with one helper plus a clearing file-input adapter:

```js
async function uploadMediaFiles(files) {
  for (const file of files) {
    const response = await fetch("/api/portfolio/media", {
      method:"POST",
      headers:{ "content-type":file.type, "x-file-name":encodeURIComponent(file.name) },
      body:file,
    });
    const stored = await response.json();
    if (!response.ok) throw new Error(stored.error || "Upload failed");
    state.project.media.push(stored.kind === "image"
      ? { kind:"image", src:stored.src, caption:"", alt:"" }
      : { kind:"video", src:stored.src, caption:"" });
    state.dirty = true;
    renderMediaRows();
    schedulePreview();
  }
  setStatus("Media uploaded", "ok");
}

mediaInput.addEventListener("change", () => withAction(mediaInput, async () => {
  const files = Array.from(mediaInput.files);
  try { await uploadMediaFiles(files); }
  finally { mediaInput.value = ""; }
}));
```

The helper appends each success immediately and awaits before starting the next file, so a thrown server error naturally preserves prior rows and prevents later requests.

- [ ] **Step 4: Add body-level native file-drag lifecycle**

Add this beside the media input listener. It adds a class only to `#media-area`, copies `File` objects into an array before uploading, and never calls the cover handler:

```js
const hasDraggedFiles = (event) => Array.from(event.dataTransfer?.types || []).includes("Files");
let mediaDragDepth = 0;

function resetMediaDrag() {
  mediaDragDepth = 0;
  mediaArea.classList.remove("drag-active");
}

document.body.addEventListener("dragenter", (event) => {
  if (!hasDraggedFiles(event)) return;
  event.preventDefault();
  mediaDragDepth += 1;
  mediaArea.classList.add("drag-active");
});

document.body.addEventListener("dragover", (event) => {
  if (!hasDraggedFiles(event)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
  mediaArea.classList.add("drag-active");
});

document.body.addEventListener("dragleave", (event) => {
  if (!hasDraggedFiles(event)) return;
  mediaDragDepth = Math.max(0, mediaDragDepth - 1);
  if (mediaDragDepth === 0) mediaArea.classList.remove("drag-active");
});

document.body.addEventListener("drop", (event) => {
  const isFileDrop = hasDraggedFiles(event);
  const files = isFileDrop ? Array.from(event.dataTransfer.files) : [];
  resetMediaDrag();
  if (!isFileDrop) return;
  event.preventDefault();
  return withAction(mediaInput, () => uploadMediaFiles(files));
});
```

- [ ] **Step 5: Run focused and repository GREEN checks**

Run:

```bash
node --test --test-name-pattern='portfolio mode serves|portfolio controls retain' scripts/article-dashboard.test.mjs
npm run test:article-dashboard
npm test
npm run verify:content
npm run lint
npm run build
git diff --check
```

Expected: all PASS; `npm test` retains the full repository test count, `verify:content` reports one portfolio project, and the build still statically exports `/portfolio/loutine` without `out/drafts`.

- [ ] **Step 6: Capture fresh browser proof on an isolated temporary dashboard root**

From the repository root, create a disposable authoring root and start the real portfolio server on a fresh port so proof uploads cannot dirty tracked or untracked workspace paths:

```bash
portfolio_proof_root=$(mktemp -d)
mkdir -p "$portfolio_proof_root/content" "$portfolio_proof_root/public/portfolio"
cp content/portfolio.json "$portfolio_proof_root/content/portfolio.json"
(
  cd "$portfolio_proof_root"
  PORTFOLIO_DASHBOARD_PORT=4321 node /Users/celan/.herdr/worktrees/ValseLee.github.io/feature-portfolio-section/scripts/article-dashboard.mjs portfolio
)
```

Open `http://127.0.0.1:4321` in a fresh browser surface. If `DataTransfer`, `File`, and `DragEvent` are available, evaluate this setup and record the active class plus computed border/background:

```js
const mediaArea = document.querySelector("#media-area");
const coverBefore = document.querySelector("#cover-preview img")?.getAttribute("src") ?? null;
const transfer = new DataTransfer();
transfer.items.add(new File([new Uint8Array([137, 80, 78, 71])], "drop-proof.png", { type:"image/png" }));
transfer.items.add(new File([new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112])], "drop-proof.mp4", { type:"video/mp4" }));
document.body.dispatchEvent(new DragEvent("dragenter", { bubbles:true, cancelable:true, dataTransfer:transfer }));
({
  active: mediaArea.classList.contains("drag-active"),
  borderColor: getComputedStyle(mediaArea).borderColor,
  backgroundColor: getComputedStyle(mediaArea).backgroundColor,
});
```

Expected before drop: `active` is `true`, the media-area border is visible, and the cover/preview/page shell have no `drag-active` class. Then dispatch the real drop and wait for sequential requests:

```js
document.body.dispatchEvent(new DragEvent("drop", { bubbles:true, cancelable:true, dataTransfer:transfer }));
await new Promise((resolve) => setTimeout(resolve, 300));
({
  active: mediaArea.classList.contains("drag-active"),
  rows: [...document.querySelectorAll("#media-rows .media-path")].slice(-2).map((node) => node.textContent),
  coverUnchanged: (document.querySelector("#cover-preview img")?.getAttribute("src") ?? null) === coverBefore,
});
```

Expected after drop: `active` is `false`, rows end with `[/portfolio/drop-proof.png, /portfolio/drop-proof.mp4]` in that order, and `coverUnchanged` is `true`.

If the browser surface lacks any of those constructors, record the missing constructor, rerun the exact node:vm event proof, and prove the CSS state directly in the browser:

```bash
node --test --test-name-pattern='portfolio controls retain browser behavior' scripts/article-dashboard.test.mjs
```

```js
const mediaArea = document.querySelector("#media-area");
mediaArea.classList.add("drag-active");
const computed = getComputedStyle(mediaArea);
const proof = { borderColor: computed.borderColor, backgroundColor: computed.backgroundColor };
mediaArea.classList.remove("drag-active");
proof;
```

Stop only the port-4321 server. Validate and remove only the disposable root created above:

```bash
case "$portfolio_proof_root" in
  /tmp/*|/private/tmp/*|/var/folders/*) rm -rf -- "$portfolio_proof_root" ;;
  *) echo "refusing unexpected proof root: $portfolio_proof_root"; exit 1 ;;
esac
```

- [ ] **Step 7: Commit only the dashboard behavior and its regression**

```bash
git add scripts/article-dashboard.mjs scripts/article-dashboard.test.mjs
git diff --cached --check
git diff --cached --stat
git diff --cached --name-only
git commit -m "✨ feat: add portfolio media drag and drop"
git status --short
```

Expected: the staged and committed paths are exactly the dashboard script and its existing test; final status is clean and nothing is pushed.

---

### Task 6: Add the canonical media-size/poster contract and public rendering

**Files:**
- Modify: `lib/portfolio.mjs:3-120`
- Modify: `lib/portfolio.d.mts:1-22`
- Modify: `scripts/article-dashboard.mjs:7-16,95-115`
- Modify: `scripts/article-dashboard.test.mjs:35-102,168-285`
- Modify: `components/PortfolioProjectArticle.tsx:1-27`

**Interfaces:**
- Consumes: the existing `normalizePortfolioSrc()` image/video allowlists, normalized draft/canonical reads, `publishPortfolioProject()` explicit path safeguards, and the shared `PortfolioProjectArticle` Server Component.
- Produces: `PortfolioMediaSize = "mini" | "small" | "medium" | "large" | "full"`; `PORTFOLIO_MEDIA_WIDTHS = { mini:"20%", small:"45%", medium:"65%", large:"85%", full:"100%" }`; required normalized `media.size`; optional video-only `posterSrc`; deduplicated poster publish paths; centered public figures and native video `poster` attributes.

- [ ] **Step 1: Add failing normalizer, draft, and publish-path tests**

In `normalizePortfolioProject preserves ordered image and video media`, leave the image `size` omitted to prove the legacy default and give the video an explicit size/poster:

```js
media: [
  { kind: "image", src: "/portfolio/home.png", caption: " Home ", alt: " Home screen " },
  { kind: "video", src: "/portfolio/demo.mp4", caption: " Demo ", size: "mini", posterSrc: "/portfolio/demo-poster.jpg", alt: "discard me" },
],
```

Expect the normalized media exactly:

```js
media: [
  { kind: "image", src: "/portfolio/home.png", caption: "Home", alt: "Home screen", size: "full" },
  { kind: "video", src: "/portfolio/demo.mp4", caption: "Demo", size: "mini", posterSrc: "/portfolio/demo-poster.jpg" },
],
```

Add one focused contract test after the existing cover test:

```js
test("normalizePortfolioProject validates media sizes and video posters", () => {
  const valid = portfolioProject();
  const sizes = ["mini", "small", "medium", "large", "full"];
  const normalized = normalizePortfolioProject({
    ...valid,
    media: sizes.map((size) => ({
      kind: "image", src: "/portfolio/home.png", caption: size, alt: size, size,
    })),
  });
  assert.deepEqual(normalized.media.map(({ size }) => size), sizes);

  for (const size of ["", "50%", "wide", 65, null]) {
    assert.throws(() => normalizePortfolioProject({
      ...valid,
      media: [{ kind: "image", src: "/portfolio/home.png", caption: "Home", alt: "Home", size }],
    }), /media\[0\]\.size/i);
  }

  for (const media of [
    { kind: "image", src: "/portfolio/home.png", caption: "Home", alt: "Home", posterSrc: "/portfolio/poster.jpg" },
    { kind: "video", src: "/portfolio/demo.mp4", caption: "Demo", posterSrc: "" },
    { kind: "video", src: "/portfolio/demo.mp4", caption: "Demo", posterSrc: "/portfolio/poster.mp4" },
    { kind: "video", src: "/portfolio/demo.mp4", caption: "Demo", posterSrc: "/portfolio/../poster.jpg" },
  ]) assert.throws(() => normalizePortfolioProject({ ...valid, media: [media] }), /media\[0\]\.posterSrc/i);
});
```

Change the draft round-trip fixture's video to:

```js
media: [{
  kind: "video",
  src: "/portfolio/demo.mp4",
  caption: "Demo",
  size: "large",
  posterSrc: "/portfolio/demo-poster.jpg",
}],
```

In `publishPortfolioProject updates by slug...`, create `demo-poster.jpg`, use that same video shape, and update every preflight/add/commit path list to this exact order:

```js
[
  "content/portfolio.json",
  "public/portfolio/cover.png",
  "public/portfolio/demo.mp4",
  "public/portfolio/demo-poster.jpg",
]
```

- [ ] **Step 2: Run the focused model tests and confirm RED**

Run:

```bash
node --test --test-name-pattern='normalizePortfolioProject|portfolio drafts|publishPortfolioProject updates' scripts/article-dashboard.test.mjs
```

Expected: FAIL because normalized media have no `size`/`posterSrc`, invalid values are accepted or discarded, draft equality loses the new fields, and publish does not include the poster path.

- [ ] **Step 3: Run the public legacy-size probe and confirm RED**

Run the unchanged production build, then inspect the existing canonical Loutine detail output (its raw media omit `size`):

```bash
npm run build
node -e 'const fs=require("node:fs"); const file=["out/portfolio/loutine.html","out/portfolio/loutine/index.html"].find(fs.existsSync); if(!file) throw new Error("missing static portfolio route"); const html=fs.readFileSync(file,"utf8"); if(!/<figure[^>]*style="[^"]*width:100%/.test(html)) throw new Error("legacy media is not rendered at centered full width")'
```

Expected: build PASS, then probe FAIL with `legacy media is not rendered at centered full width` because the shared detail renderer has no normalized width style yet.

- [ ] **Step 4: Implement the fixed normalized contract**

Add beside the extension sets in `lib/portfolio.mjs`:

```js
export const PORTFOLIO_MEDIA_WIDTHS = Object.freeze({
  mini: "20%",
  small: "45%",
  medium: "65%",
  large: "85%",
  full: "100%",
});
const PORTFOLIO_MEDIA_SIZES = new Set(Object.keys(PORTFOLIO_MEDIA_WIDTHS));

function normalizePortfolioMediaSize(value, index) {
  if (value === undefined) return "full";
  if (typeof value !== "string" || !PORTFOLIO_MEDIA_SIZES.has(value)) {
    throw new Error(`media[${index}].size is invalid`);
  }
  return value;
}

function normalizePortfolioPosterSrc(value, index) {
  const posterSrc = normalizePortfolioSrc(value, `media[${index}].posterSrc`);
  const extension = path.extname(decodeURIComponent(posterSrc)).toLowerCase();
  if (!PORTFOLIO_IMAGE_EXTENSIONS.has(extension)) {
    throw new Error(`media[${index}].posterSrc must be an image`);
  }
  return posterSrc;
}
```

Inside the existing media map, compute `size` after `src`/`caption`, then replace only the two successful return branches:

```js
const size = normalizePortfolioMediaSize(item.size, index);
if (item.kind === "image" && PORTFOLIO_IMAGE_EXTENSIONS.has(extension)) {
  if (Object.hasOwn(item, "posterSrc")) throw new Error(`media[${index}].posterSrc is only valid for video`);
  return { kind: "image", src, caption, alt: requiredPortfolioText(item.alt, `media[${index}].alt`), size };
}
if (item.kind === "video" && PORTFOLIO_VIDEO_EXTENSIONS.has(extension)) {
  const posterSrc = Object.hasOwn(item, "posterSrc")
    ? normalizePortfolioPosterSrc(item.posterSrc, index)
    : undefined;
  return { kind: "video", src, caption, size, ...(posterSrc ? { posterSrc } : {}) };
}
```

Update `lib/portfolio.d.mts` without introducing a raw-content type:

```ts
export type PortfolioMediaSize = "mini" | "small" | "medium" | "large" | "full";
export const PORTFOLIO_MEDIA_WIDTHS: Readonly<Record<PortfolioMediaSize, `${number}%`>>;
export type PortfolioMedia =
  | { kind: "image"; src: string; caption: string; alt: string; size: PortfolioMediaSize }
  | { kind: "video"; src: string; caption: string; size: PortfolioMediaSize; posterSrc?: string };
```

- [ ] **Step 5: Include posters in the existing explicit publish path set**

Replace only `mediaSources` in `publishPortfolioProject()`:

```js
const mediaSources = [
  project.coverImage?.src,
  ...project.media.flatMap((media) => [
    media.src,
    media.kind === "video" ? media.posterSrc : undefined,
  ]),
].filter(Boolean);
```

Leave the following `Set` deduplication, staged-overlap preflight, build rollback, `git commit --only`, and push behavior unchanged.

- [ ] **Step 6: Apply normalized width and poster values in the shared Server Component**

Import the shared mapping as a value and keep the type-only project import:

```tsx
import { PORTFOLIO_MEDIA_WIDTHS } from "@/lib/portfolio.mjs";
import type { PortfolioProject } from "@/lib/portfolio.mjs";
```

Change only the existing media figure:

```tsx
<figure
  key={`${media.src}-${index}`}
  style={{ width: PORTFOLIO_MEDIA_WIDTHS[media.size], marginInline: "auto" }}
>
  {media.kind === "image" ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="w-full" src={media.src} alt={media.alt} />
  ) : (
    <video className="w-full" src={media.src} poster={media.posterSrc} controls preload="metadata" />
  )}
  <figcaption className="text-subtext text-sm mt-2">{media.caption}</figcaption>
</figure>
```

Do not add a Client Component, effect, poster extraction, or a public percentage parser.

- [ ] **Step 7: Run GREEN checks and commit Task 6**

```bash
node --test --test-name-pattern='normalizePortfolioProject|portfolio drafts|publishPortfolioProject updates' scripts/article-dashboard.test.mjs
npm test
npm run verify:content
npm run lint
npm run build
node -e 'const fs=require("node:fs"); const file=["out/portfolio/loutine.html","out/portfolio/loutine/index.html"].find(fs.existsSync); if(!file) throw new Error("missing static portfolio route"); const html=fs.readFileSync(file,"utf8"); if(!/<figure[^>]*style="[^"]*width:100%/.test(html)) throw new Error("legacy media is not rendered at centered full width")'
git diff --check
git add lib/portfolio.mjs lib/portfolio.d.mts scripts/article-dashboard.mjs scripts/article-dashboard.test.mjs components/PortfolioProjectArticle.tsx
git diff --cached --check
git diff --cached --name-only
git commit -m "✨ feat: add portfolio media display contract"
```

Expected: all PASS; `verify:content` accepts the legacy size omissions as normalized `full`; the static detail HTML includes `width:100%`; the commit contains exactly the five listed files.

---

### Task 7: Add dashboard Size controls and native first-frame video posters

**Files:**
- Modify: `scripts/article-dashboard.mjs:7-16,995-1450`
- Modify: `scripts/article-dashboard.test.mjs:395-705`

**Interfaces:**
- Consumes: `PORTFOLIO_MEDIA_WIDTHS`, the existing `/api/portfolio/media` request/response boundary, `uploadMediaFiles(files)`, `mediaElement(item)`, `renderMediaRows()`, `renderPreview()`, and the existing `node:vm` fake DOM/fetch test.
- Produces: one labelled native Size select per media row; centered 20/45/65/85/100 row/preview widths; `generateVideoPoster(item): Promise<void>` shared by automatic new-video and manual existing-video actions; a first poster-warning retained across the rest of a successful upload batch.

- [ ] **Step 1: Extend the existing node:vm fake browser with failing size and media primitives**

Keep `preview.children[2]` for every period assertion and keep media paths at `row.children[1]`. Extend `createElement(tagName = "div")` rather than adding a second harness:

```js
let posterMode = "success";
const drawnFrames = [];
const createElement = (tagName = "div") => {
  const listeners = new Map();
  const classes = new Set();
  const element = {
    tagName: tagName.toUpperCase(),
    value: "", checked: false, disabled: false, required: false, min: "", files: [],
    children: [], style: {},
    classList: {
      add(...names) { names.forEach((name) => classes.add(name)); },
      remove(...names) { names.forEach((name) => classes.delete(name)); },
      contains(name) { return classes.has(name); },
    },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); },
    dispatch(type, event = {}) { return listeners.get(type)?.({ preventDefault() {}, ...event }); },
    listenerCount() { return listeners.size; },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
  };
  if (tagName === "video") {
    element.videoWidth = 1280;
    element.videoHeight = 720;
    element.load = () => queueMicrotask(() => element.dispatch(
      posterMode === "decode" || element.src.includes("/warning-") ? "error" : "loadeddata",
    ));
  }
  if (tagName === "canvas") {
    element.getContext = () => {
      if (posterMode === "canvas") throw new Error("canvas failed");
      return { drawImage(video, x, y, width, height) { drawnFrames.push({ video, x, y, width, height }); } };
    };
    element.toBlob = (callback, type) => callback(posterMode === "null-blob" ? null : { type });
  }
  return element;
};

class FakeFile {
  constructor(parts, name, options) { this.parts = parts; this.name = name; this.type = options.type; }
}
```

Pass `File: FakeFile` into `vm.runInNewContext`. In the media fetch branch, make poster behavior deterministic without changing ordinary upload behavior:

```js
else if (fileName.endsWith("-poster.jpg")) {
  if (posterMode === "upload") {
    responseOk = false;
    result = { ok: false, error: "poster upload failed" };
  } else if (posterMode === "malformed") {
    result = { ok: true, kind: "video", src: "/portfolio/not-an-image.mp4" };
  } else {
    result = { ok: true, kind: "image", src: `/portfolio/${fileName}` };
  }
}
```

Give the initial existing video a non-default size and prior poster:

```js
media: [{
  kind: "video",
  src: "/portfolio/demo.mp4",
  caption: "Demo",
  size: "small",
  posterSrc: "/portfolio/old-poster.jpg",
}],
```

- [ ] **Step 2: Add failing Size-control and existing-video poster assertions**

After the initial field assertions, add stable row helpers:

```js
const mediaRows = elements.get("#media-rows");
const mediaPaths = () => mediaRows.children.map((row) => row.children[1].textContent);
const sizeControl = (row) => row.children.find(({ className }) => className === "media-size-field").children[0];
const thumbnailButton = (row) => row.children.at(-1).children.find(({ textContent }) => textContent === "Generate Thumbnail");

assert.equal(mediaRows.children[0].style.width, "45%");
assert.equal(mediaRows.children[0].style.marginInline, "auto");
assert.equal(mediaRows.children[0].children[0].poster, "/portfolio/old-poster.jpg");
assert.deepEqual(sizeControl(mediaRows.children[0]).children.map(({ value }) => value), ["mini", "small", "medium", "large", "full"]);

sizeControl(mediaRows.children[0]).value = "medium";
sizeControl(mediaRows.children[0]).dispatch("change");
assert.equal(mediaRows.children[0].style.width, "65%");
assert.equal(preview.children[4].style.width, "65%");
assert.equal(preview.children[4].style.marginInline, "auto");
```

Delete the later duplicate `const mediaRows` and `const mediaPaths` declarations from the existing drag-and-drop block and reuse these helpers there; `mediaPaths()` must continue reading `row.children[1]`.

Click the existing video's action and prove intrinsic canvas sizing, JPEG upload, assignment, and listener cleanup:

```js
await thumbnailButton(mediaRows.children[0]).dispatch("click");
const drawnFrame = drawnFrames.at(-1);
assert.deepEqual(
  { x: drawnFrame.x, y: drawnFrame.y, width: drawnFrame.width, height: drawnFrame.height },
  { x: 0, y: 0, width: 1280, height: 720 },
);
assert.equal(drawnFrame.video.listenerCount(), 0);
const posterRequest = requests.filter(({ url, options }) =>
  url === "/api/portfolio/media" && decodeURIComponent(options.headers["x-file-name"]) === "demo-poster.jpg").at(-1);
assert.equal(posterRequest.options.headers["content-type"], "image/jpeg");
assert.equal(mediaRows.children[0].children[0].poster, "/portfolio/demo-poster.jpg");
```

Then exercise each manual failure through the same button and prove the successful poster is never replaced:

```js
for (const mode of ["decode", "canvas", "null-blob", "upload", "malformed"]) {
  posterMode = mode;
  await thumbnailButton(mediaRows.children[0]).dispatch("click");
  assert.equal(mediaRows.children[0].children[0].poster, "/portfolio/demo-poster.jpg");
  assert.match(elements.get("#status").textContent, /thumbnail|poster|canvas/i);
}
posterMode = "success";
```

- [ ] **Step 3: Add failing automatic-poster, first-warning, input-regression, and cover-isolation assertions**

Retain the existing Task 5 drag/drop assertions, but filter poster requests out of its ordinary upload-order checks because successful videos now add an interleaved poster request:

```js
const uploadedNames = () => requests
  .filter(({ url }) => url === "/api/portfolio/media")
  .map(({ options }) => decodeURIComponent(options.headers["x-file-name"]));
const ordinaryUploadedNames = () => uploadedNames().filter((name) => !name.endsWith("-poster.jpg"));
```

Use `ordinaryUploadedNames()` for the existing `drop-one/drop-two/kept/bad`, skipped-file, and file-input order assertions. Keep `mediaPaths()` unchanged so it still proves that generated posters do not become ordinary rows. After the existing file-input regression, add two automatic failures around later successful files so the retained warning is provably the first one:

```js
const warningBatch = {
  types: ["Files"],
  files: [
    { name: "warning-first.mp4", type: "video/mp4" },
    { name: "after-warning.png", type: "image/png" },
    { name: "warning-second.mp4", type: "video/mp4" },
    { name: "later.mp4", type: "video/mp4" },
  ],
  dropEffect: "none",
};
body.dispatch("dragenter", { dataTransfer: warningBatch });
await body.dispatch("drop", { dataTransfer: warningBatch, preventDefault() {} });
assert.deepEqual(mediaPaths().slice(-4), [
  "/portfolio/warning-first.mp4",
  "/portfolio/after-warning.png",
  "/portfolio/warning-second.mp4",
  "/portfolio/later.mp4",
]);
assert.match(elements.get("#status").textContent, /warning.*warning-first\.mp4/i);
assert.doesNotMatch(elements.get("#status").textContent, /warning-second\.mp4/i);
assert.equal(uploadedNames().includes("warning-first-poster.jpg"), false);
assert.equal(uploadedNames().includes("warning-second-poster.jpg"), false);
assert.equal(requests.some(({ url, options }) =>
  url === "/api/portfolio/media" && decodeURIComponent(options.headers["x-file-name"]) === "later-poster.jpg"), true);
assert.equal(coverPreview.children[0].src, "/portfolio/new-cover.png");
```

Because `uploadedNames()` reads `requests` on every call, later automatic poster requests cannot make the Task 5 order assertions stale. In the final saved-draft assertion, require every media item to have `size`, require the changed existing video to keep `size: "medium"` and its poster, require new media to default to `full`, and confirm `coverImage` is unchanged. Do not change any `preview.children[2]` period assertion.

- [ ] **Step 4: Run the focused test and confirm RED**

```bash
node --test --test-name-pattern='portfolio controls retain browser behavior' scripts/article-dashboard.test.mjs
```

Expected: FAIL first because media rows have no `.media-size-field`, no width style, and no `Generate Thumbnail` action. The fake video/canvas assertions must not be weakened to make the pre-implementation script pass.

- [ ] **Step 5: Reuse one upload request boundary and render fixed sizes/posters**

Import `PORTFOLIO_MEDIA_WIDTHS` into `scripts/article-dashboard.mjs`, then serialize it once into the existing inline script:

```js
const mediaWidths = ${JSON.stringify(PORTFOLIO_MEDIA_WIDTHS)};
const mediaSizes = Object.keys(mediaWidths);
```

Extract only the repeated existing POST into a local helper and call it from cover upload, ordinary upload, and poster upload:

```js
async function uploadPortfolioFile(file, failureMessage = "Upload failed") {
  const response = await fetch("/api/portfolio/media", {
    method:"POST",
    headers:{ "content-type":file.type, "x-file-name":encodeURIComponent(file.name) },
    body:file,
  });
  const stored = await response.json();
  if (!response.ok) throw new Error(stored.error || failureMessage);
  return stored;
}
```

Keep cover's existing image-response check after this helper returns. In `mediaElement()` set only validated video posters:

```js
else {
  element.controls = true;
  element.preload = "metadata";
  if (item.posterSrc) element.poster = item.posterSrc;
}
```

Add the fixed-width application and use it on each row and preview figure:

```js
function applyMediaSize(element, size) {
  element.style.width = mediaWidths[size];
  element.style.marginInline = "auto";
}
```

Every newly appended ordinary item must include `size:"full"` while cover state remains separate.

- [ ] **Step 6: Add native Size selects and one shared poster-generation lifecycle**

In `renderMediaRows()`, call `applyMediaSize(row, item.size)`. After caption/alt controls and before actions, append one wrapping native label:

```js
const sizeLabel = document.createElement("label");
sizeLabel.className = "media-size-field";
sizeLabel.textContent = "Size for " + item.src;
const sizeSelect = document.createElement("select");
for (const size of mediaSizes) {
  const option = document.createElement("option");
  option.value = size;
  option.textContent = size;
  sizeSelect.append(option);
}
sizeSelect.value = item.size;
sizeSelect.addEventListener("change", () => {
  item.size = sizeSelect.value;
  applyMediaSize(row, item.size);
  markDirty();
});
sizeLabel.append(sizeSelect);
row.append(sizeLabel);
```

Add these local functions beside `mediaElement()`; no element is attached to the document:

```js
function loadVideoFrame(src) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const cleanup = () => {
      video.removeEventListener("loadeddata", loaded);
      video.removeEventListener("error", failed);
      video.removeEventListener("abort", failed);
    };
    const loaded = () => { cleanup(); resolve(video); };
    const failed = () => { cleanup(); reject(new Error("Thumbnail video decode failed for " + src)); };
    video.addEventListener("loadeddata", loaded);
    video.addEventListener("error", failed);
    video.addEventListener("abort", failed);
    video.preload = "auto";
    video.currentTime = 0;
    video.src = src;
    video.load();
  });
}

function canvasJpeg(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("Thumbnail canvas returned no image")),
    "image/jpeg",
  ));
}

function posterFileName(src) {
  const fileName = decodeURIComponent(src.split("/").at(-1));
  return fileName.replace(/\.[^.]+$/, "") + "-poster.jpg";
}

async function generateVideoPoster(item) {
  const video = await loadVideoFrame(item.src);
  if (!(video.videoWidth > 0 && video.videoHeight > 0)) throw new Error("Thumbnail video has no decoded frame");
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Thumbnail canvas is unavailable");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await canvasJpeg(canvas);
  const file = new File([blob], posterFileName(item.src), { type:"image/jpeg" });
  const stored = await uploadPortfolioFile(file, "Thumbnail upload failed");
  if (stored.kind !== "image" || typeof stored.src !== "string") throw new Error("Thumbnail upload must return an image");
  item.posterSrc = stored.src;
  state.dirty = true;
  renderMediaRows();
  schedulePreview();
}
```

For each video row, append one button to the existing actions before Move Up:

```js
if (item.kind === "video") {
  const generateButton = mediaButton("Generate Thumbnail", () => withAction(generateButton, async () => {
    await generateVideoPoster(item);
    setStatus("Thumbnail generated", "ok");
  }), false);
  actions.append(generateButton);
}
```

The old poster is assigned only after the complete successful path; all thrown decode/canvas/blob/upload/response errors therefore preserve it. In `renderPreview()`, call `applyMediaSize(figure, item.size)` before appending the figure.

- [ ] **Step 7: Preserve the first automatic poster warning while continuing the batch**

Keep ordinary upload failures throwing so Task 5's stop-on-first-failed-file behavior remains. Change only the successful append path and final status in `uploadMediaFiles()`:

```js
async function uploadMediaFiles(files) {
  let firstPosterWarning = "";
  for (const file of files) {
    const stored = await uploadPortfolioFile(file);
    const item = stored.kind === "image"
      ? { kind:"image", src:stored.src, caption:"", alt:"", size:"full" }
      : { kind:"video", src:stored.src, caption:"", size:"full" };
    state.project.media.push(item);
    state.dirty = true;
    renderMediaRows();
    schedulePreview();
    if (item.kind === "video") {
      try { await generateVideoPoster(item); }
      catch (error) { if (!firstPosterWarning) firstPosterWarning = error.message; }
    }
  }
  setStatus(
    firstPosterWarning ? "Media uploaded; thumbnail warning: " + firstPosterWarning : "Media uploaded",
    firstPosterWarning ? "error" : "ok",
  );
}
```

Do not roll back a stored video, stop later files for a poster failure, add the poster as an ordinary media row, or touch `coverImage`.

- [ ] **Step 8: Run focused and repository GREEN checks**

```bash
node --test --test-name-pattern='portfolio controls retain browser behavior' scripts/article-dashboard.test.mjs
npm run test:article-dashboard
npm test
npm run verify:content
npm run lint
npm run build
git diff --check
```

Expected: all PASS; the focused fake-browser test proves all five preset values/widths, manual success and failure preservation, automatic generation, first-warning retention with later-file continuation, ordinary upload ordering, file-input regression, unchanged cover state, JPEG filename/type, intrinsic canvas dimensions, and listener cleanup.

- [ ] **Step 9: Capture fresh browser and fallback proof**

Start a fresh portfolio dashboard against a disposable root on port 4322, copying only canonical content and one existing image/video needed for real media decoding:

```bash
portfolio_media_proof_root=$(mktemp -d)
mkdir -p "$portfolio_media_proof_root/content" "$portfolio_media_proof_root/public/portfolio"
cp content/portfolio.json "$portfolio_media_proof_root/content/portfolio.json"
proof_image=$(node -e 'const p=require("./content/portfolio.json").projects[0].media.find(({kind})=>kind==="image"); process.stdout.write(p.src)')
proof_video=$(node -e 'const p=require("./content/portfolio.json").projects[0].media.find(({kind})=>kind==="video"); process.stdout.write(p.src)')
cp "public$proof_image" "$portfolio_media_proof_root/public/portfolio/"
cp "public$proof_video" "$portfolio_media_proof_root/public/portfolio/"
(
  cd "$portfolio_media_proof_root"
  PORTFOLIO_DASHBOARD_PORT=4322 node /Users/celan/.herdr/worktrees/ValseLee.github.io/feature-portfolio-section/scripts/article-dashboard.mjs portfolio
)
```

Open `http://127.0.0.1:4322` in a fresh browser. Change the first row Size through all five values and record row/preview computed widths of exactly 20%, 45%, 65%, 85%, and 100% of their media columns with centered left/right margins. Click the first existing video's `Generate Thumbnail`; when native decoding succeeds, record that:

- the row and preview video `poster` attributes point to the new `/portfolio/*-poster.jpg`;
- the media row count and order are unchanged;
- the cover path is unchanged;
- the status reports thumbnail success.

When `DataTransfer`, `File`, and `DragEvent` are available, fetch `proof_video` from the same dashboard origin, wrap its blob in a new MP4 `File`, and dispatch a body `drop`. Record that a new video row appears before its poster request completes, its final size is `full`, and its poster appears without a separate image row. If the browser cannot construct the drop or decode the MP4/canvas, record the exact unavailable API/decoder error and rerun the deterministic fallback:

```bash
node --test --test-name-pattern='portfolio controls retain browser behavior' scripts/article-dashboard.test.mjs
```

For the shared public renderer, first refuse to overwrite an existing proof draft, then start a fresh current-worktree dashboard on port 4324:

```bash
test ! -e .portfolio-drafts/portfolio-media-proof.json
PORTFOLIO_DASHBOARD_PORT=4324 npm run portfolio
```

In another terminal, use that dashboard's existing draft API to save a development-only proof project containing all five sizes and a video poster; this writes only `.portfolio-drafts/portfolio-media-proof.json`:

```bash
node -e 'const fs=require("node:fs"); const source=JSON.parse(fs.readFileSync("content/portfolio.json","utf8")).projects[0]; const image=source.media.find(({kind})=>kind==="image"); const video=source.media.find(({kind})=>kind==="video"); const sizes=["mini","small","medium","large","full"]; const media=sizes.map((size,index)=>index===0?{...image,size}:{...video,size,posterSrc:image.src}); const project={...source,slug:"portfolio-media-proof",name:"Portfolio media proof",media}; fetch("http://127.0.0.1:4324/api/portfolio/draft",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(project)}).then(async response=>{const result=await response.json(); if(!response.ok) throw new Error(result.error); console.log(result.project.slug)})'
npm run dev -- --hostname 127.0.0.1 --port 4323
```

Open the fresh Next server and inspect `/drafts/portfolio/portfolio-media-proof` plus `/portfolio/loutine`:

- the draft route's five figures compute to 20%, 45%, 65%, 85%, and 100%, centered;
- its video has the exact poster attribute;
- the canonical public route's legacy omitted sizes compute to centered 100%;
- neither page markup nor loaded script text contains the dashboard-only `toBlob("image/jpeg")` poster extractor.

If the development-only draft route cannot be opened in the browser surface, retain the successful static-output probe from Task 6 and the exact `node:vm` renderer inputs as the fallback, and report that limitation explicitly.

Stop only ports 4322, 4323, and 4324. Remove only `.portfolio-drafts/portfolio-media-proof.json` and the validated disposable root:

```bash
rm -f -- .portfolio-drafts/portfolio-media-proof.json
case "$portfolio_media_proof_root" in
  /tmp/*|/private/tmp/*|/var/folders/*) rm -rf -- "$portfolio_media_proof_root" ;;
  *) echo "refusing unexpected proof root: $portfolio_media_proof_root"; exit 1 ;;
esac
```

- [ ] **Step 10: Commit only dashboard production/test changes and verify final state**

```bash
git add scripts/article-dashboard.mjs scripts/article-dashboard.test.mjs
git diff --cached --check
git diff --cached --name-only
git commit -m "✨ feat: add portfolio media sizing and posters"
git status --short
git log --oneline -4
```

Expected: the commit contains exactly the dashboard script and its existing test; status is clean; Task 6 and Task 7 commits are present; nothing is pushed.

## Execution Handoff

Tasks 1-5 are completed historical work and remain unchanged above. Execution mode is **Inline Execution** in this same Herdr worktree; after critical review, invoke `superpowers:executing-plans` and execute only Tasks 6-7 in order, stopping at every RED, GREEN, browser-proof, and commit gate.
