import Link from "next/link";
import { POST_CATEGORIES } from "@/lib/categories";
import { getPostsByCategory } from "@/lib/posts";

export default function CategoriesPage() {
  const categories = POST_CATEGORIES.map((category) => ({
    ...category,
    posts: getPostsByCategory(category.id),
  }));

  return (
    <div className="py-12">
      <h1 className="font-serif text-4xl font-semibold mb-12">Categories</h1>

      <div className="space-y-16">
        {categories.map((category) => (
          <section key={category.id}>
            <div className="mb-6">
              <h2>
                {category.label}
              </h2>
              <p className="text-subtext text-sm mt-1">{category.description}</p>
            </div>

            {category.posts.length === 0 ? (
              <p className="text-subtext">이 카테고리에 글이 없습니다.</p>
            ) : (
              <ul className="space-y-3">
                {category.posts.map((post) => {
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
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
