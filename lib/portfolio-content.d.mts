import type { PortfolioProject } from "./portfolio.mjs";
export function getAllPortfolioProjects(root?: string): PortfolioProject[];
export function getPortfolioProjectBySlug(slug: string, root?: string): PortfolioProject | null;
