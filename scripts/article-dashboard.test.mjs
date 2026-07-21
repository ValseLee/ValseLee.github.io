import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";

import {
  buildCommitMessage,
  buildMdxDocument,
  createServer,
  createSlug,
  listDrafts,
  listPortfolioDrafts,
  loadDraft,
  loadPortfolioDraft,
  mergePortfolioProject,
  normalizePortfolioContent,
  normalizePortfolioProject,
  parseCommaList,
  parseDraftMdx,
  publishPost,
  publishPortfolioProject,
  renderMarkdownPreview,
  resolveUniquePostFile,
  saveDraft,
  savePortfolioDraft,
  savePortfolioMedia,
  saveUploadedImage,
  validatePortfolioMediaUpload,
} from "./article-dashboard.mjs";

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
    [{ ...valid, name: "" }, /name/i],
    [{ ...valid, name: "n".repeat(121) }, /name.*120/i],
    [{ ...valid, period: "" }, /period/i],
    [{ ...valid, period: "p".repeat(81) }, /period.*80/i],
    [{ ...valid, descriptionMarkdown: "" }, /descriptionMarkdown/i],
    [{ ...valid, descriptionMarkdown: "d".repeat(50_001) }, /descriptionMarkdown.*50000/i],
    [{ ...valid, media: [{ ...valid.media[0], caption: "" }] }, /media\[0\]\.caption/i],
    [{ ...valid, media: [{ ...valid.media[0], caption: "c".repeat(301) }] }, /media\[0\]\.caption.*300/i],
    [{ ...valid, media: [{ ...valid.media[0], alt: "" }] }, /media\[0\]\.alt/i],
    [{ ...valid, media: [{ ...valid.media[0], src: "/portfolio/../home.png" }] }, /media\[0\]\.src/i],
    [{ ...valid, media: [{ ...valid.media[0], src: "/portfolio/home.txt" }] }, /media\[0\]\.src/i],
    [{ ...valid, media: [{ kind: "image", src: "/portfolio/demo.mp4", caption: "Demo", alt: "Demo" }] }, /media\[0\]\.kind/i],
    [{ ...valid, media: Array.from({ length: 21 }, () => valid.media[0]) }, /media/i],
  ];

  for (const [input, error] of cases) assert.throws(() => normalizePortfolioProject(input), error);
  assert.throws(() => normalizePortfolioProject(null), /project/i);
  assert.throws(() => normalizePortfolioContent({ projects: [valid, valid] }), /duplicate.*slug/i);
});

test("savePortfolioMedia stores MP4 uploads and suffixes collisions", (t) => {
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
  assert.deepEqual(fs.readdirSync(path.join(root, "public", "portfolio")).sort(), ["demo-reel-2.mp4", "demo-reel.mp4"]);
});

test("savePortfolioMedia removes partial temporary files and preserves collision targets on failure", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-media-failure-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const upload = { fileName: "Demo.mp4", contentType: "video/mp4", content: Buffer.from("replacement") };
  savePortfolioMedia({ ...upload, content: Buffer.from("original") }, root);
  const directory = path.join(root, "public", "portfolio");
  const writeFileSync = fs.writeFileSync.bind(fs);
  t.mock.method(fs, "writeFileSync", (filePath, content, options) => {
    if (path.dirname(filePath) === directory) {
      writeFileSync(filePath, content.subarray(0, 1), options);
      throw new Error("simulated write failure");
    }
    return writeFileSync(filePath, content, options);
  });

  assert.throws(() => savePortfolioMedia(upload, root), /simulated write failure/);
  assert.equal(fs.readFileSync(path.join(directory, "demo.mp4"), "utf8"), "original");
  assert.deepEqual(fs.readdirSync(directory), ["demo.mp4"]);
});

test("validatePortfolioMediaUpload accepts supported extension and MIME pairs", () => {
  const allowed = [
    ["image.png", "image/png", "image"],
    ["image.jpg", "image/jpeg", "image"],
    ["image.jpeg", "image/jpeg", "image"],
    ["image.gif", "image/gif", "image"],
    ["image.webp", "image/webp", "image"],
    ["image.avif", "image/avif", "image"],
    ["image.svg", "image/svg+xml", "image"],
    ["demo.mp4", "video/mp4", "video"],
  ];

  for (const [fileName, contentType, kind] of allowed) {
    assert.equal(validatePortfolioMediaUpload({ fileName, contentType, size: 1 }).kind, kind);
  }
});

