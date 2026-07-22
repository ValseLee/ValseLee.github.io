# My blog

## Local article dashboard

Run `npm run write` to open the localhost-only article dashboard. After placing the caret in the Markdown body, drop one PNG, JPEG, GIF, WebP, AVIF, or SVG file there. The dashboard saves it in `public/images/` and inserts its Markdown reference automatically; the image is included when the article is committed.

## Local draft preview

Run `npm run dev`, then open `/drafts` to browse article drafts from `.article-drafts/` and portfolio drafts from `.portfolio-drafts/`. These development-only routes are excluded from the production static export.
