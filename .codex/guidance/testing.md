# Testing Rules

<primary_directive>
Protect observable behavior with the smallest runnable check. For non-trivial behavior changes, write a failing test first, make it pass with the minimum change, and keep the test at the boundary that owns the behavior.
</primary_directive>

<cognitive_anchors>
TRIGGERS: test, node:test, assert, TDD, regression, mock, fixture, coverage, parser, validation
SIGNAL: When triggered -> test behavior at the smallest owning boundary and run the focused check first
</cognitive_anchors>

## Core Rules

1. **Test behavior, not implementation.** Assert returned values, rendered contracts, validation failures, file outcomes, and public side effects. Do not lock tests to private helper steps.
2. **Use the existing test surface.** Prefer `node:test` and `node:assert/strict` for `lib/` and `scripts/`. Do not add a test framework for behavior the current setup can prove.
3. **Use one meaningful regression check.** Every changed branch, loop, parser, validation rule, or data-preserving write needs a test that would fail if the behavior regressed. Trivial markup or type-only edits need no synthetic test.
4. **Keep tests beside the owner.** Use `lib/*.test.mjs` for library behavior and `scripts/*.test.mjs` for authoring tools, matching the current repository pattern.
5. **Cover failure paths at trust boundaries.** Parsers and writers test malformed input, missing required fields, unsafe paths or URLs, and preservation of prior data.
6. **Keep fixtures minimal.** Build only the smallest valid input needed for the assertion. Use temporary directories for filesystem writes and never mutate tracked content in tests.
7. **Mock only external boundaries.** Prefer real pure functions and temporary files. Stub time, network, browser APIs, or process launches only when the test cannot remain deterministic otherwise.
8. **Run focused before broad.** Run the owning test file first, then `npm test`, and add lint/build verification according to `.codex/guidance/verify.md`.

## TDD Loop

1. Add one test describing the missing or broken behavior.
2. Run its focused command and confirm the expected failure.
3. Make the smallest production change that satisfies it.
4. Run the focused test until it passes.
5. Run the broader checks required by the changed surface.

## Quality Gates

- Would the test fail if the requested behavior broke?
- Does it use the public boundary instead of private implementation details?
- Does a write test prove the previous data survives invalid input?
- Is the fixture smaller than the production object graph?
- Did the focused test fail first for the expected reason?
- Were broader checks selected from `verify.md`?

## Avoid

- Tests that only assert a helper was called.
- Snapshot tests for small semantic output.
- Framework installation for one component or script.
- Tests that write into tracked `content/` or `public/` paths.
- Live network calls and browser launches in unit tests.
- Claiming TDD without observing the initial failure.
