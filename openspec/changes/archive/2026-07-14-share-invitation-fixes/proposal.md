## Why

Accepting a share invitation was unreliable in several ways: `GET /api/v1/share/invitations/:id?accept=true` sometimes returned 502 because DIAL Core returns an **empty body** for the accepting call (its OpenAPI schema claims a full `Invitation` payload, but the real response has no content once `accept=true` performs the side effect). Even when acceptance succeeded, the catalog's details panel would silently fail to open for the newly shared item because the deployments/toolsets lists are cached server-side for 30s and can also be clobbered client-side by a slower, stale initial-load response racing an explicit post-accept refetch. Finally, users granted WRITE access to a shared application or toolset had no way to edit it, because `isEditable` only ever checked ownership (`isMy`), never a share grant.

## What Changes

- `ShareService.acceptInvitation` now performs a **peek** call (no `accept` query param) to read the invitation's shared `itemId` from DIAL Core, then a separate **accept** call (`accept=true`) to actually grant access — the accept call's response body is no longer relied on.
- After a successful accept, `ShareService` invalidates the accepting user's cached deployments list (`DeploymentsService.invalidateListCache`) and toolsets list (`ToolsetsService.invalidateListCache`) so the next list fetch reflects the newly shared resource instead of a stale cached snapshot.
- `DeploymentsService.listDeployments` and `ToolsetsService.listToolsets`/`getToolset` now resolve WRITE-permission shared resources via DIAL Core's `getSharedResources` and expose it as `canEdit` (`DeploymentItemDto`) / `can_edit` (`DialToolsetDto`) alongside the existing `isMy` field.
- `apps/chat/src/utils/map-deployment-to-catalog-item.ts` computes `CatalogItem.isEditable` from `isMy OR canEdit` instead of `isMy` alone, so shared-with-write-access applications and toolsets show the Edit action.
- `SharedInvitationPage` calls `refetchDeployments()`/`refetchToolsets()` (awaited) before navigating to the target route, so the catalog/toolsets lists are refreshed ahead of the details-panel-open attempt.
- `DeploymentsContext`'s `refetchDeployments`/`refetchToolsets` (and the initial `loadDeployments` load) now guard against out-of-order responses with a per-resource monotonic request id, so a slower stale response (e.g. the initial mount-time load) can never overwrite a fresher explicit refetch.
- Added debug-level logging in `ShareService`/`mapDialHttpStatus` (request payload, DIAL Core response body/status) to make future accept-invitation failures diagnosable without re-instrumenting.

## Capabilities

### New Capabilities

- `share-invitation-permissions`: Resolving and exposing WRITE-permission share grants (`canEdit`/`can_edit`) for applications and toolsets, driving the catalog's Edit-action visibility for shared-with-write-access resources.

### Modified Capabilities

- `conversation-share`: `ShareService.acceptInvitation` changes from a single accepting call to a peek-then-accept two-step flow, and now invalidates the user's deployments/toolsets list caches on success.
- `deployments-context`: `refetchDeployments`/`refetchToolsets` (and the initial load) gain request-id guards against stale-response races; `SharedInvitationPage` awaits both refetches before navigating.

## Impact

- Backend: `apps/chat-api/src/share/share.service.ts`, `share.module.ts`, `share.controller.ts`; `apps/chat-api/src/deployments/deployments.service.ts`, `deployment-item.dto.ts`, `deployments.module.ts`; `apps/chat-api/src/toolsets/toolsets.service.ts`; `apps/chat-api/src/openapi/openapi-response.dto.ts`; `apps/chat-api/src/common/dial/dial-error.mapper.ts`.
- Generated client: `libs/chat-api-client` (regenerated via `npm run openapi` for the new `canEdit`/`can_edit` fields).
- Frontend: `apps/chat/src/pages/SharedInvitation/SharedInvitation.tsx`, `apps/chat/src/context/DeploymentsContext.tsx`, `apps/chat/src/utils/map-deployment-to-catalog-item.ts`.
- No new external dependencies. No breaking API changes — `canEdit`/`can_edit` are additive optional response fields.
