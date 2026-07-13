# React and TypeScript Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a routed, English-language guidance suite that preserves the blog's current Next.js boundaries while defining explicit extension and style-isolation rules.

**Architecture:** Eight focused files under `.codex/guidance/` map to the repository's existing `app/`, `components/`, `lib/`, `content/`, and `scripts/` boundaries. The root `AGENTS.md` becomes a small bootstrap that always loads the index, routes only matching guidance, and requires completion verification.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5 strict mode, Tailwind CSS 4, CSS Modules, MDX, Node.js built-ins, `node:test`

## Global Constraints

- Write all guidance in English.
- Preserve the current directory structure and static `output: "export"` deployment model.
- Do not add dependencies, runtime code, speculative layers, or broad source refactors.
- Keep shared tokens and site-level primitives global; keep non-trivial component styles in colocated CSS Modules.
- Do not let parent selectors depend on child component markup or implementation classes.
- Keep the existing untracked `AGENTS.md` project context while intentionally adding the guidance bootstrap.
- Use the smallest verification command that proves each documentation change.

## File Map

- Create `.codex/guidance/architecture.md`: directory ownership, dependency flow, server/client boundary, and promotion rules.
- Create `.codex/guidance/react-typescript.md`: React composition, state/effect discipline, strict types, and accessibility.
- Create `.codex/guidance/styling.md`: global/token scope, Tailwind use, CSS Modules, and parent-child style isolation.
- Create `.codex/guidance/content.md`: MDX/JSON build inputs, validation, static routes, and content integrity.
- Create `.codex/guidance/local-tools.md`: localhost-only scripts, safe writes, and deployed-app separation.
- Create `.codex/guidance/testing.md`: behavior-focused `node:test` rules and proportional coverage.
- Create `.codex/guidance/verify.md`: change-surface verification matrix and final evidence format.
- Create `.codex/guidance/index.md`: always-loaded quick reference and trigger-to-file routing.
- Modify `AGENTS.md`: add the guidance bootstrap while preserving project overview and deployment context.

---

### Task 1: Core Architecture and Frontend Rules

**Files:**
- Create: `.codex/guidance/architecture.md`
- Create: `.codex/guidance/react-typescript.md`
- Create: `.codex/guidance/styling.md`
- Create: `.codex/guidance/content.md`

**Interfaces:**
- Consumes: Current repository boundaries and the approved design specification.
- Produces: Four focused rule files referenced later by `.codex/guidance/index.md`.

- [ ] **Step 1: Confirm the documented boundaries still match the repository**

Run:

```bash
for dir in app components lib content scripts; do test -d "$dir" || exit 1; done
rg -n '"use client"|node:fs|from "fs"|\.module\.css|@import "tailwindcss"' app components lib scripts
```

Expected: all five directories exist; client boundaries, filesystem readers, and the current global Tailwind entry are visible. No `*.module.css` match is required because the guidance defines the rule for new or changed non-trivial component styles.

- [ ] **Step 2: Create the four core rule files**

Create `.codex/guidance/architecture.md` with:

