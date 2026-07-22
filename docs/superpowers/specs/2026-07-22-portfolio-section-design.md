# Portfolio Section Design

**Date:** 2026-07-22
**Status:** Approved

## Goal

Turn homepage section 2 into a public portfolio grid backed by the canonical portfolio content, add an explicit optional project cover managed by the existing local dashboard, let authors add and size ordinary project media by file input or dashboard-wide drag-and-drop, generate optional first-frame video posters in the browser, and provide a statically exported detail page for every project.

## Scope

### Included

- An optional `coverImage: { src, alt }` field on each canonical portfolio project.
- A black card background when a project has no cover image.
- A cover-specific image input, preview, replacement, alt-text field, and removal control in `npm run portfolio`.
- Reuse of the existing `/api/portfolio/media` upload endpoint and `public/portfolio/` storage.
- Dashboard-wide drag-and-drop for multiple ordinary image or MP4 files, appended in drop order.
- One shared ordinary-media upload helper used by both drag-and-drop and the existing multiple-file input.
- A visual drag-active state scoped to the ordinary media area.
- An optional media size preset with exact `mini`, `small`, `medium`, `large`, and `full` values.
- Centered preset widths of 20%, 45%, 65%, 85%, and 100% in dashboard rows, dashboard preview, and public detail rendering.
- A native Size select on every dashboard media row.
- An optional image-only `posterSrc` on video media.
- Native browser `<video>` and `<canvas>` first-frame extraction for new and existing videos, with the generated image uploaded through `/api/portfolio/media`.
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
- A new upload endpoint, synthetic file-input event, drag-and-drop cover replacement, or removal of the accessible media file input.
- Arbitrary media percentages, free-form dimensions, per-breakpoint sizes, aspect-ratio controls, or crop/focal-point controls.
- `ffmpeg`, server-side video decoding, poster extraction during build, a new dependency, or a separate poster endpoint.
- Poster asset cleanup, automatic deletion of replaced posters, poster alt text, or using posters as portfolio covers.
- Changes to homepage sections other than filling the approved section 2 slot.
- Unrelated cleanup of the approved in-flight `app/page.tsx` and `app/globals.css` baseline.

## Chosen Architecture

Keep one content contract and separate its three responsibilities by their existing owners:

- `content/portfolio.json` remains the tracked, canonical build input.
- `lib/portfolio.mjs` continues to own project normalization and validates the cover, media-size preset, and video poster path for every authoring, draft, verification, and public read path.
- A small server-only reader in `lib/` loads and normalizes canonical portfolio content for the homepage and detail route. It exposes list and slug lookup operations rather than allowing routes to parse JSON independently.
- `scripts/article-dashboard.mjs` remains the only authoring surface. It owns cover controls, ordinary-media input/drop behavior, native size selects, and browser-only first-frame extraction in its existing portfolio mode without adding an endpoint, server, or dependency. File input and drop call one shared sequential upload helper instead of redispatching an input event; new and existing videos call one shared poster-generation path.
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

type PortfolioMediaSize = "mini" | "small" | "medium" | "large" | "full";

type PortfolioMedia =
  | {
      kind: "image";
      src: string;
      caption: string;
      alt: string;
      size: PortfolioMediaSize;
    }
  | {
      kind: "video";
      src: string;
      caption: string;
      size: PortfolioMediaSize;
      posterSrc?: string;
    };
