# React and TypeScript Rules

<primary_directive>
Use React and Next.js primitives directly. Keep components small, state close to the interaction that owns it, effects limited to external synchronization, and TypeScript types strict at every boundary.
</primary_directive>

<cognitive_anchors>
TRIGGERS: React, TypeScript, TSX, component, props, hook, state, effect, context, event, form, accessibility, client component
SIGNAL: When triggered -> apply component ownership, strict typing, state, effect, and accessibility rules
</cognitive_anchors>

## Core Rules

1. **Prefer composition over configuration.** A component should have one visible UI responsibility. Keep route-specific composition in the route until another real consumer needs the same contract.
2. **Keep props narrow.** Pass the values or callbacks a child needs, not a page-sized object for convenience. Server-to-client props must be serializable.
3. **Keep types with their owner.** Define a prop or local data type beside its component. Move it to `lib/` only when multiple modules share the same semantic contract. Use `import type` for type-only imports.
4. **Preserve strict TypeScript.** Avoid `any`, unchecked assertions, and casts used to silence boundary uncertainty. Accept `unknown` at untrusted boundaries and narrow it before use. Prefer derived literal unions and existing framework types over duplicated handwritten shapes.
5. **Keep state at the lowest common owner.** Derive values during render instead of synchronizing duplicate state. Lift state only to coordinate real siblings. Prefer URL state or server data for navigation and shareable state.
6. **Use effects only for external synchronization.** Do not use an effect to derive render data or respond to an event that can be handled directly. Clean up subscriptions, observers, timers, and global mutations.
7. **Do not memoize speculatively.** Use `useMemo` or `useCallback` only when measured work is expensive or a third-party API requires stable identity. Keep dependency arrays complete.
8. **Use stable semantic keys.** Use IDs, slugs, or stable values; do not use an array index when items can be reordered, inserted, or removed.
9. **Use native and Next.js behavior first.** Prefer semantic HTML, `next/link`, Next metadata APIs, browser form controls, CSS, and platform events before custom replacements.
10. **Keep accessibility part of the component contract.** Use semantic elements, associated labels, keyboard-operable controls, visible focus, meaningful link text, and ARIA only when native semantics are insufficient.

## Client Boundary Checklist

Before adding `"use client"`, identify the exact browser API, hook, or interaction that requires it. Keep data loading and static markup in a parent Server Component when possible. A Client Component may receive data but must not import `node:fs`, `node:path`, or server-only readers.

## Quality Gates

- Can the component's responsibility be described in one sentence?
- Is state stored only once and at its nearest owner?
- Can an effect be replaced by render derivation or an event handler?
- Are props and boundary values precisely typed?
- Does the markup work with keyboard and screen-reader semantics?
- Was a native React, Next.js, or browser capability reused before adding code?

## Avoid

- Whole-page Client Components for isolated interaction.
- Mirroring props in state without an independent editing lifecycle.
- Effects that only call `setState` from other state.
- `any`, blanket `as` casts, and duplicate interface definitions.
- Click handlers on non-interactive elements.
- New context providers or state libraries for local state.
