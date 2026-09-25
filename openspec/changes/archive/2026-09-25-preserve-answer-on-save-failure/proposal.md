## Why

An answer can disappear after streaming: the backend logs a failed terminal save but completes the stream, and the frontend replaces visible text/stages with the persisted empty placeholder. Previous diagnostic tests reproduced both halves; this change adds permanent regression coverage through real HTTP and the installed DIAL SDK.

## What Changes

- Signal terminal persistence failures to the originating completion stream and generation-attach subscribers using the existing error envelopes.
- Preserve accumulated assistant payload and show an explicit, localized unsaved-answer warning on failure or a terminal reload that still returns the same empty placeholder.
- Cover normal completion, stop/provider error, resumed generation, successful saves, and stale callbacks/navigation.
- Keep the existing single terminal-write ownership contract; do not retry ambiguous writes automatically.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `backend-owned-generation-persistence`: failed terminal writes must be reported, and terminal reloads must not erase received answers.
- `generation-live-replay`: persistence-error terminal events preserve the attached client's assembled answer.

## Impact

Backend streaming/registry, the headless `chat-hooks` streaming transport and hook, app-provided translations, and their docs/tests. Follow `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts:595` and `libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts:342`. No new context, dependency, REST endpoint, storage schema, Docker setting, or feature flag. Library isolation remains intact: transport capabilities and translated strings arrive from the app; auth, SDK construction, and storage writes stay at the app edge.

## Problem and solution

The stream's successful model outcome is currently mistaken for successful persistence. Report these independently and retain the live payload when persistence is uncertain. A stale token is a plausible trigger because the same token is reused for the final write; an HTTP integration test will also exercise an explicit storage-service failure. Neither simulation establishes what happened in the user's deployment.

## Non-goals

Automatic write retries, refreshing credentials inside an open SSE request, durable recovery after page reload/process loss, and fencing unrelated conversation writers. These need separate ownership/auth/storage designs. No changes to document preview or Dockerfile are indicated by the evidence.

## Acceptance criteria

1. A local HTTP DIAL stand-in accepts the start save, streams text/stages, rejects the terminal SDK write with 401/503, and the real backend emits a persistence error while storage retains the placeholder.
2. Originating and attached clients keep all received payload and display an unsaved-answer warning; successful reloads still use server-persisted enrichment.
3. A legacy/ambiguous terminal reload of the same empty placeholder cannot erase a received answer; stale generations cannot restore over a newer one.
4. Focused regression tests, affected verification, full verification, docs validation, and OpenSpec validation are recorded.

## Alternatives and compatibility

Frontend-only preservation hides the storage failure; retry-only recovery still loses answers on permanent failures and can overwrite concurrent writes. Choose explicit error reporting plus client preservation. Existing error envelopes remain compatible and the new hook message parameter is optional. Revert this change to roll back; no data migration is needed.
