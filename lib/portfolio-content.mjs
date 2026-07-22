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
