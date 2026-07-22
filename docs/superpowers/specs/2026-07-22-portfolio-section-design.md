# Portfolio Section Design

**Date:** 2026-07-22
**Status:** Approved

## Goal

Turn homepage section 2 into a public portfolio grid backed by the canonical portfolio content, add an explicit optional project cover managed by the existing local dashboard, and provide a statically exported detail page for every project.

## Scope

### Included

- An optional `coverImage: { src, alt }` field on each canonical portfolio project.
- A black card background when a project has no cover image.
- A cover-specific image input, preview, replacement, alt-text field, and removal control in `npm run portfolio`.
- Reuse of the existing `/api/portfolio/media` upload endpoint and `public/portfolio/` storage.
- A homepage section 2 grid with whole-card links to `/portfolio/<slug>`.
- Project name and period overlays with hover, keyboard-focus, touch, responsive, and reduced-motion behavior.
- A statically exported `/portfolio/[slug]` route with generated parameters, content-derived metadata, and normal 404 handling.
- One shared portfolio detail renderer used by the public route and the existing development-only draft route.
- Focused model and dashboard regressions, release checks, and live browser proof.

### Excluded

- Deriving a cover from the first item in `media`.
- A black-only interim implementation that postpones cover support.
- Video covers, multiple covers, cover galleries, crop controls, or focal-point metadata.
- Automatically deleting replaced or removed cover files from `public/portfolio/`.
- Redesigning the existing portfolio detail body or changing media order.
- A deployed write API, client-side content fetching, new dependency, or JavaScript-driven hover animation.
- Changes to homepage sections other than filling the approved section 2 slot.
- Unrelated cleanup of the approved in-flight `app/page.tsx` and `app/globals.css` baseline.

## Chosen Architecture

Keep one content contract and separate its three responsibilities by their existing owners:

- `content/portfolio.json` remains the tracked, canonical build input.
- `lib/portfolio.mjs` continues to own project normalization and validates the new cover field for every authoring, draft, verification, and public read path.
- A small server-only reader in `lib/` loads and normalizes canonical portfolio content for the homepage and detail route. It exposes list and slug lookup operations rather than allowing routes to parse JSON independently.
- `scripts/article-dashboard.mjs` remains the only authoring surface. It adds cover controls to its existing portfolio mode without adding an endpoint, server, or dependency.
- Homepage-specific grid composition stays under `app/` as a Server Component with a colocated CSS Module. It needs no state, effect, browser API, or `"use client"` boundary.
- A shared `PortfolioProjectArticle` Server Component owns the existing detail presentation because the public detail route and draft detail route are now real consumers of the same rendering contract.
- `app/portfolio/[slug]/page.tsx` owns routing, static parameters, metadata, canonical lookup, and `notFound()`.

The deployed site reads tracked content only at build time. All writes remain inside the localhost dashboard bound to `127.0.0.1`.

## Canonical Data Contract

A normalized portfolio project has this shape:

```ts
interface PortfolioProject {
  slug: string;
  name: string;
  period: string;
  descriptionMarkdown: string;
  coverImage?: {
    src: string;
    alt: string;
  };
  media: PortfolioMedia[];
}
```

`coverImage` is omitted when a project has no cover. The normalizer must not synthesize a cover from `media`, and existing projects therefore remain valid and render with the black fallback.

When `coverImage` is present:

- It must be a non-array object containing only the normalized values used by consumers.
- `src` must pass the existing `/portfolio/<filename>` path checks.
- Its extension must belong to the existing portfolio image extension set. An MP4 path is invalid even though the general media collection accepts MP4.
- `alt` must be a non-empty trimmed string.

Normalization returns the cover unchanged except for the same trimming and path normalization already applied to portfolio fields. Draft saves, canonical loads, project merges, and publish responses all round-trip the field. Removing a cover omits the field from persisted JSON.

## Dashboard Cover Flow

