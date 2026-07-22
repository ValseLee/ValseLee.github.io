import type { Post } from "./posts";
import type { PortfolioProject } from "./portfolio.mjs";

export type { PortfolioProject } from "./portfolio.mjs";

export type DraftKind = "articles" | "portfolio";

export interface DraftReaderOptions {
  root?: string;
  nodeEnv?: string;
}

export interface DraftSummary {
  kind: DraftKind;
  slug: string;
  label: string;
  valid: boolean;
}

export type DraftLoadResult =
  | { status: "disabled" }
  | { status: "missing" }
  | { status: "invalid"; kind: DraftKind; slug: string; message: string }
  | { status: "ok"; kind: "articles"; article: Post }
  | { status: "ok"; kind: "portfolio"; project: PortfolioProject };

export function isDraftPreviewEnabled(nodeEnv?: string): boolean;
export function listDrafts(options?: DraftReaderOptions): DraftSummary[];
export function loadDraft(kind: DraftKind, slug: string, options?: DraftReaderOptions): DraftLoadResult;
