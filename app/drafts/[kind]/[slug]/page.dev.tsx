import { notFound } from "next/navigation";

import PostArticle from "@/components/PostArticle";
import PortfolioProjectArticle from "@/components/PortfolioProjectArticle";
import { isDraftPreviewEnabled, listDrafts, loadDraft } from "@/lib/draft-preview.mjs";

interface DraftPageProps {
  params: Promise<{ kind: string; slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  if (!isDraftPreviewEnabled()) return [];
  return listDrafts().map(({ kind, slug }) => ({ kind, slug }));
}

export default async function DraftPage({ params }: DraftPageProps) {
  const { kind, slug: encodedSlug } = await params;
  if (kind !== "articles" && kind !== "portfolio") notFound();

  let slug: string;
  try {
    slug = decodeURIComponent(encodedSlug);
  } catch {
    notFound();
  }

  const result = loadDraft(kind, slug);
  if (result.status === "invalid") {
    return (
      <main className="py-12">
        <h1 className="font-serif text-4xl font-semibold mb-4">Local draft error</h1>
        <p className="text-subtext mb-2">{result.slug}</p>
        <p>{result.message}</p>
      </main>
    );
  }
  if (result.status !== "ok") notFound();
  if (result.kind === "articles") return <PostArticle post={result.article} />;

  return <PortfolioProjectArticle project={result.project} />;
}
