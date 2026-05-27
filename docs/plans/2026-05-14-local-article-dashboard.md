# Local Article Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a localhost-only dashboard that writes a new MDX post, verifies the site, commits with `yyyy-MM-dd new article written by Celan - {POST_TITLE}`, and pushes.

**Architecture:** Add a standalone Node `.mjs` script under `scripts/` so the static-export Next.js app remains deploy-safe. The script serves a blog-like editor UI on `127.0.0.1`, exposes one local JSON publish endpoint, writes only `content/posts/<slug>.mdx`, then runs verification/build/git commands.

**Tech Stack:** Node.js built-in `http`, `fs`, `child_process`, Next.js/MDX content files, npm scripts.

---

### Task 1: Dashboard helper tests

**Files:**
- Create: `scripts/article-dashboard.test.mjs`

**Steps:**
1. Test slug generation, frontmatter rendering, commit-message generation, and duplicate slug resolution.
2. Run `node --test scripts/article-dashboard.test.mjs`; expected RED before implementation.

### Task 2: Dashboard script

**Files:**
- Create: `scripts/article-dashboard.mjs`

**Steps:**
1. Export pure helpers used by the tests.
2. Serve a localhost-only dashboard UI that mimics the current dark typographic blog layout.
3. Implement `POST /api/publish` to validate form data, write MDX, run `npm run verify:content`, `npm run build`, `git add <post>`, `git commit -m ...`, and `git push`.
4. On verification/build failure before commit, remove the newly-created file and return logs to the UI.

### Task 3: npm wiring and docs

**Files:**
- Modify: `package.json`
- Modify: `README.md`

**Steps:**
1. Add `npm run write` and `npm run test:article-dashboard`.
2. Document the local-only publishing workflow.

### Task 4: Verification

**Commands:**
- `npm run test:article-dashboard`
- `npm run lint`
- `npm run verify:content`
- `npm run build`