test("validatePortfolioMediaUpload rejects unsafe, mismatched, unsupported, and oversized files", () => {
  const invalid = [
    [{ fileName: "../demo.mp4", contentType: "video/mp4", size: 1 }, /unsafe/i],
    [{ fileName: "image.png", contentType: "video/mp4", size: 1 }, /content-type.*extension/i],
    [{ fileName: "notes.txt", contentType: "text/plain", size: 1 }, /unsupported/i],
    [{ fileName: "image.png", contentType: "image/png", size: 0 }, /size/i],
    [{ fileName: "image.png", contentType: "image/png", size: 10 * 1024 * 1024 + 1 }, /10 MiB/i],
    [{ fileName: "demo.mp4", contentType: "video/mp4", size: 50 * 1024 * 1024 + 1 }, /50 MiB/i],
  ];

  for (const [input, error] of invalid) assert.throws(() => validatePortfolioMediaUpload(input), error);
});

test("portfolio drafts round-trip and failed replacement preserves the previous draft", (t) => {
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
  const draftsDirectory = path.join(root, ".portfolio-drafts");
  const filePath = path.join(draftsDirectory, saved.fileName);
  const previousBytes = fs.readFileSync(filePath);
  assert.deepEqual(loadPortfolioDraft(saved.fileName, root), project);
  assert.deepEqual(listPortfolioDrafts(root), [{
    fileName: "loutine.json",
    name: "Loutine",
    updatedAt: "2026-07-21T00:00:00.000Z",
  }]);

  assert.throws(() => savePortfolioDraft({ ...project, media: [{ ...project.media[0], caption: "" }] }, root), /caption/i);
  assert.deepEqual(fs.readFileSync(filePath), previousBytes);

  const temporaryPath = `${filePath}.tmp`;
  fs.mkdirSync(temporaryPath);
  assert.throws(() => savePortfolioDraft({ ...project, name: "Replacement" }, root), /EISDIR|directory/i);
  assert.deepEqual(fs.readFileSync(filePath), previousBytes);
  assert.equal(fs.existsSync(temporaryPath), false);

  fs.writeFileSync(path.join(draftsDirectory, "broken.json"), "{");
  assert.equal(listPortfolioDrafts(root).some(({ fileName, name }) => fileName === "broken.json" && name === "broken"), true);
  assert.throws(() => loadPortfolioDraft("broken.json", root), (error) => {
    assert.match(error.message, /malformed or invalid/i);
    assert.doesNotMatch(error.message, new RegExp(root));
    return true;
  });
  fs.writeFileSync(path.join(draftsDirectory, "invalid.json"), JSON.stringify({ ...project, period: "" }));
  assert.throws(() => loadPortfolioDraft("invalid.json", root), /period is required/i);
  fs.mkdirSync(path.join(draftsDirectory, "unreadable.json"));
  assert.throws(() => loadPortfolioDraft("unreadable.json", root), (error) => {
    assert.match(error.message, /could not be read/i);
    assert.doesNotMatch(error.message, new RegExp(root));
    return true;
  });
  assert.throws(() => loadPortfolioDraft("../secret.json", root), /draft file/i);
});

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
  if (content !== undefined) {
    fs.mkdirSync(path.join(root, "content"), { recursive: true });
    fs.writeFileSync(path.join(root, "content", "portfolio.json"), `${JSON.stringify(content, null, 2)}\n`);
  }
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

