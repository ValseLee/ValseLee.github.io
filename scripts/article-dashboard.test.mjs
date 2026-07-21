import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildCommitMessage,
  buildMdxDocument,
  createServer,
  createSlug,
  listDrafts,
  loadDraft,
  loadSiteContent,
  normalizeSiteContent,
  parseCommaList,
  parseDraftMdx,
  publishPost,
  renderMarkdownPreview,
  resolveUniquePostFile,
  saveDraft,
  saveSiteContent,
  saveUploadedImage,
} from "./article-dashboard.mjs";

function validSiteContent() {
  return {
    identity: { name: "Celan", role: "Software Engineer / Writer", title: "Celan builds systems and writes about them.", intro: "개발과 제품에 관한 기록입니다." },
    about: { updated: "2026.07", bio: "복잡한 문제를 단순한 시스템으로 만듭니다.", practice: "소프트웨어와 AI 도구를 연구합니다.", principles: ["Build small.", "Write clearly."] },
    expertise: [{ label: "Engineering", items: ["AI Systems", "Web Platforms"] }],
    experience: [{ period: "2024 — Now", organization: "Independent", role: "Software Engineer", description: "제품과 개발 도구를 만듭니다." }],
    contact: { email: "", socials: [{ label: "GitHub", url: "https://github.com/example" }], copyright: "© 2026 Celan" },
  };
}

test("site content is normalized and saved atomically", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "site-content-"));
  const content = validSiteContent();

  const result = saveSiteContent(content, root);
  assert.equal(result.filePath, path.join("content", "site.json"));
  assert.deepEqual(loadSiteContent(root), content);
  assert.equal(fs.existsSync(path.join(root, "content", ".site.json.tmp")), false);
});

test("local dashboard reads and writes site content", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "site-dashboard-api-"));
  fs.mkdirSync(path.join(root, "content"), { recursive: true });
  saveSiteContent(validSiteContent(), root);
  const server = createServer(root);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;

  const loaded = await fetch(`${origin}/api/site`).then((response) => response.json());
  assert.equal(loaded.ok, true);
  loaded.content.identity.title = "Updated title";
  const saved = await fetch(`${origin}/api/site`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(loaded.content),
  }).then((response) => response.json());
  assert.equal(saved.content.identity.title, "Updated title");
  assert.equal(loadSiteContent(root).identity.title, "Updated title");
});

test("local dashboard rejects unsafe POST headers without changing site content", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "site-dashboard-post-policy-"));
  saveSiteContent(validSiteContent(), root);
  const server = createServer(root);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/api/site`;
  const changed = validSiteContent();
  changed.identity.title = "Must not be saved";

  const wrongType = await fetch(url, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: JSON.stringify(changed),
  });
  assert.equal(wrongType.status, 415);
  assert.equal(loadSiteContent(root).identity.title, validSiteContent().identity.title);

  const foreignOrigin = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://evil.example" },
    body: JSON.stringify(changed),
  });
  assert.equal(foreignOrigin.status, 403);
  assert.equal(loadSiteContent(root).identity.title, validSiteContent().identity.title);

  changed.identity.title = "Local CLI update";
  const originlessJson = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(changed),
  });
  assert.equal(originlessJson.status, 200);
  assert.equal(loadSiteContent(root).identity.title, "Local CLI update");
});

test("site editor restores focus after removing a repeat row", async (t) => {
  const server = createServer(process.cwd());
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const { port } = server.address();
  const html = await fetch(`http://127.0.0.1:${port}/`).then((response) => response.text());

  assert.match(html, /removeButtons\[index\] \|\| removeButtons\[index - 1\] \|\| addButton/);
  assert.match(html, /focusTarget\.focus\(\)/);
});

test("site editor gives repeating fields reliable accessible names", async (t) => {
  const server = createServer(process.cwd());
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const { port } = server.address();
  const html = await fetch(`http://127.0.0.1:${port}/`).then((response) => response.text());

  assert.match(html, /input\.setAttribute\("aria-label", key \+ " row " \+ \(index \+ 1\) \+ " " \+ field\)/);
});

test("invalid site content never replaces the existing file", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "site-content-invalid-"));
  fs.mkdirSync(path.join(root, "content"), { recursive: true });
  const file = path.join(root, "content", "site.json");
  fs.writeFileSync(file, '{"existing":true}\n');

  assert.throws(
    () => saveSiteContent({ identity: { name: "" } }, root),
    /identity\.name/,
  );
  assert.equal(fs.readFileSync(file, "utf8"), '{"existing":true}\n');
});

