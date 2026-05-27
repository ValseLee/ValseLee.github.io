import Link from "next/link";
import { getAllPosts } from "@/lib/posts";

export default function Home() {
  const recentPosts = getAllPosts().slice(0, 5);

  return (
    <div className="py-12">
      <section className="mb-16">
        <h1 className="font-serif text-5xl font-semibold mb-6">Thoughts</h1>
        <p className="text-subtext text-lg leading-relaxed max-w-xl">
          빌드 로그, 창업자 노트, 엔지니어링과 일상에 대한 생각을 기록합니다.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-2xl font-medium mb-8">Recent</h2>
        <ul className="space-y-4">
          {recentPosts.map((post) => {
            const date = new Date(post.frontmatter.date);
            const formattedDate = `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;

            return (
              <li key={post.slug}>
                <Link
                  href={`/posts/${post.slug}`}
                  className="group flex items-baseline gap-4 transition-opacity duration-200 hover:opacity-70"
                >
                  <span className="text-subtext text-sm font-mono">
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

        {recentPosts.length === 0 && (
          <p className="text-subtext">아직 작성된 글이 없습니다.</p>
        )}

        <Link
          href="/archive"
          className="inline-block mt-8 text-subtext hover:text-foreground transition-colors duration-200"
        >
          모든 글 보기 →
        </Link>
      </section>
    </div>
  );
}
