## Context

`GET /api/v1/conversations/list` currently accepts an optional `path` query parameter intended to scope results to a DIAL Core subfolder. It was never correctly implemented end-to-end (issue #7927): after a partial fix (#8016) the user-bucket and public-bucket calls are correctly scoped, but `getSharedResources` (the shared-with-me source) ignores `path` entirely, so scoped requests still return all shared items regardless of folder. No frontend caller passes `path` — `apps/chat/src/server-api/conversations.api.ts` forwards it, but every call site (`ConversationsContext.tsx`, `useConversationExport.ts`) omits it. This change removes the parameter rather than fixing the shared-resources gap, since the feature has no consumer.

## Goals / Non-Goals

**Goals:**
- Remove the `path` query parameter and all associated normalization, encoding, and 404-tolerance logic from the backend.
- Remove `path` from the frontend wrapper and the generated API client.
- Remove all `path`-scoping requirements/scenarios from specs, and delete the now-empty `conversation-list-path-filter` spec.

**Non-Goals:**
- Introducing a different/working folder-scoping mechanism. If subfolder scoping is needed later, it should be re-proposed as a new change with the shared-resources gap fixed from the start.
- Any change to `limit`/`nextToken` pagination behavior, ownership-flag logic, or the three-way merge/sort behavior beyond removing `path`.

## Decisions

- **Remove `path` outright rather than fix shared-resources filtering.** Fixing it would require passing a folder prefix into `getSharedResources` (a DIAL Core sharing API call, not a metadata call) and filtering its results client-side by resource path — added complexity for a parameter with zero current callers. Removing it deletes the `isEmptyScopedFolder` 404-tolerance branch as a side effect, simplifying the resilience logic back to the pre-path-filter behavior (bucket-root 404 is always fatal).
- **Full removal, not deprecation.** Since this is pre-1.0 internal API surface with no external/frontend consumer, there is no need for a deprecation window; the parameter is deleted from the DTO, service, spec, and generated client in one change.

## Risks / Trade-offs

- **BREAKING for any out-of-repo caller passing `path` today.** → Mitigated: issue #7927 confirms the parameter is currently non-functional for shared-with-me items, so no caller can be correctly relying on it; the OpenAPI contract change is intentional and versioned via `npm run openapi`.
- **Test removal reduces coverage of the 404-tolerance branch.** → That branch only existed to support scoped-path semantics; once `path` is gone the branch is dead code, so the corresponding tests are correctly removed, not just skipped.

## Migration Plan

1. Update DTO, controller, and service to drop `path` (backend slice).
2. Update/remove backend tests referencing `path`.
3. Run `npm run openapi && npm run openapi:check` to regenerate `libs/chat-api-client` without `path`.
4. Update `apps/chat/src/server-api/conversations.api.ts` to drop `path` from its param type.
5. Update the `conversations-api` spec (remove `path`-related requirement text/scenarios) and delete `conversation-list-path-filter/spec.md`.

No data migration or rollout sequencing is needed — this is a pure API-surface reduction with no persisted state.

## Open Questions

None.
