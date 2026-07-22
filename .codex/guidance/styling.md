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
9. **Migrate incrementally.** Existing semantic global classes may remain until their owner changes. When a violating selector or its owner is touched, move it to the correct scope instead of adding another override. Do not convert unrelated styles merely to satisfy the preferred pattern.

## Cascade and Specificity

1. **Give each property one owner.** Do not make a Tailwind utility, global rule, and CSS Module compete to set the same property on one element. Split responsibilities by property or express an intentional component variant inside the owning CSS Module.
2. **Keep a one-class specificity budget.** Start selectors at one local class (`0-1-0`). Put states and variants on that class, using `:where(...)` when needed to avoid raising specificity. Treat higher specificity as an explicit same-owner exception, not the default.
3. **Distinguish safe nesting from structural coupling.** Nesting `&:hover`, `&:focus-visible`, `&::before`, and media queries under an owned class is safe. Avoid `& h2`, `& .child`, `.parent &`, and other selectors whose behavior depends on descendant markup.
4. **Keep descendant exceptions narrow.** A generated-content owner may use selectors such as `.prose :where(h1, h2, p)`. A component may use a relationship such as `.card:where(:hover, :focus-visible) .overlay` only when both classes belong to that component and the ancestor state genuinely controls the child.
5. **Make global layer precedence explicit.** Keep tokens in `@theme` or `:root`, element defaults in `@layer base`, and shared global primitives in `@layer components`. Avoid unlayered element and class selectors in `app/globals.css`; normal unlayered CSS outranks Tailwind's layered utilities regardless of selector specificity.
6. **Do not use source order as an API.** Import order and later declarations must not be the documented way to customize a component. Use props, `data-*` attributes, or an owned modifier class for intentional variants.
7. **Reserve `!important` for hard guarantees.** Do not use it to win specificity conflicts. Accessibility safeguards such as reduced-motion overrides, or a documented boundary with CSS outside repository control, may use it when the guarantee must win.

## Choosing a Style Surface

- Site-wide token or reset -> `app/globals.css`.
- Reused site primitive with a documented contract -> `app/globals.css`.
- Up to a few readable, one-use utilities -> Tailwind in JSX.
- Component variants, states, animation, or several selectors -> colocated CSS Module.
- Style shared by unrelated components but not yet stable -> keep local duplication until a common contract is clear.

## Quality Gates

- Could this rule affect markup outside its owner?
- Does a parent selector depend on a child's tags or classes?
- Does more than one styling surface set the same property on this element?
- Is this selector more specific than one class without an explicit same-owner reason?
- Is a global rule in the correct cascade layer?
- Is a repeated value already represented by a token?
- Are focus, reduced motion, and narrow-screen behavior preserved?
- Is the chosen style surface smaller than a new global rule?

## Avoid

- Broad tag overrides for component-specific design.
- Parent selectors reaching into child component internals.
- Descendant nesting used only to increase specificity or override another rule.
- Tailwind utilities and CSS Modules competing for the same property.
- Unlayered element or class rules in `app/globals.css`.
- `!important` as a specificity strategy.
- A new global class for a single local use.
- Long repeated Tailwind strings that hide a shared component contract.
- Repository-wide style migration during an unrelated feature.
