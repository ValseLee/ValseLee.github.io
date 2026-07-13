# Local Tool Rules

<primary_directive>
Keep authoring and maintenance tools local, testable, and unable to weaken the static deployed site. Validate before writing, preserve existing data on failure, and prefer Node built-ins or installed packages.
</primary_directive>

<cognitive_anchors>
TRIGGERS: script, dashboard, authoring, local server, write, upload, file, CLI, localhost, atomic save, verify-content
SIGNAL: When triggered -> preserve localhost isolation, safe file boundaries, and testable pure logic
</cognitive_anchors>

## Core Rules

1. **Bind authoring servers to `127.0.0.1`.** Do not expose local write tools on all interfaces and do not add a deployed `/admin` route or write API.
2. **Validate before mutation.** Check request size, method, content type, field shape, filenames, extensions, URLs, and destination paths at the local trust boundary.
3. **Preserve data on failure.** Normalize and validate first; for replaceable content files, write a sibling temporary file and rename it only after the complete write succeeds.
4. **Constrain paths to owned directories.** Derive destinations from fixed repository roots, reject traversal and separators in user-controlled filenames, and never accept an arbitrary absolute path from a request.
5. **Separate pure logic from process startup.** Export normalizers, parsers, and save functions for direct tests. Guard server startup so importing a script in tests has no side effects.
6. **Use the platform first.** Prefer `node:fs`, `node:path`, `node:http`, `node:url`, and installed packages before adding a dependency.
7. **Keep outputs reviewable.** Tracked content and images use deterministic names and formats. Temporary files stay untracked and are cleaned after successful operations.
8. **Return actionable errors without leaking internals.** Give local users a field-specific message; do not expose stack traces, arbitrary filesystem paths, or secrets in HTTP responses.

## Quality Gates

- Is every write endpoint unreachable from the deployed Next.js app?
- Does malformed input leave the previous file unchanged?
- Can path input escape the intended content or image directory?
- Can core logic be tested without starting a server or opening a browser?
- Was a Node built-in or existing dependency reused?
- Are temporary files and partial output handled deterministically?

## Avoid

- Binding a write server to `0.0.0.0`.
- A deployed admin page, route handler, or write API.
- Writing before complete validation.
- Accepting request-controlled filesystem paths.
- Starting the server as an import side effect.
- Adding a framework for a small local script.
