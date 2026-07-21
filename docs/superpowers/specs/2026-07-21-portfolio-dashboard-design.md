# Portfolio Dashboard Design

**Date:** 2026-07-21
**Status:** Approved

## Goal

Add a localhost-only portfolio authoring dashboard that stores structured project data, accepts multiple images and MP4 files with per-media captions, previews Markdown descriptions, supports drafts, and publishes through the existing build, commit, and push workflow.

## Scope

### Included

- `npm run portfolio` as a dedicated local dashboard command.
- Creating projects and loading or editing existing projects.
- One Markdown description and multiple ordered media items per project.
- A required caption for every image or video.
- Local draft save and load.
- Validated, atomic updates to tracked portfolio data.
- `npm run build`, explicit-path staging, commit, and push.
- Focused `node:test` coverage using the existing dashboard test surface.

### Excluded

- Public portfolio rendering in `expertise-grid`.
- Any change to `app/page.tsx`.
- Any change to public site CSS, including `app/globals.css`.
- Media conversion, compression, thumbnails, external storage, or orphan-file cleanup.
- New runtime or development dependencies.

The local dashboard may reuse the article dashboard's existing inline styles. It must not import or modify public site CSS.

## Chosen Approach

Extend `scripts/article-dashboard.mjs` with a portfolio mode. `npm run write` keeps its current article behavior, while `npm run portfolio` runs `node scripts/article-dashboard.mjs portfolio` and starts the same localhost-only Node server with portfolio-specific HTML and `/api/portfolio/*` endpoints. The portfolio mode uses port 4318 by default and accepts a `PORTFOLIO_DASHBOARD_PORT` override without changing the article dashboard's port or environment variable.

This reuses the existing `node:http` server, `127.0.0.1` binding, same-origin POST protection, request parsing, slug and collision handling, draft patterns, command runner, logs, and guarded process startup. A separate dashboard framework or shared abstraction module is unnecessary.

Rejected alternatives:

- A separate dashboard plus a new shared core would add files and abstractions before a third consumer exists.
- Project-per-MDX storage would make ordered structured media metadata and future portfolio ordering harder to manage.

## Data Contract

The canonical tracked file is `content/portfolio.json`:

```json
{
  "projects": [
    {
      "slug": "loutine",
      "name": "Loutine",
      "period": "2025.01 — Present",
      "descriptionMarkdown": "## Project description\n\nMarkdown content.",
      "media": [
        {
          "kind": "image",
          "src": "/portfolio/loutine-home.png",
          "caption": "Home screen",
          "alt": "Loutine home screen"
        },
        {
          "kind": "video",
          "src": "/portfolio/loutine-demo.mp4",
          "caption": "Routine execution"
        }
      ]
    }
  ]
}
```

- `slug` is created with the existing slug helper for new projects and remains stable when a project name changes.
- Project order and media order are their array order.
- `descriptionMarkdown` stores Markdown source, not rendered HTML.
- `kind` is either `image` or `video`.
- `src` points to a direct child of `public/portfolio/`.
- Every media item has a non-empty caption.
- Image items have a required, non-empty `alt`; video items do not have an `alt` field.
- `content/portfolio.json` begins with an empty `projects` array and is validated by `verify:content` even though no public renderer consumes it in this scope.

## Dashboard Screen

Reuse the article dashboard's single-form and sticky-preview layout.

1. **Project controls:** an existing-project select and a New Project button. Loading another project while the form is dirty uses native `confirm()` to prevent accidental loss.
2. **Project fields:** name, period, and a Markdown description textarea.
3. **Media controls:** native `<input type="file" multiple accept="image/*,video/mp4">`. Files upload sequentially to preserve selection order.
4. **Media rows:** preview, stored path, required caption input, an additional required alt input for images only, Move Up, Move Down, and Remove buttons. Video rows do not show or store alt. Removal changes only the current project payload; it does not delete the uploaded file.
5. **Preview:** project name, period, Markdown rendered through the existing `micromark` path, then ordered `<figure>` elements using `<img>` or `<video controls preload="metadata">` and `<figcaption>`.
6. **Persistence:** saved-draft select, Load, Save Draft, and Save, Commit & Push actions.
7. **Feedback:** reuse the existing status and command-log regions. Disable only actions involved in the active request.

No drag-sort library, modal system, state library, or custom file picker is introduced.

## API Contract