test("site content rejects unsafe social URLs", () => {
  assert.throws(
    () => normalizeSiteContent({
      identity: { name: "Celan", role: "Developer", title: "Title", intro: "Intro" },
      about: { updated: "Now", bio: "Bio", practice: "Practice", principles: ["One"] },
      expertise: [{ label: "Engineering", items: ["Web"] }],
      experience: [{ period: "Now", organization: "Studio", role: "Developer", description: "Work" }],
      contact: { email: "", socials: [{ label: "Bad", url: "javascript:alert(1)" }], copyright: "© Celan" },
    }),
    /https URL/,
  );

  assert.throws(
    () => normalizeSiteContent({
      ...validSiteContent(),
      contact: { ...validSiteContent().contact, socials: [{ label: "Bad", url: "https://" }] },
    }),
    /contact\.socials\[0\]\.url/,
  );
});

test("site content allows an empty email but validates a provided email", () => {
  assert.equal(normalizeSiteContent(validSiteContent()).contact.email, "");
  assert.throws(
    () => normalizeSiteContent({
      ...validSiteContent(),
      contact: { ...validSiteContent().contact, email: "not-an-email" },
    }),
    /contact\.email/,
  );
});

test("site content reports empty nested items by field", () => {
  assert.throws(
    () => normalizeSiteContent({ ...validSiteContent(), about: { ...validSiteContent().about, principles: [""] } }),
    /about\.principles\[0\]/,
  );
  assert.throws(
    () => normalizeSiteContent({ ...validSiteContent(), expertise: [{ label: "Engineering", items: [] }] }),
    /expertise\[0\]\.items/,
  );
  assert.throws(
    () => normalizeSiteContent({
      ...validSiteContent(),
      contact: { ...validSiteContent().contact, socials: {} },
    }),
    /contact\.socials/,
  );
});

test("renderMarkdownPreview supports standard Markdown syntax", () => {
  const html = renderMarkdownPreview("**굵게** [링크](/archive)\n\n1. 첫째\n2. 둘째\n\n![설명](/images/example.png)");

  assert.match(html, /<strong>굵게<\/strong>/);
  assert.match(html, /<a href="\/archive">링크<\/a>/);
  assert.match(html, /<ol>/);
  assert.match(html, /<img src="\/images\/example\.png" alt="설명" \/>/);
});

test("createSlug creates stable URL-safe slugs and keeps Korean text", () => {
  assert.equal(createSlug("Hello, Celan's New Article!"), "hello-celans-new-article");
  assert.equal(createSlug("독서와 AI 에이전트"), "독서와-ai-에이전트");
  assert.match(createSlug("   "), /^post-\d{4}-\d{2}-\d{2}$/);
});

test("parseCommaList trims comma-separated values and drops blanks", () => {
  assert.deepEqual(parseCommaList("Next.js,  MDX, , 블로그 "), ["Next.js", "MDX", "블로그"]);
  assert.deepEqual(parseCommaList(""), []);
});

test("buildMdxDocument renders required frontmatter and markdown body", () => {
  const mdx = buildMdxDocument({
    title: "Quote: \"Hello\"",
    date: "2026-05-14",
    category: "engineering",
    tags: ["Next.js", "MDX"],
    links: [],
    description: "Local dashboard draft",
    body: "# Heading\n\n본문입니다.",
  });

  assert.match(mdx, /^---\n/);
  assert.match(mdx, /title: "Quote: \\"Hello\\""/);
  assert.match(mdx, /date: "2026-05-14"/);
  assert.match(mdx, /category: "engineering"/);
  assert.match(mdx, /tags: \["Next.js", "MDX"\]/);
  assert.match(mdx, /links: \[\]/);
  assert.match(mdx, /description: "Local dashboard draft"/);
  assert.match(mdx, /---\n\n# Heading\n\n본문입니다\.\n$/);
});

test("buildCommitMessage follows the requested Celan article format", () => {
  assert.equal(
    buildCommitMessage("2026-05-14", "Local Dashboard"),
    "2026-05-14 new article written by Celan - Local Dashboard",
  );
});

test("resolveUniquePostFile appends numeric suffixes for duplicate slugs", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "article-dashboard-"));
  fs.writeFileSync(path.join(dir, "hello-world.mdx"), "existing");
  fs.writeFileSync(path.join(dir, "hello-world-2.mdx"), "existing");

  const result = resolveUniquePostFile(dir, "hello-world");
  assert.equal(result.slug, "hello-world-3");
  assert.equal(result.filePath, path.join(dir, "hello-world-3.mdx"));
});

