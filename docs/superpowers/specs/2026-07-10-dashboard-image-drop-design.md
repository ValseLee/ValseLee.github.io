# Dashboard Image Drop Design

## Goal

Let the local article dashboard attach a dropped image at the current Markdown textarea position.

## Flow

1. The user drops one image file on the Markdown body textarea.
2. The browser sends the file to a local upload endpoint.
3. The endpoint accepts image files up to 10 MB, writes them under `public/images/`, and returns their public path.
4. On success, the browser inserts `![original filename](/images/saved filename)` at the drop caret position and updates the preview.
5. On failure, the editor text remains unchanged and the dashboard shows the error.

## Storage and Naming

Images are part of the site source, not embedded as base64 in MDX. The server creates a URL-safe unique filename from the original basename and preserves its extension. A filename collision receives a numeric suffix.

## Boundaries

- The endpoint is served only by the existing `127.0.0.1` dashboard.
- Only one dropped file is handled per drop.
- Accepted types are PNG, JPEG, GIF, WebP, AVIF, and SVG; the browser-supplied MIME type and filename extension must agree with that list.
- No image resizing, metadata extraction, gallery UI, or paste-from-clipboard support is included.

## Verification

Unit tests cover filename generation and file validation/storage. A browser-level check confirms a successful upload response inserts the expected Markdown at the saved selection.
