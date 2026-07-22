import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { micromark } from "micromark";
import {
  createSlug,
  mergePortfolioProject,
  normalizePortfolioContent,
  normalizePortfolioProject,
  normalizePortfolioSrc,
} from "../lib/portfolio.mjs";

export { createSlug, mergePortfolioProject, normalizePortfolioContent, normalizePortfolioProject };

const HOST = "127.0.0.1";
const DEFAULT_PORT = 4317;
const DEFAULT_PORTFOLIO_PORT = 4318;
const CATEGORIES = ["build-log", "founder-notes", "engineering", "life"];
const DEFAULT_CATEGORY = "build-log";
const VALID_CATEGORIES = new Set(CATEGORIES);
const IMAGE_TYPES = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".avif", "image/avif"],
  [".svg", "image/svg+xml"],
]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const PORTFOLIO_MEDIA_TYPES = new Map([
  ...[...IMAGE_TYPES].map(([extension, contentType]) => [extension, ["image", contentType, MAX_IMAGE_BYTES]]),
  [".mp4", ["video", "video/mp4", 50 * 1024 * 1024]],
]);
const PORTFOLIO_DRAFTS_DIRECTORY = ".portfolio-drafts";

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

export function renderMarkdownPreview(markdown) {
  return micromark(String(markdown ?? ""));
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

function portfolioJson(content) {
  return `${JSON.stringify(content, null, 2)}\n`;
}

function replaceFileAtomically(filePath, content) {
  const temporaryPath = `${filePath}.tmp`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    fs.writeFileSync(temporaryPath, content);
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    fs.rmSync(temporaryPath, { recursive: true, force: true });
    throw error;
  }
}

