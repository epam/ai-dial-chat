## Why

Users can already publish user-owned Applications, Toolsets, and Models to an Organization folder from the catalog, and conversations already support view-only Share links and read-only consumption of org-published content (`publishedWithMe`). There is no way to publish a conversation itself to the Organization so other users can discover and reuse it — closing this gap extends the existing publish mechanics to the one owned-resource type that still lacks it.

## What Changes

- Add a **Publish** action to the conversation row "..." menu (`ConversationPanelView.getActions`), visible only for owned, writable conversations (same gate as Share: excludes `isReadonly`, `sharedWithMe`, `publishedWithMe`).
- Add a new **standalone right-side slide-in panel** for conversation publish, reusing the catalog `DetailsPanel` shell dimensions/animation but with a **Close (X)** header (no Back button, no details view underneath) since there is no catalog details screen to return to.
- Add a **`POST /api/v1/conversations/{path}/publish`** and **`GET /api/v1/conversations/{path}/publish-history`** backend endpoint pair (dedicated conversation endpoints, not an extension of the catalog publish controller — see design.md for the trade-off against extending `entityType`).
- Generalize the catalog publish lib building blocks (`PublishPanel`, `PublishFooter`, `derivePublishState`) so they can render a conversation (title-only, no version) instead of a `CatalogItem` with a version pill, without duplicating the folder-tree/history-list/callout logic.
- Add `PublishConversationPanelContainer` (app-level), following the `ShareConversationPopoverContainer` container pattern, wiring the new backend endpoints, `useCatalogPublishFolders` (or a renamed/shared folder-loading hook), and i18n.
- On successful publish: close panel, show a success notification, refresh the conversation list so the org-published copy appears under the Organization tab.
- **BREAKING**: none. This is additive; no existing endpoint or component contract changes.

## Capabilities

### New Capabilities

- `conversation-publish-flow`: entry point (row menu action + visibility gate), standalone publish panel (header with Close not Back, folder picker, history, footer), post-publish notification and list refresh, RTL/a11y.
- `conversation-publish-api`: `POST /api/v1/conversations/{path}/publish` and `GET /api/v1/conversations/{path}/publish-history`, DTOs, Core `createPublication`/`getPublications` mapping for the `conversations/...` resource type, error codes.

### Modified Capabilities

- `catalog-publish-flow`: `PublishPanel`'s entity-summary section and `PublishFooter`'s submit-label logic are generalized to accept a resource summary that is either a versioned catalog item or a title-only conversation, with no behavior change for existing catalog callers.

## Impact

- **Frontend**: `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`, new `apps/chat/src/components/PublishConversationPanelContainer/`, `apps/chat/src/hooks/catalog/useCatalogPublishFolders.ts` (reused), `apps/chat/src/server-api/` (new `conversation-publish.api.ts` or extension of `publish.api.ts`), `apps/chat/src/constants/translation-keys.ts` + all locale JSON files.
- **Libs**: `libs/catalog/src/components/PublishPanel/`, `libs/catalog/src/components/PublishPanel/PublishFooter.tsx`, `libs/catalog/src/utils/use-publish-flow.ts`, `libs/catalog/src/utils/publish-state.ts`, `libs/catalog/src/models/publish.ts` (widened to a generic resource-summary shape); possibly a new panel-shell component shared between catalog `DetailsPanel`'s publish sub-view and the new standalone conversation panel.
- **Backend**: new `apps/chat-api/src/conversations/` publish sub-routes (or a new domain folder), `DialClientService.client.createPublication`/`getPublications` calls scoped to `conversations/{bucket}/{path}` resource URLs, OpenAPI regeneration, `apps/chat/src/server-api` wrappers.
- **Dependencies**: none new; reuses `@epam/ai-dial-typescript-sdk` Publication API already used by `apps/chat-api/src/publish/publish.service.ts`.
