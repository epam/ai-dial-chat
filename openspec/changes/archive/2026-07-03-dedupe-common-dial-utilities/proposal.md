## Why

Duplicated implementations of the same logic have drifted apart across `chat-api`, `chat-shared`, and `conversation-stages`: two DIAL error mappers with inconsistent logging, three near-identical DIAL path encoders, the same bucket-name regex copy-pasted across seven DTOs, and two divergent `MessageAttachment` → `DisplayAttachment` mappers (one of which silently drops audio support). Consolidating these into single, well-tested implementations removes the drift risk and the audio-attachment gap in `conversation-stages`, without changing any externally observable behavior.

## What Changes

- Merge `dial-error.ts` and `dial-fetch-error.ts` into one `apps/chat-api/src/common/dial/dial-error.mapper.ts` exporting `mapDialHttpStatus`, `handleDialSdkError` (replaces `handleDialError`), and `handleDialFetchError`; migrate all 15+ call sites; delete the old files.
- Extract a single `encodeDialResourcePath` helper at `apps/chat-api/src/common/utils/encode-dial-path.ts`, replacing the conversation/file/toolset-specific encoders and the inline duplicate in `conversation.service.ts`.
- Extract a shared `BUCKET_NAME_PATTERN` / `BUCKET_NAME_VALIDATION_MESSAGE` at `apps/chat-api/src/common/validators/bucket-name.pattern.ts`, replacing the inline `@Matches(/^[\w.-]+$/)` regex duplicated across 7 file DTOs.
- Add a canonical, pure `MessageAttachment` → `DisplayAttachment` mapper to `libs/chat-shared` that accepts optional resolver callbacks (`resolvePreviewUrl`, `resolvePlayUrl`) instead of importing app-specific URL-resolution logic; add a thin `apps/chat` adapter that supplies the app resolvers; migrate `conversation-stages` to consume the shared mapper (fixing its missing audio-attachment support) and delete its local duplicate.
- No new or removed REST endpoints; no OpenAPI/generated-client changes.

## Capabilities

This change does not alter any user-facing or client-facing behavior — the specs below exist to pin down the internal equivalence contract each consolidated utility must uphold, not to introduce new product capabilities.

### New Capabilities

- `dial-error-mapping`: the single DIAL HTTP-status-to-NestJS-exception mapping contract used by every `chat-api` domain service, covering both SDK-shaped and raw-fetch-shaped errors.
- `dial-resource-path-encoding`: the single DIAL resource-path percent-encoding contract used when building conversation, file, and toolset URLs.
- `attachment-display-mapping`: the single `MessageAttachment` → `DisplayAttachment` mapping contract shared by `apps/chat` and `libs/conversation-stages`.

### Modified Capabilities

None — no existing spec in `openspec/specs/` documents these implementation-level contracts today, so there is nothing to modify; the bucket-name-validator consolidation (workstream 1.3) has no observable contract beyond "same regex, same message" and is covered by design.md + tasks.md without a dedicated spec.

## Impact

- **Code**: `apps/chat-api/src/common/utils/dial-error.ts`, `dial-fetch-error.ts` (removed), new `apps/chat-api/src/common/dial/dial-error.mapper.ts`; `apps/chat-api/src/conversations/**`, `apps/chat-api/src/files/**`, `apps/chat-api/src/toolsets/**` (path encoding + bucket validation call sites); `libs/chat-shared/src/utils/message-attachment-to-display.ts` (new); `apps/chat/src/utils/attachment-dto-to-display.ts` (becomes a thin adapter); `libs/conversation-stages/src/utils/to-display-attachment.ts` (removed).
- **Tests**: consolidated/extended specs for the error mapper, new unit spec for the path encoder, unchanged DTO/controller tests, merged attachment-mapper spec covering the previously-missing audio case.
- **No impact** on REST response bodies, status codes, OpenAPI contracts, or the generated `@epam/chat-api-client`.
