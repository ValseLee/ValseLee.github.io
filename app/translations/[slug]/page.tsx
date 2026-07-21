import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import {
  formatTranslationDate,
  getAllTranslationSlugs,
  getTranslationBySlug,
} from "@/lib/translations";

interface TranslationPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllTranslationSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: TranslationPageProps) {
  const { slug } = await params;
  const translation = getTranslationBySlug(slug);

  if (!translation) {
    return { title: "Not Found" };
  }

  return {
    title: `${translation.frontmatter.title} | Translations`,
    description: translation.frontmatter.description,
  };
}

export default async function TranslationPage({ params }: TranslationPageProps) {
  const { slug } = await params;
  const translation = getTranslationBySlug(slug);

  if (!translation) {
    notFound();
  }

  return (
    <article className="w-full max-w-[75vw] mx-auto py-12">
      <Link
        href="/translations"
        className="inline-block text-subtext hover:text-foreground transition-colors mb-8"
      >
        ← 번역 목록으로
      </Link>

      <header className="mb-12">
        <p className="text-subtext text-sm mb-2">
          {translation.frontmatter.author}
          {translation.frontmatter.date &&
            ` · ${formatTranslationDate(translation.frontmatter.date)}`}
        </p>
        <h1 className="font-serif text-4xl md:text-5xl font-semibold mb-4">
          {translation.frontmatter.title}
        </h1>
        <div className="flex flex-wrap gap-2 items-center">
          {translation.frontmatter.tags.map((tag) => (
            <span
              key={tag}
              className="text-subtext text-sm px-2 py-0.5 border border-border rounded"
            >
              {tag}
            </span>
          ))}
          {translation.frontmatter.source && (
            <a
              href={translation.frontmatter.source}
              target="_blank"
              rel="noopener noreferrer"
              className="text-subtext text-sm underline underline-offset-2 hover:text-foreground transition-colors"
            >
              원문 보기 ↗
            </a>
          )}
        </div>
      </header>

      <div className="prose">
        <MDXRemote source={translation.content} />
      </div>
    </article>
  );
}