```

The interface above is the normalized contract consumed by dashboard and public renderers. Raw persisted projects retain the same shape except that each media item's `size` may be absent.

`coverImage` is omitted when a project has no cover. The normalizer must not synthesize a cover from `media`, and existing projects therefore remain valid and render with the black fallback.

When `coverImage` is present:

- It must be a non-array object containing only the normalized values used by consumers.
- `src` must pass the existing `/portfolio/<filename>` path checks.
- Its extension must belong to the existing portfolio image extension set. An MP4 path is invalid even though the general media collection accepts MP4.
- `alt` must be a non-empty trimmed string.

Normalization returns the cover unchanged except for the same trimming and path normalization already applied to portfolio fields. Draft saves, canonical loads, project merges, and publish responses all round-trip the field. Removing a cover omits the field from persisted JSON.

The persisted JSON may omit `size` for backward compatibility. Normalization always materializes one of the five preset strings and uses `full` when the field is absent; downstream dashboard and public renderers therefore consume a required normalized `size`. New media is created with `size: "full"`. Empty strings, arbitrary percentages, numbers, and unknown preset names fail with a media-indexed size error instead of silently becoming `full`.

`posterSrc` is optional and valid only for `kind: "video"`. When present, it passes the same safe `/portfolio/<filename>` path normalization and existing image-extension allowlist as a cover. Video paths, unsafe paths, empty strings, and `posterSrc` on image media fail normalization. Existing videos without a poster remain valid and normalize without a synthesized value.

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

## Dashboard Ordinary Media Drag-and-Drop Flow

The existing multiple-file input remains the labelled, keyboard-accessible way to add ordinary project media. Drag-and-drop is a pointer convenience layered onto the same behavior, not a replacement control.

Dropping files anywhere inside the portfolio dashboard treats them as ordinary media, including a drop over the cover controls. The cover input and `project.coverImage` are never read or changed by this flow. While an external file drag is active over the dashboard, only the ordinary media area receives the visual highlight; the page shell, form, cover controls, and preview do not change appearance.

The drag lifecycle follows native file-drag events:

- `dragenter` and `dragover` activate the media-area highlight only when `dataTransfer.types` contains `Files`; `dragover` prevents the browser default and reports a copy drop effect.
- Nested enter/leave transitions use a small drag-depth counter so moving across dashboard descendants does not flicker the highlight.
- The final `dragleave` and every `drop` clear the counter and highlight.
- `drop` prevents the browser from opening the files, copies `dataTransfer.files` into a stable array, and passes that array directly to the shared upload helper.

The shared helper accepts an ordered collection of `File` objects and uploads them sequentially to `/api/portfolio/media`. Each successful response is converted to the existing ordinary-media shape and appended immediately to `state.project.media`: images receive empty caption and alt fields, while videos receive an empty caption. Sequential requests preserve the original input or drop order after all existing media.

The existing file-input `change` handler calls the same helper with its selected files and then clears the input value. It does not construct or dispatch a synthetic event. Both entry paths retain the current dirty-state, media-row rendering, preview scheduling, and status-region behavior.

If a file fails existing server MIME, extension, size, or path validation, the helper stops at that file and reports the existing server error. Media uploaded earlier in the same batch stays appended and stored; later files in that batch are not attempted. This preserves the dashboard's current sequential partial-success semantics without rollback or batch transactions.

## Media Size Presets

The size contract is fixed and shared across all ordinary-media rendering surfaces:

| Preset | Width |
| --- | ---: |
| `mini` | 20% |
| `small` | 45% |
| `medium` | 65% |
| `large` | 85% |
| `full` | 100% |

Each dashboard media row contains a labelled native `<select>` with those five values in ascending order. Changing it updates only that media item's normalized `size`, marks the project dirty, rerenders the affected rows, and schedules the existing preview update. It does not reorder media or alter captions, alt text, video posters, or cover state.

The dashboard media row, its corresponding dashboard preview figure, and the public `PortfolioProjectArticle` figure use the same preset-to-width mapping. The owning row or figure receives the percentage width and `margin-inline: auto`; its image or video remains `width: 100%` inside that centered container. Width percentages are relative to each surface's existing media column, and no renderer accepts a raw percentage from content.

## Dashboard Video Poster Flow

Every video row exposes a native `Generate Thumbnail` button. A video with an existing `posterSrc` displays it through the video's `poster` attribute and may run the same action again; the current poster remains assigned until a replacement succeeds.

After a new MP4 upload succeeds, the dashboard appends and renders the video immediately with `size: "full"` and no poster. It then invokes the same poster-generation function used by the row button with the stored same-origin video `src`. Poster generation is an enhancement after the durable video upload, not part of deciding whether the video itself succeeded.

The shared browser lifecycle is:

1. Create an in-memory native `<video>`, set `preload="auto"`, load the stored same-origin MP4 source, and wait for the first `loadeddata` frame. Native `error` or `abort` events reject the operation.
2. Confirm `videoWidth` and `videoHeight` are positive, create a canvas at those intrinsic dimensions, and draw the decoded frame at time zero.
3. Call `canvas.toBlob()` with `image/jpeg`; a null blob or canvas security/decoding error rejects the operation. No custom quality or resizing policy is introduced.
4. Wrap the blob in a filename derived from the video stem with `-poster.jpg`, then POST it to the existing `/api/portfolio/media` endpoint as `image/jpeg` using the same upload request boundary as other portfolio images.
5. Accept only a successful `{ kind: "image", src }` response. Assign that `src` to `video.posterSrc`, mark the project dirty, rerender the row and preview, and report success through the existing live status region.
6. Remove event listeners and release the temporary video/canvas references after success or failure. No hidden media element remains attached to the document.

If automatic extraction or poster upload fails, the already-appended video stays in its original position, retains `size: "full"`, and remains usable without a poster. The dashboard retains the first poster-specific failure, continues with later files because the underlying video upload succeeded, and reports that warning after the batch instead of overwriting it with the generic media-upload success message. A manual generation failure similarly leaves the existing video and any previously assigned poster unchanged. Failed or replaced poster files may remain in `public/portfolio/`; rollback and asset garbage collection are outside scope.

Draft save/load and canonical save round-trip `size` and `posterSrc`. Publishing extends the existing referenced-media collection with every video `posterSrc` alongside the cover and ordinary media `src` values, deduplicates those explicit paths, and leaves staged-overlap checks, build rollback, `git commit --only`, and push behavior unchanged.

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
- The same centered preset width used by dashboard rows and preview figures.
- `poster={media.posterSrc}` for videos when a poster exists; videos without one omit the attribute.

The draft route retains its development-only lookup and error behavior but passes a normalized project to the same renderer. The cover belongs to homepage navigation and is not repeated automatically in the detail body.

Poster extraction code remains confined to the localhost dashboard. The public route only renders validated strings and fixed preset classes during the existing static build, so `/portfolio/[slug]` adds no browser script, runtime media decoding, API dependency, or deployed write path.

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

### Ordinary media input and drop

```text
multiple file input OR dashboard file drop
  -> ordered File array
  -> shared sequential ordinary-media upload helper
  -> POST each file to /api/portfolio/media
  -> existing server validation and atomic public/portfolio/ write
  -> append each success to project.media in request order
  -> dirty state, media rows, preview, and status update
