import Link from "next/link";
import { getPostsByYear } from "@/lib/posts";

export default function ArchivePage() {
  const postsByYear = getPostsByYear();
  const years = Object.keys(postsByYear).sort((a, b) => Number(b) - Number(a));

  return (
    <div className="py-12">
      <h1 className="font-serif text-4xl font-semibold mb-12">Archive</h1>

      {years.length === 0 && (
        <p className="text-subtext">아직 작성된 글이 없습니다.</p>
      )}

      {years.map((year) => (
        <section key={year} className="mb-12">
          <h2 className="font-serif text-2xl font-medium mb-6 text-accent">
            {year}
          </h2>
          <ul className="space-y-3">
            {postsByYear[year].map((post) => {
              const date = new Date(post.frontmatter.date);
              const formattedDate = `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;

              return (
                <li key={post.slug}>
                  <Link
                    href={`/posts/${post.slug}`}
                    className="group flex items-baseline gap-4 transition-opacity duration-200 hover:opacity-70"
                  >
                    <span className="text-subtext text-sm font-mono w-12">
                      {formattedDate}
                    </span>
                    <span className="text-foreground">
                      {post.frontmatter.title}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
