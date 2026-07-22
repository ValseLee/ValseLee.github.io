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
- Preservation of the current uncommitted `.overlay` opacity and formatting changes.

### Excluded

- React or JavaScript animation.
- SVG, extra elements, dependencies, or shared animation abstractions.
- Changes to card content, links, cover images, layout, or the existing focus outline.
- Applying the decoration to other cards or site-wide styles.

## Design

Keep the effect in `app/PortfolioGrid.module.css`, the existing owner of portfolio-card interaction styles. Draw all four corners with one non-interactive `.card::after` pseudo-element using CSS background gradients. The pseudo-element sits above the card artwork and overlay, inherits the card's white foreground color, and cannot intercept pointer input.

The resting pseudo-element is transparent and positioned slightly outside its final inset. On `.card:hover` for precise hover devices and on `.card:focus-visible`, it moves inward to the final inset while fading in over approximately 220ms. Removing the state reverses the same transition. The existing overlay transition continues independently.

Keyboard focus uses the same visible corner state while retaining the current external focus outline. Coarse-pointer and touch interaction do not gain a persistent hover decoration. Under `prefers-reduced-motion: reduce`, the corner transition is disabled while the active hover or focus state remains visible.

## Failure and Compatibility Boundaries

The decoration is visual-only, so missing CSS animation support must leave the link usable and its text accessible. No content, state, event, or runtime error path changes. The implementation uses established CSS properties rather than masks or complex clipping so current Safari, Chrome, and Firefox rendering remains predictable.

## Verification

- Confirm the implementation diff changes only `app/PortfolioGrid.module.css` and preserves the existing uncommitted overlay edits.
- Run `git diff --check`.
- Run `npm run lint`.
- Run `npm run build`.
- Inspect the rendered grid with pointer hover and keyboard focus, including the external focus outline.
- Confirm reduced-motion disables movement without hiding the active corners.