export async function publishPortfolioProject(rawProject, root = process.cwd(), now = new Date(), runner = runCommand) {
  const project = normalizePortfolioProject(rawProject);
  const relativeFilePath = path.join("content", "portfolio.json");
  const canonicalFilePath = path.join(root, relativeFilePath);
  const previousBytes = fs.existsSync(canonicalFilePath) ? fs.readFileSync(canonicalFilePath) : null;
  const current = previousBytes
    ? normalizePortfolioContent(JSON.parse(previousBytes.toString("utf8")))
    : { projects: [] };
  const nextBytes = Buffer.from(portfolioJson(mergePortfolioProject(current, project)));
  const commitMessage = `${now.toISOString().slice(0, 10)} update portfolio - ${project.name}`;
  const logs = [];

  if (previousBytes?.equals(nextBytes)) {
    return { ok: true, committed: false, slug: project.slug, filePath: relativeFilePath, commitMessage, logs };
  }

  const mediaSources = [project.coverImage?.src, ...project.media.map(({ src }) => src)].filter(Boolean);
  const mediaPaths = [...new Set(mediaSources.map((src) => path.join("public", src.slice(1))))];
  const stagedPaths = [relativeFilePath, ...mediaPaths];
  const modulesPath = path.join(root, "node_modules");
  const linkedModulesPath = fs.lstatSync(modulesPath, { throwIfNoEntry: false })?.isSymbolicLink()
    ? path.relative(root, fs.realpathSync(modulesPath))
    : "";
  const buildArgs = linkedModulesPath === ".." || linkedModulesPath.startsWith(`..${path.sep}`)
    ? ["run", "build", "--", "--webpack"]
    : ["run", "build"];
  let committed = false;

  try {
    await runner("git", ["diff", "--cached", "--quiet", "--", ...stagedPaths], root);
  } catch {
    const error = "staged portfolio changes must be committed or unstaged before publishing";
    return { ok: false, committed, slug: project.slug, filePath: relativeFilePath, commitMessage, error, logs: [error] };
  }

  try {
    replaceFileAtomically(canonicalFilePath, nextBytes);
    for (const [command, args] of [
      ["npm", buildArgs],
      ["git", ["add", "--", ...stagedPaths]],
      ["git", ["commit", "--only", "-m", commitMessage, "--", ...stagedPaths]],
      ["git", ["push"]],
    ]) {
      logs.push(await runner(command, args, root));
      if (command === "git" && args[0] === "commit") committed = true;
    }
  } catch (error) {
    if (!committed) {
      try {
        await runner("git", ["restore", "--staged", "--", ...stagedPaths], root);
      } catch {
        // The explicit paths may not have been staged yet.
      }
      if (previousBytes) replaceFileAtomically(canonicalFilePath, previousBytes);
      else fs.rmSync(canonicalFilePath, { force: true });
      fs.rmSync(`${canonicalFilePath}.tmp`, { recursive: true, force: true });
    }

    const rawMessage = error instanceof CommandError ? error.output : error instanceof Error ? error.message : "portfolio publish failed";
    const message = rawMessage.replaceAll(root, "repository");
    logs.push(message);
    return { ok: false, committed, slug: project.slug, filePath: relativeFilePath, commitMessage, error: message, logs };
  }

  return { ok: true, committed, slug: project.slug, filePath: relativeFilePath, commitMessage, logs };
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

export function resolveUniqueImageFile(imagesDirectory, requestedName) {
  const extension = path.extname(requestedName);
  const baseName = path.basename(requestedName, extension);
  let fileName = requestedName;
  let index = 2;

  while (fs.existsSync(path.join(imagesDirectory, fileName))) {
    fileName = `${baseName}-${index}${extension}`;
    index += 1;
  }

  return { fileName, filePath: path.join(imagesDirectory, fileName) };
}

export function saveUploadedImage({ fileName, contentType, content }, root = process.cwd()) {
  const baseName = path.basename(String(fileName ?? ""));
  const originalExtension = path.extname(baseName);
  const extension = originalExtension.toLowerCase();

  if (IMAGE_TYPES.get(extension) !== contentType || !Buffer.isBuffer(content) || !content.length || content.length > MAX_IMAGE_BYTES) {
    throw new Error("이미지 파일 형식 또는 크기가 올바르지 않습니다.");
  }

  const imagesDirectory = path.join(root, "public", "images");
  const requestedName = `${createSlug(path.basename(baseName, originalExtension))}${extension}`;
  fs.mkdirSync(imagesDirectory, { recursive: true });
  const target = resolveUniqueImageFile(imagesDirectory, requestedName);
  fs.writeFileSync(target.filePath, content);

  return {
    ok: true,
    fileName: target.fileName,
    filePath: path.join("public", "images", target.fileName),
    publicPath: `/images/${target.fileName}`,
  };
}

export function validatePortfolioMediaUpload({ fileName, contentType, size }) {
  if (typeof fileName !== "string" || !fileName || path.basename(fileName) !== fileName || fileName.includes("\\")) {
    throw new Error("fileName is unsafe");
  }
  const extension = path.extname(fileName).toLowerCase();
  const rule = PORTFOLIO_MEDIA_TYPES.get(extension);
  if (!rule) throw new Error("unsupported portfolio media file");

  const [kind, expectedType, maxBytes] = rule;
  if (contentType !== expectedType) throw new Error("Content-Type does not match extension");
  if (!Number.isSafeInteger(size) || size < 1) throw new Error("upload size must be a positive integer");
  if (size > maxBytes) {
    throw new Error(`${kind} upload exceeds ${maxBytes === MAX_IMAGE_BYTES ? "10 MiB" : "50 MiB"}`);
  }
  return { kind, extension, maxBytes };
}

export function savePortfolioMedia({ fileName, contentType, content }, root = process.cwd()) {
  if (!Buffer.isBuffer(content)) throw new Error("content must be a Buffer");
  const { kind, extension } = validatePortfolioMediaUpload({ fileName, contentType, size: content.length });
  const portfolioDirectory = path.join(root, "public", "portfolio");
  const originalExtension = path.extname(fileName);
  const originalStem = path.basename(fileName, originalExtension);
  const requestedName = `${originalStem ? createSlug(originalStem) : "media"}${extension}`;
  fs.mkdirSync(portfolioDirectory, { recursive: true });
  const target = resolveUniqueImageFile(portfolioDirectory, requestedName);
  const temporaryPath = path.join(portfolioDirectory, `.${target.fileName}.${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporaryPath, content, { flag: "wx" });
    fs.linkSync(temporaryPath, target.filePath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }

  return {
    kind,
    fileName: target.fileName,
    filePath: target.filePath,
    src: `/portfolio/${target.fileName}`,
  };
}

export function savePortfolioDraft(rawProject, root = process.cwd(), now = new Date()) {
  const project = normalizePortfolioProject(rawProject);
  const draftsDirectory = path.join(root, PORTFOLIO_DRAFTS_DIRECTORY);
  const fileName = `${project.slug}.json`;
  const filePath = path.join(draftsDirectory, fileName);
  const temporaryPath = `${filePath}.tmp`;
  fs.mkdirSync(draftsDirectory, { recursive: true });

  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(project, null, 2)}\n`, { flag: "w" });
    fs.utimesSync(temporaryPath, now, now);
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    fs.rmSync(temporaryPath, { recursive: true, force: true });
    throw error;
  }

  return { fileName, name: project.name, updatedAt: now.toISOString(), project };
}

function normalizePortfolioDraftFileName(fileName) {
  if (typeof fileName !== "string" || !/^[\p{Letter}\p{Number}]+(?:-[\p{Letter}\p{Number}]+)*\.json$/u.test(fileName)) {
    throw new Error("draft file is invalid");
  }
  return fileName;
}

export function loadPortfolioDraft(fileName, root = process.cwd()) {
  const safeFileName = normalizePortfolioDraftFileName(fileName);
  const filePath = path.join(root, PORTFOLIO_DRAFTS_DIRECTORY, safeFileName);
  if (!fs.existsSync(filePath)) throw new Error(`draft ${safeFileName} was not found`);
  let source;
  try {
    source = fs.readFileSync(filePath, "utf8");
  } catch {
    throw new Error(`draft ${safeFileName} could not be read`);
  }
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error(`draft ${safeFileName} is malformed or invalid`);
  }
  return normalizePortfolioProject(parsed);
}

