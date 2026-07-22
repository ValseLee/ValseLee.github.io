# Portfolio Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a localhost-only portfolio authoring mode to the existing article dashboard, with validated structured project data, ordered image/MP4 media, drafts, Markdown preview, and the existing build/commit/push publication flow.

**Architecture:** Extend `scripts/article-dashboard.mjs` in place and keep `npm run write` unchanged; `npm run portfolio` selects portfolio-only HTML and `/api/portfolio/*` routes on the same guarded `node:http` server. Keep the canonical contract in `content/portfolio.json`, reuse `micromark`, slug/collision logic, same-origin protection, atomic file replacement, command execution, and the existing `node:test` file; do not add a module, framework, dependency, public renderer, or public CSS.

**Tech Stack:** Node.js 20 built-ins, `node:http`, `node:fs`, `node:path`, `node:test`, `node:assert/strict`, existing `micromark`, JSON, inline HTML/CSS/JavaScript, npm, Git.

## Global Constraints

- `npm run write` keeps its current article behavior.
- `npm run portfolio` runs `node scripts/article-dashboard.mjs portfolio`.
- Portfolio mode binds to `127.0.0.1`, uses port `4318` by default, and accepts `PORTFOLIO_DASHBOARD_PORT`; it must not change the article dashboard port or environment variable.
- The canonical tracked file is `content/portfolio.json` and begins with `{ "projects": [] }`.
- `slug` is created with the existing slug helper for new projects and remains stable when a project name changes.
- Project order and media order are their array order; `descriptionMarkdown` stores Markdown source.
- Project name is required and at most 120 characters; period is required and at most 80 characters; Markdown description is required and at most 50,000 characters.
- A project has at most 20 media items; every caption is required and at most 300 characters.
- Image alt is required and non-empty; video items do not accept or retain an `alt` field.
- Media `src` is exactly `/portfolio/<filename>` and must reject separators, traversal, absolute paths, and unsupported extensions.
- Images are PNG, JPEG, GIF, WebP, AVIF, or SVG and at most 10 MiB; video is `.mp4` with `video/mp4` and at most 50 MiB; extension and `Content-Type` must agree.
- Retain the existing 1 MiB JSON request-body limit.
- Draft replacement and canonical replacement use sibling temporary files and atomic rename after full validation.
- Publish stages only `content/portfolio.json` and media referenced by the submitted project, commits `YYYY-MM-DD update portfolio - <project name>`, and runs the existing `git push` command.
- A pre-commit failure unstages explicit portfolio paths and restores the exact prior canonical bytes or removes a newly created canonical file; a push failure preserves the successful commit and reports `committed: true`.
- Keep `.portfolio-drafts/` ignored; uploaded media remains as an untracked, recoverable file when a draft or pre-commit publish step fails.
- Do not change `expertise-grid`, `app/page.tsx`, `app/globals.css`, or any other public UI/CSS.
- Do not add runtime or development dependencies, a separate dashboard module, drag-sort library, modal system, state library, custom file picker, media conversion, compression, thumbnails, external storage, or orphan cleanup.

## File Structure

- `scripts/article-dashboard.mjs`: retain the article dashboard and add portfolio normalization, media persistence, draft persistence, publishing, inline dashboard HTML, mode selection, and portfolio-only HTTP routes.
- `scripts/article-dashboard.test.mjs`: add all focused unit, filesystem, publication-runner, and real HTTP regression cases to the existing test surface.
- `scripts/verify-content.mjs`: validate the canonical portfolio JSON through the same exported portfolio normalizer used by drafts and publish.
- `content/portfolio.json`: hold the canonical ordered `projects` array.
- `.gitignore`: ignore `.portfolio-drafts/` only.
- `package.json`: add only the `portfolio` npm script.

---

### Task 1: Canonical Portfolio Contract and Build-Time Validation

**Files:**
- Create: `content/portfolio.json`
- Modify: `scripts/article-dashboard.mjs`
- Modify: `scripts/article-dashboard.test.mjs`
- Modify: `scripts/verify-content.mjs`

**Interfaces:**
- Consumes: existing `createSlug(title: string, date?: Date): string` and `renderMarkdownPreview(markdown: string): string` from `scripts/article-dashboard.mjs`.
- Produces: `normalizePortfolioProject(rawProject: unknown): PortfolioProject`, where `PortfolioProject` is `{ slug: string; name: string; period: string; descriptionMarkdown: string; media: Array<{ kind: "image"; src: string; caption: string; alt: string } | { kind: "video"; src: string; caption: string }> }`.
- Produces: `normalizePortfolioContent(rawContent: unknown): { projects: PortfolioProject[] }`, preserving project/media order and rejecting duplicate slugs.
- Produces: a canonical `content/portfolio.json` containing exactly `{ "projects": [] }` before projects are published.

- [ ] **Step 1: Add the failing ordered-project normalization test (2-5 minutes)**

Add one table-driven test block to `scripts/article-dashboard.test.mjs`; import `normalizePortfolioProject` and `normalizePortfolioContent` from the existing dashboard module.

