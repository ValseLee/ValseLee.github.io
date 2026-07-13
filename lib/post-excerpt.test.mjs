import test from "node:test";
import assert from "node:assert/strict";
import { createPostExcerpt } from "./post-excerpt.mjs";

test("createPostExcerpt strips Markdown and keeps at most ten sentences", () => {
  const markdown = `# 제목

첫 문장입니다. **둘째 문장입니다.** [셋째 문장입니다.](https://example.com)

\`\`\`ts
const hidden = "미리보기에 포함하지 않습니다.";
\`\`\`

넷째입니다. 다섯째입니다. 여섯째입니다. 일곱째입니다. 여덟째입니다. 아홉째입니다. 열째입니다. 열한째입니다.`;
  const excerpt = createPostExcerpt(markdown);

  assert.equal(excerpt.includes("const hidden"), false);
  assert.equal(excerpt.includes("**"), false);
  assert.equal(excerpt.includes("열한째"), false);
  assert.equal(excerpt, "제목 첫 문장입니다. 둘째 문장입니다. 셋째 문장입니다. 넷째입니다. 다섯째입니다. 여섯째입니다. 일곱째입니다. 여덟째입니다. 아홉째입니다. 열째입니다.");
});

test("createPostExcerpt bounds punctuation-poor content at a word boundary", () => {
  const excerpt = createPostExcerpt(Array.from({ length: 100 }, (_, index) => `word${index}`).join(" "));

  assert.ok(excerpt.length <= 320);
  assert.match(excerpt, /word\d+…$/);
});
