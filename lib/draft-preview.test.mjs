import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const subjectPromise = import("./draft-preview.mjs").catch(() => null);

function fixtureRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "draft-preview-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, ".article-drafts"));
  fs.mkdirSync(path.join(root, ".portfolio-drafts"));
  return root;
}

test("draft preview reader exposes its public API", async () => {
  const subject = await subjectPromise;
  assert.ok(subject, "draft preview module must be available");
  for (const name of ["isDraftPreviewEnabled", "listDrafts", "loadDraft"]) assert.equal(typeof subject[name], "function");
});

test("development lists and loads both draft formats", async (t) => {
  const { listDrafts, loadDraft } = await subjectPromise;
  const root = fixtureRoot(t);
  fs.writeFileSync(path.join(root, ".article-drafts", "local-note.mdx"), `---\ntitle: Local Note\ndate: 2026-07-22\ncategory: engineering\ntags: [draft]\nlinks: []\ndescription: Local description\n---\n\n# Draft body\n`);
  fs.writeFileSync(path.join(root, ".portfolio-drafts", "local-project.json"), JSON.stringify({ slug: "local-project", name: "Local Project", period: "2026 — Present", descriptionMarkdown: "## Portfolio draft", media: [] }));
  assert.deepEqual(listDrafts({ root, nodeEnv: "development" }).map(({ kind, slug, label, valid }) => ({ kind, slug, label, valid })), [
    { kind: "articles", slug: "local-note", label: "Local Note", valid: true },
    { kind: "portfolio", slug: "local-project", label: "Local Project", valid: true },
  ]);
  assert.equal(loadDraft("articles", "local-note", { root, nodeEnv: "development" }).article.content.trim(), "# Draft body");
  assert.equal(loadDraft("portfolio", "local-project", { root, nodeEnv: "development" }).project.name, "Local Project");
});

test("an impossible unquoted article date is invalid", async (t) => {
  const { loadDraft } = await subjectPromise;
  const root = fixtureRoot(t);
  fs.writeFileSync(path.join(root, ".article-drafts", "impossible-date.mdx"), `---\ntitle: Impossible Date\ndate: 2026-02-30\ncategory: engineering\ntags: []\nlinks: []\ndescription: Invalid calendar date\n---\n\nDraft body\n`);

  assert.equal(loadDraft("articles", "impossible-date", { root, nodeEnv: "development" }).status, "invalid");
});

test("draft listing and loading exclude directories and symlinks", async (t) => {
  const { listDrafts, loadDraft } = await subjectPromise;
  const root = fixtureRoot(t);
  const draftsDirectory = path.join(root, ".article-drafts");
  const source = `---\ntitle: External Draft\ndate: 2026-07-22\ncategory: engineering\ntags: []\nlinks: []\ndescription: External file\n---\n\nDraft body\n`;
  fs.mkdirSync(path.join(draftsDirectory, "folder.mdx"));
  fs.writeFileSync(path.join(root, "external.mdx"), source);
  fs.symlinkSync(path.join(root, "external.mdx"), path.join(draftsDirectory, "linked.mdx"));

  assert.deepEqual(listDrafts({ root, nodeEnv: "development" }), []);
  assert.deepEqual(loadDraft("articles", "folder", { root, nodeEnv: "development" }), { status: "missing" });
  assert.deepEqual(loadDraft("articles", "linked", { root, nodeEnv: "development" }), { status: "missing" });
});

test("missing malformed and unsafe drafts return safe results", async (t) => {
  const { listDrafts, loadDraft } = await subjectPromise;
  const root = fixtureRoot(t);
  fs.writeFileSync(path.join(root, ".article-drafts", "broken.mdx"), "not frontmatter");
  fs.writeFileSync(path.join(root, ".portfolio-drafts", "broken.json"), "{");
  fs.writeFileSync(path.join(root, ".portfolio-drafts", "wrong-name.json"), JSON.stringify({ slug: "different-name", name: "Mismatch", period: "2026", descriptionMarkdown: "Draft", media: [] }));
  for (const [kind, slug] of [["articles", "broken"], ["portfolio", "broken"]]) {
    const result = loadDraft(kind, slug, { root, nodeEnv: "development" });
    assert.equal(result.status, "invalid");
    assert.doesNotMatch(result.message, new RegExp(root));
  }
  assert.deepEqual(loadDraft("portfolio", "wrong-name", { root, nodeEnv: "development" }), { status: "missing" });
  assert.deepEqual(loadDraft("articles", "missing", { root, nodeEnv: "development" }), { status: "missing" });
  assert.deepEqual(loadDraft("articles", "../secret", { root, nodeEnv: "development" }), { status: "missing" });
  assert.deepEqual(loadDraft("articles", "secret.json", { root, nodeEnv: "development" }), { status: "missing" });
  assert.deepEqual(listDrafts({ root, nodeEnv: "development" }).filter(({ valid }) => !valid), [
    { kind: "articles", slug: "broken", label: "broken", valid: false },
    { kind: "portfolio", slug: "broken", label: "broken", valid: false },
  ]);
  assert.deepEqual(listDrafts({ root: path.join(root, "empty"), nodeEnv: "development" }), []);
});

test("production disables drafts before filesystem access", async () => {
  const { listDrafts, loadDraft } = await subjectPromise;
  const options = { root: "/path-that-must-not-be-read", nodeEnv: "production" };
  assert.deepEqual(listDrafts(options), []);
  assert.deepEqual(loadDraft("articles", "local-note", options), { status: "disabled" });
});