```js
test("normalizePortfolioProject preserves ordered image and video media", () => {
  const project = normalizePortfolioProject({
    slug: "loutine",
    name: " Loutine ",
    period: " 2025.01 — Present ",
    descriptionMarkdown: "## Project description",
    media: [
      { kind: "image", src: "/portfolio/home.png", caption: " Home ", alt: " Home screen " },
      { kind: "video", src: "/portfolio/demo.mp4", caption: " Demo ", alt: "discard me" },
    ],
  });

  assert.deepEqual(project, {
    slug: "loutine",
    name: "Loutine",
    period: "2025.01 — Present",
    descriptionMarkdown: "## Project description",
    media: [
      { kind: "image", src: "/portfolio/home.png", caption: "Home", alt: "Home screen" },
      { kind: "video", src: "/portfolio/demo.mp4", caption: "Demo" },
    ],
  });
});

test("normalizePortfolioProject rejects invalid project fields", () => {
  const valid = {
    slug: "loutine",
    name: "Loutine",
    period: "2025",
    descriptionMarkdown: "Description",
    media: [{ kind: "image", src: "/portfolio/home.png", caption: "Home", alt: "Home" }],
  };
  const cases = [
    [{ ...valid, media: [{ ...valid.media[0], caption: "" }] }, "media[0].caption"],
    [{ ...valid, media: [{ ...valid.media[0], alt: "" }] }, "media[0].alt"],
    [{ ...valid, media: [{ ...valid.media[0], src: "/portfolio/../home.png" }] }, "media[0].src"],
    [{ ...valid, media: Array.from({ length: 21 }, () => valid.media[0]) }, "media"],
  ];
  for (const [input, field] of cases) assert.throws(() => normalizePortfolioProject(input), new RegExp(field, "i"));
  assert.throws(
    () => normalizePortfolioContent({ projects: [valid, valid] }),
    /duplicate.*slug/i,
  );
});
```

- [ ] **Step 2: Run the focused test and observe the missing export (2 minutes)**

Run: `node --test --test-name-pattern="normalizePortfolioProject" scripts/article-dashboard.test.mjs`

Expected: FAIL because `normalizePortfolioProject` and `normalizePortfolioContent` are not exported yet.

- [ ] **Step 3: Add the minimum shared normalizers (2-5 minutes)**

Add the following contract in `scripts/article-dashboard.mjs`; use a small field helper so canonical content, drafts, and publish cannot drift.

```js
const PORTFOLIO_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg"]);
const PORTFOLIO_VIDEO_EXTENSIONS = new Set([".mp4"]);

function requiredPortfolioText(value, field, maxLength) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  const normalized = value.trim();
  if (maxLength !== undefined && normalized.length > maxLength) throw new Error(`${field} must be at most ${maxLength} characters`);
  return normalized;
}

function normalizePortfolioSrc(value, field) {
  if (typeof value !== "string" || !/^\/portfolio\/[^/\\]+$/.test(value)) {
    throw new Error(`${field} must be /portfolio/<filename>`);
  }
  const extension = path.extname(value).toLowerCase();
  if (!PORTFOLIO_IMAGE_EXTENSIONS.has(extension) && !PORTFOLIO_VIDEO_EXTENSIONS.has(extension)) {
    throw new Error(`${field} has an unsupported extension`);
  }
  return value;
}

export function normalizePortfolioProject(rawProject) {
  if (!rawProject || typeof rawProject !== "object" || Array.isArray(rawProject)) {
    throw new Error("project must be an object");
  }
  const name = requiredPortfolioText(rawProject.name, "name", 120);
  const slug = rawProject.slug ? requiredPortfolioText(rawProject.slug, "slug") : createSlug(name);
  if (!/^[\p{Letter}\p{Number}]+(?:-[\p{Letter}\p{Number}]+)*$/u.test(slug)) throw new Error("slug is invalid");
  const media = rawProject.media;
  if (!Array.isArray(media) || media.length > 20) throw new Error("media must contain at most 20 items");
  if (typeof rawProject.descriptionMarkdown !== "string" || !rawProject.descriptionMarkdown.trim()) {
    throw new Error("descriptionMarkdown is required");
  }
  if (rawProject.descriptionMarkdown.length > 50_000) throw new Error("descriptionMarkdown must be at most 50000 characters");

  return {
    slug,
    name,
    period: requiredPortfolioText(rawProject.period, "period", 80),
    descriptionMarkdown: rawProject.descriptionMarkdown,
    media: media.map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`media[${index}] is invalid`);
      const src = normalizePortfolioSrc(item.src, `media[${index}].src`);
      const caption = requiredPortfolioText(item.caption, `media[${index}].caption`, 300);
      if (item.kind === "image" && PORTFOLIO_IMAGE_EXTENSIONS.has(path.extname(src).toLowerCase())) {
        return { kind: "image", src, caption, alt: requiredPortfolioText(item.alt, `media[${index}].alt`) };
      }
      if (item.kind === "video" && PORTFOLIO_VIDEO_EXTENSIONS.has(path.extname(src).toLowerCase())) {
        return { kind: "video", src, caption };
      }
      throw new Error(`media[${index}].kind does not match src`);
    }),
  };
}

export function normalizePortfolioContent(rawContent) {
  if (!rawContent || typeof rawContent !== "object" || !Array.isArray(rawContent.projects)) {
    throw new Error("portfolio.projects must be an array");
  }
  const projects = rawContent.projects.map(normalizePortfolioProject);
  if (new Set(projects.map(({ slug }) => slug)).size !== projects.length) throw new Error("duplicate project slug");
  return { projects };
}
```

- [ ] **Step 4: Add canonical JSON verification and make the focused checks pass (2-5 minutes)**

Create `content/portfolio.json`:

```json
{
  "projects": []
}
```

In `scripts/verify-content.mjs`, import `normalizePortfolioContent`, read `content/portfolio.json` with the script's existing repository-root and JSON-reading pattern, and validate it without supplying defaults:

```js
const portfolioPath = path.join(root, "content", "portfolio.json");
normalizePortfolioContent(JSON.parse(await fs.readFile(portfolioPath, "utf8")));
```

Run: `node --test --test-name-pattern="normalizePortfolioProject" scripts/article-dashboard.test.mjs`

Expected: PASS; the focused normalization cases pass.

Run: `npm run verify:content`

