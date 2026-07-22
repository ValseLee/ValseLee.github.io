# Portfolio Media Grid Design

**Date:** 2026-07-22
**Status:** Approved

## Goal

Make the media gallery at the bottom of each portfolio project easier to scan by replacing the vertical list with a responsive grid.

## Design

- Render media in one column on mobile, two columns on tablet-sized screens, and three columns on desktop.
- Give every media item an equal grid cell and let its image or video fill that cell's width.
- Keep captions directly below their media.
- Preserve the existing media order, image alt text, video controls, poster images, and loading behavior.
- Keep the existing `size` value in the portfolio content contract and dashboard, but do not apply it in this uniform gallery layout.

## Scope

Change only `components/PortfolioProjectArticle.tsx` using existing Tailwind layout utilities. Do not change portfolio content, validation, dashboard behavior, dependencies, or unrelated site styles.

## Verification

- Inspect the final diff and run `git diff --check`.
- Run `npm run lint` and `npm run build`.
- Verify the rendered gallery at mobile, tablet, and desktop widths, including image captions and playable videos.
