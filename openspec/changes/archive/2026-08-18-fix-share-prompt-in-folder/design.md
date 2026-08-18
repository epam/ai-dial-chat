## Context

`POST /api/v1/share` builds a DIAL Core resource link for prompts by calling `toPromptResourceUrl(itemId, bucket)` in `apps/chat-api/src/prompts/utils/prompt-mapper.util.ts`, which concatenates the raw path with no percent-encoding: `` `${PROMPT_RESOURCE_PREFIX}/${bucket}/${promptPath}` ``. Every other DIAL Core path builder in the codebase (conversations, files, toolsets, and the other prompt CRUD services) routes through the shared `encodeDialResourcePath` helper (`apps/chat-api/src/common/utils/encode-dial-path.ts`), which splits the path on `/`, safely decodes and re-encodes each segment with `encodeURIComponent`, then rejoins with `/`. `toPromptResourceUrl` is the one path builder that skips this, so any prompt path with a segment requiring encoding (spaces, folder names) reaches DIAL Core unencoded and is rejected with 400.

## Goals / Non-Goals

**Goals:**
- Make prompt sharing produce a correctly percent-encoded DIAL Core resource path for prompts at any folder depth, consistent with how conversations/files/toolsets already build their paths.
- Add regression coverage so this can't silently regress.

**Non-Goals:**
- No change to the `POST /api/v1/share` request/response contract, DTOs, or route.
- No change to how conversations, files, toolsets, or other prompt endpoints build their resource paths — they already use `encodeDialResourcePath` correctly.
- No frontend changes — the frontend already sends the human-readable `itemId`; encoding is a backend concern.

## Decisions

**Fix at `toPromptResourceUrl`, not at the `ShareService` call site.** `toPromptResourceUrl(promptPath, bucket)` becomes:
```ts
export const toPromptResourceUrl = (
  promptPath: string,
  bucket: string,
): string =>
  `${PROMPT_RESOURCE_PREFIX}/${bucket}/${encodeDialResourcePath(promptPath)}`;
```
Alternative considered: encode `itemId` inside `ShareService.createShareLink` before calling `toPromptResourceUrl`. Rejected — `toPromptResourceUrl` is also used elsewhere for building prompt resource URLs (other prompt services already call `encodeDialResourcePath` themselves before other DIAL Core calls), so fixing it at the source keeps every caller correct instead of requiring each call site to remember to encode first.

**Reuse the existing `encodeDialResourcePath` utility rather than writing prompt-specific encoding.** It already implements the exact segment-by-segment decode/re-encode semantics DIAL Core expects, and is the established single-encoder convention (`dial-resource-path-encoding` capability). No new utility is introduced.

## Risks / Trade-offs

- [Risk] A prompt path segment that was already relying on being sent unencoded (unlikely, since DIAL Core expects encoded segments) could behave differently. → Mitigation: `encodeDialResourcePath` safely decodes before re-encoding, so already-encoded or plain segments produce the same DIAL Core–compatible result other resource kinds already rely on.
- [Risk] Regression test only covers `ShareService`; a future new prompt-path builder could reintroduce raw concatenation. → Mitigation: `toPromptResourceUrl` is the single shared builder used by share and other prompt flows, so fixing it in one place covers all current callers.

## Migration Plan

Single backend code change plus a test; no data migration, no rollout sequencing, no feature flag. Deploy as a normal fix; rollback is a plain revert if needed.
