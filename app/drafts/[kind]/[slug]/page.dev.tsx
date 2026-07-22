import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";

import PostArticle from "@/components/PostArticle";
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

  return (
    <article className="w-full max-w-[75vw] mx-auto py-12">
      <header className="mb-12">
        <p className="text-subtext text-sm mb-2">{result.project.period}</p>
        <h1 className="font-serif text-4xl md:text-5xl font-semibold">{result.project.name}</h1>
      </header>
      <div className="prose">
        <MDXRemote source={result.project.descriptionMarkdown} />
      </div>
      <div className="mt-12 space-y-8">
        {result.project.media.map((media, index) => (
          <figure key={`${media.src}-${index}`}>
            {media.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media.src} alt={media.alt} />
            ) : (
              <video src={media.src} controls preload="metadata" />
            )}
            <figcaption className="text-subtext text-sm mt-2">{media.caption}</figcaption>
          </figure>
        ))}
      </div>
    </article>
  );
}