async function startPortfolioServer(t, root) {
  const server = createServer(root, { mode: "portfolio" });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test("publishPortfolioProject updates by slug and stages only canonical JSON and referenced media", async (t) => {
  const root = createPortfolioRoot(t, {
    projects: [portfolioProject({ slug: "first", name: "First" }), portfolioProject({ slug: "loutine", name: "Old" })],
  });
  fs.mkdirSync(path.join(root, "public", "portfolio"), { recursive: true });
  fs.writeFileSync(path.join(root, "public", "portfolio", "demo.mp4"), "mp4");
  const calls = [];
  const runner = async (command, args, cwd) => {
    calls.push({ command, args, cwd });
    return `$ ${command} ${args.join(" ")}`;
  };
  assert.deepEqual(
    mergePortfolioProject({ projects: [portfolioProject({ slug: "first", name: "First" }), portfolioProject({ name: "Old" })] }, portfolioProject()).projects.map(({ name }) => name),
    ["First", "Loutine"],
  );

  const result = await publishPortfolioProject(
    portfolioProject({ slug: "loutine", name: "Loutine", media: [{ kind: "video", src: "/portfolio/demo.mp4", caption: "Demo" }] }),
    root,
    new Date("2026-07-21T00:00:00.000Z"),
    runner,
  );

  assert.equal(result.committed, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, "content", "portfolio.json"), "utf8")).projects.map(({ slug }) => slug), ["first", "loutine"]);
  assert.deepEqual(calls.map(({ command, args, cwd }) => [command, args, cwd]), [
    ["git", ["diff", "--cached", "--quiet", "--", "content/portfolio.json", "public/portfolio/demo.mp4"], root],
    ["npm", ["run", "build"], root],
    ["git", ["add", "--", "content/portfolio.json", "public/portfolio/demo.mp4"], root],
    ["git", ["commit", "--only", "-m", "2026-07-21 update portfolio - Loutine", "--", "content/portfolio.json", "public/portfolio/demo.mp4"], root],
    ["git", ["push"], root],
  ]);
});

test("publishPortfolioProject commits only portfolio paths and rejects staged overlap", async (t) => {
  const root = createPortfolioRoot(t, { projects: [portfolioProject({ name: "Old" })] });
  fs.writeFileSync(path.join(root, "unrelated.txt"), "base\n");
  git(root, ["init", "-q"]);
  git(root, ["config", "user.name", "Dashboard Test"]);
  git(root, ["config", "user.email", "dashboard@example.com"]);
  git(root, ["add", "."]);
  git(root, ["commit", "-qm", "base"]);
  fs.writeFileSync(path.join(root, "unrelated.txt"), "staged user work\n");
  git(root, ["add", "unrelated.txt"]);
  const runner = async (command, args, cwd) => {
    if (command === "npm" || (command === "git" && args[0] === "push")) return `$ ${command} ${args.join(" ")}`;
    return `$ ${command} ${args.join(" ")}\n${git(cwd, args)}`.trim();
  };

  const result = await publishPortfolioProject(portfolioProject({ name: "Published" }), root, new Date("2026-07-21"), runner);

  assert.equal(result.ok, true);
  assert.equal(git(root, ["show", "--format=", "--name-only", "HEAD"]), "content/portfolio.json");
  assert.equal(git(root, ["diff", "--cached", "--name-only"]), "unrelated.txt");
  assert.equal(git(root, ["show", "HEAD:unrelated.txt"]), "base");

  const canonicalPath = path.join(root, "content", "portfolio.json");
  fs.writeFileSync(canonicalPath, `${JSON.stringify({ projects: [portfolioProject({ name: "Staged user edit" })] }, null, 2)}\n`);
  git(root, ["add", "content/portfolio.json"]);
  const stagedBytes = fs.readFileSync(canonicalPath);
  const headBeforeOverlap = git(root, ["rev-parse", "HEAD"]);

  const blocked = await publishPortfolioProject(portfolioProject({ name: "Must not replace" }), root, new Date("2026-07-21"), runner);

  assert.equal(blocked.ok, false);
  assert.equal(blocked.committed, false);
  assert.match(blocked.error, /staged.*portfolio/i);
  assert.equal(git(root, ["rev-parse", "HEAD"]), headBeforeOverlap);
  assert.deepEqual(fs.readFileSync(canonicalPath), stagedBytes);
  assert.match(git(root, ["diff", "--cached", "--name-only"]), /content\/portfolio\.json/);
});

test("publishPortfolioProject returns before commands when canonical bytes are unchanged", async (t) => {
  const project = portfolioProject();
  const root = createPortfolioRoot(t, { projects: [project] });
  const calls = [];
  const result = await publishPortfolioProject(project, root, new Date("2026-07-21"), async (...args) => {
    calls.push(args);
    return "unexpected";
  });

  assert.equal(result.ok, true);
  assert.equal(result.committed, false);
  assert.deepEqual(calls, []);
});

