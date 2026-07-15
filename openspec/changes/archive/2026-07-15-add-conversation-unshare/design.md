## Context

`POST /api/v1/share/discard` (`ShareController` / `ShareService.discardShared`, `apps/chat-api/src/share/`) already implements recipient-side discard for catalog Applications and Toolsets: it forwards `itemId` unmodified to DIAL Core's `discardSharedResources`, then invalidates the caller's `DeploymentsService`/`ToolsetsService` list caches. `DiscardSharedCatalogItemDto.itemId` is validated with `IsValidFilePath` plus an `@Matches` allowlist restricted to `applications/{bucket}/{path}` or `toolsets/{bucket}/{path}`.

Conversations already support the mirror operation (Share, `conversation-share` capability) by reusing the generic `POST /api/v1/share` endpoint with a `conversations/{bucket}/{path}` `itemId` — no conversation-specific endpoint exists. Conversations differ from catalog items in one structural way: **there is no server-side list cache for conversations** (`ConversationsContext.refreshConversations()` on the frontend re-fetches directly; there is no `ConversationsService.invalidateListCache` equivalent to `DeploymentsService`/`ToolsetsService`), so a discard has nothing analogous to invalidate server-side.

## Goals / Non-Goals

**Goals:**
- Let a recipient discard their own access to a conversation shared with them, using the same DIAL Core call already used for catalog items.
- Reuse the existing `POST /api/v1/share/discard` endpoint and its generated client method rather than introducing a new operation.
- Surface the action as a conversation-panel row menu item ("Delete") gated on `sharedWithMe === true`, with a confirmation step, mirroring the catalog Delete UX.

**Non-Goals:**
- Owner-side revoke-for-everyone (`revokeSharedResources`).
- Unshare for `publishedWithMe` (organization-published) conversations — these are not share-link grants and DIAL Core's discard call does not apply to them.
- Bulk/multi-select unshare.
- Unshare from inside an open chat's own header/menu (row menu only, v1).
- Any new server-side cache layer for conversations.

## Decisions

### Decision 1: Extend the existing discard endpoint, not a new one

Widen `DiscardSharedCatalogItemDto`'s `@Matches` pattern to also accept `conversations/{bucket}/{path}`, and update `@ApiOperation.description` accordingly. Reject the alternative (`POST /api/v1/share/discard-conversation` + `DiscardSharedConversationDto`).

**Why**: The endpoint already treats `itemId` as an opaque DIAL Core resource `url` with no branching logic — `ShareService.discardShared` has zero catalog-specific behavior; it doesn't reconstruct a bucket/path or type-switch. The same pattern was already applied to Share (`POST /api/v1/share` widened to accept conversations without a new endpoint — see `conversation-share` capability). A second endpoint would duplicate throttle config, DTO validation scaffolding, error mapping, and OpenAPI wiring for zero behavioral gain, and would fragment discard semantics across two operationIds that do the same DIAL Core call.

**Trade-off accepted**: the one asymmetry between catalog and conversation discard — cache invalidation — now lives inside a single method as a conditional no-op (see Decision 2) rather than being cleanly separated by endpoint. This is judged acceptable because the conditional is one `if` away from a shared helper, not a fork of the request/response contract.

### Decision 2: No server-side cache invalidation for conversations; rely on client-side `refreshConversations()`

`ShareService.discardShared` keeps invalidating `DeploymentsService`/`ToolsetsService` list caches unconditionally (harmless no-op cost for a conversation `itemId` — cache keys are per-user, not per-resource, so this invalidation is already indiscriminate and cheap). No new conversation list cache or invalidation call is added.

**Why**: Conversations have no equivalent server-side cache today (confirmed: no `ConversationsService.invalidateListCache`). Adding one purely to mirror the catalog pattern would be new caching infrastructure introduced for a single call site, with no existing read-path cache to keep coherent. `ConversationPanelView` already calls `refreshConversations()` after every other mutation (delete, rename, duplicate) with no server-side cache in between, so the existing consistency model is client-driven re-fetch, not cache invalidation.

**Alternative considered**: add a conversations list cache now for symmetry. Rejected — no other part of the conversations read path caches server-side yet; introducing one cache layer for a single discard call is scope creep relative to this proposal's goal.

### Decision 3: Frontend reuses `discardSharedCatalogItem(itemId)` unchanged