Expected: PASS; content verification accepts the empty canonical array.

- [ ] **Step 5: Commit the contract atomically (2 minutes)**

```bash
git add content/portfolio.json scripts/article-dashboard.mjs scripts/article-dashboard.test.mjs scripts/verify-content.mjs
git commit -m "✨ feat: add portfolio content contract"
```

### Task 2: Validated Portfolio Media Persistence

**Files:**
- Modify: `scripts/article-dashboard.mjs`
- Modify: `scripts/article-dashboard.test.mjs`

**Interfaces:**
- Consumes: existing `resolveUniqueImageFile(directory: string, requestedName: string): string` for deterministic `-2`, `-3` collision suffixes.
- Produces: `validatePortfolioMediaUpload({ fileName: string; contentType: string; size: number }): { kind: "image" | "video"; extension: string; maxBytes: number }`.
- Produces: `savePortfolioMedia({ fileName: string; contentType: string; content: Buffer }, root?: string): { kind: "image" | "video"; fileName: string; filePath: string; src: string }`, writing only beneath `<root>/public/portfolio/`.

- [ ] **Step 1: Add failing media validation and persistence tests (2-5 minutes)**

Add tests using a temporary root; do not write to tracked `public/`.

```js
test("savePortfolioMedia stores ordered-dashboard MP4 uploads and suffixes collisions", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-media-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const upload = { fileName: "Demo Reel.mp4", contentType: "video/mp4", content: Buffer.from("mp4") };

  assert.deepEqual(savePortfolioMedia(upload, root), {
    kind: "video",
    fileName: "demo-reel.mp4",
    filePath: path.join(root, "public", "portfolio", "demo-reel.mp4"),
    src: "/portfolio/demo-reel.mp4",
  });
  assert.equal(savePortfolioMedia(upload, root).fileName, "demo-reel-2.mp4");
});

test("validatePortfolioMediaUpload rejects mismatches, unsupported files, and size excess", () => {
  const invalid = [
    [{ fileName: "image.png", contentType: "video/mp4", size: 1 }, /content-type.*extension/i],
    [{ fileName: "notes.txt", contentType: "text/plain", size: 1 }, /unsupported/i],
    [{ fileName: "image.png", contentType: "image/png", size: 10 * 1024 * 1024 + 1 }, /10 MiB/i],
    [{ fileName: "demo.mp4", contentType: "video/mp4", size: 50 * 1024 * 1024 + 1 }, /50 MiB/i],
  ];
  for (const [input, error] of invalid) assert.throws(() => validatePortfolioMediaUpload(input), error);
});
```

- [ ] **Step 2: Run the focused media tests and observe the missing exports (2 minutes)**

Run: `node --test --test-name-pattern="PortfolioMedia" scripts/article-dashboard.test.mjs`

Expected: FAIL because `savePortfolioMedia` and `validatePortfolioMediaUpload` are not exported yet.

- [ ] **Step 3: Implement extension/MIME/size validation (2-5 minutes)**

Add the exact allowlist beside the Task 1 extension sets and reject before creating directories or files.

```js
const PORTFOLIO_MEDIA_TYPES = new Map([
  [".png", ["image", "image/png", 10 * 1024 * 1024]],
  [".jpg", ["image", "image/jpeg", 10 * 1024 * 1024]],
  [".jpeg", ["image", "image/jpeg", 10 * 1024 * 1024]],
  [".gif", ["image", "image/gif", 10 * 1024 * 1024]],
  [".webp", ["image", "image/webp", 10 * 1024 * 1024]],
  [".avif", ["image", "image/avif", 10 * 1024 * 1024]],
  [".svg", ["image", "image/svg+xml", 10 * 1024 * 1024]],
  [".mp4", ["video", "video/mp4", 50 * 1024 * 1024]],
]);

export function validatePortfolioMediaUpload({ fileName, contentType, size }) {
  const baseName = path.basename(fileName);
  if (baseName !== fileName || baseName === "." || baseName === "..") throw new Error("fileName is unsafe");
  const extension = path.extname(baseName).toLowerCase();
  const rule = PORTFOLIO_MEDIA_TYPES.get(extension);
  if (!rule) throw new Error("unsupported portfolio media file");
  const [kind, expectedType, maxBytes] = rule;
  if (contentType !== expectedType) throw new Error("Content-Type does not match extension");
  if (!Number.isSafeInteger(size) || size < 1 || size > maxBytes) {
    throw new Error(`${kind} upload exceeds ${maxBytes === 10 * 1024 * 1024 ? "10 MiB" : "50 MiB"}`);
  }
  return { kind, extension, maxBytes };
}
```

- [ ] **Step 4: Implement constrained storage and make the focused tests pass (2-5 minutes)**

Reuse the existing filename-slugging expression from `saveUploadedImage` and `resolveUniqueImageFile`; change only the owned directory and return shape.

```js
export function savePortfolioMedia({ fileName, contentType, content }, root = process.cwd()) {
  if (!Buffer.isBuffer(content)) throw new Error("content must be a Buffer");
  const { kind, extension } = validatePortfolioMediaUpload({ fileName, contentType, size: content.byteLength });
  const directory = path.join(root, "public", "portfolio");
  fs.mkdirSync(directory, { recursive: true });
  const stem = path.basename(fileName, path.extname(fileName))
    .normalize("NFKD").toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-|-$/g, "") || "media";
  const filePath = resolveUniqueImageFile(directory, `${stem}${extension}`);
  fs.writeFileSync(filePath, content, { flag: "wx" });
  const storedName = path.basename(filePath);
  return { kind, fileName: storedName, filePath, src: `/portfolio/${storedName}` };
}
```

