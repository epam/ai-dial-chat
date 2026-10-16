# Proposal

## Why

Sharing, un-sharing, revoking and counting recipients of a conversation (or any resource) fails with `400 Bad Request — path must not start with /, contain .., or include forbidden characters` whenever the DIAL Core resource id contains a character the chat-api share DTOs reject. The reproduced case is a chat with a Bedrock model, e.g. `conversations/{bucket}/anthropic.claude-haiku-4-5-20251001-v1:0__hi__{uuid}`: the model id carries a literal `:`, which `IsValidFilePath` forbids (`apps/chat-api/src/files/dto/file-path.validator.ts:3`). The user only sees the generic popup "Couldn't create the share link."

The root cause is a misapplied validator, not bad data. `IsValidFilePath` was written for the files API (#6920) and its forbidden set (`: ; , = { } % & \ "`) is the same list used to sanitise names the user types (`PROHIBITED_CONVERSATION_NAME_CHARS_RE`, `libs/chat-shared/src/utils/string-utils.ts:2`). A resource id is not a typed name: it is DIAL Core's canonical URL, and Core's own encoder (Guava `urlPathSegmentEscaper`, `ai-dial-core` `UrlUtil.encodePathSegment`) leaves `: , ; = & @ + $ ! ' ( ) *` literal. Core itself rejects only control characters, `/`, `{`, `}` and `"` inside a decoded path element (`ResourceDescriptorFactory.isValidFilename`). Chat titles are stripped of the forbidden characters, but the deployment/model id embedded in the filename is not, so any model or application id containing `:` produces an id the BFF refuses to share. The same check also rejects any substring `..` (e.g. a title `Wait.. what`), although only whole `.`/`..` segments are traversal.

## What Changes

- Add one resource-id validator, `IsDialResourceId`, next to `IsSafeResourceId` in `apps/chat-api/src/common/validators/`, that mirrors DIAL Core's actual path rules: segment-level traversal guard (empty, `.`, `..`, raw or percent-encoded), reject `\`, `{`, `}`, `"` and control characters (literal or decoded), a literal `?`/`#`, and malformed percent-encoding, and allow the sub-delimiters Core leaves literal (`: ; , = & @ + $ ! ' ( ) *`), spaces, unicode, and `%2F`.
- Replace `@IsValidFilePath()` with `@IsDialResourceId()` on `itemId` of the four share DTOs: `CreateShareLinkDto`, `DiscardSharedCatalogItemDto`, `RevokeSharedAccessDto`, `GetShareRecipientsDto`. The existing `@IsCatalogResourcePath()` prefix allowlist, `@Matches(NOT_A_SKILL_FILE_PATTERN)` and `@MaxLength(2048)` stay as they are.
- `IsValidFilePath` is left untouched; the files API, `folderPath` of publish/unpublish, skills and scheduled tasks keep using it.
- Update OpenAPI descriptions only if the DTO `@ApiProperty` text changes; regenerate with `npm run openapi` / `npm run openapi:check`.
- No frontend, lib or i18n change.

## Capabilities

### New Capabilities
- `dial-resource-id-validation`: contract of `IsDialResourceId` — which resource-id shapes the chat-api accepts as `itemId`, and which are rejected before any DIAL Core call.

### Modified Capabilities
- `share-revoke-access`: `RevokeSharedAccessDto` and `GetShareRecipientsDto` validate `itemId` with `IsDialResourceId` instead of `IsValidFilePath`.
- `catalog-unshare`: `DiscardSharedCatalogItemDto` validates `itemId` with `IsDialResourceId` instead of `IsValidFilePath`.
- `conversation-unshare-api`: a conversation id with `:` (and other Core-legal characters) is accepted; the invalid-shape scenario is rephrased around `IsDialResourceId`.

`conversation-share` (create-link requirement) is deliberately not modified: `CreateShareLinkDto`'s shape is unchanged and its `itemId` rules are specified once, in `dial-resource-id-validation`.

## Alternatives considered

| Option | Verdict |
| --- | --- |
| Relax the shared `IsValidFilePath` | Rejected: ~20 DTOs use it, including the files API where the value is a user-typed path; each would need its own audit. |
| Reuse `IsSafeResourceId` as-is | Rejected: `DEPLOYMENT_ID_PATTERN` (`deployment-id.pattern.ts:7`) rejects whitespace, `,` and `&`, which would break sharing prompts whose ids are decoded human-readable paths. |
| Percent-encode `itemId` on the frontend | Rejected: the id is Core's canonical form, the server already encodes at the SDK boundary (`encodeDialResourcePath`), and it would double-encode. |
| New share-only validator mirroring Core (chosen) | Smallest blast radius, keeps traversal/log-injection protection, follows the existing `IsSafeResourceId` pattern. |

Closest existing model: `apps/chat-api/src/common/validators/safe-resource-id.validator.ts` and its spec (`safe-resource-id.validator.spec.ts`).

## Non-goals

- The intermittent `502 DIAL Core returned a server error` on share: separate, root cause not yet established (no reproduction); diagnostic logging lives outside this change.
- Changing `IsValidFilePath`, `folderPath` validation, the files API, or `IsCatalogResourcePath`.
- Whether DIAL Core accepts a `%2F`-encoded segment in a conversation id (Quick App with `/` in its name); the validator will not reject it, any downstream Core refusal is a separate issue.

## Acceptance criteria

- `POST /api/v1/share` with the Bedrock conversation id above passes validation and reaches the service (verified by DTO, controller and service tests).
- The same id is accepted by `/share/discard`, `/share/revoke` and `GET /share/recipients`.
- Still rejected with `400` before any DIAL Core call: leading `/`, empty segment, `.`/`..` segments (also `%2e%2e`, `..%2F`), `\`, `{`, `}`, `"`, `?`, `#`, control characters, malformed `%`.
- Accepted: `..` inside a name (`Wait.. what`), prompt ids with spaces and commas, `%20`-encoded ids, unicode.
- `npm exec nx test chat-api`, `npm exec nx lint chat-api`, `npm run validate:specs` and `npm run openapi:check` pass.

## Impact

- Code: `apps/chat-api/src/common/validators/` (new validator + spec), `apps/chat-api/src/share/dto/{create-share-link,discard-shared-catalog-item,revoke-shared-access,share-recipients}.dto.ts` and their specs.
- API: no endpoint, DTO field or generated-client change; request validation is strictly broader for characters Core accepts, and equal or stricter-by-segment for traversal.
- Compatibility / rollback: not breaking; previously rejected ids become valid. Revert is the single-commit swap of the decorator back to `IsValidFilePath`.
- Security: validation is the BFF's first boundary; Core remains the second (it rejects its own invalid names), and `encodeDialResourcePath` still encodes before SDK calls. Control characters stay rejected (log-injection guard: `itemId` is logged).
- Libs: none touched. i18n: no new user-visible strings.