Portfolio mode adds one cover group near the project identity fields:

- A file input accepts images only.
- When no cover exists, the group shows the image input and the black fallback preview.
- When a cover exists, it shows the image, its stored path, a required alt-text input, a Replace action using the same file input, and a Remove action.
- Remove changes only the project state. It does not delete the stored file.

Selecting a file posts it to `/api/portfolio/media`, exactly like ordinary media. The existing endpoint remains general-purpose and continues returning `{ kind, src, ... }`. Cover-specific browser logic accepts the result only when `kind === "image"`; the canonical normalizer independently enforces the image-only rule at save and publish boundaries.

The current cover is replaced only after an upload succeeds and returns a valid image result. A rejected upload, network error, video response, or malformed response leaves the previous cover intact and reports the error through the existing dashboard status region. A successful replacement starts with an empty required alt field so the user must describe the new image before draft save or publish.

Project selection, new-project reset, draft load/save, preview rendering, dirty-state protection, and canonical reload all include `coverImage`. The ordinary `media` list remains separate and keeps its current order and captions.

Publishing adds the cover path to the existing explicit referenced-media set. The build, staged-path overlap preflight, `git commit --only`, rollback, and push behavior remain unchanged. Replaced and removed files may remain unreferenced in `public/portfolio/`; automatic asset garbage collection is outside this feature.

## Public Homepage Grid

Section 2 reads the normalized canonical project list and renders one semantic `Link` per project. The link wraps the entire card and points to `/portfolio/<slug>`, so pointer and keyboard users activate the same native navigation target without a click handler.

The grid is mobile-first:

- One column on narrow screens.
- Two equal columns above the existing homepage narrow-screen breakpoint.
- A consistent `16 / 10` card aspect ratio so covered and uncovered projects align.
- Cover images fill the card with `object-fit: cover`.
- Missing covers render the same frame with a solid black background and no decorative empty image element.

The project name and period are always present in one overlay. They are real link content, provide the link's accessible name, and are never conveyed only through the image or animation.

On devices that support precise hover, the overlay begins visually offset and hidden, then transitions into view when the card is hovered or the link receives `:focus-visible`. The focus outline remains visible independently of the overlay. On `hover: none` or coarse-pointer environments, the overlay is visible without interaction. CSS owns all of these states; no Client Component or event listener is introduced.

## Public Detail Route

`/portfolio/[slug]` is a normal App Router static route:

- `generateStaticParams()` enumerates every normalized canonical project slug.
- `dynamicParams = false` prevents an ungenerated project from becoming a runtime route.
- The route looks up the canonical project by slug and calls `notFound()` when it is absent.
- `generateMetadata()` uses the project name for the title and the project name plus period for the description. A missing lookup returns explicit Not Found metadata.

The route renders `PortfolioProjectArticle`, extracted from the existing portfolio branch of `app/drafts/[kind]/[slug]/page.dev.tsx`. The shared renderer keeps the current contract:

- Project period and name in the header.
- `descriptionMarkdown` through the installed `MDXRemote` renderer.
- Ordered image and video figures with required captions.
- Validated image alt text and native video controls.

The draft route retains its development-only lookup and error behavior but passes a normalized project to the same renderer. The cover belongs to homepage navigation and is not repeated automatically in the detail body.

## Data Flow

### Authoring and publish

```text
cover image input
  -> POST /api/portfolio/media
  -> existing image MIME, extension, size, and path validation
  -> atomic write under public/portfolio/
  -> dashboard project.coverImage = { src, alt }
  -> shared project normalization
  -> draft JSON or content/portfolio.json merge
  -> build verification
  -> explicit canonical JSON, cover, and media commit paths
```

### Static public rendering

```text
content/portfolio.json
  -> server-only canonical reader
  -> shared project normalization
  -> homepage PortfolioGrid
  -> /portfolio/[slug] static params and metadata
  -> shared PortfolioProjectArticle
  -> static export
```