Run: `node --test --test-name-pattern="PortfolioMedia" scripts/article-dashboard.test.mjs`

Expected: PASS; MP4 storage, slugging, collision suffixes, MIME/extension mismatch, unsupported type, and both limits are covered.

- [ ] **Step 5: Commit media persistence atomically (2 minutes)**

```bash
git add scripts/article-dashboard.mjs scripts/article-dashboard.test.mjs
git commit -m "✨ feat: add validated portfolio media storage"
```

### Task 3: Atomic Portfolio Draft Round Trip

**Files:**
- Modify: `.gitignore`
- Modify: `scripts/article-dashboard.mjs`
- Modify: `scripts/article-dashboard.test.mjs`

**Interfaces:**
- Consumes: `normalizePortfolioProject(rawProject: unknown): PortfolioProject` from Task 1.
- Produces: `savePortfolioDraft(rawProject: unknown, root?: string, now?: Date): { fileName: string; name: string; updatedAt: string; project: PortfolioProject }`.
- Produces: `listPortfolioDrafts(root?: string): Array<{ fileName: string; name: string; updatedAt: string }>`; malformed JSON files remain in this list using the filename stem as `name`.
- Produces: `loadPortfolioDraft(fileName: string, root?: string): PortfolioProject`; unsafe names and malformed/invalid drafts throw field-specific errors without filesystem paths.

- [ ] **Step 1: Add a failing round-trip and preservation test (2-5 minutes)**

```js
test("portfolio drafts round-trip and invalid replacement preserves the previous draft", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-draft-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const project = {
    slug: "loutine",
    name: "Loutine",
    period: "2025",
    descriptionMarkdown: "Description",
    media: [{ kind: "video", src: "/portfolio/demo.mp4", caption: "Demo" }],
  };

  const saved = savePortfolioDraft(project, root, new Date("2026-07-21T00:00:00.000Z"));
  const previousBytes = fs.readFileSync(path.join(root, ".portfolio-drafts", saved.fileName));
  assert.deepEqual(loadPortfolioDraft(saved.fileName, root), project);
  assert.deepEqual(listPortfolioDrafts(root), [{
    fileName: "loutine.json",
    name: "Loutine",
    updatedAt: "2026-07-21T00:00:00.000Z",
  }]);

  assert.throws(() => savePortfolioDraft({ ...project, media: [{ ...project.media[0], caption: "" }] }, root), /caption/i);
  assert.deepEqual(fs.readFileSync(path.join(root, ".portfolio-drafts", saved.fileName)), previousBytes);
  assert.equal(fs.existsSync(path.join(root, ".portfolio-drafts", "loutine.json.tmp")), false);

  fs.writeFileSync(path.join(root, ".portfolio-drafts", "broken.json"), "{");
  assert.equal(listPortfolioDrafts(root).some(({ fileName, name }) => fileName === "broken.json" && name === "broken"), true);
  assert.throws(() => loadPortfolioDraft("broken.json", root), /malformed or invalid/i);
});
```

- [ ] **Step 2: Run the focused draft test and observe the missing exports (2 minutes)**

Run: `node --test --test-name-pattern="portfolio drafts" scripts/article-dashboard.test.mjs`

Expected: FAIL because the three portfolio draft functions are not exported yet.

- [ ] **Step 3: Implement atomic save and guarded load (2-5 minutes)**

```js
const PORTFOLIO_DRAFTS_DIRECTORY = ".portfolio-drafts";

export function savePortfolioDraft(rawProject, root = process.cwd(), now = new Date()) {
  const project = normalizePortfolioProject(rawProject);
  const directory = path.join(root, PORTFOLIO_DRAFTS_DIRECTORY);
  const fileName = `${project.slug}.json`;
  const filePath = path.join(directory, fileName);
  const temporaryPath = `${filePath}.tmp`;
  fs.mkdirSync(directory, { recursive: true });
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(project, null, 2)}\n`, { flag: "w" });
    fs.renameSync(temporaryPath, filePath);
    fs.utimesSync(filePath, now, now);
  } catch (error) {
    fs.rmSync(temporaryPath, { force: true });
    throw error;
  }
  return { fileName, name: project.name, updatedAt: now.toISOString(), project };
}