```markdown
# Architecture Rules

<primary_directive>
Preserve the smallest architecture that expresses the product. Keep route composition in `app/`, reusable UI in `components/`, shared content logic in `lib/`, tracked build inputs in `content/`, and local-only tooling in `scripts/`. Add a new layer only after a real responsibility no longer fits one of these boundaries.
</primary_directive>

<cognitive_anchors>
TRIGGERS: architecture, structure, directory, boundary, module, dependency, refactor, server component, client component, use client, static export
SIGNAL: When triggered -> preserve directory ownership and keep dependencies flowing toward shared, runtime-neutral code
</cognitive_anchors>

## Core Rules

1. **Keep directory ownership explicit.**
   - `app/`: routes, layouts, metadata, page composition, and server-side loading.
   - `components/`: reusable UI and substantial interactive leaf components.
   - `lib/`: shared content readers, transformations, constants, and runtime-neutral types.
   - `content/`: tracked MDX and JSON build inputs; no application imports.
   - `scripts/`: localhost authoring and verification tools; never imported by the deployed app.
2. **Use Server Components by default.** Add `"use client"` only at the smallest component that needs browser APIs, hooks, or interaction. Pass serializable values across the server/client boundary.
3. **Colocate before promoting.** Keep route-only code beside its route and component-only types beside the component. Promote code after a second real consumer needs the same behavior or when it owns a distinct external-system responsibility.
4. **Keep dependency direction predictable.** `app/` may depend on `components/` and `lib/`; `components/` may depend on runtime-compatible `lib/`; `lib/` must not import route or component implementations. Client code must not import Node-only modules.
5. **Do not create speculative layers.** Do not add `domain`, `service`, `repository`, dependency-injection, or global state layers for a filesystem-backed static blog. Introduce one only when current code demonstrates the boundary and lifecycle it would own.
6. **Keep static export a release constraint.** New routes must be compatible with `output: "export"`; dynamic routes provide static params, and deployed code does not depend on runtime writes or server-only APIs unavailable on GitHub Pages.
7. **Separate deployed reads from local writes.** Public pages read tracked content at build time. Authoring writes remain in `scripts/` and never require a deployed admin route.
8. **Change the narrowest owning boundary.** Fix shared behavior in its shared reader or component, not independently in every route that consumes it.

## Extension Thresholds

- Extract a reusable component after two consumers need the same UI contract, not merely similar markup.
- Extract a shared helper when it removes duplicated behavior, not just duplicated syntax.
- Add context or a state library only when state must be coordinated across multiple distant interactive branches and URL/server state is not the better owner.
- Add an external service boundary only when an actual database, API, queue, or SDK appears.

## Quality Gates

- Does every changed file sit in the directory that owns its responsibility?
- Is each Client Component boundary as small as practical?
- Are Node-only imports unreachable from client bundles?
- Does the change remain compatible with static export?
- Was an existing helper, component, platform API, or installed dependency reused first?
- If a new abstraction was added, can its second consumer or independent lifecycle be named now?

## Avoid

- Route files importing other route files.
- `lib/` importing from `app/` or `components/`.
- Turning an entire page client-side for one interactive leaf.
- Generic `utils`, `services`, or `types` dumping grounds.
- Repository or use-case wrappers around direct build-time file reads.
- A deployed write API or admin route for local authoring.
```

Create `.codex/guidance/react-typescript.md` with:

```markdown
# React and TypeScript Rules

<primary_directive>
Use React and Next.js primitives directly. Keep components small, state close to the interaction that owns it, effects limited to external synchronization, and TypeScript types strict at every boundary.
</primary_directive>

<cognitive_anchors>
TRIGGERS: React, TypeScript, TSX, component, props, hook, state, effect, context, event, form, accessibility, client component
SIGNAL: When triggered -> apply component ownership, strict typing, state, effect, and accessibility rules
</cognitive_anchors>

## Core Rules

1. **Prefer composition over configuration.** A component should have one visible UI responsibility. Keep route-specific composition in the route until another real consumer needs the same contract.
2. **Keep props narrow.** Pass the values or callbacks a child needs, not a page-sized object for convenience. Server-to-client props must be serializable.
3. **Keep types with their owner.** Define a prop or local data type beside its component. Move it to `lib/` only when multiple modules share the same semantic contract. Use `import type` for type-only imports.
4. **Preserve strict TypeScript.** Avoid `any`, unchecked assertions, and casts used to silence boundary uncertainty. Accept `unknown` at untrusted boundaries and narrow it before use. Prefer derived literal unions and existing framework types over duplicated handwritten shapes.
5. **Keep state at the lowest common owner.** Derive values during render instead of synchronizing duplicate state. Lift state only to coordinate real siblings. Prefer URL state or server data for navigation and shareable state.
6. **Use effects only for external synchronization.** Do not use an effect to derive render data or respond to an event that can be handled directly. Clean up subscriptions, observers, timers, and global mutations.
7. **Do not memoize speculatively.** Use `useMemo` or `useCallback` only when measured work is expensive or a third-party API requires stable identity. Keep dependency arrays complete.
8. **Use stable semantic keys.** Use IDs, slugs, or stable values; do not use an array index when items can be reordered, inserted, or removed.
9. **Use native and Next.js behavior first.** Prefer semantic HTML, `next/link`, Next metadata APIs, browser form controls, CSS, and platform events before custom replacements.
10. **Keep accessibility part of the component contract.** Use semantic elements, associated labels, keyboard-operable controls, visible focus, meaningful link text, and ARIA only when native semantics are insufficient.

## Client Boundary Checklist

Before adding `"use client"`, identify the exact browser API, hook, or interaction that requires it. Keep data loading and static markup in a parent Server Component when possible. A Client Component may receive data but must not import `node:fs`, `node:path`, or server-only readers.

## Quality Gates

- Can the component's responsibility be described in one sentence?
- Is state stored only once and at its nearest owner?
- Can an effect be replaced by render derivation or an event handler?
- Are props and boundary values precisely typed?
- Does the markup work with keyboard and screen-reader semantics?
- Was a native React, Next.js, or browser capability reused before adding code?

## Avoid

- Whole-page Client Components for isolated interaction.
- Mirroring props in state without an independent editing lifecycle.
- Effects that only call `setState` from other state.
- `any`, blanket `as` casts, and duplicate interface definitions.
- Click handlers on non-interactive elements.
- New context providers or state libraries for local state.
```

