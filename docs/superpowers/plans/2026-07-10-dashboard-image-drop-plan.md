# Dashboard Image Drop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store an image dropped onto the local article editor and insert its Markdown reference at the textarea selection.

**Architecture:** Keep the existing standalone Node dashboard. A binary `POST /api/images` endpoint validates and stores one file in `public/images`; the browser then inserts the returned path into the existing textarea and refreshes its preview.

**Tech Stack:** Node.js built-in `http`, `fs`, and `path`; browser `File` and `fetch`; Node test runner.

## Global Constraints

- The dashboard remains bound to `127.0.0.1`.
- Accept one PNG, JPEG, GIF, WebP, AVIF, or SVG file per drop, with a 10 MB maximum.
- Store images in `public/images/` with a URL-safe, collision-free filename.
- Do not add dependencies, base64-embed images, resize images, or support clipboard paste.

---

### Task 1: Image storage helper

**Files:**

- Modify: `scripts/article-dashboard.mjs`
- Modify: `scripts/article-dashboard.test.mjs`

**Interfaces:**

- Produces: `resolveUniqueImageFile(imagesDirectory, requestedName)` returning `{ fileName, filePath }`.
- Produces: `saveUploadedImage({ fileName, contentType, content }, root)` returning `{ ok, fileName, filePath, publicPath }`.

- [ ] **Step 1: Write failing tests for storage, collision names, and MIME/extension mismatch.**

```js
test("saveUploadedImage writes an allowed image with a public path", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "article-dashboard-image-"));
  const result = saveUploadedImage({
    fileName: "A cat photo.PNG", contentType: "image/png", content: Buffer.from("png"),
  }, root);
  assert.deepEqual(result, {
    ok: true, fileName: "a-cat-photo.png",
    filePath: path.join("public", "images", "a-cat-photo.png"),
    publicPath: "/images/a-cat-photo.png",
  });
});

test("saveUploadedImage suffixes duplicate image names", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "article-dashboard-image-"));
  saveUploadedImage({ fileName: "cat.png", contentType: "image/png", content: Buffer.from("one") }, root);
  assert.equal(saveUploadedImage({ fileName: "cat.png", contentType: "image/png", content: Buffer.from("two") }, root).fileName, "cat-2.png");
});

test("saveUploadedImage rejects mismatched uploads", () => {
  assert.throws(() => saveUploadedImage({
    fileName: "script.svg", contentType: "image/png", content: Buffer.from("x"),
  }), /이미지 파일 형식/);
});
```

- [ ] **Step 2: Run the test and confirm it fails because `saveUploadedImage` is not exported.**

Run: `node --test scripts/article-dashboard.test.mjs`

Expected: FAIL with `saveUploadedImage is not a function`.

- [ ] **Step 3: Add the smallest storage implementation.**

```js
const IMAGE_TYPES = new Map([
  [".png", "image/png"], [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"],
  [".gif", "image/gif"], [".webp", "image/webp"], [".avif", "image/avif"], [".svg", "image/svg+xml"],
]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function resolveUniqueImageFile(imagesDirectory, requestedName) {
  const extension = path.extname(requestedName);
  const baseName = path.basename(requestedName, extension);
  let fileName = requestedName;
  for (let index = 2; fs.existsSync(path.join(imagesDirectory, fileName)); index += 1) fileName = baseName + "-" + index + extension;
  return { fileName, filePath: path.join(imagesDirectory, fileName) };
}

export function saveUploadedImage({ fileName, contentType, content }, root = process.cwd()) {
  const extension = path.extname(path.basename(fileName)).toLowerCase();
  if (IMAGE_TYPES.get(extension) !== contentType || !Buffer.isBuffer(content) || !content.length || content.length > MAX_IMAGE_BYTES) {
    throw new Error("이미지 파일 형식 또는 크기가 올바르지 않습니다.");
  }
  const imagesDirectory = path.join(root, "public", "images");
  fs.mkdirSync(imagesDirectory, { recursive: true });
  const target = resolveUniqueImageFile(imagesDirectory, createSlug(path.basename(fileName, extension)) + extension);
  fs.writeFileSync(target.filePath, content);
  return { ok: true, fileName: target.fileName, filePath: path.join("public", "images", target.fileName), publicPath: "/images/" + target.fileName };
}
```

- [ ] **Step 4: Run the test and confirm all 12 tests pass.**

Run: `node --test scripts/article-dashboard.test.mjs`

Expected: 12 PASS, 0 FAIL.

- [ ] **Step 5: Commit the tested helper change.**

