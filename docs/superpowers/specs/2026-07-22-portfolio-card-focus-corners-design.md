# Portfolio Card Focus Corners Design

**Date:** 2026-07-22
**Status:** Approved

## Goal

Add the reference video's camera-focus corner animation to portfolio cards without changing their markup, navigation, or existing overlay behavior.

## Scope

### Included

- Four white L-shaped corner marks inside each portfolio card.
- A short inward movement and fade when a card receives precise-pointer hover or keyboard `:focus-visible`.
- The reverse transition when hover or focus ends.
- An immediate final state when reduced motion is requested.
- The existing ink-shadow layer values applied to the gradient corners through a shared drop-shadow token, including the weaker mobile values below 860px.
- Preservation of the current uncommitted `.overlay` opacity and formatting changes.
- Preservation of the later tuned corner opacity, timing, focus inset, and outline width.

### Excluded

- React or JavaScript animation.
- SVG, extra elements, dependencies, or shared animation abstractions.
- Direct `text-shadow` or `box-shadow` on the gradient decoration, because neither follows the four L-shaped corner pixels.
- Duplicating the global ink-shadow values inside the CSS Module.
- Changes to card content, links, cover images, layout, or the existing focus outline.
- Applying the decoration to other cards or site-wide styles.

## Design

Keep the effect in `app/PortfolioGrid.module.css`, the existing owner of portfolio-card interaction styles. Draw all four corners with one non-interactive `.card::after` pseudo-element using CSS background gradients. The pseudo-element sits above the card artwork and overlay, inherits the card's white foreground color, and cannot intercept pointer input.

The tuned resting pseudo-element uses a 6px inset and `0.3` opacity. Precise-pointer hover moves it to a 16px inset and full opacity over 250ms, while keyboard `:focus-visible` uses the tuned 8px inset, full opacity, and existing 1px external outline. Removing the active state reverses the same transition. The existing overlay transition continues independently.

Keyboard focus uses the same visible corner state while retaining the current external focus outline. Coarse-pointer and touch interaction do not gain a persistent hover decoration. Under `prefers-reduced-motion: reduce`, the corner transition is disabled while the active hover or focus state remains visible.

The existing `--ink-shadow` value cannot be passed directly to `filter: drop-shadow()` because it is a comma-separated `text-shadow` list, and `text-shadow` does not affect background gradients. Define a neighboring `--ink-drop-shadow` token in `app/globals.css` whose three `drop-shadow()` functions use the same offsets, blur radii, and colors as `--ink-shadow`. Give it the corresponding weaker values in the existing 860px media query, then apply `filter: var(--ink-drop-shadow)` only to `.card::after`.

## Failure and Compatibility Boundaries

The decoration is visual-only, so missing CSS animation or filter support must leave the link usable and its text accessible. No content, state, event, or runtime error path changes. The implementation uses established CSS properties rather than masks or complex clipping so current Safari, Chrome, and Firefox rendering remains predictable.

## Verification

- Confirm the implementation diff changes only `app/globals.css` and `app/PortfolioGrid.module.css` and preserves all existing uncommitted card edits.
- Run `git diff --check`.
- Run `npm run lint`.
- Run `npm run build`.
- Inspect the rendered grid with pointer hover and keyboard focus, including the external focus outline.
- Confirm reduced-motion disables movement without hiding the active corners.
- Confirm the corner's computed filter uses the desktop token and switches to the weaker token below 860px.