Create `.codex/guidance/styling.md` with:

```markdown
# Styling Rules

<primary_directive>
Keep shared design contracts global and component implementation styles local. Parents own placement; children own their internal appearance. A selector must not reach across a component boundary and depend on a child's markup.
</primary_directive>

<cognitive_anchors>
TRIGGERS: CSS, style, styling, Tailwind, className, CSS Module, responsive, theme, token, animation, layout, visual
SIGNAL: When triggered -> choose the narrowest style scope and audit parent-child isolation
</cognitive_anchors>

## Scope Rules

1. **Use `app/globals.css` only for shared contracts.** Global reset, design tokens, body defaults, site shell, typography primitives, prose output, and patterns with at least two consumers may be global.
2. **Use Tailwind for short one-off composition.** Local spacing, alignment, and simple responsive utilities may stay in JSX when they are readable and not repeated.
3. **Use a colocated CSS Module for non-trivial component styles.** Create `Component.module.css` when a component owns multiple selectors, variants, interactive states, animation, or responsive behavior.
4. **Keep selectors owned.** Prefer one local class. Avoid selectors such as `.parent .child`, `.parent h2`, or selectors that target another component's implementation class.
5. **Respect the parent-child contract.** A parent controls grid/flex placement through its own wrapper or a child's documented `className` prop. A child controls its descendants, spacing, states, and decoration.
6. **Allow owned descendant styling only for generated content.** A prose or content-rendering primitive may style raw MDX descendants because that subtree is its public responsibility. Keep the selector under one explicit primitive class.
7. **Use tokens for repeated decisions.** Reuse existing custom properties for color, typography, spacing, and borders. Add a token only after the value represents a shared semantic decision.
8. **Keep responsive and motion behavior local.** Start with the narrow layout, add breakpoints where content requires them, honor `prefers-reduced-motion`, and preserve visible `:focus-visible` states.
9. **Migrate incrementally.** Existing semantic global classes may remain until their owner changes. Do not convert unrelated styles merely to satisfy the preferred pattern.

## Choosing a Style Surface

- Site-wide token or reset -> `app/globals.css`.
- Reused site primitive with a documented contract -> `app/globals.css`.
- Up to a few readable, one-use utilities -> Tailwind in JSX.
- Component variants, states, animation, or several selectors -> colocated CSS Module.
- Style shared by unrelated components but not yet stable -> keep local duplication until a common contract is clear.

## Quality Gates

- Could this rule affect markup outside its owner?
- Does a parent selector depend on a child's tags or classes?
- Is a repeated value already represented by a token?
- Are focus, reduced motion, and narrow-screen behavior preserved?
- Is the chosen style surface smaller than a new global rule?

## Avoid

- Broad tag overrides for component-specific design.
- Parent selectors reaching into child component internals.
- `!important` as a specificity strategy.
- A new global class for a single local use.
- Long repeated Tailwind strings that hide a shared component contract.
- Repository-wide style migration during an unrelated feature.
```

