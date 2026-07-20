## Why

Navigating to a shared-deployment invitation link fails to open the deployment's details panel (GitHub #7860). Manual verification against a running instance showed two distinct bugs stacked on top of each other:

1. **Stale in-tab guard (fixed).** `CatalogView` never cleared the `itemId` query param after consuming it, so once a deployment's details had been opened in a tab, `initialDetailsItemId` kept resolving to the same id on every render; `Catalog.tsx`'s `appliedInitialDetailsItemIdRef` guard then permanently remembered that id was already applied and silently refused to reopen it. This only mattered for same-route client-side re-navigation without a full reload.
2. **Eventual-consistency race on the deployments/toolsets list (this update).** The actual GitHub #7860 repro is a *full page navigation* to a shared link — confirmed with the reporter: `itemId` does appear in the post-accept redirect URL, but `Catalog`'s `initialDetailsItemId` effect still can't find the item, because `GET /api/v1/deployments` / `GET /api/v1/toolsets`, even right after `SharedInvitationPage`'s `refetchDeployments()`/`refetchToolsets()`, do not yet include the newly-shared resource. Accepting an invitation and DIAL Core's bulk listing reflecting that grant are not atomic, so the frontend's blind "refetch the whole list, then navigate" approach races the upstream grant.

The legacy pre-rewrite app (`origin/development`, `apps/chat/src/store/share/share.epics.ts`) never had this race: its `acceptInvitationEpic`/`acceptInvitationSuccessEpic` resolved the shared application **by id directly** (`ApplicationActions.get`/`ApplicationService.getDialEntity`) instead of depending on a bulk list refresh to include it. This proposal ports that same principle into the current architecture: have the backend resolve and return the shared item's summary as part of the accept-invitation response, so the frontend can inject it directly into its local deployments/toolsets state without waiting on (or racing) a bulk list refetch.

## What Changes

- (Done) `CatalogView` clears the `itemId` search param immediately after reading it; `Catalog.tsx`'s applied-id guard resets whenever the prop goes falsy. See "Stale in-tab guard" above.
- `ShareService.acceptInvitation` (`apps/chat-api/src/share/share.service.ts`) resolves the shared resource's type and summary by id — reusing the same prefix-based dispatch (`toolsets/`, `applications/`, else `getModel` → `getApplication` → `getToolset`) already used by `DeploymentsService.getDeploymentDetails` — and includes that summary in its response.
- `AcceptInvitationResponseDto` (`apps/chat-api/src/share/dto/accept-invitation-response.dto.ts`) gains an optional `sharedDeployment?: DeploymentItemDto` field (models/applications) or `sharedToolset?: DialToolsetDto` field (toolsets), populated from the same resolution. **BREAKING** in the additive sense only (new optional response fields) — no existing field changes.
- `DeploymentsContext` (`apps/chat/src/context/DeploymentsContext.tsx`) gains a `mergeSharedItem` method that synchronously upserts a single `DeploymentItemDto`/`DialToolsetDto` into local `rawDeployments`/`toolsets` state, independent of any network round-trip.
- `SharedInvitationPage` (`apps/chat/src/pages/SharedInvitation/SharedInvitation.tsx`) calls `mergeSharedItem` with the item returned by `acceptInvitation` before navigating, so `items`/`toolsets` are guaranteed to contain the shared resource at the moment `CatalogView` mounts — the existing `refetchDeployments()`/`refetchToolsets()` calls stay as a consistency backstop but are no longer load-bearing for the details panel to open.
- OpenAPI contract changes require `npm run openapi`, `npm run openapi:check`, and a `chat-api-client` rebuild.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `conversation-share`: the "Accepting an invitation opens the shared item's details panel" behavior no longer depends on a bulk deployments/toolsets list refetch reflecting the newly-granted resource before navigating; the accept-invitation response itself carries the resolved item, which the frontend merges into local state directly.

## Impact

- `apps/chat/src/components/CatalogView/CatalogView.tsx` — clear the `itemId` param after reading it (done).
- `libs/catalog/src/components/Catalog/Catalog.tsx` — reset the applied-id guard on a falsy `initialDetailsItemId` (done).
- `apps/chat-api/src/share/share.service.ts`, `apps/chat-api/src/share/dto/accept-invitation-response.dto.ts` — resolve and return the shared item summary.
- `apps/chat-api/src/deployments/deployments.service.ts` — expose the existing single-id resolve/prefix-dispatch logic for reuse by `ShareService` (extract, don't duplicate).
- `apps/chat/src/context/DeploymentsContext.tsx` — new `mergeSharedItem` method.
- `apps/chat/src/pages/SharedInvitation/SharedInvitation.tsx` — use the returned item instead of relying solely on blind refetch.
- Generated OpenAPI spec/`chat-api-client` — new optional response fields.
- No database changes. No migration needed beyond the OpenAPI regeneration workflow.