Portfolio endpoints exist only when the server runs in portfolio mode:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | Return the portfolio dashboard HTML. |
| `GET` | `/api/portfolio` | Return canonical projects. |
| `GET` | `/api/portfolio/drafts` | Return draft summaries: `fileName`, `name`, and `updatedAt`. |
| `GET` | `/api/portfolio/draft?file=<name>` | Return one complete draft project. |
| `POST` | `/api/portfolio/draft` | Validate and atomically save one project draft. |
| `POST` | `/api/portfolio/media` | Accept one binary image or MP4 and return its stored path and kind. |
| `POST` | `/api/portfolio/preview` | Convert `{ "markdown": string }` to preview HTML with `micromark`. |
| `POST` | `/api/portfolio/publish` | Validate, merge, build, commit, and push one project. |
| `GET` | `/portfolio/<filename>` | Serve an uploaded asset to the local preview. |

Draft and publish requests use the project shape from the data contract. A successful media response returns `kind`, `fileName`, `filePath`, and `src`. A publish response returns `ok`, `committed`, `slug`, `filePath`, `commitMessage`, and `logs`; failures also return an actionable `error`.

## Validation and Media Limits

All request values are treated as untrusted and normalized before mutation.

- Project name: required, at most 120 characters.
- Period: required, at most 80 characters.
- Markdown description: required, at most 50,000 characters.
- Media: at most 20 items per project.
- Caption: required for every item, at most 300 characters.
- Image alt: required and non-empty; video items do not accept or retain an alt field.
- JSON request body: retain the existing 1 MiB limit.
- `src`: exactly `/portfolio/<filename>`; reject separators, traversal, absolute paths, and unsupported extensions.
- Images: PNG, JPEG, GIF, WebP, AVIF, or SVG; at most 10 MiB.
- Video: `.mp4` with `video/mp4`; at most 50 MiB.
- The extension and `Content-Type` must agree.
- Uploaded names are slugged and receive `-2`, `-3`, and later suffixes on collision.

The same project validator is used for canonical content, drafts, and publish payloads. Validation errors identify the failing field without returning stack traces or arbitrary filesystem paths.

## Draft Flow

1. Validate the complete project.
2. Write `.portfolio-drafts/<slug>.json.tmp`.
3. Rename it to `.portfolio-drafts/<slug>.json` only after the write completes.
4. Keep `.portfolio-drafts/` ignored and outside commit or push operations.

Invalid input or a write failure leaves the previous draft unchanged. Malformed drafts remain visible in the draft list but return a clear error when loaded. Uploaded media stays in `public/portfolio/` as an untracked, recoverable file if draft saving fails.

## Publish Flow

1. Validate the submitted project and current canonical data.
2. Retain the exact previous `content/portfolio.json` bytes, or note that the file did not exist.
3. Merge by stable slug, preserving array position for edits and appending new projects.
4. Stop with a "no changes" result before running Git commands when neither data nor referenced assets changed.
5. Write a sibling temporary JSON file and rename it over the canonical file.
6. Run `npm run build`.
7. Stage only `content/portfolio.json` and media referenced by the submitted project.
8. Commit with `YYYY-MM-DD update portfolio - <project name>`.
9. Run the existing `git push` command.

Before a commit succeeds, any failure unstages the explicit paths and restores the previous canonical bytes, or removes a newly created canonical file. Uploaded media remains untracked. After a commit succeeds, a push failure keeps the commit and returns `committed: true` with command logs. Unrelated working-tree changes are never staged, restored, deleted, or committed. Missing branch upstream configuration is reported as a push failure rather than changed automatically.

## Verification

Add the smallest behavior-focused cases to `scripts/article-dashboard.test.mjs`:

1. Normalize a project with multiple ordered images and MP4 files, captions, a required image alt, and no video alt.
2. Reject a missing caption, missing image alt, unsafe `src`, MIME or extension mismatch, unsupported file, excess media count, and oversized upload.
3. Round-trip a draft and prove invalid replacement preserves the previous draft.
4. Update an existing project by slug and stage only the canonical JSON and referenced media.
5. Restore canonical content after a pre-commit failure and retain a successful commit after push failure.
6. Exercise the real portfolio media endpoint with an MP4 and reject a cross-origin POST.

Implementation verification runs, in order:

```text
node --test scripts/article-dashboard.test.mjs
npm test
npm run verify:content
npm run lint
npm run build
git diff --check
```

No public rendering or visual regression check is required because `expertise-grid`, `app/page.tsx`, and public CSS are explicitly outside this design.
