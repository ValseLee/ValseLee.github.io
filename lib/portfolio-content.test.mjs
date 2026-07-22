import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getAllPortfolioProjects, getPortfolioProjectBySlug } from "./portfolio-content.mjs";

test("canonical portfolio reader normalizes list and slug lookup", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-content-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "content"));
  fs.writeFileSync(path.join(root, "content", "portfolio.json"), JSON.stringify({ projects: [{
    slug: "loutine",
    name: "Loutine",
    period: "2026.06.22 — Present",
    descriptionMarkdown: "Description",
    coverImage: { src: "/portfolio/cover.png", alt: " Cover " },
    media: [],
  }] }));

  assert.equal(getAllPortfolioProjects(root)[0].coverImage.alt, "Cover");
  assert.equal(getPortfolioProjectBySlug("loutine", root)?.name, "Loutine");
  assert.equal(getPortfolioProjectBySlug("missing", root), null);
  assert.equal(getPortfolioProjectBySlug("bad%encoding", root), null);
});
