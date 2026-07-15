## Why

A user who accepts a catalog share invitation currently has no way to remove that shared item from their own catalog. `libs/catalog`'s `ShareButton` (`libs/catalog/src/components/Details/Header/ShareButton/ShareButton.tsx:16-18`) only renders for the owner (`item.isMyApp === true`); a recipient sees no action at all on a shared item's details header, and the only path back to a "clean" catalog is asking the owner to revoke access for everyone. `CatalogItem` (`libs/catalog/src/models/catalog-item.ts`) has no `sharedWithMe` concept at all — the legacy `origin/development` Redux implementation had this field on its entity model and a Unshare context-menu action (`apps/chat/src/hooks/useAgentMenuItems.ts:188-197`, legacy), but neither the field nor the action was ported when the BFF/generated-client/React-Context architecture replaced Redux. DIAL Core already exposes exactly the operation needed for this — `discardSharedResources` — and the current branch already has one working reference implementation of it for File Manager (`apps/chat-api/src/files/files.service.ts:975-1009`), so the backend pattern is proven; it just hasn't been extended to the catalog domain.

## What Changes

- Add an explicit `sharedWithMe: boolean` field to `DeploymentItemDto` and `DialToolsetDto`, computed server-side from an **unfiltered** DIAL Core `getSharedResources({ with: 'me' })` lookup (today's `getWritableApplicationUrls`/`getWritableToolsetUrls` in `deployments.service.ts:300-327`/`toolsets.service.ts:233-257` only capture the `WRITE`-permission subset used for `canEdit`; `sharedWithMe` needs the full READ+WRITE set). Map it through to `CatalogItem.sharedWithMe` in `map-deployment-to-catalog-item.ts`.
- Add a new versioned BFF endpoint `POST /api/v1/share/discard` on the existing `ShareController`/`ShareService` (`apps/chat-api/src/share/`), calling SDK `discardSharedResources({ resources: [{ url: itemId }] })`, modeled on the file-manager `discard-shared` route (`apps/chat-api/src/files/files.controller.ts:562-586`) but with a simpler `{ itemId: string }` DTO since catalog resource ids are already full DIAL Core URLs. On success, invalidate `DeploymentsService.invalidateListCache(userSub)` and `ToolsetsService.invalidateListCache(userSub)`, mirroring `acceptInvitation`'s existing invalidation call (`share.service.ts:241-244`).
- Regenerate `libs/chat-api-client` from the updated OpenAPI spec and add a thin `discardSharedCatalogItem(itemId)` wrapper to `apps/chat/src/server-api/share.api.ts`.
- Extend the host-agnostic `ShareButton` action slot with a recipient-side Delete presentation, mutually exclusive with Share (gated on `item.sharedWithMe` instead of `item.isMyApp`), using the existing `DialConfirmationPopup` for confirmation and a direction-neutral Tabler trash icon. Internally the callback remains `onUnshare` because the operation still discards the recipient's share.
- Wire a `handleUnshare` in `apps/chat/src/components/CatalogView/CatalogView.tsx`, mirroring the existing `handleDelete` mutate → refetch → notify shape (`CatalogView.tsx:480-505`), calling the new API wrapper then `refetchDeployments()`/`refetchToolsets()` (`useDeployments()`), clearing `selectedItemId` via the existing `DeploymentsContext` fallback policy if the unshared item was selected, and closing the details panel on success.
- Add `catalog.details.unshare.*` translation keys (title, description with `{{name}}` interpolation, confirm/cancel labels) to `apps/chat/src/i18n/locales/en.json` and `translation-keys.ts`; their user-facing copy presents the operation as Delete while retaining the technical unshare namespace.

**Non-goals** (explicitly out of scope): owner-side `revokeSharedResources` ("remove access for everyone"); conversations, File Manager resources, catalog cards/context menus, bulk unshare; Guardrail/MCP catalog entities; any change to share-link creation or invitation acceptance; any new feature flag.

## Capabilities

### New Capabilities

- `catalog-shared-with-me`: server-side `sharedWithMe` enrichment on deployments/toolsets list responses, derived from DIAL Core's unfiltered `getSharedResources({ with: 'me' })`, mapped through to `CatalogItem.sharedWithMe`.
- `catalog-unshare`: the recipient-side discard flow end-to-end — BFF `POST /api/v1/share/discard` endpoint and cache invalidation, generated-client and frontend wrapper, the host-agnostic recipient-side Delete/confirmation UX in `libs/catalog`, and the `CatalogView`/`DeploymentsContext` integration that refetches lists and clears a stale selection after a successful unshare.

### Modified Capabilities

(none — `sharedWithMe` and the discard endpoint are additive; no existing spec requirement changes behavior)

## Impact

- **Backend**: `apps/chat-api/src/share/` (controller, service, new `dto/discard-shared.dto.ts`), `apps/chat-api/src/deployments/deployments.service.ts`, `apps/chat-api/src/toolsets/toolsets.service.ts` (new unfiltered shared-resources helper, reused by both the existing `canEdit` computation and the new `sharedWithMe` computation), OpenAPI spec + `libs/chat-api-client` regeneration.
- **Frontend**: `apps/chat/src/server-api/share.api.ts`, `apps/chat/src/utils/map-deployment-to-catalog-item.ts`, `apps/chat/src/components/CatalogView/CatalogView.tsx`, `apps/chat/src/context/DeploymentsContext.tsx` (consumption only, no API surface change), `apps/chat/src/i18n/locales/en.json`, `apps/chat/src/constants/translation-keys.ts`.
- **Library**: `libs/catalog/src/models/catalog-item.ts` (+`sharedWithMe`), `libs/catalog/src/models/catalog-props.ts`/`item-details-props.ts` (+`onUnshare` props), the existing `ShareButton` action slot, and `Header.tsx` wiring.
- **No feature flag**: visibility is fully determined by the new `sharedWithMe` boolean; existing sharing visibility rules (who can see a shared item at all) are unchanged and sufficient.
