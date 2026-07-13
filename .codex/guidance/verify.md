# Completion Verification Rules

<primary_directive>
Before calling repository work complete, inspect the final diff, run the smallest checks that prove the changed surface, expand to release checks when the surface requires them, and report both evidence and gaps.
</primary_directive>

<cognitive_anchors>
TRIGGERS: verify, verification, complete, done, final, review, acceptance criteria, handoff, build, lint
SIGNAL: Before every final response or handoff -> inspect the diff, apply the surface matrix, and report guidance plus evidence
</cognitive_anchors>

## Always Apply

1. Inspect `git status --short` and the complete diff for the task scope.
2. Re-read the guidance files loaded for the changed surface.
3. If a related GitHub issue or approved spec exists, check every explicit acceptance criterion.
4. Run the smallest focused check first, then the broader commands required below.
5. Do not describe an unrun command as passing. State the reason and resulting risk.

## Verification Matrix

| Changed surface | Required checks |
| --- | --- |
| Guidance or Markdown only | Link/path inspection, stale-term scan, and final diff review |
| `content/**` or content contract | `npm run verify:content`; `npm run build` when render or route output can change |
| `lib/**` behavior | Owning focused `node --test ...`; then `npm test` |
| `scripts/**` behavior | Owning focused `node --test ...`; then `npm test` and `npm run verify:content` when tracked content is involved |
| `app/**`, `components/**`, CSS, or MDX rendering | Relevant focused tests, `npm run lint`, and `npm run build` |
| Package, Next.js, TypeScript, ESLint, or build config | `npm test`, `npm run lint`, and `npm run build` |

Run `npm run verify:content` before `npm run build` only when calling it separately; the build script already invokes content verification.

## Guidance Integrity Check

For `.codex/guidance/` changes:

- confirm every file named in `index.md` exists;
- confirm commands match `package.json`;
- scan for stale platform terminology or copied repository names;
- check that overlapping rules use the same ownership and verification language;
- keep `index.md` short enough to route rather than duplicate detailed rules.

## Final Evidence Format

```text
Guidance loaded: index.md, verify.md, <matched files or none>
Issue/spec review: <reference and result, or no related issue>
Verification: <commands or inspections and results>
Not run: <command and reason, when applicable>
```

## Avoid

- Marking work complete from code inspection alone when a runnable check exists.
- Running only the broad build when a focused regression test should identify the behavior.
- Hiding skipped checks or environment failures.
- Rewriting unrelated files discovered during final review.
- Finalizing with missing index targets or contradictory guidance.