export function listPortfolioDrafts(root = process.cwd()) {
  const draftsDirectory = path.join(root, PORTFOLIO_DRAFTS_DIRECTORY);
  if (!fs.existsSync(draftsDirectory)) return [];

  return fs.readdirSync(draftsDirectory)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => {
      const filePath = path.join(draftsDirectory, fileName);
      const updatedAt = fs.statSync(filePath).mtime.toISOString();
      try {
        return { fileName, name: loadPortfolioDraft(fileName, root).name, updatedAt };
      } catch {
        return { fileName, name: path.basename(fileName, ".json"), updatedAt };
      }
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
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

function referencedImagePaths(body, root) {
  const paths = new Set();
  const imagePattern = /!\[[^\]]*\]\(\/images\/([^\s)]+)\)/g;

  for (const match of String(body ?? "").matchAll(imagePattern)) {
    let fileName;
    try {
      fileName = decodeURIComponent(match[1]);
    } catch {
      continue;
    }

    if (path.basename(fileName) !== fileName || !IMAGE_TYPES.has(path.extname(fileName).toLowerCase())) continue;
    const relativePath = path.join("public", "images", fileName);
    if (fs.existsSync(path.join(root, relativePath))) paths.add(relativePath);
  }

  return [...paths];
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
  const stagedPaths = [relativePath, ...referencedImagePaths(article.body, root)];
  const mdx = buildMdxDocument(article);
  const commitMessage = buildCommitMessage(article.date, article.title);
  const logs = [];
  let committed = false;

  fs.writeFileSync(filePath, mdx, "utf8");

  try {
    for (const [command, args] of [
      ["npm", ["run", "build"]],
      ["git", ["add", "--", ...stagedPaths]],
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
        await runner("git", ["restore", "--staged", "--", ...stagedPaths], root);
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
    .markdown a { color:var(--accent); text-decoration:underline; text-underline-offset:2px; }
    .markdown ul, .markdown ol { margin:0 0 16px; padding-left:24px; }
    .markdown li { margin-bottom:6px; }
    .markdown img { display:block; max-width:100%; height:auto; margin:16px 0; border-radius:12px; }
    .markdown pre { background:var(--border); padding:14px; border-radius:14px; overflow:auto; }
    .markdown blockquote { border-left:2px solid var(--subtext); margin:16px 0; padding-left:14px; color:var(--subtext); }
    .status { margin-top:18px; white-space:pre-wrap; font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px; line-height:1.55; color:var(--subtext); }
    .status.ok { color:var(--ok); }.status.error { color:var(--danger); }
    .log { margin-top:24px; display:none; }
    .log pre { white-space:pre-wrap; overflow:auto; margin:0; color:var(--subtext); font-size:12px; line-height:1.55; }
    [hidden] { display:none !important; }
    @media (max-width: 900px) { .grid { grid-template-columns:1fr; } .preview { position:static; } }
  </style>
</head>
<body>
  <div class="shell">
    <header>
      <nav>
        <a href="/">[ Home ]</a>
        <a href="/archive">[ Archive ]</a>
        <a href="/translations">[ Translations ]</a>
        <a class="active" href="/">[ Write ]</a>
      </nav>
      <span class="ghost">${escapeHtml(root)}</span>
    </header>

    <section class="hero">
      <h1>Write like the site already knows the article.</h1>
      <p>로컬 전용 작성 대시보드입니다. 저장 버튼을 누르면 MDX 파일을 만들고, 검증과 빌드를 통과한 뒤 지정된 커밋 메시지로 commit + push까지 실행합니다.</p>
    </section>

    <section id="article-dashboard" class="grid">
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

    let previewTimer;
    let previewRequest = 0;

    async function renderPreview() {
      const request = ++previewRequest;
      try {
        const response = await fetch("/api/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ markdown: body.value }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "미리보기를 렌더링하지 못했습니다.");
        if (request === previewRequest) previewBody.innerHTML = result.html;
      } catch (error) {
        if (request === previewRequest) previewBody.textContent = error.message;
      }
    }

    function updatePreview() {
      previewTitle.textContent = title.value.trim() || "Untitled";
      previewMeta.textContent = date.value + " · " + category.value;
      clearTimeout(previewTimer);
      previewTimer = setTimeout(renderPreview, 100);
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

    function insertImageAtSelection(fileName, publicPath, start, end) {
      const alt = fileName.replaceAll("[", "").replaceAll("]", "");
      body.setRangeText("![" + alt + "](" + publicPath + ")", start, end, "end");
      body.focus();
      updatePreview();
    }

    async function uploadDroppedImage(file, start, end) {
      const response = await fetch("/api/images", {
        method: "POST",
        headers: { "content-type": file.type, "x-file-name": encodeURIComponent(file.name) },
        body: file,
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || "이미지를 저장하지 못했습니다.");
      insertImageAtSelection(file.name, result.publicPath, start, end);
      status.className = "status ok";
      status.textContent = "이미지 추가: " + result.publicPath;
    }

    body.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    });

    body.addEventListener("drop", async (event) => {
      event.preventDefault();
      const files = event.dataTransfer.files;
      if (files.length !== 1) {
        status.className = "status error";
        status.textContent = "이미지 파일 하나만 drop해 주세요.";
        return;
      }

      const start = body.selectionStart;
      const end = body.selectionEnd;
      status.className = "status";
      status.textContent = "이미지를 저장하는 중입니다...";

      try {
        await uploadDroppedImage(files[0], start, end);
      } catch (error) {
        status.className = "status error";
        status.textContent = error.message;
      }
    });

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

function renderPortfolioDashboard(root) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Celan Portfolio Dashboard</title>
  <style>
    :root { color-scheme:dark; --background:#0a0a0a; --foreground:#fafafa; --subtext:#a1a1a1; --border:#2b2b2b; --panel:#111; --danger:#ff8a8a; --ok:#a7f3d0; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--background); color:var(--foreground); font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    main { max-width:1180px; margin:auto; padding:32px 24px 64px; }
    header { display:flex; flex-wrap:wrap; align-items:end; justify-content:space-between; gap:16px; margin-bottom:28px; }
    h1,h2,h3 { margin:0; font-family:Georgia,serif; }
    header p,.path,.hint,.media-path { color:var(--subtext); }
    .layout { display:grid; grid-template-columns:minmax(0,1fr) minmax(320px,420px); gap:24px; align-items:start; }
    form,#preview { border:1px solid var(--border); border-radius:22px; background:var(--panel); padding:22px; }
    #preview { position:sticky; top:18px; }
    .field { margin-bottom:16px; }
    label { display:block; margin-bottom:7px; color:var(--subtext); font-size:13px; }
    input,select,textarea { width:100%; border:1px solid var(--border); border-radius:12px; background:#080808; color:var(--foreground); padding:11px 12px; font:inherit; }
    textarea { min-height:260px; resize:vertical; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; line-height:1.55; }
    input:focus-visible,select:focus-visible,textarea:focus-visible,button:focus-visible { outline:2px solid #fff; outline-offset:2px; }
    .controls,.actions,.media-actions { display:flex; flex-wrap:wrap; gap:10px; align-items:end; }
    .controls .field { flex:1; margin:0; }
    .checkbox input { width:auto; }
    button { border:1px solid var(--border); border-radius:999px; background:#fff; color:#050505; padding:10px 15px; font-weight:650; cursor:pointer; }
    button.secondary { background:transparent; color:var(--foreground); }
    button:disabled { opacity:.5; cursor:not-allowed; }
    #media-rows { list-style:none; padding:0; display:grid; gap:14px; }
    .media-row { border:1px solid var(--border); border-radius:16px; padding:14px; }
    .media-row img,.media-row video,#preview img,#preview video { width:100%; max-height:280px; object-fit:contain; border-radius:10px; background:#050505; }
    .cover-preview { min-height:160px; margin:10px 0; display:grid; place-items:center; border-radius:10px; background:#050505; color:var(--subtext); overflow:hidden; }
    .cover-preview img { width:100%; max-height:280px; object-fit:contain; }
    .media-path { display:block; overflow-wrap:anywhere; margin:8px 0 12px; }
    #preview .markdown { line-height:1.7; overflow-wrap:anywhere; }
    #preview figure { margin:20px 0 0; }
    #preview figcaption { color:var(--subtext); margin-top:7px; }
    #status { min-height:1.5em; margin-top:15px; white-space:pre-wrap; color:var(--subtext); }
    #status.ok { color:var(--ok); } #status.error { color:var(--danger); }
    #command-log { white-space:pre-wrap; overflow:auto; color:var(--subtext); }
    @media (max-width:900px) { .layout { grid-template-columns:1fr; } #preview { position:static; } }
  </style>
</head>
<body>
  <main>
    <header><div><h1>Portfolio Dashboard</h1><p>Local-only structured portfolio authoring.</p></div><code class="path">${escapeHtml(root)}</code></header>
    <section class="layout">
      <form id="portfolio-form">
        <div class="controls">
          <div class="field"><label for="project-select">Existing project</label><select id="project-select"></select></div>
          <button id="new-project" type="button" class="secondary">New Project</button>
        </div>
        <div class="field"><label for="name">Project name</label><input id="name" maxlength="120" required /></div>
        <div class="field">
          <label>Period</label>
          <div class="controls">
            <div class="field"><label for="period-start">Start date</label><input id="period-start" type="date" required /></div>
            <div class="field"><label for="period-end">End date</label><input id="period-end" type="date" required /></div>
            <label class="checkbox"><input id="period-present" type="checkbox" /> Present</label>
          </div>
        </div>
        <div class="field">
          <label for="cover-input">Cover image</label>
          <input id="cover-input" type="file" accept="image/*" />
          <div id="cover-preview" class="cover-preview"></div>
          <label for="cover-alt">Cover alt</label>
          <input id="cover-alt" disabled />
          <button id="remove-cover" type="button" class="secondary" disabled>Remove Cover</button>
        </div>
        <div class="field"><label for="description-markdown">Markdown description</label><textarea id="description-markdown" maxlength="50000" required></textarea></div>
        <div class="field"><label for="media-input">Images or MP4 files</label><input id="media-input" type="file" multiple accept="image/*,video/mp4" /></div>
        <ol id="media-rows"></ol>
        <div class="controls">
          <div class="field"><label for="draft-select">Saved draft</label><select id="draft-select"></select></div>
          <button id="load-draft" type="button" class="secondary">Load</button>
        </div>
        <div class="actions">
          <button id="save-draft" type="button" class="secondary">Save Draft</button>
          <button id="publish" type="submit">Save, Commit &amp; Push</button>
        </div>
        <p id="status" role="status" aria-live="polite"></p>
        <pre id="command-log"></pre>
      </form>
      <aside id="preview" aria-label="Project preview"></aside>
    </section>
  </main>
  <script>
    const form = document.querySelector("#portfolio-form");
    const projectSelect = document.querySelector("#project-select");
    const newProjectButton = document.querySelector("#new-project");
    const nameInput = document.querySelector("#name");
    const periodStartInput = document.querySelector("#period-start");
    const periodEndInput = document.querySelector("#period-end");
    const periodPresentInput = document.querySelector("#period-present");
    const coverInput = document.querySelector("#cover-input");
    const coverPreview = document.querySelector("#cover-preview");
    const coverAltInput = document.querySelector("#cover-alt");
    const removeCoverButton = document.querySelector("#remove-cover");
    const descriptionInput = document.querySelector("#description-markdown");
    const mediaInput = document.querySelector("#media-input");
    const mediaRows = document.querySelector("#media-rows");
    const draftSelect = document.querySelector("#draft-select");
    const loadDraftButton = document.querySelector("#load-draft");
    const saveDraftButton = document.querySelector("#save-draft");
    const publishButton = document.querySelector("#publish");
    const preview = document.querySelector("#preview");
    const status = document.querySelector("#status");
    const commandLog = document.querySelector("#command-log");
    const emptyProject = () => ({ slug:"", name:"", period:"", descriptionMarkdown:"", media:[] });
    const state = { project:emptyProject(), projects:[], dirty:false, previewRequest:0 };
    const canonicalPeriod = /^(\\d{4}\\.\\d{2}\\.\\d{2}) — (Present|\\d{4}\\.\\d{2}\\.\\d{2})$/;
    const toIsoDate = (value) => value.replaceAll(".", "-");
    const toPeriodDate = (value) => value.replaceAll("-", ".");

    async function requestJson(url, options) {
      const response = await fetch(url, options);
      const result = await response.json();
      if (!response.ok && !Array.isArray(result.logs)) throw new Error(result.error || "Request failed (" + response.status + ")");
      return result;
    }

    function setStatus(message, kind) {
      status.textContent = message || "";
      status.className = kind || "";
    }

    function mayReplaceForm() {
      return !state.dirty || confirm("Discard unsaved portfolio changes?");
    }

    function syncPeriodFields() {
      const match = canonicalPeriod.exec(state.project.period);
      periodStartInput.value = match ? toIsoDate(match[1]) : "";
      periodPresentInput.checked = match?.[2] === "Present";
      periodEndInput.value = match && !periodPresentInput.checked ? toIsoDate(match[2]) : "";
      periodEndInput.disabled = periodPresentInput.checked;
      periodEndInput.required = !periodPresentInput.checked;
      periodEndInput.min = periodStartInput.value;
    }

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

    function syncFields() {
      nameInput.value = state.project.name;
      syncPeriodFields();
      renderCoverControls();
      descriptionInput.value = state.project.descriptionMarkdown;
    }

    function markDirty() {
      state.dirty = true;
      schedulePreview();
    }

    function updatePeriod() {
      periodEndInput.disabled = periodPresentInput.checked;
      periodEndInput.required = !periodPresentInput.checked;
      periodEndInput.min = periodStartInput.value;
      if (periodPresentInput.checked) periodEndInput.value = "";
      const start = periodStartInput.value;
      const end = periodEndInput.value;
      state.project.period = start && (periodPresentInput.checked || (end && end >= start))
        ? toPeriodDate(start) + " — " + (periodPresentInput.checked ? "Present" : toPeriodDate(end))
        : "";
      markDirty();
    }

    function moveMedia(index, offset) {
      const target = index + offset;
      if (target < 0 || target >= state.project.media.length) return;
      const item = state.project.media.splice(index, 1)[0];
      state.project.media.splice(target, 0, item);
      state.dirty = true;
      renderMediaRows();
      schedulePreview();
    }

    function removeMedia(index) {
      state.project.media.splice(index, 1);
      state.dirty = true;
      renderMediaRows();
      schedulePreview();
    }

    function mediaElement(item) {
      const element = document.createElement(item.kind === "image" ? "img" : "video");
      element.src = item.src;
      if (item.kind === "image") element.alt = item.alt;
      else { element.controls = true; element.preload = "metadata"; }
      return element;
    }

    function mediaButton(label, action, disabled) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary";
      button.textContent = label;
      button.disabled = disabled;
      button.addEventListener("click", action);
      return button;
    }

    function renderMediaRows() {
      mediaRows.replaceChildren();
      state.project.media.forEach((item, index) => {
        const row = document.createElement("li");
        row.className = "media-row";
        row.append(mediaElement(item));
        const storedPath = document.createElement("code");
        storedPath.className = "media-path";
        storedPath.textContent = item.src;
        row.append(storedPath);

        const captionLabel = document.createElement("label");
        captionLabel.textContent = "Caption";
        const caption = document.createElement("input");
        caption.required = true;
        caption.maxLength = 300;
        caption.value = item.caption;
        caption.addEventListener("input", () => { item.caption = caption.value; markDirty(); });
        captionLabel.append(caption);
        row.append(captionLabel);

        if (item.kind === "image") {
          const altLabel = document.createElement("label");
          altLabel.textContent = "Image alt";
          const alt = document.createElement("input");
          alt.required = true;
          alt.value = item.alt;
          alt.addEventListener("input", () => { item.alt = alt.value; markDirty(); });
          altLabel.append(alt);
          row.append(altLabel);
        }

        const actions = document.createElement("div");
        actions.className = "media-actions";
        actions.append(
          mediaButton("Move Up", () => moveMedia(index, -1), index === 0),
          mediaButton("Move Down", () => moveMedia(index, 1), index === state.project.media.length - 1),
          mediaButton("Remove", () => removeMedia(index), false),
        );
        row.append(actions);
        mediaRows.append(row);
      });
    }

    async function renderPreview() {
      const request = ++state.previewRequest;
      const title = document.createElement("h2");
      title.textContent = state.project.name || "Untitled project";
      const period = document.createElement("p");
      period.className = "hint";
      period.textContent = state.project.period;
      const markdown = document.createElement("div");
      markdown.className = "markdown";
      const cover = state.project.coverImage ? mediaElement({ kind:"image", ...state.project.coverImage }) : null;
      preview.replaceChildren(...(cover ? [cover] : []), title, period, markdown);
      for (const item of state.project.media) {
        const figure = document.createElement("figure");
        figure.append(mediaElement(item));
        const caption = document.createElement("figcaption");
        caption.textContent = item.caption;
        figure.append(caption);
        preview.append(figure);
      }
      try {
        const result = await requestJson("/api/portfolio/preview", {
          method:"POST", headers:{ "content-type":"application/json" },
          body:JSON.stringify({ markdown:state.project.descriptionMarkdown }),
        });
        if (request === state.previewRequest) markdown.innerHTML = result.html;
      } catch (error) {
        if (request === state.previewRequest) markdown.textContent = error.message;
      }
    }

    let previewTimer;
    function schedulePreview() {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(renderPreview, 100);
    }

    function renderProjectOptions() {
      projectSelect.replaceChildren();
      if (!state.projects.length) {
        const option = document.createElement("option");
        option.value = ""; option.textContent = "No saved projects";
        projectSelect.append(option);
      } else {
        for (const project of state.projects) {
          const option = document.createElement("option");
          option.value = project.slug; option.textContent = project.name;
          projectSelect.append(option);
        }
        projectSelect.value = state.project.slug;
      }
    }

    function setProject(project) {
      state.project = structuredClone(project);
      state.dirty = false;
      syncFields();
      renderProjectOptions();
      renderMediaRows();
      schedulePreview();
    }

    async function refreshDrafts() {
      const result = await requestJson("/api/portfolio/drafts");
      draftSelect.replaceChildren();
      for (const draft of result.drafts) {
        const option = document.createElement("option");
        option.value = draft.fileName;
        option.textContent = draft.name + " · " + new Date(draft.updatedAt).toLocaleString();
        draftSelect.append(option);
      }
      loadDraftButton.disabled = !result.drafts.length;
    }

    async function withAction(control, action) {
      control.disabled = true;
      try { return await action(); }
      catch (error) { setStatus(error.message, "error"); }
      finally { control.disabled = false; }
    }

    for (const [input, field] of [[nameInput,"name"],[descriptionInput,"descriptionMarkdown"]]) {
      input.addEventListener("input", () => { state.project[field] = input.value; markDirty(); });
    }
    periodStartInput.addEventListener("input", updatePeriod);
    periodEndInput.addEventListener("input", updatePeriod);
    periodPresentInput.addEventListener("change", updatePeriod);

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

    projectSelect.addEventListener("change", () => {
      const project = state.projects.find((item) => item.slug === projectSelect.value);
      if (!project || !mayReplaceForm()) { renderProjectOptions(); return; }
      setProject(project);
    });

    newProjectButton.addEventListener("click", () => {
      if (mayReplaceForm()) setProject(emptyProject());
    });

    mediaInput.addEventListener("change", () => withAction(mediaInput, async () => {
      for (const file of mediaInput.files) {
        const response = await fetch("/api/portfolio/media", {
          method:"POST", headers:{ "content-type":file.type, "x-file-name":encodeURIComponent(file.name) }, body:file,
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
      mediaInput.value = "";
      setStatus("Media uploaded", "ok");
    }));

    loadDraftButton.addEventListener("click", () => withAction(loadDraftButton, async () => {
      if (!draftSelect.value || !mayReplaceForm()) return;
      const result = await requestJson("/api/portfolio/draft?file=" + encodeURIComponent(draftSelect.value));
      setProject(result.project);
      setStatus("Draft loaded", "ok");
    }));

    saveDraftButton.addEventListener("click", () => {
      if (!form.reportValidity()) return;
      withAction(saveDraftButton, async () => {
        const result = await requestJson("/api/portfolio/draft", {
          method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify(state.project),
        });
        setProject(result.project);
        await refreshDrafts();
        setStatus("Draft saved", "ok");
      });
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      withAction(publishButton, async () => {
        const result = await requestJson("/api/portfolio/publish", {
          method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify(state.project),
        });
        commandLog.textContent = (result.logs || []).join("\\n\\n");
        if (typeof result.slug === "string" && result.slug) state.project.slug = result.slug;
        if (result.committed) {
          const portfolio = await requestJson("/api/portfolio");
          state.projects = portfolio.projects;
          setProject(state.projects.find((project) => project.slug === result.slug) || state.project);
        } else {
          state.dirty = !result.ok;
          renderProjectOptions();
        }
        setStatus(result.ok
          ? (result.committed ? "Committed and pushed" : "No changes")
          : (result.committed ? "Committed; push failed: " : "Publish failed: ") + result.error,
        result.ok ? "ok" : "error");
      });
    });

    Promise.all([requestJson("/api/portfolio"), refreshDrafts()])
      .then(([portfolio]) => {
        state.projects = portfolio.projects;
        setProject(state.projects[0] || emptyProject());
      })
      .catch((error) => setStatus(error.message, "error"));
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

async function readImageBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_IMAGE_BYTES) throw new Error("이미지 파일은 10MB 이하여야 합니다.");
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

function readPortfolioContent(root) {
  return normalizePortfolioContent(JSON.parse(fs.readFileSync(path.join(root, "content", "portfolio.json"), "utf8")));
}

function portfolioPreviewMarkdown(value) {
  if (typeof value !== "string") throw new Error("markdown must be a string");
  if (value.length > 50_000) throw new Error("markdown must be at most 50000 characters");
  return value;
}

async function readPortfolioMediaBody(request) {
  const chunks = [];
  let size = 0;
  const maxBytes = 50 * 1024 * 1024;
  const contentLength = Number(request.headers["content-length"]);

  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    const error = new Error("portfolio media request exceeds 50 MiB");
    error.statusCode = 413;
    throw error;
  }

  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error("portfolio media request exceeds 50 MiB");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

function localErrorMessage(error, root) {
  return (error instanceof Error ? error.message : "portfolio request failed").replaceAll(root, "repository");
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data, null, 2));
}

function acceptPostRequest(request, response, pathname) {
  const contentType = String(request.headers["content-type"] ?? "").split(";", 1)[0].trim().toLowerCase();
  if (!["/api/images", "/api/portfolio/media"].includes(pathname) && contentType !== "application/json") {
    sendJson(response, 415, { ok: false, error: "POST 요청은 application/json이어야 합니다." });
    return false;
  }

  const originHeader = request.headers.origin;
  if (!originHeader) return true;

  try {
    const host = new URL(`http://${request.headers.host}`);
    const origin = new URL(originHeader);
    if (origin.protocol === "http:" && origin.host === host.host && ["127.0.0.1", "localhost"].includes(host.hostname)) return true;
  } catch {
    // Reject malformed Host or Origin headers below.
  }

  sendJson(response, 403, { ok: false, error: "로컬 대시보드와 같은 Origin에서만 POST할 수 있습니다." });
  return false;
}

export function createServer(root, { mode = "article" } = {}) {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://${HOST}`);

    if (request.method === "POST" && !acceptPostRequest(request, response, url.pathname)) return;

    if (mode === "portfolio") {
      if (request.method === "GET" && url.pathname === "/") {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(renderPortfolioDashboard(root));
        return;
      }

      if (request.method === "GET" && url.pathname === "/favicon.ico") {
        response.writeHead(204);
        response.end();
        return;
      }

      if (request.method === "GET" && url.pathname.startsWith("/portfolio/")) {
        try {
          const fileName = decodeURIComponent(url.pathname.slice("/portfolio/".length));
          const src = normalizePortfolioSrc(`/portfolio/${fileName}`, "media.src");
          const extension = path.extname(src).toLowerCase();
          response.writeHead(200, { "content-type": PORTFOLIO_MEDIA_TYPES.get(extension)[1] });
          response.end(fs.readFileSync(path.join(root, "public", "portfolio", fileName)));
          return;
        } catch {
          response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
          response.end("Not found");
          return;
        }
      }

      if (request.method === "GET" && url.pathname === "/api/portfolio") {
        try {
          sendJson(response, 200, { ok: true, ...readPortfolioContent(root) });
        } catch (error) {
          sendJson(response, 500, { ok: false, error: localErrorMessage(error, root) });
        }
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/portfolio/drafts") {
        try {
          sendJson(response, 200, { ok: true, drafts: listPortfolioDrafts(root) });
        } catch (error) {
          sendJson(response, 500, { ok: false, error: localErrorMessage(error, root), drafts: [] });
        }
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/portfolio/draft") {
        try {
          sendJson(response, 200, { ok: true, project: loadPortfolioDraft(url.searchParams.get("file"), root) });
        } catch (error) {
          sendJson(response, 400, { ok: false, error: localErrorMessage(error, root) });
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/portfolio/media") {
        try {
          const result = savePortfolioMedia({
            fileName: decodeURIComponent(request.headers["x-file-name"] ?? ""),
            contentType: String(request.headers["content-type"] ?? "").split(";", 1)[0],
            content: await readPortfolioMediaBody(request),
          }, root);
          sendJson(response, 200, { ok: true, ...result });
        } catch (error) {
          sendJson(response, error.statusCode || 400, { ok: false, error: localErrorMessage(error, root) });
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/portfolio/preview") {
        try {
          const body = await readJsonBody(request);
          sendJson(response, 200, { ok: true, html: renderMarkdownPreview(portfolioPreviewMarkdown(body.markdown)) });
        } catch (error) {
          sendJson(response, 400, { ok: false, error: localErrorMessage(error, root) });
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/portfolio/draft") {
        try {
          const result = savePortfolioDraft(await readJsonBody(request), root);
          sendJson(response, 200, { ok: true, ...result });
        } catch (error) {
          sendJson(response, 400, { ok: false, error: localErrorMessage(error, root) });
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/portfolio/publish") {
        try {
          const result = await publishPortfolioProject(await readJsonBody(request), root);
          sendJson(response, result.ok ? 200 : 500, result);
        } catch (error) {
          sendJson(response, 400, { ok: false, committed: false, error: localErrorMessage(error, root), logs: [] });
        }
        return;
      }

      sendJson(response, 404, { ok: false, error: "Not found" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(renderDashboard(root));
      return;
    }

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

    if (request.method === "POST" && url.pathname === "/api/images") {
      try {
        const result = saveUploadedImage({
          fileName: decodeURIComponent(request.headers["x-file-name"] ?? ""),
          contentType: String(request.headers["content-type"] ?? "").split(";", 1)[0],
          content: await readImageBody(request),
        }, root);
        sendJson(response, 200, result);
      } catch (error) {
        sendJson(response, 400, { ok: false, error: error.message });
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

    if (request.method === "POST" && url.pathname === "/api/preview") {
      try {
        const body = await readJsonBody(request);
        sendJson(response, 200, { ok: true, html: renderMarkdownPreview(body.markdown) });
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
  const mode = process.argv[2] === "portfolio" ? "portfolio" : "article";
  const port = mode === "portfolio"
    ? Number(process.env.PORTFOLIO_DASHBOARD_PORT || DEFAULT_PORTFOLIO_PORT)
    : Number(process.env.ARTICLE_DASHBOARD_PORT || DEFAULT_PORT);
  const server = createServer(root, { mode });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      const variable = mode === "portfolio" ? "PORTFOLIO_DASHBOARD_PORT" : "ARTICLE_DASHBOARD_PORT";
      const command = mode === "portfolio" ? "npm run portfolio" : "npm run write";
      console.error(`Port ${port} is already in use. Stop the existing dashboard or run ${variable}=${port + 1} ${command}.`);
      process.exit(1);
    }
    throw error;
  });

  server.listen(port, HOST, () => {
    console.log(`${mode === "portfolio" ? "Portfolio" : "Article"} dashboard running at http://${HOST}:${port}`);
    console.log("Press Ctrl+C to stop.");
  });
}

const currentFile = pathToFileURL(fileURLToPath(import.meta.url)).href;
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === currentFile) {
  start();
}