No deployed request reads from the filesystem or writes content after the static build.

## Validation and Error Handling

- Missing `coverImage` is valid and produces the black card fallback.
- A cover with an empty alt, unsafe path, unsupported extension, or video extension fails normalization with a cover-specific field error.
- The cover file input uses `accept="image/*"`, while server-side validation remains authoritative.
- Failed cover upload or replacement preserves the previous cover state.
- Removing a cover does not remove ordinary media or its file from disk.
- Invalid canonical portfolio content fails `verify:content` and the build instead of silently dropping the cover.
- Invalid draft content uses the existing local draft error state.
- A missing public project slug returns the normal 404 page.
- Dashboard errors continue to avoid absolute repository paths and stack traces.

## Accessibility, Responsiveness, and Motion

- Each card is one native link; no nested button or duplicate click target is introduced.
- The visible project name and period remain in the DOM in every interaction state.
- Cover alt text describes the image. The project name is not copied into alt text merely to satisfy validation.
- Keyboard focus reveals the same metadata as pointer hover and retains a visible focus ring.
- Touch and non-hover environments show metadata by default.
- The grid collapses from two columns to one at the existing homepage breakpoint without horizontal scrolling.
- `prefers-reduced-motion: reduce` removes overlay transition and transform animation. State changes remain immediate and content remains visible.
- The black fallback preserves sufficient contrast for the text overlay.

## Testing and Verification

### Focused model and dashboard checks

Extend the existing `node:test` surfaces with the smallest regressions that prove the new behavior:

1. The project normalizer accepts an omitted cover and preserves a valid image cover.
2. It rejects video cover paths, unsupported or unsafe paths, empty alt text, and malformed cover objects.
3. Draft save/load and canonical merge round-trip the optional cover.
4. Publish includes a referenced cover file in its explicit path set while preserving staged-path safeguards.
5. Portfolio dashboard HTML exposes the cover input, alt field, preview, replace, and remove controls.
6. The embedded dashboard script compiles and preserves the previous cover when upload fails or returns a video.
7. Successful image replacement, removal, project switching, and draft reload update the cover state without changing ordinary media.

Use the existing `node:vm` fake DOM/fetch boundary for dashboard browser-script behavior; do not add a browser test framework.

### Repository checks

Run focused tests first, then the existing release checks:

```text
node --test scripts/article-dashboard.test.mjs
npm test
npm run verify:content
npm run lint
npm run build
git diff --check
```

The production build must list `/portfolio/[slug]` as generated static pages and must not expose the development-only draft routes.

### Browser proof

Use a fresh local build or development server and inspect real computed layout and interaction state:

- At a wide viewport, section 2 computes to two grid tracks; at a narrow mobile viewport, it computes to one.
- A project without `coverImage` has a black card background.
- On a hover-capable desktop, the overlay changes from its resting state to visible on hover.
- Tabbing to the whole-card link reveals the overlay and shows the focus ring.
- Under mobile or `hover: none` emulation, the metadata is visible before interaction.
- Under reduced-motion emulation, the overlay has no transition or transform animation.
- Activating the card opens its `/portfolio/<slug>` detail page, whose name, period, Markdown, and ordered media render correctly.

## Acceptance Criteria

- Existing projects without covers remain valid and render as black portfolio cards.
- The dashboard can upload, describe, replace, remove, draft, publish, and reload a separate image-only cover without affecting ordinary media.
- Homepage section 2 renders every canonical project in the approved responsive grid.
- Every card is fully linked, keyboard accessible, touch legible, and motion-safe.
- Every canonical project has a statically exported detail URL using the same renderer as its local draft preview.
- Invalid cover data fails at the shared boundary, and failed dashboard replacement does not destroy the prior state.
- No new dependency, deployed write path, client-side state layer, first-media convention, interim-only fallback implementation, unrelated homepage change, or asset cleanup system is added.
