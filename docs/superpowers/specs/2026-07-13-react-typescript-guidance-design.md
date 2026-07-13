# React and TypeScript Guidance Design

## Goal

Add repo-local guidance that helps agents preserve this Next.js blog's structure as it grows. The rules should describe the architecture the repository actually has, make extension points explicit, and avoid introducing layers before the code needs them.

The guidance will be written in English and routed through a small index modeled after `/Users/celan/Loutine/.codex/guidance/`.

## Design Principles

- Document current boundaries before prescribing future ones.
- Prefer framework and platform capabilities over new abstractions or dependencies.
- Keep rules narrow enough to load only when their surface is touched.
- Add a new guidance file only when a distinct responsibility exists in the repository.
- Treat verification commands and architectural boundaries as executable constraints, not suggestions.

## Repository Boundaries

The existing directories remain the canonical structure:

- `app/` owns routes, layouts, metadata, page composition, and server-side data loading.
- `components/` owns reusable UI and substantial interactive leaf components.
- `lib/` owns shared content readers, transformations, and framework-independent types or utilities.
- `content/` is tracked build input containing MDX and JSON content.
- `scripts/` contains localhost-only authoring and verification tools and is not imported by the deployed app.

No `domain`, `service`, `repository`, state-management, or dependency-injection layer will be introduced speculatively. Code moves into a new boundary only after it has multiple real consumers, an independent lifecycle, or a distinct external-system responsibility.

## Guidance Documents

Create eight files under `.codex/guidance/`:

1. `index.md`
   - Always-loaded quick reference.
   - Trigger-to-rule-file routing table.
   - Completion rule that always loads `verify.md`.
2. `architecture.md`
   - Directory ownership and allowed dependency direction.
   - Server Component by default; Client Components are the smallest interactive leaves.
   - Rules for colocating code first and promoting it only after reuse or responsibility becomes clear.
3. `react-typescript.md`
   - Strict TypeScript, narrow props, state ownership, effect discipline, stable keys, and accessibility basics.
   - Reuse native React, Next.js, and browser behavior before adding helpers or dependencies.
4. `styling.md`
   - Shared tokens and site-level primitives may live in `app/globals.css`.
   - One-off simple composition may use Tailwind utilities.
   - Non-trivial component-owned styling uses a colocated CSS Module.
   - Parent selectors must not reach into child component markup or implementation classes.
5. `content.md`
   - MDX/JSON files are build inputs read on the server.
   - Frontmatter and site content must be validated at the content boundary.
   - Static export, route generation, `notFound()`, slug handling, and link integrity remain explicit.
6. `local-tools.md`
   - `scripts/` tools stay bound to localhost and separate from deployed routes.
   - Validate inputs at write boundaries and preserve files with atomic replacement where data loss is possible.
   - Prefer Node built-ins and already-installed packages.
7. `testing.md`
   - Test observable behavior with the smallest runnable check.
   - Use the existing `node:test` setup unless a browser-level behavior actually requires another surface.
   - Keep tests beside the owning module or script and cover failure paths for parsers and writes.
8. `verify.md`
   - Select checks by changed surface, then expand from focused tests to `npm test`, `npm run verify:content`, `npm run lint`, and `npm run build` when applicable.
   - Require final reports to name loaded guidance and checks run or skipped.

## AGENTS.md Bootstrap

Update the root `AGENTS.md` so agents:

1. Read `.codex/guidance/index.md` before planning, editing, reviewing, testing, or finalizing repository work.
2. Apply the index quick reference and load only guidance matched by the request and touched files.
3. Load `verify.md` before completion.
4. Report `Guidance loaded: index.md, verify.md, <matched files or none>` in plans, handoffs, and final responses.

The existing project overview and deployment context will remain in `AGENTS.md`; detailed rules move to the routed guidance files.

## Styling Isolation

The style rules support gradual migration rather than a repository-wide rewrite:

- Existing semantic global classes may remain until their component is changed.
- New site-wide tokens, typography defaults, shell layout, and prose primitives may use `globals.css`.
- A component with multiple selectors, variants, states, or responsive rules gets a colocated `*.module.css` file.
- Tailwind remains acceptable for short, local utility combinations that are not repeated.
- Shared visual patterns become explicitly named global primitives only after at least two consumers need the same contract.
- Selectors should target one owned class. Avoid parent-to-child descendant selectors, tag selectors coupled to component internals, `!important`, and broad global overrides.
- Parents control placement through the child's public wrapper (`className` when supported); children control their internal layout and appearance.

## Data and Dependency Flow

Build-time content flows from `content/` through `lib/` readers into `app/` route components. Interactive browser behavior flows from server-rendered pages into small Client Component props. Local authoring writes flow through `scripts/` directly to validated content files and never through a deployed API.

Allowed imports follow these boundaries:

- `app/` may import from `components/`, `lib/`, and static `content/` where appropriate.
- `components/` may import shared types and constants from `lib/`, but client components must not import Node-only modules.
- `lib/` must not import route modules or component implementations.
- `scripts/` may share pure data-shape code only when doing so does not pull browser or Next.js runtime code into Node tools.
- `content/` imports no application code.

## Error Handling and Safety

- Invalid tracked content should fail verification or build with a field-specific error rather than render misleading defaults.
- Missing dynamic content should use the existing nullable reader and `notFound()` route boundary.
- Local write tools validate untrusted input before mutation and preserve the previous file on failure.
- Client-side errors should be handled at the smallest UI boundary that can offer a useful recovery action.
- Security, accessibility, and data-preservation checks are never omitted for simplicity.

## Verification

Documentation work will be checked by:

- confirming all index routes point to existing guidance files;
- scanning for stale iOS/Swift/Loutine terminology;
- confirming commands match `package.json`;
- reviewing the final diff for contradictions and accidental edits;
- leaving the pre-existing untracked `AGENTS.md` out of the design-only commit, then including its intentional update with the guidance implementation.

No dependencies, runtime code, or broad source refactors are part of this work.