Create `.codex/guidance/content.md` with:

```markdown
# Content and Static Route Rules

<primary_directive>
Treat tracked MDX and JSON as typed build inputs. Read them on the server, validate them at the content boundary, and keep every public route compatible with static export.
</primary_directive>

<cognitive_anchors>
TRIGGERS: MDX, frontmatter, content, post, translation, slug, static params, metadata, JSON, category, link, archive
SIGNAL: When triggered -> apply content validation, server-only reading, and static route rules
</cognitive_anchors>

## Core Rules

1. **Keep content tracked and build-time.** Posts live in `content/posts`, translations in `content/translations`, and profile data in `content/site.json`. Do not add runtime persistence for deployed pages.
2. **Read files only from server-capable code.** Keep filesystem access in `lib/` readers or local `scripts/`; never import those readers into Client Components.
3. **Validate at the boundary.** Treat parsed frontmatter, JSON, slugs, and local editor payloads as untrusted until required fields, arrays, enums, dates, and URLs are checked. Do not spread unchecked casts through consumers.
4. **Change content contracts atomically.** When a content field changes, update its type, reader/normalizer, verification script, authoring surface, and every renderer in the same change.
5. **Keep dynamic routes enumerable.** A dynamic public route must implement `generateStaticParams()` from the canonical content reader. Missing content returns `notFound()` rather than an incomplete page.
6. **Keep metadata content-derived.** Generate route titles and descriptions from validated content, with an explicit not-found result.
7. **Keep slugs and links consistent.** Derive slugs from filenames, decode route input once, accept only the expected filename shape, and verify internal linked slugs exist.
8. **Fail builds on invalid tracked content.** Required content must not silently become an empty string or default object. Produce a field-specific error through `verify:content` or the reader used during build.
9. **Keep list transformations pure.** Sorting, grouping, excerpts, and graph links belong in focused `lib/` functions and must not mutate parsed content.

## Quality Gates

- Is the content shape represented by one canonical TypeScript contract?
- Is untrusted parsed data checked before rendering?
- Are filesystem APIs unreachable from Client Components?
- Do new dynamic values participate in static params and metadata?
- Does `npm run verify:content` detect a malformed or dangling value?
- Did a contract change update readers, writers, verification, and renderers together?

## Avoid

- Reading MDX directly in multiple route files.
- Required fields normalized to misleading empty defaults.
- Runtime APIs or databases for tracked static content.
- Dynamic routes without static params under `output: "export"`.
- Client-side filesystem or content parsing.
- Link graphs that silently retain missing target slugs.
```

- [ ] **Step 3: Inspect the new rules for scope and platform drift**

Run:

```bash
for file in architecture react-typescript styling content; do test -s ".codex/guidance/$file.md" || exit 1; done
rg -n 'Swift|SwiftUI|iOS|Xcode|Loutine|FactoryKit' .codex/guidance && exit 1 || true
rg -n '^# |<primary_directive>|<cognitive_anchors>|## Quality Gates|## Avoid' .codex/guidance/{architecture,react-typescript,styling,content}.md
```

Expected: all four files are non-empty; no Apple/Loutine terminology is found; each file exposes its title, directive, triggers, gates, and anti-patterns.

- [ ] **Step 4: Commit the core rules**

```bash
git add .codex/guidance/architecture.md .codex/guidance/react-typescript.md .codex/guidance/styling.md .codex/guidance/content.md
git diff --cached --stat
git commit -m "📄 docs: define frontend architecture guidance"
```

Expected: one documentation commit containing only the four core rule files.

---

### Task 2: Tooling, Testing, and Completion Rules

**Files:**
- Create: `.codex/guidance/local-tools.md`
- Create: `.codex/guidance/testing.md`
- Create: `.codex/guidance/verify.md`

**Interfaces:**
- Consumes: Existing package scripts and localhost authoring architecture.
- Produces: Tooling and completion rule files referenced later by `.codex/guidance/index.md`.

- [ ] **Step 1: Confirm verification and authoring commands**

Run:

```bash
npm pkg get scripts
rg -n '127\.0\.0\.1|renameSync|node:test|normalizeSiteContent' scripts package.json
```

