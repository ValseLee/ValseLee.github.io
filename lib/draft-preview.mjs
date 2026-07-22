import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

import { normalizePortfolioProject } from "./portfolio.mjs";

const CATEGORIES = new Set(["build-log", "founder-notes", "engineering", "life"]);
const DRAFTS = {
  articles: { directory: ".article-drafts", extension: ".mdx" },
  portfolio: { directory: ".portfolio-drafts", extension: ".json" },
};

function normalizeArticle(slug, source) {
  const { data, content } = matter(source);
  const date = data.date instanceof Date ? data.date.toISOString().slice(0, 10) : data.date;
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
  if (!fs.existsSync(filePath)) return { status: "missing" };

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
      .readdirSync(draftsDirectory)
      .filter((fileName) => fileName.endsWith(extension))
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
