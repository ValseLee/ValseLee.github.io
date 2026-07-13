const MAX_EXCERPT_CHARS = 320;

export function createPostExcerpt(markdown, maxSentences = 10) {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`#>*_~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!plain || maxSentences < 1) return "";
  const excerpt = [...new Intl.Segmenter("ko", { granularity: "sentence" }).segment(plain)]
    .slice(0, maxSentences)
    .map(({ segment }) => segment.trim())
    .join(" ");

  if (excerpt.length <= MAX_EXCERPT_CHARS) return excerpt;
  let boundary = 0;
  for (const { index, segment } of new Intl.Segmenter("ko", { granularity: "word" }).segment(excerpt)) {
    if (index + segment.length >= MAX_EXCERPT_CHARS) break;
    boundary = index + segment.length;
  }
  return `${excerpt.slice(0, boundary || MAX_EXCERPT_CHARS - 1).trimEnd()}…`;
}
