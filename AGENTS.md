# AGENTS.md

This file provides repository-level guidance to coding agents working on this project.

## Guidance Bootstrap

Repo-local rules live in `.codex/guidance/`.

For every repository task, read `.codex/guidance/index.md` before planning, editing, reviewing, testing, or finalizing. Apply its Quick Reference, then load only the rule files matched by the request, touched paths, imports, and implementation surface.

Before completion, always load `.codex/guidance/verify.md`. Plans, handoffs, reviews, and final responses must include:

```text
Guidance loaded: index.md, verify.md, <matched files or none>
```

When work is delegated, include the same bootstrap requirement and require the delegate to report the guidance it loaded.

## Project Overview

This is a personal mini blog for writing and organizing thoughts. It uses Next.js 16 App Router, React 19, strict TypeScript, MDX, and Tailwind CSS 4.

## Repository Boundaries

- `app/`: routes, layouts, metadata, and page composition.
- `components/`: reusable and interactive UI.
- `lib/`: shared content readers, transformations, and types.
- `content/`: tracked MDX and JSON build inputs.
- `scripts/`: localhost-only authoring and verification tools.

## Deployment

The public site is a static export deployed to GitHub Pages. Keep `output: "export"` compatible and do not add deployed write APIs or admin routes. Local authoring runs through `npm run write` and remains bound to `127.0.0.1`.

## Verification Commands

- `npm test`
- `npm run verify:content`
- `npm run lint`
- `npm run build`
