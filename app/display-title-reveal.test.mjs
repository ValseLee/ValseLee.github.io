import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const appDirectory = dirname(fileURLToPath(import.meta.url));
const [page, styles, site] = await Promise.all([
  readFile(join(appDirectory, "page.tsx"), "utf8"),
  readFile(join(appDirectory, "globals.css"), "utf8"),
  readFile(join(appDirectory, "../content/site.tsx"), "utf8"),
]);

test("display title uses a reduced-motion-safe vertical cut reveal", () => {
  assert.match(site, /title:\s*\["👋 안녕하세요,", "iOS Product Engineer", "이승준 입니다\."\]/);
  assert.match(page, /site\.identity\.title\.map/);
  assert.match(page, /line\.split\(" "\)/);
  assert.match(page, /Array\.from\(word\)/);
  assert.match(page, /animationDelay:\s*character\.delay/);
  assert.match(page, /aria-label=\{site\.identity\.title\.join\(" "\)\}/);
  assert.match(
    page,
    /<\/span>\s*\{wordIndex < line\.length - 1 && " "\}\s*<\/Fragment>/s,
  );
  assert.match(styles, /\.display-title-cut\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(styles, /@keyframes display-title-reveal/);
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.display-title-character\s*\{[^}]*animation:\s*none/s,
  );
});