test("publishPortfolioProject restores canonical state before commit and keeps a commit after push failure", async (t) => {
  const root = createPortfolioRoot(t, { projects: [portfolioProject({ name: "Old" })] });
  const filePath = path.join(root, "content", "portfolio.json");
  const previousBytes = fs.readFileSync(filePath);
  const failingBuild = async (command, args) => {
    if (command === "npm") throw new Error("build failed");
    return `$ ${command} ${args.join(" ")}`;
  };

  const buildResult = await publishPortfolioProject(portfolioProject({ name: "New" }), root, new Date("2026-07-21"), failingBuild);
  assert.equal(buildResult.committed, false);
  assert.deepEqual(fs.readFileSync(filePath), previousBytes);

  const newRoot = createPortfolioRoot(t);
  const newFilePath = path.join(newRoot, "content", "portfolio.json");
  const newBuildResult = await publishPortfolioProject(portfolioProject(), newRoot, new Date("2026-07-21"), failingBuild);
  assert.equal(newBuildResult.committed, false);
  assert.equal(fs.existsSync(newFilePath), false);

  const blockedRoot = createPortfolioRoot(t, { projects: [portfolioProject({ name: "Old" })] });
  const blockedFilePath = path.join(blockedRoot, "content", "portfolio.json");
  const blockedBytes = fs.readFileSync(blockedFilePath);
  fs.mkdirSync(`${blockedFilePath}.tmp`);
  const blockedResult = await publishPortfolioProject(portfolioProject({ name: "New" }), blockedRoot, new Date("2026-07-21"), async (command, args) => `$ ${command} ${args.join(" ")}`);
  assert.equal(blockedResult.ok, false);
  assert.deepEqual(fs.readFileSync(blockedFilePath), blockedBytes);

  const pushFailure = async (command, args) => {
    if (command === "git" && args[0] === "push") throw new Error("no upstream");
    return `$ ${command} ${args.join(" ")}`;
  };
  const pushResult = await publishPortfolioProject(portfolioProject({ name: "New" }), root, new Date("2026-07-21"), pushFailure);
  assert.equal(pushResult.committed, true);
  assert.match(pushResult.error, /no upstream/i);
  assert.equal(JSON.parse(fs.readFileSync(filePath, "utf8")).projects[0].name, "New");
});