export function loadPortfolioDraft(fileName, root = process.cwd()) {
  if (!/^[\p{Letter}\p{Number}]+(?:-[\p{Letter}\p{Number}]+)*\.json$/u.test(fileName)) throw new Error("draft file is invalid");
  try {
    return normalizePortfolioProject(JSON.parse(fs.readFileSync(path.join(root, PORTFOLIO_DRAFTS_DIRECTORY, fileName), "utf8")));
  } catch {
    throw new Error(`draft ${fileName} is malformed or invalid`);
  }
}
```

- [ ] **Step 4: Implement resilient listing, ignore drafts, and pass the focused test (2-5 minutes)**

```js
export function listPortfolioDrafts(root = process.cwd()) {
  const directory = path.join(root, PORTFOLIO_DRAFTS_DIRECTORY);
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => {
      const filePath = path.join(directory, fileName);
      const updatedAt = fs.statSync(filePath).mtime.toISOString();
      try {
        return { fileName, name: loadPortfolioDraft(fileName, root).name, updatedAt };
      } catch {
        return { fileName, name: path.basename(fileName, ".json"), updatedAt };
      }
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
```

Append exactly this ignore entry to `.gitignore`:

```gitignore
.portfolio-drafts/
```

Run: `node --test --test-name-pattern="portfolio drafts" scripts/article-dashboard.test.mjs`

Expected: PASS; a valid draft round-trips, invalid replacement preserves exact bytes, the temporary file is absent, and listing remains deterministic.

- [ ] **Step 5: Commit draft persistence atomically (2 minutes)**

```bash
git add .gitignore scripts/article-dashboard.mjs scripts/article-dashboard.test.mjs
git commit -m "✨ feat: add atomic portfolio drafts"
```

### Task 4: Transactional Portfolio Publish Workflow

**Files:**
- Modify: `scripts/article-dashboard.mjs`
- Modify: `scripts/article-dashboard.test.mjs`

**Interfaces:**
- Consumes: `normalizePortfolioProject(rawProject: unknown): PortfolioProject` and `normalizePortfolioContent(rawContent: unknown): { projects: PortfolioProject[] }` from Task 1.
- Consumes: existing private command runner contract `(command: string, args: string[], options: { cwd: string }) => Promise<{ stdout?: string; stderr?: string }>` already used by `publishPost`.
- Produces: `mergePortfolioProject(content: { projects: PortfolioProject[] }, project: PortfolioProject): { projects: PortfolioProject[] }`, replacing in place by stable slug or appending once.
- Produces: `publishPortfolioProject(rawProject: unknown, root?: string, now?: Date, runner?: CommandRunner): Promise<PortfolioPublishResult>`, where success is `{ ok: true; committed: boolean; slug: string; filePath: string; commitMessage: string; logs: string[] }` and failure adds `{ ok: false; error: string }`; push failure returns `committed: true`.

- [ ] **Step 1: Add failing merge and explicit-stage tests (2-5 minutes)**

Use a temporary repository-shaped root and a recording runner; keep fixtures to two projects and one referenced asset.

```js
function portfolioProject(overrides = {}) {
  return {
    slug: "loutine",
    name: "Loutine",
    period: "2025",
    descriptionMarkdown: "Description",
    media: [],
    ...overrides,
  };
}

function createPortfolioRoot(t, content) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-publish-"));
  fs.mkdirSync(path.join(root, "content"), { recursive: true });
  fs.writeFileSync(path.join(root, "content", "portfolio.json"), `${JSON.stringify(content, null, 2)}\n`);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test("publishPortfolioProject updates by slug and stages only canonical JSON and referenced media", async (t) => {
  const root = createPortfolioRoot(t, {
    projects: [portfolioProject({ slug: "first", name: "First" }), portfolioProject({ slug: "loutine", name: "Old" })],
  });
  fs.mkdirSync(path.join(root, "public", "portfolio"), { recursive: true });
  fs.writeFileSync(path.join(root, "public", "portfolio", "demo.mp4"), "mp4");
  const calls = [];
  const runner = async (command, args, options) => {
    calls.push({ command, args, cwd: options.cwd });
    return { stdout: "ok", stderr: "" };
  };

  const result = await publishPortfolioProject(
    portfolioProject({ slug: "loutine", name: "Loutine", media: [{ kind: "video", src: "/portfolio/demo.mp4", caption: "Demo" }] }),
    root,
    new Date("2026-07-21T00:00:00.000Z"),
    runner,
  );

  assert.equal(result.committed, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, "content", "portfolio.json"), "utf8")).projects.map(({ slug }) => slug), ["first", "loutine"]);
  assert.deepEqual(calls.map(({ command, args }) => [command, args]), [
    ["npm", ["run", "build"]],
    ["git", ["add", "--", "content/portfolio.json", "public/portfolio/demo.mp4"]],
    ["git", ["commit", "-m", "2026-07-21 update portfolio - Loutine"]],
    ["git", ["push"]],
  ]);
});
```

- [ ] **Step 2: Add failing rollback and push-failure tests, then observe the missing export (2-5 minutes)**

```js
test("publishPortfolioProject restores canonical bytes before commit and keeps a commit after push failure", async (t) => {
  const root = createPortfolioRoot(t, { projects: [portfolioProject({ slug: "loutine", name: "Old" })] });
  const filePath = path.join(root, "content", "portfolio.json");
  const previousBytes = fs.readFileSync(filePath);
  const failingBuild = async (command, args) => {
    if (command === "npm") throw new Error("build failed");
    return { stdout: `${command} ${args.join(" ")}`, stderr: "" };
  };
  const buildResult = await publishPortfolioProject(portfolioProject({ slug: "loutine", name: "New" }), root, new Date("2026-07-21"), failingBuild);
  assert.equal(buildResult.committed, false);
  assert.deepEqual(fs.readFileSync(filePath), previousBytes);

  const pushFailure = async (command, args) => {
    if (command === "git" && args[0] === "push") throw new Error("no upstream");
    return { stdout: "ok", stderr: "" };
  };
  const pushResult = await publishPortfolioProject(portfolioProject({ slug: "loutine", name: "New" }), root, new Date("2026-07-21"), pushFailure);
  assert.equal(pushResult.committed, true);
  assert.match(pushResult.error, /no upstream/i);
  assert.equal(JSON.parse(fs.readFileSync(filePath, "utf8")).projects[0].name, "New");
});
```

Run: `node --test --test-name-pattern="publishPortfolioProject" scripts/article-dashboard.test.mjs`

Expected: FAIL because `publishPortfolioProject` is not exported yet.

- [ ] **Step 3: Add merge, deterministic bytes, and the no-change exit (2-5 minutes)**

```js
export function mergePortfolioProject(content, project) {
  const projects = [...content.projects];
  const index = projects.findIndex(({ slug }) => slug === project.slug);
  if (index === -1) projects.push(project);
  else projects[index] = project;
  return { projects };
}