test("saveUploadedImage writes an allowed image with a public path", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "article-dashboard-image-"));
  const result = saveUploadedImage({
    fileName: "A cat photo.PNG",
    contentType: "image/png",
    content: Buffer.from("png"),
  }, root);

  assert.deepEqual(result, {
    ok: true,
    fileName: "a-cat-photo.png",
    filePath: path.join("public", "images", "a-cat-photo.png"),
    publicPath: "/images/a-cat-photo.png",
  });
  assert.equal(fs.readFileSync(path.join(root, result.filePath), "utf8"), "png");
});

test("saveUploadedImage suffixes duplicate image names", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "article-dashboard-image-"));
  saveUploadedImage({ fileName: "cat.png", contentType: "image/png", content: Buffer.from("one") }, root);

  assert.equal(
    saveUploadedImage({ fileName: "cat.png", contentType: "image/png", content: Buffer.from("two") }, root).fileName,
    "cat-2.png",
  );
});

test("saveUploadedImage rejects mismatched image uploads", () => {
  assert.throws(
    () => saveUploadedImage({ fileName: "script.svg", contentType: "image/png", content: Buffer.from("x") }),
    /이미지 파일 형식/,
  );
});

test("POST /api/images stores an image and returns its public path", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "article-dashboard-server-"));
  const server = createServer(root);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/images`, {
      method: "POST",
      headers: { "content-type": "image/png", "x-file-name": "drop.png" },
      body: Buffer.from("png"),
    });

    assert.deepEqual(await response.json(), {
      ok: true,
      fileName: "drop.png",
      filePath: path.join("public", "images", "drop.png"),
      publicPath: "/images/drop.png",
    });

    const rejected = await fetch(`http://127.0.0.1:${port}/api/images`, {
      method: "POST",
      headers: { "content-type": "image/png", "x-file-name": "blocked.png", origin: "https://evil.example" },
      body: Buffer.from("png"),
    });
    assert.equal(rejected.status, 403);
    assert.equal(fs.existsSync(path.join(root, "public", "images", "blocked.png")), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

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

test("saveDraft writes an ignored local draft without committing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "article-dashboard-root-"));
  const result = saveDraft({
    title: "Draft: Local Note",
    date: "2026-05-14",
    category: "life",
    tags: "memo, local",
    links: "",
    description: "A local draft",
    body: "# Draft\n\n임시저장 본문입니다.",
  }, root, new Date("2026-05-14T00:00:00+09:00"));

  assert.equal(result.ok, true);
  assert.equal(result.slug, "draft-local-note");
  assert.equal(result.filePath, path.join(".article-drafts", "draft-local-note.mdx"));
  assert.equal(
    fs.readFileSync(path.join(root, result.filePath), "utf8"),
    buildMdxDocument({
      title: "Draft: Local Note",
      date: "2026-05-14",
      category: "life",
      tags: ["memo", "local"],
      links: [],
      description: "A local draft",
      body: "# Draft\n\n임시저장 본문입니다.",
    }),
  );
});


test("parseDraftMdx restores dashboard form fields from a saved draft", () => {
  const mdx = buildMdxDocument({
    title: "다시 불러올 글",
    date: "2026-05-18",
    category: "founder-notes",
    tags: ["draft", "local"],
    links: ["hello-world"],
    description: "불러오기 테스트",
    body: "# Draft\n\n다시 이어 쓸 본문입니다.",
  });

  assert.deepEqual(parseDraftMdx(mdx), {
    title: "다시 불러올 글",
    date: "2026-05-18",
    category: "founder-notes",
    tags: "draft, local",
    links: "hello-world",
    description: "불러오기 테스트",
    body: "# Draft\n\n다시 이어 쓸 본문입니다.",
  });
});

