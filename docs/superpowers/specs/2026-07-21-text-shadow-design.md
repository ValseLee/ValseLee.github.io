# Text Shadow Design

## Goal

Bring the ink-like text texture from `ph.demiladehq.com` into the blog without changing its typography or layout.

## Design

- Reuse the existing `--ink-shadow` token in `app/globals.css`.
- Apply it only to `a`, `button`, `h3`, `h4`, and `p`, matching the reference site's scope and leaving large `h1` and `h2` titles crisp.
- Override `--ink-shadow` below `860px` with the reference site's quarter-strength values so the effect does not look heavy on smaller screens.
- Add no component, dependency, JavaScript, or new abstraction.

## Verification

- Run `npm run lint` and `npm run build`.
- Inspect the rendered desktop and mobile typography to confirm the intended selectors receive the shadow and large titles do not.