function portfolioJson(content) {
  return `${JSON.stringify(content, null, 2)}\n`;
}
```

In `publishPortfolioProject`, normalize both payload and current JSON, calculate `nextBytes`, and return before build or Git when `Buffer.equals(previousBytes, Buffer.from(nextBytes))`. Because uploads always use collision-safe new filenames and never overwrite existing media, an unchanged canonical payload cannot introduce a changed referenced asset.

- [ ] **Step 4: Implement the write/build/stage/commit/push transaction and pass focused tests (2-5 minutes)**

Keep rollback in this function and use only repository-relative explicit paths.

```js
export async function publishPortfolioProject(rawProject, root = process.cwd(), now = new Date(), runner = runCommand) {
  const project = normalizePortfolioProject(rawProject);
  const relativeFilePath = "content/portfolio.json";
  const canonicalFilePath = path.join(root, relativeFilePath);
  const existed = fs.existsSync(canonicalFilePath);
  const previousBytes = existed ? fs.readFileSync(canonicalFilePath) : null;
  const current = existed ? normalizePortfolioContent(JSON.parse(previousBytes.toString("utf8"))) : { projects: [] };
  const nextBytes = Buffer.from(portfolioJson(mergePortfolioProject(current, project)));
  const commitMessage = `${now.toISOString().slice(0, 10)} update portfolio - ${project.name}`;
  const logs = [];
  if (previousBytes?.equals(nextBytes)) return { ok: true, committed: false, slug: project.slug, filePath: relativeFilePath, commitMessage, logs };

  const relativeMediaPaths = [...new Set(project.media.map(({ src }) => `public${src}`))];
  const stagedPaths = [relativeFilePath, ...relativeMediaPaths];
  let committed = false;
  try {
    fs.mkdirSync(path.dirname(canonicalFilePath), { recursive: true });
    fs.writeFileSync(`${canonicalFilePath}.tmp`, nextBytes);
    fs.renameSync(`${canonicalFilePath}.tmp`, canonicalFilePath);
    for (const [command, args] of [
      ["npm", ["run", "build"]],
      ["git", ["add", "--", ...stagedPaths]],
      ["git", ["commit", "-m", commitMessage]],
    ]) {
      const result = await runner(command, args, { cwd: root });
      logs.push(result.stdout || result.stderr || `${command} completed`);
    }
    committed = true;
    const pushed = await runner("git", ["push"], { cwd: root });
    logs.push(pushed.stdout || pushed.stderr || "git push completed");
    return { ok: true, committed, slug: project.slug, filePath: relativeFilePath, commitMessage, logs };
  } catch (error) {
    if (!committed) {
      await runner("git", ["reset", "--", ...stagedPaths], { cwd: root }).catch(() => {});
      if (previousBytes) {
        fs.writeFileSync(`${canonicalFilePath}.tmp`, previousBytes);
        fs.renameSync(`${canonicalFilePath}.tmp`, canonicalFilePath);
      } else {
        fs.rmSync(canonicalFilePath, { force: true });
      }
      fs.rmSync(`${canonicalFilePath}.tmp`, { force: true });
    }
    const message = error instanceof Error ? error.message.replaceAll(root, "repository") : "portfolio publish failed";
    return { ok: false, committed, slug: project.slug, filePath: relativeFilePath, commitMessage, logs, error: message };
  }
}
```

Run: `node --test --test-name-pattern="publishPortfolioProject" scripts/article-dashboard.test.mjs`

Expected: PASS; stable-slug replacement retains project position, explicit staging contains no unrelated path, pre-commit failure restores byte-for-byte content, and push failure keeps `committed: true`.

- [ ] **Step 5: Commit publishing atomically (2 minutes)**

```bash
git add scripts/article-dashboard.mjs scripts/article-dashboard.test.mjs
git commit -m "✨ feat: add transactional portfolio publishing"
```

### Task 5: Portfolio Mode, Local Dashboard, and HTTP Contract

**Files:**
- Modify: `package.json`
- Modify: `scripts/article-dashboard.mjs`
- Modify: `scripts/article-dashboard.test.mjs`

**Interfaces:**
- Consumes: Task 1 normalizers/Markdown renderer, Task 2 media save, Task 3 draft functions, and Task 4 publish function.
- Changes: `createServer(root: string, options?: { mode?: "article" | "portfolio" }): http.Server`; omitting `options` preserves every existing article route and test.
- Produces in portfolio mode only: `GET /`, `GET /api/portfolio`, `GET /api/portfolio/drafts`, `GET /api/portfolio/draft?file=<name>`, `POST /api/portfolio/draft`, `POST /api/portfolio/media`, `POST /api/portfolio/preview`, `POST /api/portfolio/publish`, and `GET /portfolio/<filename>`.
- Produces: binary media upload request headers `Content-Type: <allowed MIME>` and `X-File-Name: <original filename>`; success JSON is `{ kind, fileName, filePath, src }`.
- Produces: CLI behavior `node scripts/article-dashboard.mjs portfolio`, listening on `127.0.0.1:${PORTFOLIO_DASHBOARD_PORT || 4318}`.

- [ ] **Step 1: Add failing real-server media and same-origin tests (2-5 minutes)**

Start the real server on an ephemeral local port in the existing test file.

```js
test("portfolio mode accepts an MP4 and rejects a cross-origin POST", async (t) => {
  const root = createPortfolioRoot(t, { projects: [] });
  const server = createServer(root, { mode: "portfolio" });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;

  const uploaded = await fetch(`${origin}/api/portfolio/media`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "video/mp4", "X-File-Name": "Demo.mp4" },
    body: Buffer.from("mp4"),
  });
  assert.equal(uploaded.status, 200);
  assert.deepEqual(await uploaded.json(), {
    kind: "video",
    fileName: "demo.mp4",
    filePath: path.join(root, "public", "portfolio", "demo.mp4"),
    src: "/portfolio/demo.mp4",
  });

  const rejected = await fetch(`${origin}/api/portfolio/preview`, {
    method: "POST",
    headers: { Origin: "https://example.com", "Content-Type": "application/json" },
    body: JSON.stringify({ markdown: "# Unsafe" }),
  });
  assert.equal(rejected.status, 403);
});
```

- [ ] **Step 2: Run the focused HTTP test and observe the missing portfolio mode (2 minutes)**

Run: `node --test --test-name-pattern="portfolio mode" scripts/article-dashboard.test.mjs`

Expected: FAIL because `createServer(root, { mode: "portfolio" })` does not route portfolio media or preview requests yet.

- [ ] **Step 3: Add portfolio-only routing and preserve article mode (2-5 minutes)**

Change the export to `createServer(root, { mode = "article" } = {})`. At the top of its request handler, keep the existing same-origin guard and existing 1 MiB JSON reader, then route portfolio requests only when `mode === "portfolio"`:

```js
if (mode === "portfolio") {
  if (request.method === "GET" && url.pathname === "/") return sendHtml(response, portfolioDashboardHtml());
  if (request.method === "GET" && url.pathname === "/api/portfolio") return sendJson(response, 200, readPortfolioContent(root));
  if (request.method === "GET" && url.pathname === "/api/portfolio/drafts") return sendJson(response, 200, listPortfolioDrafts(root));
  if (request.method === "GET" && url.pathname === "/api/portfolio/draft") return sendJson(response, 200, loadPortfolioDraft(url.searchParams.get("file"), root));
  if (request.method === "GET" && url.pathname.startsWith("/portfolio/")) return servePortfolioMedia(url.pathname, root, response);
  if (request.method === "POST" && url.pathname === "/api/portfolio/media") {
    const content = await readRequestBuffer(request, 50 * 1024 * 1024);
    return sendJson(response, 200, savePortfolioMedia({ fileName: request.headers["x-file-name"], contentType: request.headers["content-type"], content }, root));
  }
  if (request.method === "POST" && ["/api/portfolio/draft", "/api/portfolio/preview", "/api/portfolio/publish"].includes(url.pathname)) {
    const body = await readJsonRequest(request, 1024 * 1024);
    if (url.pathname === "/api/portfolio/draft") return sendJson(response, 200, savePortfolioDraft(body, root));
    if (url.pathname === "/api/portfolio/preview") return sendJson(response, 200, { html: renderMarkdownPreview(portfolioPreviewMarkdown(body.markdown)) });
    return sendJson(response, 200, await publishPortfolioProject(body, root));
  }
  return sendJson(response, 404, { error: "Not found" });
}
```

Implement `readPortfolioContent`, `servePortfolioMedia`, and `readRequestBuffer` beside the existing equivalent article helpers. Each resolves from fixed `content/portfolio.json` or `public/portfolio/`, applies the Task 1 filename rule, returns field-specific 400/413 errors, and never returns a stack trace or arbitrary filesystem path:

```js
function readPortfolioContent(root) {
  return normalizePortfolioContent(JSON.parse(fs.readFileSync(path.join(root, "content", "portfolio.json"), "utf8")));
}

