import fs from "fs";
import path from "path";
import matter from "gray-matter";

const translationsDirectory = path.join(process.cwd(), "content/translations");

export interface TranslationFrontmatter {
  title: string;
  date: string;
  author: string;
  source: string;
  description: string;
  tags: string[];
}

export interface Translation {
  slug: string;
  frontmatter: TranslationFrontmatter;
  content: string;
}

export interface TranslationMeta {
  slug: string;
  frontmatter: TranslationFrontmatter;
}

function getTranslationFileNames(): string[] {
  if (!fs.existsSync(translationsDirectory)) {
    return [];
  }

  return fs
    .readdirSync(translationsDirectory)
    .filter((fileName) => fileName.endsWith(".mdx"));
}

function normalizeFrontmatter(data: Record<string, unknown>): TranslationFrontmatter {
  return {
    title: String(data.title ?? "Untitled"),
    date: String(data.date ?? ""),
    author: String(data.author ?? ""),
    source: String(data.source ?? ""),
    description: String(data.description ?? ""),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
  };
}

function dateValue(date: string): number {
  const parsed = Date.parse(date);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function formatTranslationDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    return date;
  }

  const parsed = Date.parse(date);
  if (Number.isNaN(parsed)) {
    return date;
  }

  return new Date(parsed).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function getAllTranslations(): TranslationMeta[] {
  return getTranslationFileNames()
    .map((fileName) => {
      const slug = fileName.replace(/\.mdx$/, "");
      const fullPath = path.join(translationsDirectory, fileName);
      const fileContents = fs.readFileSync(fullPath, "utf8");
      const { data } = matter(fileContents);

      return {
        slug,
        frontmatter: normalizeFrontmatter(data),
      };
    })
    .sort((a, b) => dateValue(b.frontmatter.date) - dateValue(a.frontmatter.date));
}

export function getTranslationBySlug(slug: string): Translation | null {
  try {
    const fullPath = path.join(translationsDirectory, `${slug}.mdx`);
    const fileContents = fs.readFileSync(fullPath, "utf8");
    const { data, content } = matter(fileContents);

    return {
      slug,
      frontmatter: normalizeFrontmatter(data),
      content,
    };
  } catch {
    return null;
  }
}

export function getAllTranslationSlugs(): string[] {
  return getTranslationFileNames().map((fileName) => fileName.replace(/\.mdx$/, ""));
}
