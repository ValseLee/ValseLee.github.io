# Rules Index

Repo-local guidance lives in `.codex/guidance/`. Read this file before repository work, apply the quick reference, then load only the rule files matched by the request and touched surface.

## Repository Task Bootstrap

- When `HERDR_ENV=1`, load `.codex/guidance/worktree-dispatch.md` before planning, editing, reviewing, or testing any repository task.

## Quick Reference (Always Apply)

- **Architecture:** Preserve `app/`, `components/`, `lib/`, `content/`, and `scripts/` ownership. Colocate first; add a layer only for a real second consumer or distinct lifecycle.
- **React:** Use Server Components by default and keep `"use client"` on the smallest interactive leaf.
- **TypeScript:** Keep strict types at boundaries; accept `unknown` and narrow it instead of using `any` or unchecked casts.
- **Styling:** Keep tokens and site primitives global, one-off utilities local, and non-trivial component styles in colocated CSS Modules. Parents do not reach into child internals.
- **Content:** Treat MDX, JSON, and TSX content modules as build inputs; keep public routes compatible with static export.
- **Local tools:** Keep writes in localhost-only `scripts/`, validate before mutation, and preserve existing files on failure.
- **Testing:** Protect non-trivial behavior with the smallest runnable regression check; use the existing `node:test` surface first.
- **Dependencies:** Reuse repository code, platform APIs, and installed packages before adding code or dependencies.
- **Completion:** Load `.codex/guidance/verify.md`, inspect the final diff, run surface-matched checks, and report evidence and gaps.

## Trigger -> Rule File

| Keywords or touched surface | Load |
| --- | --- |
| architecture, structure, boundary, module, dependency, refactor, Server Component, Client Component, `"use client"`, static export, `app/**`, `components/**`, `lib/**` | `.codex/guidance/architecture.md` |
| React, TypeScript, TSX, component, props, hook, state, effect, context, event, form, accessibility | `.codex/guidance/react-typescript.md` |
| CSS, style, Tailwind, className, CSS Module, responsive, token, animation, layout, `app/globals.css`, `*.module.css` | `.codex/guidance/styling.md` |
| MDX, frontmatter, content, post, translation, slug, static params, metadata, category, archive, `content/**` | `.codex/guidance/content.md` |
| script, dashboard, authoring, local server, write, upload, file save, localhost, `scripts/**` | `.codex/guidance/local-tools.md` |
| test, `node:test`, assert, TDD, regression, mock, fixture, parser validation, `*.test.*` | `.codex/guidance/testing.md` |
| verify, complete, done, final, review, acceptance criteria, handoff, build, lint | `.codex/guidance/verify.md` |

## Combined Surfaces

- Client-side visual work -> `architecture.md`, `react-typescript.md`, and `styling.md`.
- Content-backed route work -> `architecture.md`, `content.md`, and `testing.md` when behavior changes.
- Local authoring changes -> `local-tools.md`, `content.md` when the content contract changes, and `testing.md`.
- Shared library changes -> `architecture.md` and `testing.md`; also load `content.md` for content readers.
- Completion or handoff -> `verify.md` in addition to every file already matched.

## How to Use

1. Read this index before planning, editing, reviewing, testing, or finalizing.
2. Detect triggers from the request, touched paths, imports, and implementation surface.
3. Load every matching file, preferring the more specific rule when guidance overlaps.
4. Apply rules to new and changed code; do not launch unrelated migrations solely to satisfy a preferred pattern.
5. Before completion, load `verify.md` and report `Guidance loaded: index.md, verify.md, <matched files or none>`.
