# Dashboard Preview Images Design

## Goal

Show images uploaded through the local article dashboard inside its Markdown preview.

## Design

The existing `node:http` dashboard server will handle `GET /images/<filename>` by reading the matching file from `public/images/`. The route will decode one filename, reject path separators, traversal, unsupported extensions, and missing files, then return the file with the existing image MIME type. All other paths keep the current 404 behavior.

This reuses the URL already inserted by drag and drop (`/images/<filename>`) and does not change upload, Markdown, commit, push, or deployed-site behavior.

## Error Handling

- Unsafe or malformed image paths return 404 without exposing filesystem details.
- Missing files return 404.
- Only the image extensions already accepted by uploads are served.

## Testing

Add one real-server regression test that creates a temporary `public/images` file, requests its `/images/...` URL, and verifies the status, MIME type, and bytes. Keep the existing upload and publish tests unchanged, then run the dashboard suite and broader repository checks required for `scripts/**` changes.
