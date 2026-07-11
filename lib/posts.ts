import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { type PostCategory } from "@/lib/categories";
import { createPostExcerpt } from "@/lib/post-excerpt";
export { POST_CATEGORIES, type PostCategory } from "@/lib/categories";

const postsDirectory = path.join(process.cwd(), "content/posts");

export interface PostFrontmatter {
  title: string;
  date: string;
  category: PostCategory;
  tags: string[];
  links: string[];
  description: string;
}

export interface Post {
  slug: string;
  frontmatter: PostFrontmatter;
  content: string;
}

export interface PostMeta {
  slug: string;
  frontmatter: PostFrontmatter;
  excerpt: string;
}

export function getAllPosts(): PostMeta[] {
  const fileNames = fs.readdirSync(postsDirectory);
  const posts = fileNames
    .filter((fileName) => fileName.endsWith(".mdx"))
    .map((fileName) => {
      const slug = fileName.replace(/\.mdx$/, "");
      const fullPath = path.join(postsDirectory, fileName);
      const fileContents = fs.readFileSync(fullPath, "utf8");
      const { data, content } = matter(fileContents);

      return {
        slug,
        frontmatter: data as PostFrontmatter,
        excerpt: createPostExcerpt(content),
      };
    });

  return posts.sort((a, b) =>
    new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime()
  );
}

export function getPostBySlug(slug: string): Post | null {
  try {
    const decodedSlug = decodeURIComponent(slug);
    const fullPath = path.join(postsDirectory, `${decodedSlug}.mdx`);
    const fileContents = fs.readFileSync(fullPath, "utf8");
    const { data, content } = matter(fileContents);

    return {
      slug: decodedSlug,
      frontmatter: data as PostFrontmatter,
      content,
    };
  } catch {
    return null;
  }
}

export function getAllSlugs(): string[] {
  const fileNames = fs.readdirSync(postsDirectory);
  return fileNames
    .filter((fileName) => fileName.endsWith(".mdx"))
    .map((fileName) => fileName.replace(/\.mdx$/, ""));
}

export function getPostsByCategory(category: PostCategory): PostMeta[] {
  return getAllPosts().filter((post) => post.frontmatter.category === category);
}

export function getPostsByYear(): Record<string, PostMeta[]> {
  const posts = getAllPosts();
  const byYear: Record<string, PostMeta[]> = {};

  posts.forEach((post) => {
    const year = new Date(post.frontmatter.date).getFullYear().toString();
    if (!byYear[year]) {
      byYear[year] = [];
    }
    byYear[year].push(post);
  });

  return byYear;
}

export function getGraphData(): { nodes: { id: string; category: string; title: string }[]; links: { source: string; target: string }[] } {
  const posts = getAllPosts();

  const nodes = posts.map((post) => ({
    id: post.slug,
    category: post.frontmatter.category,
    title: post.frontmatter.title,
  }));

  const links: { source: string; target: string }[] = [];
  const slugSet = new Set(posts.map((p) => p.slug));

  posts.forEach((post) => {
    post.frontmatter.links.forEach((linkedSlug) => {
      if (slugSet.has(linkedSlug)) {
        links.push({
          source: post.slug,
          target: linkedSlug,
        });
      }
    });
  });

  return { nodes, links };
}
