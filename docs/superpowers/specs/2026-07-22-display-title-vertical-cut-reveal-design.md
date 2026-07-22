# Display Title Vertical Cut Reveal

## Goal

Reveal the home-page `display-title` on its first appearance with the character-by-character vertical cut motion demonstrated by 21st.dev's Vertical Cut Reveal.

## Design

- Store the three title lines as strings so the page can render their characters without duplicating copy.
- Keep the home page as a Server Component; no browser state or animation dependency is needed.
- Render characters inside clipped inline wrappers and animate them from below to their resting position with a short stagger from the first character.
- Preserve word wrapping by grouping characters within their original words.
- Keep the existing `h1` semantics and provide the complete title as its accessible name.
- Under `prefers-reduced-motion: reduce`, render the final title immediately without motion.

## Scope

Change only the title content shape, home-page title markup, and its existing global style. Do not generalize the effect into a reusable component until a second consumer exists.

## Verification

- Run the surface-matched lint/build checks required by repository guidance.
- Verify in a browser that the title begins clipped below its baseline, reveals in source order only on initial page load, preserves its desktop and mobile wrapping, and is immediately visible with reduced motion enabled.
