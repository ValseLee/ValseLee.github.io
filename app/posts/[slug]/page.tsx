import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getAllSlugs, getPostBySlug } from "@/lib/posts";
import Link from "next/link";

interface PostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PostPageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return { title: "Not Found" };
  }

  return {
    title: `${post.frontmatter.title} | Thoughts`,
    description: post.frontmatter.description,
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const formattedDate = new Date(post.frontmatter.date).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <article className="py-12">
      <header className="mb-12">
        <p className="text-subtext text-sm mb-2">
          {formattedDate} · {post.frontmatter.category}
        </p>
        <h1 className="font-serif text-4xl md:text-5xl font-semibold mb-4">
          {post.frontmatter.title}
        </h1>
        {post.frontmatter.tags.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {post.frontmatter.tags.map((tag) => (
              <span
                key={tag}
                className="text-subtext text-sm px-2 py-0.5 border border-border rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="prose">
        <MDXRemote source={post.content} />
      </div>

      {post.frontmatter.links.length > 0 && (
        <footer className="mt-12 pt-8 border-t border-border">
          <h2 className="font-serif text-xl font-semibold mb-4">Related Posts</h2>
          <ul className="space-y-2">
            {post.frontmatter.links.map((linkedSlug) => (
              <li key={linkedSlug}>
                <Link
                  href={`/posts/${linkedSlug}`}
                  className="text-subtext hover:text-foreground transition-colors"
                >
                  → {linkedSlug}
                </Link>
              </li>
            ))}
          </ul>
        </footer>
      )}
    </article>
  );
}