Expected: `test`, `verify:content`, `lint`, `build`, and `write` scripts are present; the authoring server uses localhost and the current script exposes testable normalization/write behavior.

- [ ] **Step 2: Create the three workflow rule files**

Create `.codex/guidance/local-tools.md` with:

```markdown
# Local Tool Rules

<primary_directive>
Keep authoring and maintenance tools local, testable, and unable to weaken the static deployed site. Validate before writing, preserve existing data on failure, and prefer Node built-ins or installed packages.
</primary_directive>

<cognitive_anchors>
TRIGGERS: script, dashboard, authoring, local server, write, upload, file, CLI, localhost, atomic save, verify-content
SIGNAL: When triggered -> preserve localhost isolation, safe file boundaries, and testable pure logic
</cognitive_anchors>

## Core Rules

1. **Bind authoring servers to `127.0.0.1`.** Do not expose local write tools on all interfaces and do not add a deployed `/admin` route or write API.
2. **Validate before mutation.** Check request size, method, content type, field shape, filenames, extensions, URLs, and destination paths at the local trust boundary.
3. **Preserve data on failure.** Normalize and validate first; for replaceable content files, write a sibling temporary file and rename it only after the complete write succeeds.
4. **Constrain paths to owned directories.** Derive destinations from fixed repository roots, reject traversal and separators in user-controlled filenames, and never accept an arbitrary absolute path from a request.
5. **Separate pure logic from process startup.** Export normalizers, parsers, and save functions for direct tests. Guard server startup so importing a script in tests has no side effects.
6. **Use the platform first.** Prefer `node:fs`, `node:path`, `node:http`, `node:url`, and installed packages before adding a dependency.
7. **Keep outputs reviewable.** Tracked content and images use deterministic names and formats. Temporary files stay untracked and are cleaned after successful operations.
8. **Return actionable errors without leaking internals.** Give local users a field-specific message; do not expose stack traces, arbitrary filesystem paths, or secrets in HTTP responses.

## Quality Gates

- Is every write endpoint unreachable from the deployed Next.js app?
- Does malformed input leave the previous file unchanged?
- Can path input escape the intended content or image directory?
- Can core logic be tested without starting a server or opening a browser?
- Was a Node built-in or existing dependency reused?
- Are temporary files and partial output handled deterministically?

## Avoid

- Binding a write server to `0.0.0.0`.
- A deployed admin page, route handler, or write API.
- Writing before complete validation.
- Accepting request-controlled filesystem paths.
- Starting the server as an import side effect.
- Adding a framework for a small local script.
```

Create `.codex/guidance/testing.md` with:

