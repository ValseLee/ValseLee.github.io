# Dashboard Preview Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve uploaded article images from the local dashboard so Markdown previews display them.

**Architecture:** Extend the existing `createServer` request handler with one `GET /images/<filename>` branch. Reuse `IMAGE_TYPES` and `public/images/`; do not add a server, dependency, or deployed route.

**Tech Stack:** Node.js `node:http`, `node:fs`, `node:path`, `node:test`

## Global Constraints

- Serve only files directly inside `public/images/` with extensions already present in `IMAGE_TYPES`.
- Unsafe, malformed, unsupported, and missing image paths return the existing 404 response.
- Upload, Markdown insertion, publish, commit, push, and deployed-site behavior remain unchanged.

---

### Task 1: Serve dashboard preview images

**Files:**
- Modify: `scripts/article-dashboard.mjs:1141-1243`
- Test: `scripts/article-dashboard.test.mjs:281-311`

**Interfaces:**
- Consumes: `createServer(root)`, `IMAGE_TYPES`, and files stored under `<root>/public/images/`.
- Produces: `GET /images/<encoded filename>` responses with the mapped image MIME type and original bytes.

- [x] **Step 1: Write the failing real-server test**

Add after the existing `POST /api/images` test:

```js
test("GET /images serves uploaded image previews", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "article-dashboard-preview-image-"));
  const imagesDirectory = path.join(root, "public", "images");
  const image = Buffer.from("preview");
  fs.mkdirSync(imagesDirectory, { recursive: true });
  fs.writeFileSync(path.join(imagesDirectory, "미리보기.png"), image);
  const server = createServer(root);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/images/${encodeURIComponent("미리보기.png")}`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/png");
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), image);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test --test-name-pattern="GET /images serves uploaded image previews" scripts/article-dashboard.test.mjs
```

Expected: FAIL because the response status is `404` instead of `200`.

- [x] **Step 3: Add the minimum safe image route**

Add after the dashboard root route in `createServer`:

```js
    if (request.method === "GET" && url.pathname.startsWith("/images/")) {
      try {
        const fileName = decodeURIComponent(url.pathname.slice("/images/".length));
        const extension = path.extname(fileName).toLowerCase();
        if (fileName === path.basename(fileName) && !fileName.includes("\\") && IMAGE_TYPES.has(extension)) {
          const content = fs.readFileSync(path.join(root, "public", "images", fileName));
          response.writeHead(200, { "content-type": IMAGE_TYPES.get(extension) });
          response.end(content);
          return;
        }
      } catch {
        // Invalid and missing image paths use the shared 404 response.
      }
    }
```

- [x] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
node --test --test-name-pattern="GET /images serves uploaded image previews" scripts/article-dashboard.test.mjs
```

Expected: PASS for the matching test with no failures.

- [x] **Step 5: Run repository verification**

Run:

```bash
npm test
npm run verify:content
git diff --check
```

Expected: all tests and content verification pass; `git diff --check` produces no output.

- [x] **Step 6: Commit the implementation**

```bash
git add scripts/article-dashboard.mjs scripts/article-dashboard.test.mjs docs/superpowers/plans/2026-07-21-dashboard-preview-images.md
git commit -m "🐛 fix: serve dashboard preview images"
```
