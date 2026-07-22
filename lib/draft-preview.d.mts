import type { Post } from "./posts";

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

export type PortfolioMedia =
  | { kind: "image"; src: string; caption: string; alt: string }
  | { kind: "video"; src: string; caption: string };

export interface PortfolioProject {
  slug: string;
  name: string;
  period: string;
  descriptionMarkdown: string;
  media: PortfolioMedia[];
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