```

### Video poster generation

```text
newly uploaded video OR existing video Generate Thumbnail action
  -> same-origin stored MP4 loaded by native browser video
  -> first loadeddata frame drawn to intrinsic-size canvas
  -> JPEG Blob/File named <video-stem>-poster.jpg
  -> POST /api/portfolio/media
  -> existing image validation and atomic public/portfolio/ write
  -> video.posterSrc assigned only after successful image response
  -> dashboard row and preview rerender with video poster
  -> canonical JSON and explicit publish paths on save/publish
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
- File input and drag-and-drop use the same upload and append path, so their media shapes, order, and error messages cannot diverge.
- Unsupported dropped files are rejected by the existing server boundary; successful earlier files remain, the failing file is not appended, and later files are not attempted.
- Drop handling never mutates `coverImage`, even when the pointer is over the cover controls.
- Missing media `size` normalizes to `full`; only `mini`, `small`, `medium`, `large`, and `full` are accepted when the field is present.
- A video `posterSrc` must be a safe existing-format portfolio image path. Image media cannot carry a poster.
- New video state is retained before poster extraction begins, so decode, canvas, blob, network, validation, or malformed-response failure cannot remove the video.
- Poster generation accepts only an image response. A failed automatic attempt does not stop later ordinary files, while the existing first-failed-file rule still applies to failures of the ordinary media upload itself.
- Manual poster regeneration replaces `posterSrc` only after success; failure preserves an existing poster or leaves an unposterized video unchanged.
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
- The labelled multiple-file input remains available for keyboard and assistive-technology users; drag-and-drop is optional enhancement behavior.
- The drag-active visual state is confined to the ordinary media area and does not rely on color to communicate upload success or failure; the existing live status region continues to report those outcomes.
- Every Size select has an associated media-specific label and preserves native keyboard operation.
- Every Generate Thumbnail control is a native button, is disabled only while its own generation request is active, and reports success or failure through the existing `aria-live` status region.
- Video posters are presentation for the native video control and do not introduce a duplicate image, alt-text requirement, or separate keyboard target.
- All five sizes remain centered and constrained to their media column on narrow screens; `full` remains the backward-compatible 100% layout.

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
8. A file `dragover` prevents the browser default, uses a copy drop effect, and highlights only the ordinary media area until the drag leaves or drops.
9. Dropping multiple image/MP4 files anywhere in the dashboard uploads sequentially and appends them after existing ordinary media in drop order without changing the cover.
10. A failed item preserves earlier successful uploads and stops the remaining batch.
11. The existing multiple-file input still uses the same helper and preserves its current upload, ordering, dirty-state, row-rendering, and preview behavior.
12. Media normalization defaults an omitted size to `full`, preserves all five presets, and rejects empty, numeric, percentage, or unknown values.
13. Video normalization round-trips a valid image `posterSrc` and rejects unsafe, non-image, empty, or image-media poster fields.
14. Draft save/load, canonical merge, and public reads preserve normalized sizes and optional video posters.
15. Publish adds every referenced `posterSrc` to the existing deduplicated explicit media path set without weakening staged-path safeguards.
16. The dashboard browser renderer creates a native Size select for every row and a Generate Thumbnail button for every video while image rows have no poster action.
17. The existing `node:vm` fake browser proves size changes update draft state, centered row/preview preset styling, and leave media order and cover state unchanged.
18. Fake native video/canvas boundaries prove automatic and manual first-frame generation, intrinsic canvas dimensions, JPEG upload naming/type, image-only response acceptance, poster assignment, and cleanup.
19. Decode, canvas, null-blob, upload, and malformed-response failures preserve the video and prior poster, report an error, and allow later ordinary uploads after an automatic poster failure.
20. The shared detail renderer applies the same five centered widths and the native video `poster` attribute without adding client-side public behavior.

