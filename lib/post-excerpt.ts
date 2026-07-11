export function createPostExcerpt(markdown: string, maxSentences = 10): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`#>*_~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!plain || maxSentences < 1) return "";
  return [...new Intl.Segmenter("ko", { granularity: "sentence" }).segment(plain)]
    .slice(0, maxSentences)
    .map(({ segment }) => segment.trim())
    .join(" ");
}