test("portfolio mode serves the local dashboard and portfolio JSON APIs", async (t) => {
  const project = portfolioProject();
  const root = createPortfolioRoot(t, { projects: [project] });
  const origin = await startPortfolioServer(t, root);

  const dashboard = await fetch(`${origin}/`);
  const html = await dashboard.text();
  assert.equal(dashboard.status, 200);
  for (const id of ["project-select", "new-project", "name", "period-start", "period-end", "period-present", "description-markdown", "media-input", "media-rows", "draft-select", "load-draft", "save-draft", "publish", "preview", "status", "command-log"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /<input id="period-start" type="date" required/);
  assert.match(html, /<input id="period-end" type="date" required/);
  assert.match(html, /<input id="period-present" type="checkbox"/);
  assert.doesNotMatch(html, /id="article-form"/);
  const browserScript = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(browserScript);
  assert.doesNotThrow(() => new vm.Script(browserScript[1]));

  const canonical = await (await fetch(`${origin}/api/portfolio`)).json();
  assert.deepEqual(canonical, { ok: true, projects: [project] });

  const preview = await fetch(`${origin}/api/portfolio/preview`, {
    method: "POST",
    headers: { Origin: origin, "content-type": "application/json" },
    body: JSON.stringify({ markdown: "## Preview" }),
  });
  assert.match((await preview.json()).html, /<h2>Preview<\/h2>/);

  const saved = await fetch(`${origin}/api/portfolio/draft`, {
    method: "POST",
    headers: { Origin: origin, "content-type": "application/json" },
    body: JSON.stringify(project),
  });
  assert.equal(saved.status, 200);
  const drafts = await (await fetch(`${origin}/api/portfolio/drafts`)).json();
  assert.equal(drafts.drafts[0].fileName, "loutine.json");
  const loaded = await (await fetch(`${origin}/api/portfolio/draft?file=loutine.json`)).json();
  assert.deepEqual(loaded.project, project);
});

test("portfolio period controls retain their browser behavior", async (t) => {
  const project = portfolioProject({ period: "2026.01.02 — 2026.07.21" });
  const root = createPortfolioRoot(t, { projects: [project] });
  const origin = await startPortfolioServer(t, root);
  const html = await (await fetch(`${origin}/`)).text();
  const browserScript = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(browserScript);

  const createElement = () => {
    const listeners = new Map();
    return {
      value: "",
      checked: false,
      disabled: false,
      required: false,
      min: "",
      files: [],
      children: [],
      style: {},
      addEventListener(type, listener) { listeners.set(type, listener); },
      dispatch(type) { return listeners.get(type)?.({ preventDefault() {} }); },
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
    };
  };
  const selectors = ["portfolio-form", "project-select", "new-project", "name", "period-start", "period-end", "period-present", "description-markdown", "media-input", "media-rows", "draft-select", "load-draft", "save-draft", "publish", "preview", "status", "command-log"];
  const elements = new Map(selectors.map((id) => [`#${id}`, createElement()]));
  let formValid = false;
  let validityChecks = 0;
  elements.get("#portfolio-form").reportValidity = () => {
    validityChecks += 1;
    return formValid;
  };
  let confirmCalls = 0;
  const requests = [];
  let canonicalProject = project;
  let publishCount = 0;
  const browserFetch = async (url, options = {}) => {
    requests.push({ url, options });
    let result;
    if (url === "/api/portfolio") result = { ok: true, projects: [canonicalProject] };
    else if (url === "/api/portfolio/drafts") result = { ok: true, drafts: [] };
    else if (url === "/api/portfolio/preview") result = { ok: true, html: "<p>preview</p>" };
    else if (url === "/api/portfolio/draft" && options.method === "POST") {
      const submitted = JSON.parse(options.body);
      result = { ok: true, project: { ...submitted, slug: submitted.slug || "stable-project" } };
    } else if (url === "/api/portfolio/publish") {
      publishCount += 1;
      const submitted = JSON.parse(options.body);
      canonicalProject = { ...submitted, slug: submitted.slug || "stable-project" };
      result = publishCount === 1
        ? { ok: true, committed: true, slug: canonicalProject.slug, logs: [] }
        : { ok: false, committed: true, slug: canonicalProject.slug, error: "push failed", logs: [] };
    }
    else throw new Error(`Unexpected browser request: ${url}`);
    return { ok: true, status: 200, json: async () => result };
  };

  vm.runInNewContext(browserScript[1], {
    document: {
      querySelector: (selector) => elements.get(selector),
      createElement,
    },
    fetch: browserFetch,
    confirm: () => { confirmCalls += 1; return false; },
    structuredClone,
    clearTimeout() {},
    setTimeout(callback) { callback(); return 1; },
  });
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  await settle();

  const start = elements.get("#period-start");
  const end = elements.get("#period-end");
  const present = elements.get("#period-present");
  const preview = elements.get("#preview");
  assert.deepEqual(
    { start: start.value, end: end.value, present: present.checked, min: end.min, disabled: end.disabled, required: end.required },
    { start: "2026-01-02", end: "2026-07-21", present: false, min: "2026-01-02", disabled: false, required: true },
  );

  start.value = "2026-02-03";
  start.dispatch("input");
  end.value = "2026-08-22";
  end.dispatch("input");
  assert.equal(preview.children[1].textContent, "2026.02.03 — 2026.08.22");
  elements.get("#new-project").dispatch("click");
  assert.equal(confirmCalls, 1);
  assert.equal(start.value, "2026-02-03");

  end.value = "2026-01-01";
  end.dispatch("input");
  assert.equal(end.min, "2026-02-03");
  assert.equal(preview.children[1].textContent, "");

  present.checked = true;
  present.dispatch("change");
  assert.deepEqual(
    { end: end.value, disabled: end.disabled, required: end.required, preview: preview.children[1].textContent },
    { end: "", disabled: true, required: false, preview: "2026.02.03 — Present" },
  );

  const draftPosts = () => requests.filter(({ url, options }) => url === "/api/portfolio/draft" && options.method === "POST");
  elements.get("#save-draft").dispatch("click");
  assert.equal(validityChecks, 1);
  assert.equal(draftPosts().length, 0);

  formValid = true;
  elements.get("#save-draft").dispatch("click");
  await settle();
  assert.equal(validityChecks, 2);
  assert.equal(draftPosts().length, 1);
  assert.equal(JSON.parse(draftPosts()[0].options.body).period, "2026.02.03 — Present");

  elements.get("#new-project").dispatch("click");
  const name = elements.get("#name");
  const description = elements.get("#description-markdown");
  name.value = "First name";
  name.dispatch("input");
  description.value = "Description";
  description.dispatch("input");
  start.value = "2026-03-04";
  start.dispatch("input");
  present.checked = true;
  present.dispatch("change");
  elements.get("#save-draft").dispatch("click");
  await settle();

  name.value = "Renamed after save";
  name.dispatch("input");
  elements.get("#save-draft").dispatch("click");
  await settle();
  assert.equal(JSON.parse(draftPosts().at(-1).options.body).slug, "stable-project");

  const portfolioGetsBeforePublish = requests.filter(({ url }) => url === "/api/portfolio").length;
  elements.get("#portfolio-form").dispatch("submit");
  await settle();
  name.value = "Renamed after publish";
  name.dispatch("input");
  elements.get("#portfolio-form").dispatch("submit");
  await settle();

  const publishPosts = requests.filter(({ url }) => url === "/api/portfolio/publish");
  assert.equal(JSON.parse(publishPosts[1].options.body).slug, "stable-project");
  assert.equal(requests.filter(({ url }) => url === "/api/portfolio").length, portfolioGetsBeforePublish + 2);
});

test("portfolio mode stores and serves MP4 media and rejects cross-origin POST", async (t) => {
  const root = createPortfolioRoot(t, { projects: [] });
  const origin = await startPortfolioServer(t, root);
  const media = Buffer.from("mp4");

  const uploaded = await fetch(`${origin}/api/portfolio/media`, {
    method: "POST",
    headers: { Origin: origin, "content-type": "video/mp4", "x-file-name": "Demo.mp4" },
    body: media,
  });
  assert.equal(uploaded.status, 200);
  assert.deepEqual(await uploaded.json(), {
    ok: true,
    kind: "video",
    fileName: "demo.mp4",
    filePath: path.join(root, "public", "portfolio", "demo.mp4"),
    src: "/portfolio/demo.mp4",
  });

  const served = await fetch(`${origin}/portfolio/demo.mp4`);
  assert.equal(served.headers.get("content-type"), "video/mp4");
  assert.deepEqual(Buffer.from(await served.arrayBuffer()), media);

  const rejected = await fetch(`${origin}/api/portfolio/media`, {
    method: "POST",
    headers: { Origin: "https://evil.example", "content-type": "video/mp4", "x-file-name": "blocked.mp4" },
    body: media,
  });
  assert.equal(rejected.status, 403);
  assert.equal(fs.existsSync(path.join(root, "public", "portfolio", "blocked.mp4")), false);
});

test("portfolio endpoints reject invalid preview Markdown and oversized media before buffering", async (t) => {
  const root = createPortfolioRoot(t, { projects: [] });
  const origin = await startPortfolioServer(t, root);

  for (const [markdown, error] of [[null, /must be a string/i], ["x".repeat(50_001), /at most 50000/i]]) {
    const response = await fetch(`${origin}/api/portfolio/preview`, {
      method: "POST",
      headers: { Origin: origin, "content-type": "application/json" },
      body: JSON.stringify({ markdown }),
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, error);
  }

  const oversized = await new Promise((resolve, reject) => {
    const url = new URL("/api/portfolio/media", origin);
    const request = http.request(url, {
      method: "POST",
      headers: {
        Origin: origin,
        Connection: "close",
        "content-type": "video/mp4",
        "x-file-name": "too-large.mp4",
        "content-length": String(50 * 1024 * 1024 + 1),
      },
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        request.destroy();
        resolve({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks)) });
      });
    });
    const timeout = setTimeout(() => {
      request.destroy();
      reject(new Error("oversized media request was not rejected from Content-Length"));
    }, 1_000);
    request.on("response", () => clearTimeout(timeout));
    request.on("error", reject);
    request.flushHeaders();
  });

  assert.equal(oversized.status, 413);
  assert.match(oversized.body.error, /50 MiB/i);
  assert.equal(fs.existsSync(path.join(root, "public", "portfolio", "too-large.mp4")), false);
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