`apps/chat/src/server-api/share.api.ts`'s existing `discardSharedCatalogItem` wrapper is called with the conversation's context id (already in `conversations/{bucket}/{path}` form, same id shape `ShareConversationPopoverContainer` already passes to `useShareLink`/`getShareLink`). No new wrapper function is added; the name stays `discardSharedCatalogItem` since it maps 1:1 to the unchanged generated client operation — renaming it would only be a cosmetic mismatch between "catalog" in the name and its now-broader scope, not worth a churn-only rename.

### Decision 4: Menu action model mirrors the existing readonly-row branch in `getActions`

`ConversationPanelView.getActions` already branches on `isReadonlyItem` (`isReadonly || sharedWithMe || publishedWithMe`) to drop Rename/Share/Delete and return only Pin/Duplicate/Export for shared/published/readonly rows. Delete (unshare) is added as a fourth action **only** inside a narrower branch: `sharedWithMe === true` (regardless of `publishedWithMe`, since `sharedWithMe` and `publishedWithMe` are mutually exclusive flags on a given item per the existing `conversation-share`/history-panel model — same mutual-exclusivity precedent as `isMyApp`/`sharedWithMe` in `catalog-shared-with-me`). This keeps `publishedWithMe`-only rows (org-published, not share-link) with the current Pin/Duplicate/Export set and no Delete, matching the catalog precedent where public/organization items get neither Share nor Delete.

### Decision 5: Confirmation and post-action flow mirror the existing conversation Delete dialog, not the catalog `DetailsPanel` pattern

`ConversationPanelView` already owns a `pendingDeleteId`/`isDeleting`/`deleteError` triplet and a `DialConfirmationPopup` for the real (owner) delete. The unshare flow adds a parallel `pendingUnshareId`/`isUnsharing`/`unshareError` triplet and a second `DialConfirmationPopup` instance with unshare-specific copy, following the same component's own established local-state idiom rather than importing `libs/catalog`'s `DetailsPanel` pattern (a different component tree, panel-close-on-success semantics don't apply here — there's no details panel to close, only a list row to remove via refresh).

**Why not share one `DialConfirmationPopup` instance for both delete and unshare**: the two actions have different confirm-button semantics (destructive delete vs. discard-access) and can, in principle, be triggered from different rows without one dismissing the other's pending id; keeping them as separate state mirrors how Rename/Publish/Share already each have their own popup/panel state in this file.

### Decision 6: Active-conversation navigation reuses the same `panelActiveConversationId` match already used by delete

`handleConfirmUnshare` checks `conversationIdsMatch(idToUnshare, panelActiveConversationId)` exactly like `handleConfirmDelete`, and calls `navigate(ROUTES.Root)` on a match. No new id-matching logic is introduced.

### Decision 7: Refresh-failure-after-success treated as success (mirrors `CatalogView.handleUnshare`)

If `discardSharedCatalogItem` resolves but the subsequent `refreshConversations()` rejects, the flow still shows the success notification and (if applicable) navigates away — it does not surface a mutation error or invite the user to retry an already-completed discard. This matches the existing `CatalogView.handleUnshare` requirement precedent exactly.

## Risks / Trade-offs

- **[Risk]** Widening the shared `DiscardSharedCatalogItemDto` regex could, in principle, be missed by someone reasoning about "catalog" DTOs as catalog-only. → Mitigation: rename considerations were weighed (Decision 3) and rejected as premature churn; the DTO's `@ApiProperty.description` and the modified `catalog-unshare` spec requirement both explicitly document conversations as a valid `itemId` prefix going forward.
- **[Risk]** No server-side cache invalidation for conversations means a stale list could theoretically be served if some future cache is added to the conversations read path without updating this call site. → Mitigation: called out explicitly in Decision 2 and in the `conversation-unshare-api` spec so a future conversations-cache change has to grep for `discardShared` callers.
- **[Risk]** DIAL Core may reject a conversation `itemId` shared via `publishedWithMe` (org publish) differently than a genuine share-link grant if a user somehow reaches the Delete action for such a row. → Mitigation: menu visibility (Decision 4) never renders Delete for `publishedWithMe` rows, so this path is unreachable from the UI; DIAL Core's own 403 (not-shared-with-caller) is the defense-in-depth backstop already specified in `catalog-unshare`.

## Migration Plan

No data migration. Deployment is a single coordinated backend+frontend release: widen the DTO validator, regenerate `libs/chat-api-client`, ship the `ConversationPanelView` change. Rollback is a straight revert — no persisted state format changes.

## Open Questions

None outstanding; the endpoint-extension vs. new-endpoint question raised in the task prompt is resolved by Decision 1.
