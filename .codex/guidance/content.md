# Content and Static Route Rules

<primary_directive>
Treat tracked MDX and JSON as typed build inputs. Read them on the server, validate them at the content boundary, and keep every public route compatible with static export.
</primary_directive>

<cognitive_anchors>
TRIGGERS: MDX, frontmatter, content, post, translation, slug, static params, metadata, JSON, category, link, archive
SIGNAL: When triggered -> apply content validation, server-only reading, and static route rules
</cognitive_anchors>

## Core Rules

1. **Keep content tracked and build-time.** Posts live in `content/posts`, translations in `content/translations`, and profile data in `content/site.json`. Do not add runtime persistence for deployed pages.
2. **Read files only from server-capable code.** Keep filesystem access in `lib/` readers or local `scripts/`; never import those readers into Client Components.
3. **Validate at the boundary.** Treat parsed frontmatter, JSON, slugs, and local editor payloads as untrusted until required fields, arrays, enums, dates, and URLs are checked. Do not spread unchecked casts through consumers.
4. **Change content contracts atomically.** When a content field changes, update its type, reader/normalizer, verification script, authoring surface, and every renderer in the same change.
5. **Keep dynamic routes enumerable.** A dynamic public route must implement `generateStaticParams()` from the canonical content reader. Missing content returns `notFound()` rather than an incomplete page.
6. **Keep metadata content-derived.** Generate route titles and descriptions from validated content, with an explicit not-found result.
7. **Keep slugs and links consistent.** Derive slugs from filenames, decode route input once, accept only the expected filename shape, and verify internal linked slugs exist.
8. **Fail builds on invalid tracked content.** Required content must not silently become an empty string or default object. Produce a field-specific error through `verify:content` or the reader used during build.
9. **Keep list transformations pure.** Sorting, grouping, excerpts, and graph links belong in focused `lib/` functions and must not mutate parsed content.

## Quality Gates

- Is the content shape represented by one canonical TypeScript contract?
- Is untrusted parsed data checked before rendering?
- Are filesystem APIs unreachable from Client Components?
- Do new dynamic values participate in static params and metadata?
- Does `npm run verify:content` detect a malformed or dangling value?
- Did a contract change update readers, writers, verification, and renderers together?

## Avoid

- Reading MDX directly in multiple route files.
- Required fields normalized to misleading empty defaults.
- Runtime APIs or databases for tracked static content.
- Dynamic routes without static params under `output: "export"`.
- Client-side filesystem or content parsing.
- Link graphs that silently retain missing target slugs.
