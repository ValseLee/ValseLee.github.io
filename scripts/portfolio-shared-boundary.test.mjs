import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("portfolio validation is owned by lib and consumed without importing the dashboard server", () => {
  const dashboard = fs.readFileSync("scripts/article-dashboard.mjs", "utf8");
  const verifier = fs.readFileSync("scripts/verify-content.mjs", "utf8");

  assert.match(dashboard, /from "\.\.\/lib\/portfolio\.mjs"/);
  assert.match(verifier, /from "\.\.\/lib\/portfolio\.mjs"/);
  assert.doesNotMatch(verifier, /article-dashboard\.mjs/);
});