function portfolioPreviewMarkdown(value) {
  if (typeof value !== "string") throw new Error("markdown must be a string");
  if (value.length > 50_000) throw new Error("markdown must be at most 50000 characters");
  return value;
}

function readRequestBuffer(request, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    request.on("data", (chunk) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > maxBytes) {
        tooLarge = true;
        chunks.length = 0;
      }
      else chunks.push(chunk);
    });
    request.on("end", () => tooLarge ? reject(new Error(`request exceeds ${maxBytes} bytes`)) : resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function servePortfolioMedia(pathname, root, response) {
  const src = normalizePortfolioSrc(pathname, "media.src");
  const filePath = path.join(root, "public", src.slice(1));
  const [, contentType] = PORTFOLIO_MEDIA_TYPES.get(path.extname(src).toLowerCase());
  response.writeHead(200, { "Content-Type": contentType });
  response.end(fs.readFileSync(filePath));
}
```

Keep the current article handler byte-for-byte below this branch. Route caught errors through the existing JSON error responder, replacing the fixed `root` prefix with `repository` and returning no stack.

- [ ] **Step 4: Add the local portfolio form shell (2-5 minutes)**

Add one `portfolioDashboardHtml()` template using the article dashboard's existing inline style block and status/log regions. Use these exact controls so every required behavior is reachable without a library:

```html
<select id="projects"></select><button id="new-project" type="button">New Project</button>
<input id="name" maxlength="120" required><input id="period" maxlength="80" required>
<textarea id="description" maxlength="50000" required></textarea>
<input id="media-input" type="file" multiple accept="image/*,video/mp4">
<ol id="media-rows"></ol><section id="preview"></section>
<select id="drafts"></select><button id="load-draft" type="button">Load</button>
<button id="save-draft" type="button">Save Draft</button>
<button id="publish" type="button">Save, Commit &amp; Push</button>
<p id="status" role="status"></p><pre id="command-log"></pre>
```

- [ ] **Step 5: Add project loading, dirty protection, and ordered media editing (2-5 minutes)**

Keep state as one plain object `{ project, dirty, activeAction }`. Populate `projects` from `GET /api/portfolio`, retain the loaded project's `slug`, and make New Project start with an empty slug so Task 1 creates it. Project/draft switching uses only this native guard:

```js
function mayReplaceForm() {
  return !state.dirty || confirm("Discard unsaved portfolio changes?");
}

const canonical = await (await fetch("/api/portfolio")).json();
projects.onchange = () => {
  if (!mayReplaceForm()) return renderProjectSelect();
  state.project = structuredClone(canonical.projects.find(({ slug }) => slug === projects.value));
  state.dirty = false;
  render();
};
newProjectButton.onclick = () => {
  if (!mayReplaceForm()) return;
  state.project = { slug: "", name: "", period: "", descriptionMarkdown: "", media: [] };
  state.dirty = false;
  render();
};

function moveMedia(index, offset) {
  const target = index + offset;
  if (target < 0 || target >= state.project.media.length) return;
  const [item] = state.project.media.splice(index, 1);
  state.project.media.splice(target, 0, item);
  state.dirty = true;
  render();
}

function removeMedia(index) {
  state.project.media.splice(index, 1);
  state.dirty = true;
  render();
}
```

Upload selected files sequentially; render ordered rows with the local media preview, stored `src`, Move Up, Move Down, Remove, required caption, and required image-only alt. Video rows omit alt. Remove only splices the current payload and never deletes the uploaded file:

```js
for (const file of mediaInput.files) {
  const response = await fetch("/api/portfolio/media", {
    method: "POST",
    headers: { "Content-Type": file.type, "X-File-Name": file.name },
    body: file,
  });
  const stored = await response.json();
  if (!response.ok) throw new Error(stored.error || `Upload failed (${response.status})`);
  state.project.media.push(stored.kind === "image"
    ? { kind: "image", src: stored.src, caption: "", alt: "" }
    : { kind: "video", src: stored.src, caption: "" });
  render();
}
```

- [ ] **Step 6: Add Markdown/media preview plus draft and publish actions (2-5 minutes)**

Render the full preview through `POST /api/portfolio/preview` followed by ordered figures. Escape project fields, captions, paths, and alt text; insert only the `micromark` response as trusted preview HTML:

```js
async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  return result;
}

