## Why

Sharing a prompt nested inside a folder fails with HTTP 400 because the backend builds the DIAL Core resource path for prompts via raw string concatenation (`toPromptResourceUrl` in `apps/chat-api/src/prompts/utils/prompt-mapper.util.ts`) instead of routing it through the shared `encodeDialResourcePath` encoder that every other resource kind (conversations, files, toolsets, other prompt endpoints) already uses. A folder or prompt name containing spaces or other characters needing percent-encoding — e.g. `New folder 1/Prompt 1` — is sent to DIAL Core unencoded, and DIAL Core rejects it as an invalid resource link. Root-level prompts with simple alphanumeric names happen to pass through unencoded, which is why the bug was only surfaced by nested folders.

## What Changes

- Update `toPromptResourceUrl` (or its call site in `ShareService.createShareLink`, `apps/chat-api/src/share/share.service.ts`) to percent-encode each path segment of the prompt path via the existing shared `encodeDialResourcePath` utility (`apps/chat-api/src/common/utils/encode-dial-path.ts`) before building the DIAL Core resource URL, matching the pattern already used by conversations, files, toolsets, and other prompt services.
- Add a regression test in `apps/chat-api/src/share/tests/share.service.spec.ts` asserting `createShareLink` correctly percent-encodes a multi-segment prompt `itemId` (folder name with a space, nested prompt) before calling DIAL Core.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `prompts-share-api`: the prompt resource-path construction used by `POST /api/v1/share` must percent-encode each path segment (via `encodeDialResourcePath`) instead of concatenating the raw path, so prompts nested inside folders can be shared.

## Impact

- Affected code: `apps/chat-api/src/prompts/utils/prompt-mapper.util.ts` (`toPromptResourceUrl`), `apps/chat-api/src/share/share.service.ts` (`createShareLink`), `apps/chat-api/src/share/tests/share.service.spec.ts`.
- No DTO, API contract, or route changes — this is a bug fix to internal resource-path construction.
- No frontend changes required.