```bash
git add scripts/article-dashboard.mjs scripts/article-dashboard.test.mjs
git commit -m "feat: store dashboard images locally"
```

### Task 2: Binary upload endpoint

**Files:**

- Modify: `scripts/article-dashboard.mjs`
- Modify: `scripts/article-dashboard.test.mjs`

**Interfaces:**

- Consumes: `saveUploadedImage({ fileName, contentType, content }, root)`.
- Produces: `POST /api/images`, returning the helper result as JSON.

- [ ] **Step 1: Write a failing server-route test.**

```js
test("POST /api/images stores an image and returns its public path", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "article-dashboard-server-"));
  const server = createServer(root);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const response = await fetch("http://127.0.0.1:" + port + "/api/images", {
    method: "POST",
    headers: { "content-type": "image/png", "x-file-name": "drop.png" },
    body: Buffer.from("png"),
  });
  assert.deepEqual(await response.json(), {
    ok: true, fileName: "drop.png",
    filePath: path.join("public", "images", "drop.png"),
    publicPath: "/images/drop.png",
  });
  await new Promise((resolve) => server.close(resolve));
});
```

- [ ] **Step 2: Run the test and confirm it fails because the route returns 404.**

Run: `node --test scripts/article-dashboard.test.mjs`

Expected: FAIL for the new endpoint test.

- [ ] **Step 3: Export `createServer`, read binary data with the same 10 MB limit, and add the route.**

```js
async function readBinaryBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_IMAGE_BYTES) throw new Error("이미지 파일은 10MB 이하여야 합니다.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

if (request.method === "POST" && url.pathname === "/api/images") {
  try {
    const result = saveUploadedImage({
      fileName: decodeURIComponent(request.headers["x-file-name"] ?? ""),
      contentType: String(request.headers["content-type"] ?? "").split(";", 1)[0],
      content: await readBinaryBody(request),
    }, root);
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 400, { ok: false, error: error.message });
  }
  return;
}
```

- [ ] **Step 4: Run the test and confirm all 13 tests pass.**

Run: `node --test scripts/article-dashboard.test.mjs`

Expected: 13 PASS, 0 FAIL.

- [ ] **Step 5: Commit the tested endpoint change.**

```bash
git add scripts/article-dashboard.mjs scripts/article-dashboard.test.mjs
git commit -m "feat: upload dropped dashboard images"
```

### Task 3: Drop interaction and verification

**Files:**

- Modify: `scripts/article-dashboard.mjs`
- Modify: `README.md`

**Interfaces:**

- Consumes: `POST /api/images` returning `{ ok, publicPath }`.
- Produces: a drop handler that inserts `![filename](publicPath)` at the saved textarea selection.

- [ ] **Step 1: Add an upload helper and drop handler to the rendered dashboard script.**

```js
function insertAtSelection(text) {
  body.setRangeText(text, body.selectionStart, body.selectionEnd, "end");
  body.focus();
  updatePreview();
}

async function uploadDroppedImage(file) {
  const response = await fetch("/api/images", {
    method: "POST",
    headers: { "content-type": file.type, "x-file-name": encodeURIComponent(file.name) },
    body: file,
  });
  const result = await response.json();
  if (!result.ok) throw new Error(result.error || "이미지를 저장하지 못했습니다.");
  insertAtSelection("![" + file.name + "](" + result.publicPath + ")");
}

body.addEventListener("dragover", (event) => event.preventDefault());
body.addEventListener("drop", async (event) => {
  event.preventDefault();
  const [file] = event.dataTransfer.files;
  if (!file) return;
  try { await uploadDroppedImage(file); }
  catch (error) { status.className = "status error"; status.textContent = error.message; }
});
```

- [ ] **Step 2: Document the one-file drop workflow in `README.md`.**

```md
Drop one supported image file onto the Markdown body after placing the caret where its Markdown reference belongs. The dashboard saves it under `public/images/` and inserts the image reference automatically. Image files are included when the post is committed.
```

- [ ] **Step 3: Run a browser-level check.**

Run: `npm run write`

Expected: dropping a PNG on the Markdown body creates `public/images/<name>.png`, inserts `![<original name>](/images/<name>.png)` at the caret, and refreshes the preview.

- [ ] **Step 4: Run the full regression suite.**

Run: `npm run test:article-dashboard && npm run lint && npm run verify:content && npm run build`

Expected: exit code 0 from every command.

- [ ] **Step 5: Commit the UI and documentation change.**

```bash
git add scripts/article-dashboard.mjs README.md docs/superpowers
git commit -m "feat: attach images from dashboard drops"
```