const { html: markdownHtml } = await postJson("/api/portfolio/preview", { markdown: state.project.descriptionMarkdown });

const mediaHtml = state.project.media.map((item) => `<figure>${
  item.kind === "image"
    ? `<img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt)}">`
    : `<video src="${escapeHtml(item.src)}" controls preload="metadata"></video>`
}<figcaption>${escapeHtml(item.caption)}</figcaption></figure>`).join("");
preview.innerHTML = `<h2>${escapeHtml(state.project.name)}</h2><p>${escapeHtml(state.project.period)}</p>${markdownHtml}${mediaHtml}`;
```

- [ ] **Step 7: Add draft load/save actions (2-5 minutes)**

Populate `drafts` from `GET /api/portfolio/drafts`; Load calls the dirty guard then `GET /api/portfolio/draft?file=${encodeURIComponent(fileName)}`. Save Draft submits the complete current project:

```js
async function withAction(control, action) {
  state.activeAction = control.id;
  control.disabled = true;
  try { return await action(); }
  catch (error) { status.textContent = error.message; throw error; }
  finally { state.activeAction = null; control.disabled = false; }
}

loadDraftButton.onclick = async () => {
  if (!mayReplaceForm()) return;
  const response = await fetch(`/api/portfolio/draft?file=${encodeURIComponent(drafts.value)}`);
  const project = await response.json();
  if (!response.ok) throw new Error(project.error || "Draft load failed");
  state.project = project;
  state.dirty = false;
  render();
};

saveDraftButton.onclick = () => withAction(saveDraftButton, async () => {
  await postJson("/api/portfolio/draft", state.project);
  state.dirty = false;
  status.textContent = "Draft saved";
});
```

- [ ] **Step 8: Add publish feedback (2-5 minutes)**

Reuse `withAction` so only the publish button is disabled, while status and command logs remain visible:

```js
publishButton.onclick = () => withAction(publishButton, async () => {
  const result = await postJson("/api/portfolio/publish", state.project);
  commandLog.textContent = result.logs.join("\n");
  state.dirty = !result.ok && !result.committed;
  status.textContent = result.ok
    ? (result.committed ? "Committed and pushed" : "No changes")
    : (result.committed ? `Committed; push failed: ${result.error}` : `Publish failed: ${result.error}`);
});
```

Do not import public CSS.

- [ ] **Step 9: Add the npm command and independent guarded startup (2-5 minutes)**

Add only this script to `package.json`:

```json
"portfolio": "node scripts/article-dashboard.mjs portfolio"
```

At guarded process startup, select mode and its independent port:

```js
const mode = process.argv[2] === "portfolio" ? "portfolio" : "article";
const port = mode === "portfolio" ? Number(process.env.PORTFOLIO_DASHBOARD_PORT || 4318) : articlePort;
createServer(process.cwd(), { mode }).listen(port, "127.0.0.1");
```

- [ ] **Step 10: Run the complete existing dashboard test file (2-5 minutes)**

Run: `node --test scripts/article-dashboard.test.mjs`

Expected: PASS; all existing article tests remain green and the real portfolio MP4/cross-origin case passes.

- [ ] **Step 11: Run the required final verification in order (2-5 minutes per command)**

Run each command separately and stop on the first failure:

```bash
node --test scripts/article-dashboard.test.mjs
npm test
npm run verify:content
npm run lint
npm run build
git diff --check
```

Expected: every command exits `0`; content validation runs before the standalone build; the complete diff contains no changes under `app/`, `components/`, public CSS, or a new dependency/module. Also run `git status --short`, `git diff --stat HEAD~4`, and `git diff HEAD~4` before committing; at this point those comparisons cover Tasks 1-4's commits plus Task 5's working-tree changes.

- [ ] **Step 12: Commit mode, API, and local UI atomically (2 minutes)**

```bash
git add package.json scripts/article-dashboard.mjs scripts/article-dashboard.test.mjs
git commit -m "✨ feat: add portfolio dashboard mode"
```

---

Guidance loaded: index.md, verify.md, worktree-dispatch.md, local-tools.md, content.md, testing.md