test("listDrafts and loadDraft expose ignored local drafts for the dashboard", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "article-dashboard-drafts-"));
  const first = saveDraft({
    title: "First Draft",
    date: "2026-05-17",
    category: "build-log",
    tags: "first",
    links: "",
    description: "첫 번째",
    body: "# First\n\n본문",
  }, root, new Date("2026-05-17T00:00:00+09:00"));
  const second = saveDraft({
    title: "Second Draft",
    date: "2026-05-18",
    category: "engineering",
    tags: "second, test",
    links: "first-draft",
    description: "두 번째",
    body: "# Second\n\n이어 쓰는 본문",
  }, root, new Date("2026-05-18T00:00:00+09:00"));

  fs.utimesSync(path.join(root, first.filePath), new Date("2026-05-17T00:00:00Z"), new Date("2026-05-17T00:00:00Z"));
  fs.utimesSync(path.join(root, second.filePath), new Date("2026-05-18T00:00:00Z"), new Date("2026-05-18T00:00:00Z"));

  const drafts = listDrafts(root);
  assert.equal(drafts.length, 2);
  assert.equal(drafts[0].fileName, "second-draft.mdx");
  assert.equal(drafts[0].title, "Second Draft");
  assert.equal(drafts[0].filePath, path.join(".article-drafts", "second-draft.mdx"));

  assert.deepEqual(loadDraft("second-draft.mdx", root), {
    ok: true,
    fileName: "second-draft.mdx",
    filePath: path.join(".article-drafts", "second-draft.mdx"),
    article: {
      title: "Second Draft",
      date: "2026-05-18",
      category: "engineering",
      tags: "second, test",
      links: "first-draft",
      description: "두 번째",
      body: "# Second\n\n이어 쓰는 본문",
    },
  });

  fs.mkdirSync(path.join(root, "content", "posts"), { recursive: true });
  fs.writeFileSync(path.join(root, "content", "posts", "second-draft.mdx"), "published", "utf8");
  assert.equal(
    loadDraft("second-draft.mdx", root).article.sourcePath,
    path.join("content", "posts", "second-draft.mdx"),
  );

  assert.throws(() => loadDraft("../secret.mdx", root), /선택/);
});

test("publishPost updates the loaded source post instead of creating a duplicate", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "article-dashboard-publish-"));
  const postsDirectory = path.join(root, "content", "posts");
  fs.mkdirSync(postsDirectory, { recursive: true });
  const existingPath = path.join(postsDirectory, "architecture-guidance-and-the-rules-1.mdx");
  fs.writeFileSync(existingPath, "old article", "utf8");
  const calls = [];

  const result = await publishPost({
    title: "Architecture, Guidance, and the Rules (1)",
    date: "2026-06-09",
    category: "engineering",
    tags: "AI-Harness, Architecture",
    links: "",
    description: "업데이트 테스트",
    body: "# Updated\n\n기존 글을 업데이트합니다.",
    sourcePath: path.join("content", "posts", "architecture-guidance-and-the-rules-1.mdx"),
  }, root, new Date("2026-06-09T00:00:00+09:00"), async (command, args, cwd) => {
    calls.push({ command, args, cwd });
    return `$ ${command} ${args.join(" ")}`;
  });

  assert.equal(result.ok, true);
  assert.equal(result.slug, "architecture-guidance-and-the-rules-1");
  assert.equal(result.filePath, path.join("content", "posts", "architecture-guidance-and-the-rules-1.mdx"));
  assert.equal(fs.existsSync(path.join(postsDirectory, "architecture-guidance-and-the-rules-1-2.mdx")), false);
  assert.match(fs.readFileSync(existingPath, "utf8"), /# Updated/);
  assert.deepEqual(calls.map((call) => [call.command, call.args]), [
    ["npm", ["run", "build"]],
    ["git", ["add", "--", path.join("content", "posts", "architecture-guidance-and-the-rules-1.mdx")]],
    ["git", ["commit", "-m", "2026-06-09 new article written by Celan - Architecture, Guidance, and the Rules (1)"]],
    ["git", ["push"]],
  ]);
});

test("publishPost stages image assets referenced by the article body", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "article-dashboard-publish-image-"));
  const imagesDirectory = path.join(root, "public", "images");
  fs.mkdirSync(imagesDirectory, { recursive: true });
  fs.writeFileSync(path.join(imagesDirectory, "drop.png"), "png", "utf8");
  const calls = [];

  await publishPost({
    title: "Post with an image",
    date: "2026-07-10",
    category: "engineering",
    tags: "",
    links: "",
    description: "이미지 stage 테스트",
    body: "본문\n\n![drop](/images/drop.png)",
  }, root, new Date("2026-07-10T00:00:00+09:00"), async (command, args, cwd) => {
    calls.push({ command, args, cwd });
    return `$ ${command} ${args.join(" ")}`;
  });

  assert.deepEqual(calls.find((call) => call.command === "git" && call.args[0] === "add").args, [
    "add",
    "--",
    path.join("content", "posts", "post-with-an-image.mdx"),
    path.join("public", "images", "drop.png"),
  ]);
});
