# Architecture Rules

<primary_directive>
Preserve the smallest architecture that expresses the product. Keep route composition in `app/`, reusable UI in `components/`, shared content logic in `lib/`, tracked build inputs in `content/`, and local-only tooling in `scripts/`. Add a new layer only after a real responsibility no longer fits one of these boundaries.
</primary_directive>

<cognitive_anchors>
TRIGGERS: architecture, structure, directory, boundary, module, dependency, refactor, server component, client component, use client, static export
SIGNAL: When triggered -> preserve directory ownership and keep dependencies flowing toward shared, runtime-neutral code
</cognitive_anchors>

## Core Rules

1. **Keep directory ownership explicit.**
   - `app/`: routes, layouts, metadata, page composition, and server-side loading.
   - `components/`: reusable UI and substantial interactive leaf components.
   - `lib/`: shared content readers, transformations, constants, and runtime-neutral types.
   - `content/`: tracked MDX, JSON, and TSX build inputs; no application imports.
   - `scripts/`: localhost authoring and verification tools; never imported by the deployed app.
2. **Use Server Components by default.** Add `"use client"` only at the smallest component that needs browser APIs, hooks, or interaction. Pass serializable values across the server/client boundary.
3. **Colocate before promoting.** Keep route-only code beside its route and component-only types beside the component. Promote code after a second real consumer needs the same behavior or when it owns a distinct external-system responsibility.
4. **Keep dependency direction predictable.** `app/` may depend on `components/` and `lib/`; `components/` may depend on runtime-compatible `lib/`; `lib/` must not import route or component implementations. Client code must not import Node-only modules.
5. **Do not create speculative layers.** Do not add `domain`, `service`, `repository`, dependency-injection, or global state layers for a filesystem-backed static blog. Introduce one only when current code demonstrates the boundary and lifecycle it would own.
6. **Keep static export a release constraint.** New routes must be compatible with `output: "export"`; dynamic routes provide static params, and deployed code does not depend on runtime writes or server-only APIs unavailable on GitHub Pages.
7. **Separate deployed reads from local writes.** Public pages read tracked content at build time. Authoring writes remain in `scripts/` and never require a deployed admin route.
8. **Change the narrowest owning boundary.** Fix shared behavior in its shared reader or component, not independently in every route that consumes it.

## Extension Thresholds

- Extract a reusable component after two consumers need the same UI contract, not merely similar markup.
- Extract a shared helper when it removes duplicated behavior, not just duplicated syntax.
- Add context or a state library only when state must be coordinated across multiple distant interactive branches and URL/server state is not the better owner.
- Add an external service boundary only when an actual database, API, queue, or SDK appears.

## Quality Gates

- Does every changed file sit in the directory that owns its responsibility?
- Is each Client Component boundary as small as practical?
- Are Node-only imports unreachable from client bundles?
- Does the change remain compatible with static export?
- Was an existing helper, component, platform API, or installed dependency reused first?
- If a new abstraction was added, can its second consumer or independent lifecycle be named now?

## Avoid

- Route files importing other route files.
- `lib/` importing from `app/` or `components/`.
- Turning an entire page client-side for one interactive leaf.
- Generic `utils`, `services`, or `types` dumping grounds.
- Repository or use-case wrappers around direct build-time file reads.
- A deployed write API or admin route for local authoring.