Use the existing `node:vm` fake DOM/fetch boundary for dashboard browser-script behavior. Extend its fake events, `dataTransfer`, and media-area `classList` only as needed to prove dragover, drop, multiple-file order, partial success, and the file-input regression; do not add a browser test framework.

Extend that same boundary with the smallest fake video/canvas/blob surface needed for deterministic first-frame tests. Do not decode a real video in unit tests or add a media-processing package. Public width/poster behavior is proved through the shared renderer's output or a focused static build probe, then confirmed in the browser.

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
- Changing one dashboard Size select produces the exact 20/45/65/85/100 centered width in both its row and preview without moving neighboring media.
- The same project renders matching centered widths on `/portfolio/<slug>`.
- A video with `posterSrc` exposes that poster in dashboard row, dashboard preview, and public detail video elements.
- When browser media APIs permit deterministic proof, generating a thumbnail from a disposable same-origin video produces a poster request and visible poster without adding an ordinary image row; otherwise retain the exact scripted video/canvas lifecycle proof.

## Acceptance Criteria

- Existing projects without covers remain valid and render as black portfolio cards.
- The dashboard can upload, describe, replace, remove, draft, publish, and reload a separate image-only cover without affecting ordinary media.
- Dropping multiple image/MP4 files anywhere in the portfolio dashboard appends them to ordinary media in drop order through the same helper as the accessible file input, while leaving the cover unchanged.
- Only the ordinary media area highlights during a file drag, and unsupported files retain prior successful uploads under the existing server validation contract.
- Existing media without `size` normalizes and renders as centered `full` width; authors can choose only the exact 20/45/65/85/100 presets from each native Size select.
- New and existing videos can generate an optional first-frame JPEG poster through native browser APIs and the existing media endpoint, and every dashboard/public video uses `posterSrc` when present.
- Poster extraction or upload failure never removes the video, changes its order, or destroys a prior poster; the video remains usable with the documented no-poster fallback.
- Homepage section 2 renders every canonical project in the approved responsive grid.
- Every card is fully linked, keyboard accessible, touch legible, and motion-safe.
- Every canonical project has a statically exported detail URL using the same renderer as its local draft preview.
- Invalid cover data fails at the shared boundary, and failed dashboard replacement does not destroy the prior state.
- No new dependency, endpoint, deployed write path, client-side public state layer, synthetic input event, first-media convention, arbitrary percentage, server-side video decoder, interim-only fallback implementation, unrelated homepage change, or asset cleanup system is added.
