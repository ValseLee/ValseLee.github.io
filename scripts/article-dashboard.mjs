import { execFile } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HOST = "127.0.0.1";
const DEFAULT_PORT = 4317;
const CATEGORIES = ["build-log", "founder-notes", "engineering", "life"];
const DEFAULT_CATEGORY = "build-log";
const VALID_CATEGORIES = new Set(CATEGORIES);

function todayString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function yamlString(value) {
  return `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function yamlArray(values) {
  return `[${values.map((value) => yamlString(value)).join(", ")}]`;
}

export function parseCommaList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function createSlug(title, date = new Date()) {
  const slug = String(title ?? "")
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC")
    .replace(/[’']/g, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || `post-${todayString(date)}`;
}

export function resolveUniquePostFile(postsDirectory, requestedSlug) {
  const baseSlug = requestedSlug || createSlug("");
  let slug = baseSlug;
  let index = 2;
  let filePath = path.join(postsDirectory, `${slug}.mdx`);

  while (fs.existsSync(filePath)) {
    slug = `${baseSlug}-${index}`;
    filePath = path.join(postsDirectory, `${slug}.mdx`);
    index += 1;
  }

  return { slug, filePath };
}

export function buildCommitMessage(date, title) {
  return `${date} new article written by Celan - ${title}`;
}

export function buildMdxDocument({ title, date, category, tags, links, description, body }) {
  const trimmedBody = String(body ?? "").trim();

  return [
    "---",
    `title: ${yamlString(title)}`,
    `date: ${yamlString(date)}`,
    `category: ${yamlString(category)}`,
    `tags: ${yamlArray(tags)}`,
    `links: ${yamlArray(links)}`,
    `description: ${yamlString(description)}`,
    "---",
    "",
    trimmedBody,
    "",
  ].join("\n");
}

function stripMarkdown(value) {
  return String(value ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[#>*_\-[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeArticleInput(rawInput, now = new Date()) {
  const title = String(rawInput.title ?? "").trim();
  const date = String(rawInput.date ?? todayString(now)).trim();
  const category = String(rawInput.category ?? DEFAULT_CATEGORY).trim();
  const body = String(rawInput.body ?? "").trim();
  const tags = parseCommaList(rawInput.tags);
  const links = parseCommaList(rawInput.links);
  const description = String(rawInput.description ?? "").trim() || stripMarkdown(body).slice(0, 160) || title;

  if (!title) throw new Error("제목을 입력해 주세요.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("날짜는 yyyy-MM-dd 형식이어야 합니다.");
  if (!VALID_CATEGORIES.has(category)) {
    throw new Error(`카테고리는 ${CATEGORIES.join(", ")} 중 하나여야 합니다.`);
  }
  if (!body) throw new Error("본문 Markdown을 입력해 주세요.");

  return { title, date, category, body, tags, links, description };
}

class CommandError extends Error {
  constructor(command, output) {
    super(`${command} failed`);
    this.command = command;
    this.output = output;
  }
}

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd, env: process.env, maxBuffer: 1024 * 1024 * 20 }, (error, stdout, stderr) => {
      const printable = `$ ${[command, ...args].join(" ")}\n${stdout}${stderr}`.trimEnd();
      if (error) {
        reject(new CommandError([command, ...args].join(" "), printable));
        return;
      }
      resolve(printable);
    });
  });
}

export function saveDraft(rawInput, root = process.cwd(), now = new Date()) {
  const article = normalizeArticleInput(rawInput, now);
  const draftsDirectory = path.join(root, ".article-drafts");
  fs.mkdirSync(draftsDirectory, { recursive: true });

  const slug = createSlug(article.title, now);
  const filePath = path.join(draftsDirectory, `${slug}.mdx`);
  const relativePath = path.relative(root, filePath);
  fs.writeFileSync(filePath, buildMdxDocument(article), "utf8");

  return {
    ok: true,
    slug,
    filePath: relativePath,
    message: "임시저장했습니다. 이 파일은 git commit/push 대상이 아닙니다.",
  };
}


function readYamlValue(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed.replace(/^"|"$/g, "");
  }
}

export function parseDraftMdx(mdx) {
  const match = String(mdx ?? "").match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error("임시저장 파일 형식이 올바르지 않습니다.");

  const frontmatter = {};
  for (const line of match[1].split("\n")) {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (field) frontmatter[field[1]] = readYamlValue(field[2]);
  }

  return {
    title: String(frontmatter.title ?? ""),
    date: String(frontmatter.date ?? todayString()),
    category: VALID_CATEGORIES.has(String(frontmatter.category)) ? String(frontmatter.category) : DEFAULT_CATEGORY,
    tags: Array.isArray(frontmatter.tags) ? frontmatter.tags.join(", ") : String(frontmatter.tags ?? ""),
    links: Array.isArray(frontmatter.links) ? frontmatter.links.join(", ") : String(frontmatter.links ?? ""),
    description: String(frontmatter.description ?? ""),
    body: match[2].replace(/^\n/, "").replace(/\n$/, ""),
  };
}

function getDraftsDirectory(root) {
  return path.join(root, ".article-drafts");
}

function normalizeDraftFileName(fileName) {
  const baseName = path.basename(String(fileName ?? ""));
  if (!baseName || baseName !== fileName || !baseName.endsWith(".mdx")) {
    throw new Error("불러올 임시저장 파일을 선택해 주세요.");
  }
  return baseName;
}

export function listDrafts(root = process.cwd()) {
  const draftsDirectory = getDraftsDirectory(root);
  if (!fs.existsSync(draftsDirectory)) return [];

  return fs.readdirSync(draftsDirectory)
    .filter((fileName) => fileName.endsWith(".mdx"))
    .map((fileName) => {
      const filePath = path.join(draftsDirectory, fileName);
      const stats = fs.statSync(filePath);
      let title = fileName.replace(/\.mdx$/, "");
      try {
        title = parseDraftMdx(fs.readFileSync(filePath, "utf8")).title || title;
      } catch {
        // Keep a malformed draft visible so the user can decide what to do with it.
      }

      return {
        fileName,
        filePath: path.relative(root, filePath),
        title,
        updatedAt: stats.mtime.toISOString(),
      };
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function loadDraft(fileName, root = process.cwd()) {
  const safeFileName = normalizeDraftFileName(fileName);
  const filePath = path.join(getDraftsDirectory(root), safeFileName);
  if (!fs.existsSync(filePath)) throw new Error("임시저장 파일을 찾을 수 없습니다.");
  const sourcePath = path.join("content", "posts", safeFileName);
  const sourceFilePath = path.join(root, sourcePath);
  const article = parseDraftMdx(fs.readFileSync(filePath, "utf8"));
  if (fs.existsSync(sourceFilePath)) article.sourcePath = sourcePath;

  return {
    ok: true,
    fileName: safeFileName,
    filePath: path.relative(root, filePath),
    article,
  };
}

function normalizeSourcePath(sourcePath, root) {
  const value = String(sourcePath ?? "").trim();
  if (!value) return "";

  const normalized = path.normalize(value);
  const postsPrefix = `content${path.sep}posts${path.sep}`;
  if (path.isAbsolute(normalized) || normalized.startsWith("..") || !normalized.startsWith(postsPrefix) || !normalized.endsWith(".mdx")) {
    throw new Error("업데이트 대상 글 경로가 올바르지 않습니다.");
  }

  const absolutePath = path.join(root, normalized);
  if (!fs.existsSync(absolutePath)) throw new Error("업데이트 대상 글을 찾을 수 없습니다.");
  return normalized;
}

export async function publishPost(rawInput, root = process.cwd(), now = new Date(), runner = runCommand) {
  const article = normalizeArticleInput(rawInput, now);
  const postsDirectory = path.join(root, "content", "posts");
  fs.mkdirSync(postsDirectory, { recursive: true });

  const requestedSlug = createSlug(article.title, now);
  const sourcePath = normalizeSourcePath(rawInput.sourcePath, root);
  const target = sourcePath
    ? { slug: path.basename(sourcePath, ".mdx"), filePath: path.join(root, sourcePath), created: false }
    : { ...resolveUniquePostFile(postsDirectory, requestedSlug), created: true };
  const { slug, filePath } = target;
  const relativePath = path.relative(root, filePath);
  const mdx = buildMdxDocument(article);
  const commitMessage = buildCommitMessage(article.date, article.title);
  const logs = [];
  let committed = false;

  fs.writeFileSync(filePath, mdx, "utf8");

  try {
    for (const [command, args] of [
      ["npm", ["run", "verify:content"]],
      ["npm", ["run", "build"]],
      ["git", ["add", "--", relativePath]],
      ["git", ["commit", "-m", commitMessage]],
      ["git", ["push"]],
    ]) {
      const output = await runner(command, args, root);
      logs.push(output);
      if (command === "git" && args[0] === "commit") committed = true;
    }
  } catch (error) {
    if (!committed) {
      try {
        await runner("git", ["restore", "--staged", "--", relativePath], root);
      } catch {
        // The path may not have been staged yet.
      }
      if (target.created) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          // If cleanup fails, surface the original command error.
        }
      }
    }

    if (error instanceof CommandError) {
      logs.push(error.output);
      return {
        ok: false,
        committed,
        slug,
        filePath: relativePath,
        commitMessage,
        error: committed
          ? "커밋은 생성됐지만 push가 실패했습니다. 로그를 확인해 주세요."
          : target.created
            ? "저장/검증/커밋 중 실패했습니다. 새 글 파일은 정리했습니다."
            : "저장/검증/커밋 중 실패했습니다. 업데이트한 글 파일을 확인해 주세요.",
        logs,
      };
    }

    throw error;
  }

  return { ok: true, committed: true, slug, filePath: relativePath, commitMessage, logs };
}

function renderDashboard(root) {
  const today = todayString();
  const sampleBody = `# 새 글 제목\n\n여기에 Markdown으로 본문을 작성하세요.\n\n## 메모\n\n- 핵심 주장\n- 예시\n- 다음 액션`;

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Celan Article Dashboard</title>
  <style>
    :root { --background:#0A0A0A; --foreground:#FAFAFA; --subtext:#A1A1A1; --accent:#FFFFFF; --border:#262626; --panel:#111111; --danger:#ff8a8a; --ok:#a7f3d0; }
    * { box-sizing: border-box; }
    body { margin:0; background:var(--background); color:var(--foreground); font-family:Figtree, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .shell { min-height:100vh; max-width:1120px; margin:0 auto; padding:0 24px 48px; }
    header { padding:32px 0 26px; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:18px; }
    nav { display:flex; flex-wrap:wrap; gap:16px; }
    nav a, .ghost { color:var(--subtext); text-decoration:none; font-size:14px; letter-spacing:.03em; }
    nav a.active { color:var(--accent); }
    .ghost { font-family:ui-monospace, SFMono-Regular, Menlo, monospace; }
    .hero { padding:42px 0 34px; border-top:1px solid var(--border); }
    h1, h2, h3 { font-family:Cormorant Garamond, Georgia, serif; margin:0; color:var(--accent); }
    h1 { font-size:clamp(48px, 8vw, 92px); line-height:.92; letter-spacing:-.045em; max-width:780px; }
    .hero p { color:var(--subtext); max-width:620px; line-height:1.75; font-size:17px; margin:22px 0 0; }
    .grid { display:grid; grid-template-columns:minmax(0, 1fr) 390px; gap:24px; align-items:start; }
    form, .preview, .log { background:linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.015)); border:1px solid var(--border); border-radius:24px; padding:22px; }
    .field { margin-bottom:16px; }
    label { display:block; color:var(--subtext); font-size:12px; letter-spacing:.08em; text-transform:uppercase; margin-bottom:8px; }
    input, select, textarea { width:100%; border:1px solid var(--border); border-radius:14px; background:#090909; color:var(--foreground); padding:12px 14px; font:inherit; outline:none; }
    input:focus, select:focus, textarea:focus { border-color:#555; }
    textarea { min-height:520px; resize:vertical; line-height:1.65; font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:14px; }
    .row { display:grid; grid-template-columns:1fr 150px; gap:12px; }
    .draft-tools { display:grid; grid-template-columns:minmax(0, 1fr) auto; gap:12px; align-items:end; margin:4px 0 16px; }
    .draft-tools .field { margin-bottom:0; }
    .actions { display:flex; flex-wrap:wrap; gap:12px; align-items:center; margin-top:18px; }
    button { border:0; border-radius:999px; background:var(--accent); color:#050505; padding:12px 18px; font-weight:650; cursor:pointer; }
    button.secondary { background:transparent; color:var(--foreground); border:1px solid var(--border); }
    button:disabled { cursor:not-allowed; opacity:.5; }
    .note { color:var(--subtext); font-size:13px; line-height:1.55; }
    .preview { position:sticky; top:18px; }
    .preview h2 { font-size:34px; line-height:1.05; margin-bottom:10px; }
    .meta { color:var(--subtext); font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px; margin-bottom:22px; }
    .markdown { color:var(--foreground); line-height:1.75; overflow-wrap:anywhere; }
    .markdown h1, .markdown h2, .markdown h3 { margin:24px 0 12px; letter-spacing:-.02em; }
    .markdown h1 { font-size:38px; }.markdown h2 { font-size:28px; }.markdown h3 { font-size:22px; }
    .markdown p { margin:0 0 16px; }.markdown code { background:var(--border); padding:2px 6px; border-radius:6px; }
    .markdown pre { background:var(--border); padding:14px; border-radius:14px; overflow:auto; }
    .markdown blockquote { border-left:2px solid var(--subtext); margin:16px 0; padding-left:14px; color:var(--subtext); }
    .status { margin-top:18px; white-space:pre-wrap; font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px; line-height:1.55; color:var(--subtext); }
    .status.ok { color:var(--ok); }.status.error { color:var(--danger); }
    .log { margin-top:24px; display:none; }
    .log pre { white-space:pre-wrap; overflow:auto; margin:0; color:var(--subtext); font-size:12px; line-height:1.55; }
    @media (max-width: 900px) { .grid { grid-template-columns:1fr; } .preview { position:static; } }
  </style>
</head>
<body>
  <div class="shell">
    <header>
      <nav>
        <a href="/">[ Home ]</a>
        <a href="/archive">[ Archive ]</a>
        <a href="/categories">[ Categories ]</a>
        <a href="/translations">[ Translations ]</a>
        <a class="active" href="/">[ Write ]</a>
      </nav>
      <span class="ghost">${escapeHtml(root)}</span>
    </header>

    <section class="hero">
      <h1>Write like the site already knows the article.</h1>
      <p>로컬 전용 작성 대시보드입니다. 저장 버튼을 누르면 MDX 파일을 만들고, 검증과 빌드를 통과한 뒤 지정된 커밋 메시지로 commit + push까지 실행합니다.</p>
    </section>

    <section class="grid">
      <form id="article-form">
        <div class="field">
          <label for="title">Post title</label>
          <input id="title" name="title" autocomplete="off" placeholder="글 제목" required />
        </div>
        <div class="row">
          <div class="field">
            <label for="date">Commit/Post date</label>
            <input id="date" name="date" type="date" value="${today}" required />
          </div>
          <div class="field">
            <label for="category">Category</label>
            <select id="category" name="category">
              ${CATEGORIES.map((category) => `<option value="${category}">${category}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="field">
          <label for="description">Description</label>
          <input id="description" name="description" placeholder="비워두면 본문에서 자동 생성" />
        </div>
        <div class="row">
          <div class="field">
            <label for="tags">Tags comma list</label>
            <input id="tags" name="tags" placeholder="Next.js, MDX, Essay" />
          </div>
          <div class="field">
            <label for="links">Links slugs</label>
            <input id="links" name="links" placeholder="hello-world" />
          </div>
        </div>
        <div class="field">
          <label for="body">Markdown body</label>
          <textarea id="body" name="body" required>${escapeHtml(sampleBody)}</textarea>
        </div>
        <div class="draft-tools">
          <div class="field">
            <label for="draft-file">Saved drafts</label>
            <select id="draft-file" name="draft-file">
              <option value="">임시저장 목록을 불러오는 중...</option>
            </select>
          </div>
          <button id="load-draft" type="button" class="secondary">불러오기</button>
        </div>
        <div class="actions">
          <button id="draft" type="button" class="secondary">임시저장</button>
          <button id="publish" type="submit">Save, commit & push</button>
          <span class="note">임시저장은 <code>.article-drafts/</code>에만 저장합니다. 커밋 메시지: <code>yyyy-MM-dd new article written by Celan - {POST_TITLE}</code></span>
        </div>
        <div id="status" class="status"></div>
      </form>

      <aside class="preview">
        <h2 id="preview-title">Untitled</h2>
        <div id="preview-meta" class="meta">${today} · ${DEFAULT_CATEGORY}</div>
        <article id="preview-body" class="markdown"></article>
      </aside>
    </section>

    <section id="log" class="log"><pre id="log-content"></pre></section>
  </div>

  <script>
    const form = document.querySelector("#article-form");
    const title = document.querySelector("#title");
    const date = document.querySelector("#date");
    const category = document.querySelector("#category");
    const description = document.querySelector("#description");
    const tags = document.querySelector("#tags");
    const links = document.querySelector("#links");
    const body = document.querySelector("#body");
    const previewTitle = document.querySelector("#preview-title");
    const previewMeta = document.querySelector("#preview-meta");
    const previewBody = document.querySelector("#preview-body");
    const status = document.querySelector("#status");
    const draftSelect = document.querySelector("#draft-file");
    const loadDraftButton = document.querySelector("#load-draft");
    const draftButton = document.querySelector("#draft");
    const button = document.querySelector("#publish");
    const log = document.querySelector("#log");
    const logContent = document.querySelector("#log-content");
    let currentSourcePath = "";

    function escapeHtml(value) {
      const entities = { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" };
      return String(value).replace(/[&<>"']/g, (char) => entities[char]);
    }

    function renderMarkdown(markdown) {
      const lines = markdown.split("\\n");
      let html = "";
      let inCode = false;
      let paragraph = [];
      const tick = String.fromCharCode(96);
      const fence = tick + tick + tick;
      const inlineCodePattern = new RegExp(tick + "([^" + tick + "]+)" + tick, "g");
      const flushParagraph = () => {
        if (paragraph.length) {
          html += "<p>" + escapeHtml(paragraph.join(" ")).replace(inlineCodePattern, "<code>$1</code>") + "</p>";
          paragraph = [];
        }
      };

      for (const line of lines) {
        if (line.startsWith(fence)) {
          if (inCode) html += "</code></pre>";
          else { flushParagraph(); html += "<pre><code>"; }
          inCode = !inCode;
          continue;
        }
        if (inCode) { html += escapeHtml(line) + "\\n"; continue; }
        if (!line.trim()) { flushParagraph(); continue; }
        if (line.startsWith("### ")) { flushParagraph(); html += "<h3>" + escapeHtml(line.slice(4)) + "</h3>"; continue; }
        if (line.startsWith("## ")) { flushParagraph(); html += "<h2>" + escapeHtml(line.slice(3)) + "</h2>"; continue; }
        if (line.startsWith("# ")) { flushParagraph(); html += "<h1>" + escapeHtml(line.slice(2)) + "</h1>"; continue; }
        if (line.startsWith("> ")) { flushParagraph(); html += "<blockquote>" + escapeHtml(line.slice(2)) + "</blockquote>"; continue; }
        if (line.startsWith("- ")) { flushParagraph(); html += "<p>• " + escapeHtml(line.slice(2)) + "</p>"; continue; }
        paragraph.push(line.trim());
      }
      flushParagraph();
      return html;
    }

    function updatePreview() {
      previewTitle.textContent = title.value.trim() || "Untitled";
      previewMeta.textContent = date.value + " · " + category.value;
      previewBody.innerHTML = renderMarkdown(body.value);
    }

    for (const element of [title, date, category, body]) element.addEventListener("input", updatePreview);
    updatePreview();

    function collectPayload() {
      return {
        title: title.value,
        date: date.value,
        category: category.value,
        description: description.value,
        tags: tags.value,
        links: links.value,
        body: body.value,
        sourcePath: currentSourcePath,
      };
    }

    function fillForm(article) {
      currentSourcePath = article.sourcePath || "";
      title.value = article.title || "";
      date.value = article.date || date.value;
      category.value = article.category || category.value;
      description.value = article.description || "";
      tags.value = article.tags || "";
      links.value = article.links || "";
      body.value = article.body || "";
      updatePreview();
    }

    function setDraftOptions(drafts) {
      draftSelect.innerHTML = "";
      if (!drafts.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "임시저장된 글이 없습니다";
        draftSelect.append(option);
        loadDraftButton.disabled = true;
        return;
      }

      for (const draft of drafts) {
        const option = document.createElement("option");
        option.value = draft.fileName;
        option.textContent = draft.title + " · " + new Date(draft.updatedAt).toLocaleString("ko-KR");
        draftSelect.append(option);
      }
      loadDraftButton.disabled = false;
    }

    async function refreshDrafts() {
      try {
        const response = await fetch("/api/drafts");
        const result = await response.json();
        if (!result.ok) throw new Error(result.error || "임시저장 목록을 불러오지 못했습니다.");
        setDraftOptions(result.drafts || []);
      } catch (error) {
        draftSelect.innerHTML = "";
        const option = document.createElement("option");
        option.value = "";
        option.textContent = error.message;
        draftSelect.append(option);
        loadDraftButton.disabled = true;
      }
    }

    loadDraftButton.addEventListener("click", async () => {
      if (!draftSelect.value) return;
      loadDraftButton.disabled = true;
      status.className = "status";
      status.textContent = "임시저장 글을 불러오는 중입니다...";
      log.style.display = "none";
      logContent.textContent = "";

      try {
        const response = await fetch("/api/draft?file=" + encodeURIComponent(draftSelect.value));
        const result = await response.json();
        status.className = result.ok ? "status ok" : "status error";
        if (!result.ok) throw new Error(result.error || "불러오기에 실패했습니다.");
        fillForm(result.article);
        status.textContent = "불러오기 완료: " + result.filePath;
      } catch (error) {
        status.className = "status error";
        status.textContent = error.message;
      } finally {
        loadDraftButton.disabled = !draftSelect.value;
      }
    });

    refreshDrafts();

    draftButton.addEventListener("click", async () => {
      draftButton.disabled = true;
      status.className = "status";
      status.textContent = "임시저장 중입니다...";
      log.style.display = "none";
      logContent.textContent = "";

      try {
        const response = await fetch("/api/draft", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(collectPayload()),
        });
        const result = await response.json();
        status.className = result.ok ? "status ok" : "status error";
        status.textContent = result.ok
          ? "임시저장 완료: " + result.filePath
          : (result.error || "임시저장에 실패했습니다.");
        if (result.ok) await refreshDrafts();
      } catch (error) {
        status.className = "status error";
        status.textContent = error.message;
      } finally {
        draftButton.disabled = false;
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      button.disabled = true;
      status.className = "status";
      status.textContent = "저장 중입니다. verify:content → build → git commit → git push 순서로 실행합니다...";
      log.style.display = "none";
      logContent.textContent = "";

      try {
        const response = await fetch("/api/publish", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(collectPayload()),
        });
        const result = await response.json();
        status.className = result.ok ? "status ok" : "status error";
        status.textContent = result.ok
          ? "저장 완료: " + result.filePath + "\\n" + result.commitMessage
          : (result.error || "실패했습니다.") + "\\n" + (result.commitMessage || "");
        log.style.display = "block";
        logContent.textContent = (result.logs || []).join("\\n\\n---\\n\\n");
      } catch (error) {
        status.className = "status error";
        status.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new Error("요청 본문이 너무 큽니다.");
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data, null, 2));
}

function createServer(root) {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://${HOST}`);

    if (request.method === "GET" && url.pathname === "/") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(renderDashboard(root));
      return;
    }

    if (request.method === "GET" && url.pathname === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/drafts") {
      try {
        sendJson(response, 200, { ok: true, drafts: listDrafts(root) });
      } catch (error) {
        sendJson(response, 500, { ok: false, error: error.message, drafts: [] });
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/draft") {
      try {
        const result = loadDraft(url.searchParams.get("file"), root);
        sendJson(response, 200, result);
      } catch (error) {
        sendJson(response, 400, { ok: false, error: error.message });
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/draft") {
      try {
        const body = await readJsonBody(request);
        const result = saveDraft(body, root);
        sendJson(response, 200, result);
      } catch (error) {
        sendJson(response, 400, { ok: false, error: error.message });
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/publish") {
      try {
        const body = await readJsonBody(request);
        const result = await publishPost(body, root);
        sendJson(response, result.ok ? 200 : 500, result);
      } catch (error) {
        sendJson(response, 400, { ok: false, error: error.message, logs: [] });
      }
      return;
    }

    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  });
}

function start() {
  const root = process.cwd();
  const port = Number(process.env.ARTICLE_DASHBOARD_PORT || DEFAULT_PORT);
  const server = createServer(root);

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. Stop the existing dashboard or run ARTICLE_DASHBOARD_PORT=${port + 1} npm run write.`);
      process.exit(1);
    }
    throw error;
  });

  server.listen(port, HOST, () => {
    console.log(`Article dashboard running at http://${HOST}:${port}`);
    console.log("Press Ctrl+C to stop.");
  });
}

const currentFile = pathToFileURL(fileURLToPath(import.meta.url)).href;
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === currentFile) {
  start();
}
