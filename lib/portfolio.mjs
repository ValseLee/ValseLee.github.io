import path from "node:path";

export const PORTFOLIO_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg"]);
export const PORTFOLIO_VIDEO_EXTENSIONS = new Set([".mp4"]);

function todayString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createSlug(title, date = new Date()) {
  const slug = String(title ?? "")
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC")
    .replace(/[’']/g, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || `post-${todayString(date)}`;
}

function requiredPortfolioText(value, field, maxLength) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  const normalized = value.trim();
  if (maxLength !== undefined && normalized.length > maxLength) {
    throw new Error(`${field} must be at most ${maxLength} characters`);
  }
  return normalized;
}

export function normalizePortfolioSrc(value, field) {
  if (typeof value !== "string" || !value.startsWith("/portfolio/")) {
    throw new Error(`${field} must be /portfolio/<filename>`);
  }

  const fileName = value.slice("/portfolio/".length);
  let decodedFileName;
  try {
    decodedFileName = decodeURIComponent(fileName);
  } catch {
    throw new Error(`${field} must be /portfolio/<filename>`);
  }
  if (!fileName || path.posix.basename(decodedFileName) !== decodedFileName || decodedFileName.includes("\\")) {
    throw new Error(`${field} must be /portfolio/<filename>`);
  }

  const extension = path.extname(decodedFileName).toLowerCase();
  if (!PORTFOLIO_IMAGE_EXTENSIONS.has(extension) && !PORTFOLIO_VIDEO_EXTENSIONS.has(extension)) {
    throw new Error(`${field} has an unsupported extension`);
  }
  return value;
}

function normalizePortfolioCoverImage(rawCover) {
  if (!rawCover || typeof rawCover !== "object" || Array.isArray(rawCover)) {
    throw new Error("coverImage is invalid");
  }
  const src = normalizePortfolioSrc(rawCover.src, "coverImage.src");
  const extension = path.extname(decodeURIComponent(src)).toLowerCase();
  if (!PORTFOLIO_IMAGE_EXTENSIONS.has(extension)) {
    throw new Error("coverImage.src must be an image");
  }
  return { src, alt: requiredPortfolioText(rawCover.alt, "coverImage.alt") };
}

export function normalizePortfolioProject(rawProject) {
  if (!rawProject || typeof rawProject !== "object" || Array.isArray(rawProject)) {
    throw new Error("project must be an object");
  }

  const name = requiredPortfolioText(rawProject.name, "name", 120);
  const slug = rawProject.slug ? requiredPortfolioText(rawProject.slug, "slug") : createSlug(name);
  if (!/^[\p{Letter}\p{Number}]+(?:-[\p{Letter}\p{Number}]+)*$/u.test(slug)) {
    throw new Error("slug is invalid");
  }
  if (typeof rawProject.descriptionMarkdown !== "string" || !rawProject.descriptionMarkdown.trim()) {
    throw new Error("descriptionMarkdown is required");
  }
  if (rawProject.descriptionMarkdown.length > 50_000) {
    throw new Error("descriptionMarkdown must be at most 50000 characters");
  }
  if (!Array.isArray(rawProject.media) || rawProject.media.length > 20) {
    throw new Error("media must contain at most 20 items");
  }
  const coverImage = rawProject.coverImage === undefined
    ? undefined
    : normalizePortfolioCoverImage(rawProject.coverImage);

  return {
    slug,
    name,
    period: requiredPortfolioText(rawProject.period, "period", 80),
    descriptionMarkdown: rawProject.descriptionMarkdown,
    ...(coverImage ? { coverImage } : {}),
    media: rawProject.media.map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new Error(`media[${index}] is invalid`);
      }
      const src = normalizePortfolioSrc(item.src, `media[${index}].src`);
      const caption = requiredPortfolioText(item.caption, `media[${index}].caption`, 300);
      const extension = path.extname(src).toLowerCase();
      if (item.kind === "image" && PORTFOLIO_IMAGE_EXTENSIONS.has(extension)) {
        return { kind: "image", src, caption, alt: requiredPortfolioText(item.alt, `media[${index}].alt`) };
      }
      if (item.kind === "video" && PORTFOLIO_VIDEO_EXTENSIONS.has(extension)) {
        return { kind: "video", src, caption };
      }
      throw new Error(`media[${index}].kind does not match src`);
    }),
  };
}

export function normalizePortfolioContent(rawContent) {
  if (!rawContent || typeof rawContent !== "object" || Array.isArray(rawContent) || !Array.isArray(rawContent.projects)) {
    throw new Error("portfolio.projects must be an array");
  }
  const projects = rawContent.projects.map(normalizePortfolioProject);
  if (new Set(projects.map(({ slug }) => slug)).size !== projects.length) {
    throw new Error("duplicate project slug");
  }
  return { projects };
}

export function mergePortfolioProject(content, project) {
  const projects = [...content.projects];
  const index = projects.findIndex(({ slug }) => slug === project.slug);
  if (index === -1) projects.push(project);
  else projects[index] = project;
  return { projects };
}
