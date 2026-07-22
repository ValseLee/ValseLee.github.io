import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

import { normalizePortfolioProject } from "./portfolio.mjs";

const CATEGORIES = new Set(["build-log", "founder-notes", "engineering", "life"]);
const DRAFTS = {
  articles: { directory: ".article-drafts", extension: ".mdx" },
  portfolio: { directory: ".portfolio-drafts", extension: ".json" },
};

function readArticleDate(source) {
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  const rawDate = frontmatter?.match(/^date:\s*(.*?)\s*$/m)?.[1];
  const date = rawDate?.match(/^(["']?)(\d{4}-\d{2}-\d{2})\1$/)?.[2];
  if (!date) return null;

  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() + 1 === month && parsed.getUTCDate() === day
    ? date
    : null;
}

function normalizeArticle(slug, source) {
  const date = readArticleDate(source);
  const { data, content } = matter(source);
  if (
    typeof data.title !== "string" ||
    !data.title.trim() ||
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !CATEGORIES.has(data.category) ||
    !Array.isArray(data.tags) ||
    !data.tags.every((tag) => typeof tag === "string") ||
    !Array.isArray(data.links) ||
    !data.links.every((link) => typeof link === "string") ||
    typeof data.description !== "string" ||
    !data.description.trim() ||
    !content.trim()
  ) {
    throw new Error("invalid article draft");
  }

  return {
    slug,
    frontmatter: {
      title: data.title.trim(),
      date,
      category: data.category,
      tags: data.tags,
      links: data.links,
      description: data.description.trim(),
    },
    content,
  };
}

export function isDraftPreviewEnabled(nodeEnv = process.env.NODE_ENV) {
  return nodeEnv === "development";
}

export function loadDraft(kind, slug, { root = process.cwd(), nodeEnv } = {}) {
  if (!isDraftPreviewEnabled(nodeEnv)) return { status: "disabled" };
  if (!DRAFTS[kind] || typeof slug !== "string" || !slug || /[./\\]/.test(slug)) return { status: "missing" };
  const { directory, extension } = DRAFTS[kind];
  const filePath = path.join(root, directory, `${slug}${extension}`);
  if (!fs.lstatSync(filePath, { throwIfNoEntry: false })?.isFile()) return { status: "missing" };

  try {
    const source = fs.readFileSync(filePath, "utf8");
    if (kind === "articles") return { status: "ok", kind, article: normalizeArticle(slug, source) };
    const project = normalizePortfolioProject(JSON.parse(source));
    return project.slug === slug ? { status: "ok", kind, project } : { status: "missing" };
  } catch {
    return {
      status: "invalid",
      kind,
      slug,
      message: `${kind === "articles" ? "Article" : "Portfolio"} draft is malformed or invalid.`,
    };
  }
}

export function listDrafts({ root = process.cwd(), nodeEnv } = {}) {
  if (!isDraftPreviewEnabled(nodeEnv)) return [];
  return Object.entries(DRAFTS).flatMap(([kind, { directory, extension }]) => {
    const draftsDirectory = path.join(root, directory);
    if (!fs.existsSync(draftsDirectory)) return [];
    return fs
      .readdirSync(draftsDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
      .map((entry) => entry.name)
      .sort()
      .map((fileName) => {
        const slug = fileName.slice(0, -extension.length);
        const result = loadDraft(kind, slug, { root, nodeEnv });
        if (result.status === "missing") return null;
        return {
          kind,
          slug,
          label: result.status === "invalid" ? slug : kind === "articles" ? result.article.frontmatter.title : result.project.name,
          valid: result.status === "ok",
        };
      })
      .filter(Boolean);
  });
}
