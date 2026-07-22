export interface PortfolioCoverImage { src: string; alt: string }
export type PortfolioMedia =
  | { kind: "image"; src: string; caption: string; alt: string }
  | { kind: "video"; src: string; caption: string };
export interface PortfolioProject {
  slug: string;
  name: string;
  period: string;
  descriptionMarkdown: string;
  coverImage?: PortfolioCoverImage;
  media: PortfolioMedia[];
}
export interface PortfolioContent { projects: PortfolioProject[] }
export const PORTFOLIO_IMAGE_EXTENSIONS: Set<string>;
export const PORTFOLIO_VIDEO_EXTENSIONS: Set<string>;
export function createSlug(title: unknown, date?: Date): string;
export function normalizePortfolioSrc(value: unknown, field: string): string;
export function normalizePortfolioProject(rawProject: unknown): PortfolioProject;
export function normalizePortfolioContent(rawContent: unknown): PortfolioContent;
export function mergePortfolioProject(content: PortfolioContent, project: PortfolioProject): PortfolioContent;
