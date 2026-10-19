# Design

## Context

The four share DTOs validate `itemId` with `IsValidFilePath` (`apps/chat-api/src/files/dto/file-path.validator.ts`) stacked, on three of them, with `IsCatalogResourcePath` (`apps/chat-api/src/share/dto/catalog-resource-path.validator.ts`, prefix allowlist only). `IsValidFilePath` is a denylist written for files-API paths; see proposal.md for why it rejects Core-legal ids. A near neighbour already exists: `IsSafeResourceId` (`apps/chat-api/src/common/validators/safe-resource-id.validator.ts`) with a segment-level traversal guard (`hasTraversalSegment`) on top of `DEPLOYMENT_ID_PATTERN`, but that pattern is an allowlist for deployment ids and excludes whitespace, `,`, `&`, which decoded prompt ids contain.

DIAL Core's rule for a path element is small: after percent-decoding, no control character, `/`, `{`, `}` or `"`, and the raw path must be a URI with no query or fragment (`ResourceDescriptorFactory.isValidFilename`, `UrlUtil.decodePath` in `ai-dial-core`). The BFF does not forward `itemId` into a URL: it goes into a JSON body to Core (`shareResource`, `discardSharedResources`, `revokeSharedResources`) and, for conversations, through `encodeDialResourcePath` into `getConversation`. It is also written to logs.

## Goals / Non-Goals

**Goals:**
- Accept every id DIAL Core can emit for a resource of an allowlisted type.
- Keep the BFF a real first boundary: traversal, control characters and injection into logs stay rejected.
- One definition of the rules, shared by the four DTOs.

**Non-Goals:**
- Changing `IsValidFilePath` or any DTO outside `share/`.
- Replacing `IsCatalogResourcePath` or merging the two validators.
- Fixing the `502` on share.

## Decisions

**1. New validator `IsDialResourceId` in `apps/chat-api/src/common/validators/`, following the `IsSafeResourceId` file layout** (`dial-resource-id.validator.ts` exporting a pure `isDialResourceId(value): value is string`, the `IsDialResourceId` decorator, and a message constant; co-located `*.spec.ts`). Pure predicate + decorator is the established shape there, and the predicate is reusable outside class-validator.

**2. Denylist mirroring Core, not an allowlist regex.** `apps/chat-api/AGENTS.md` asks for allowlist `@Matches` on strings that reach a path/URL/log line. Here the permitted alphabet is "everything Core allows" (unicode names, spaces, all sub-delimiters), which an allowlist cannot express without drifting from Core the way `IsValidFilePath` did. The structural allowlist is kept where it is meaningful: `IsCatalogResourcePath` already pins `{type}/{bucket}/` to the five known prefixes, and the validator rejects what Core rejects plus the traversal and log-injection shapes. This is a deliberate exception to that guideline and is recorded here so it is not re-litigated.

**3. Algorithm (per request, no I/O):**
1. Non-string, empty → reject. Literal `?` or `#`, leading `/` → reject.
2. Reject malformed percent-encoding (`%` not followed by two hex digits) on the raw value.
3. Split on `/`; each raw segment must be non-empty.
4. Decode each segment once (`decodeURIComponent`; if that throws on a non-UTF-8 byte such as `%FF`, decode only the ASCII escapes `%00`-`%7F` in a single pass, so a forbidden character next to the bad byte is still seen) and split the result on `/` again, so `..%2Fx` and `%2e%2e` surface as segments; reject any resulting empty, `.` or `..` segment.
5. Reject `\`, `{`, `}`, `"` and control characters (U+0000-U+001F) in both the raw value and every decoded segment.
Everything else passes. A `%2F` inside a segment therefore passes step 4 (it only splits into non-traversal segments), matching the existing Quick App conversation ids.

**4. Apply to the four share DTOs only**, replacing `@IsValidFilePath()` one-for-one, keeping the other decorators and their order. Trailing-slash ids (folders) are not valid resources for these endpoints and are already rejected by `IsCatalogResourcePath`'s pattern on three DTOs; `CreateShareLinkDto` has no prefix check (models are shareable, e.g. `gpt-4o`), so step 3 rejecting empty segments also rejects a trailing `/` there — acceptable, no resource id ends with one.

**5. Keep `\` and decoded `%5C` rejected**, although Core would accept a decoded backslash in a name. `IsValidFilePath` rejected `%5c` as a traversal vector on Windows-style storage; relaxing it has no known user need, so it stays rejected until one appears.

Alternatives (relax `IsValidFilePath`, reuse `IsSafeResourceId`, encode on the client) are weighed in proposal.md.

## Risks / Trade-offs

- [Validator broader than before for `: ; , = & @ + $ ! ' ( ) *`] → Core remains the second boundary and rejects its own invalid names; characters that mattered for injection (control chars, `\`, braces, quotes, `?`, `#`, traversal) stay blocked, and `itemId` is only ever sent in JSON bodies or through `encodeDialResourcePath`.
- [Downstream code may mishandle a literal `:` or `,`] → a service test pins what `getConversation` and `shareResource` receive for the Bedrock id (task 3.2); whether real Core accepts it is confirmed by running the share locally after merge-ready, outside the task list.
- [A decoded prompt id with `%` in a name] → `%` not followed by two hex digits is rejected, as before; prompts with such names were already unsupported by `IsValidFilePath`. Not a regression.
- [Rules drift from Core again] → the spec names the Core rule it mirrors, and the validator spec lists each class of character explicitly.

## Migration Plan

Pure server-side validation change, no data migration, no feature flag. Rollback: revert the commit (decorator swap back to `IsValidFilePath`). No client regeneration expected; `npm run openapi:check` guards against an accidental contract change.
