# Styling Rules

<primary_directive>
Keep shared design contracts global and component implementation styles local. Parents own placement; children own their internal appearance. A selector must not reach across a component boundary and depend on a child's markup.
</primary_directive>

<cognitive_anchors>
TRIGGERS: CSS, style, styling, Tailwind, className, CSS Module, responsive, theme, token, animation, layout, visual
SIGNAL: When triggered -> choose the narrowest style scope and audit parent-child isolation
</cognitive_anchors>

## Scope Rules

1. **Use `app/globals.css` only for shared contracts.** Global reset, design tokens, body defaults, site shell, typography primitives, prose output, and patterns with at least two consumers may be global.
2. **Use Tailwind for short one-off composition.** Local spacing, alignment, and simple responsive utilities may stay in JSX when they are readable and not repeated.
3. **Use a colocated CSS Module for non-trivial component styles.** Create `Component.module.css` when a component owns multiple selectors, variants, interactive states, animation, or responsive behavior.
4. **Keep selectors owned.** Prefer one local class. Avoid selectors such as `.parent .child`, `.parent h2`, or selectors that target another component's implementation class.
5. **Respect the parent-child contract.** A parent controls grid/flex placement through its own wrapper or a child's documented `className` prop. A child controls its descendants, spacing, states, and decoration.
6. **Allow owned descendant styling only for generated content.** A prose or content-rendering primitive may style raw MDX descendants because that subtree is its public responsibility. Keep the selector under one explicit primitive class.
7. **Use tokens for repeated decisions.** Reuse existing custom properties for color, typography, spacing, and borders. Add a token only after the value represents a shared semantic decision.
8. **Keep responsive and motion behavior local.** Start with the narrow layout, add breakpoints where content requires them, honor `prefers-reduced-motion`, and preserve visible `:focus-visible` states.
9. **Migrate incrementally.** Existing semantic global classes may remain until their owner changes. Do not convert unrelated styles merely to satisfy the preferred pattern.

## Choosing a Style Surface

- Site-wide token or reset -> `app/globals.css`.
- Reused site primitive with a documented contract -> `app/globals.css`.
- Up to a few readable, one-use utilities -> Tailwind in JSX.
- Component variants, states, animation, or several selectors -> colocated CSS Module.
- Style shared by unrelated components but not yet stable -> keep local duplication until a common contract is clear.

## Quality Gates

- Could this rule affect markup outside its owner?
- Does a parent selector depend on a child's tags or classes?
- Is a repeated value already represented by a token?
- Are focus, reduced motion, and narrow-screen behavior preserved?
- Is the chosen style surface smaller than a new global rule?

## Avoid

- Broad tag overrides for component-specific design.
- Parent selectors reaching into child component internals.
- `!important` as a specificity strategy.
- A new global class for a single local use.
- Long repeated Tailwind strings that hide a shared component contract.
- Repository-wide style migration during an unrelated feature.