```markdown
# Testing Rules

<primary_directive>
Protect observable behavior with the smallest runnable check. For non-trivial behavior changes, write a failing test first, make it pass with the minimum change, and keep the test at the boundary that owns the behavior.
</primary_directive>

<cognitive_anchors>
TRIGGERS: test, node:test, assert, TDD, regression, mock, fixture, coverage, parser, validation
SIGNAL: When triggered -> test behavior at the smallest owning boundary and run the focused check first
</cognitive_anchors>

## Core Rules

1. **Test behavior, not implementation.** Assert returned values, rendered contracts, validation failures, file outcomes, and public side effects. Do not lock tests to private helper steps.
2. **Use the existing test surface.** Prefer `node:test` and `node:assert/strict` for `lib/` and `scripts/`. Do not add a test framework for behavior the current setup can prove.
3. **Use one meaningful regression check.** Every changed branch, loop, parser, validation rule, or data-preserving write needs a test that would fail if the behavior regressed. Trivial markup or type-only edits need no synthetic test.
4. **Keep tests beside the owner.** Use `lib/*.test.mjs` for library behavior and `scripts/*.test.mjs` for authoring tools, matching the current repository pattern.
5. **Cover failure paths at trust boundaries.** Parsers and writers test malformed input, missing required fields, unsafe paths or URLs, and preservation of prior data.
6. **Keep fixtures minimal.** Build only the smallest valid input needed for the assertion. Use temporary directories for filesystem writes and never mutate tracked content in tests.
7. **Mock only external boundaries.** Prefer real pure functions and temporary files. Stub time, network, browser APIs, or process launches only when the test cannot remain deterministic otherwise.
8. **Run focused before broad.** Run the owning test file first, then `npm test`, and add lint/build verification according to `.codex/guidance/verify.md`.

## TDD Loop

1. Add one test describing the missing or broken behavior.
2. Run its focused command and confirm the expected failure.
3. Make the smallest production change that satisfies it.
4. Run the focused test until it passes.
5. Run the broader checks required by the changed surface.

## Quality Gates

- Would the test fail if the requested behavior broke?
- Does it use the public boundary instead of private implementation details?
- Does a write test prove the previous data survives invalid input?
- Is the fixture smaller than the production object graph?
- Did the focused test fail first for the expected reason?
- Were broader checks selected from `verify.md`?

## Avoid

- Tests that only assert a helper was called.
- Snapshot tests for small semantic output.
- Framework installation for one component or script.
- Tests that write into tracked `content/` or `public/` paths.
- Live network calls and browser launches in unit tests.
- Claiming TDD without observing the initial failure.
```

Create `.codex/guidance/verify.md` with:

````markdown
# Completion Verification Rules

<primary_directive>
Before calling repository work complete, inspect the final diff, run the smallest checks that prove the changed surface, expand to release checks when the surface requires them, and report both evidence and gaps.
</primary_directive>

<cognitive_anchors>
TRIGGERS: verify, verification, complete, done, final, review, acceptance criteria, handoff, build, lint
SIGNAL: Before every final response or handoff -> inspect the diff, apply the surface matrix, and report guidance plus evidence
</cognitive_anchors>

## Always Apply

1. Inspect `git status --short` and the complete diff for the task scope.
2. Re-read the guidance files loaded for the changed surface.
3. If a related GitHub issue or approved spec exists, check every explicit acceptance criterion.
4. Run the smallest focused check first, then the broader commands required below.
5. Do not describe an unrun command as passing. State the reason and resulting risk.

## Verification Matrix

| Changed surface | Required checks |
| --- | --- |
| Guidance or Markdown only | Link/path inspection, stale-term scan, and final diff review |
| `content/**` or content contract | `npm run verify:content`; `npm run build` when render or route output can change |
| `lib/**` behavior | Owning focused `node --test ...`; then `npm test` |
| `scripts/**` behavior | Owning focused `node --test ...`; then `npm test` and `npm run verify:content` when tracked content is involved |
| `app/**`, `components/**`, CSS, or MDX rendering | Relevant focused tests, `npm run lint`, and `npm run build` |
| Package, Next.js, TypeScript, ESLint, or build config | `npm test`, `npm run lint`, and `npm run build` |

Run `npm run verify:content` before `npm run build` only when calling it separately; the build script already invokes content verification.

## Guidance Integrity Check

For `.codex/guidance/` changes:

- confirm every file named in `index.md` exists;
- confirm commands match `package.json`;
- scan for stale platform terminology or copied repository names;
- check that overlapping rules use the same ownership and verification language;
- keep `index.md` short enough to route rather than duplicate detailed rules.

## Final Evidence Format

```text
Guidance loaded: index.md, verify.md, <matched files or none>
Issue/spec review: <reference and result, or no related issue>
Verification: <commands or inspections and results>
Not run: <command and reason, when applicable>
```

## Avoid

- Marking work complete from code inspection alone when a runnable check exists.
- Running only the broad build when a focused regression test should identify the behavior.
- Hiding skipped checks or environment failures.
- Rewriting unrelated files discovered during final review.
- Finalizing with missing index targets or contradictory guidance.
````

- [ ] **Step 3: Verify commands and safety language**

Run:

```bash
for file in local-tools testing verify; do test -s ".codex/guidance/$file.md" || exit 1; done
for script in test verify:content lint build write; do npm pkg get "scripts.$script" | grep -vq '^{}$' || exit 1; done
rg -n '127\.0\.0\.1|atomic|node:test|npm run verify:content|npm run lint|npm run build' .codex/guidance/{local-tools,testing,verify}.md
```

Expected: all files exist, all referenced package scripts resolve, and the local safety/testing/verification terms are present.

- [ ] **Step 4: Commit the workflow rules**

```bash
git add .codex/guidance/local-tools.md .codex/guidance/testing.md .codex/guidance/verify.md
git diff --cached --stat
git commit -m "📄 docs: define local tooling and verification rules"
```

Expected: one documentation commit containing only the three workflow rule files.

---

### Task 3: Guidance Router and Agent Bootstrap

**Files:**
- Create: `.codex/guidance/index.md`
- Modify: `AGENTS.md`
- Include: `docs/superpowers/plans/2026-07-13-react-typescript-guidance.md`

**Interfaces:**
- Consumes: All seven focused rule files from Tasks 1 and 2.
- Produces: The always-loaded routing entry point and repository-wide agent bootstrap.

- [ ] **Step 1: Create the guidance index**

Create `.codex/guidance/index.md` with:

```markdown
# Rules Index

Repo-local guidance lives in `.codex/guidance/`. Read this file before repository work, apply the quick reference, then load only the rule files matched by the request and touched surface.

## Quick Reference (Always Apply)

- **Architecture:** Preserve `app/`, `components/`, `lib/`, `content/`, and `scripts/` ownership. Colocate first; add a layer only for a real second consumer or distinct lifecycle.
- **React:** Use Server Components by default and keep `"use client"` on the smallest interactive leaf.
- **TypeScript:** Keep strict types at boundaries; accept `unknown` and narrow it instead of using `any` or unchecked casts.
- **Styling:** Keep tokens and site primitives global, one-off utilities local, and non-trivial component styles in colocated CSS Modules. Parents do not reach into child internals.
- **Content:** Treat MDX and JSON as validated build inputs; keep public routes compatible with static export.
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
```

- [ ] **Step 2: Update the root bootstrap without discarding its current context**

Replace `AGENTS.md` with:

````markdown
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
````

- [ ] **Step 3: Verify every routed document and repository-specific command**

Run:

```bash
for file in architecture react-typescript styling content local-tools testing verify; do
  test -f ".codex/guidance/$file.md" || { echo "missing: $file.md"; exit 1; }
done
for script in test verify:content lint build write; do
  npm pkg get "scripts.$script" | grep -vq '^{}$' || { echo "missing package script: $script"; exit 1; }
done
rg -n 'Loutine|Swift|SwiftUI|iOS|Xcode|FactoryKit' .codex/guidance AGENTS.md && exit 1 || true
rg -n 'Guidance loaded: index.md, verify.md' AGENTS.md .codex/guidance/{index,verify}.md
git diff --check
```

Expected: every index target exists, every command exists in `package.json`, no stale platform terms appear, the reporting contract appears in the bootstrap/index/verification surfaces, and `git diff --check` prints nothing.

- [ ] **Step 4: Review the complete guidance suite for contradictions**

Run:

```bash
rg -n 'Server Components by default|smallest interactive leaf|colocat|CSS Module|127\.0\.0\.1|output: "export"|node:test' .codex/guidance AGENTS.md
git diff --stat main
git status --short
```

Expected: the same server/client, colocation, style isolation, local-only, static-export, and test-surface decisions appear consistently. Only the approved guidance/spec/plan and intentional `AGENTS.md` update are in scope.

- [ ] **Step 5: Commit the router, bootstrap, and implementation plan**

```bash
git add .codex/guidance/index.md AGENTS.md docs/superpowers/plans/2026-07-13-react-typescript-guidance.md
git diff --cached --stat
git commit -m "📄 docs: route repository guidance through AGENTS"
```

Expected: one documentation commit containing the index, root bootstrap, and implementation plan. The worktree is clean afterward.

- [ ] **Step 6: Run final documentation verification**

Run:

```bash
for file in index architecture react-typescript styling content local-tools testing verify; do test -s ".codex/guidance/$file.md" || exit 1; done
git diff --check main...HEAD
git log --oneline main..HEAD
git status --short
```

Expected: all eight guidance files are non-empty, the branch diff has no whitespace errors, the branch shows the design plus three implementation commits, and the worktree is clean.
