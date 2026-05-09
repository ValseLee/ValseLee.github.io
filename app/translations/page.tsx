import Link from "next/link";
import { formatTranslationDate, getAllTranslations } from "@/lib/translations";

export const metadata = {
  title: "Translations | Thoughts",
  description: "한국어로 옮긴 글 모음",
};

export default function TranslationsPage() {
  const translations = getAllTranslations();

  return (
    <div className="py-12">
      <h1 className="font-serif text-4xl font-semibold mb-4">Translations</h1>
      <p className="text-subtext mb-12 leading-relaxed">
        오래 두고 다시 읽고 싶은 글을 한국어로 옮겨 둔 아카이브입니다.
      </p>

      {translations.length === 0 && (
        <p className="text-subtext">아직 번역한 글이 없습니다.</p>
      )}

      <ul className="space-y-6">
        {translations.map((translation) => (
          <li key={translation.slug} className="border-b border-border pb-6 last:border-b-0">
            <Link
              href={`/translations/${translation.slug}`}
              className="group block transition-opacity duration-200 hover:opacity-70"
            >
              <h2 className="font-serif text-2xl font-medium mb-2">
                {translation.frontmatter.title}
              </h2>
              <p className="text-subtext text-sm">
                {translation.frontmatter.author}
                {translation.frontmatter.date &&
                  ` · ${formatTranslationDate(translation.frontmatter.date)}`}
              </p>
              {translation.frontmatter.description && (
                <p className="text-subtext mt-3 leading-relaxed">
                  {translation.frontmatter.description}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
