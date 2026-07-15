## Why

Conversations already support Share (`POST /api/v1/share`) and expose `sharedWithMe`/`publishedWithMe` on list items, but a shared-with-me conversation can never be removed from the recipient's own list — the row menu only offers Pin, Duplicate, and Export. Catalog Applications and Toolsets already closed this exact gap via recipient-side discard (`catalog-unshare`); conversations were explicitly scoped out of that change. This proposal closes the gap for conversations using the same discard mechanism.

## What Changes

- Widen `POST /api/v1/share/discard`'s `itemId` validation to also accept `conversations/{bucket}/{path}` (currently only `applications/...` / `toolsets/...`).
- Add a **Delete** action to the conversation row "..." menu, visible only for `sharedWithMe === true` rows (not for owned rows, not for `publishedWithMe` rows), replacing Share/Rename/Delete for those rows (mirroring the existing readonly-row action set, which already drops Rename/Share/Delete for shared/published/readonly items).
- The action opens a `DialConfirmationPopup` before calling discard; on confirm it calls the discard endpoint, refreshes the conversation list, shows a success/error notification, and navigates to `ROUTES.Root` if the discarded conversation was the currently open one.
- Add new conversation-scoped i18n keys for the confirmation copy and notifications; reuse `ButtonsI18nKeys.Cancel`.

## Capabilities

### New Capabilities

- `conversation-unshare-flow`: recipient-side discard ("Delete") UX for a shared-with-me conversation from the conversation panel — menu visibility, confirmation flow, notifications, active-conversation navigation, i18n, RTL/a11y.
- `conversation-unshare-api`: the widened `POST /api/v1/share/discard` validation that accepts `conversations/{bucket}/{path}` itemIds, error mapping, and (absence of) cache invalidation for conversations.

### Modified Capabilities

- `catalog-unshare`: `DiscardSharedCatalogItemDto.itemId`'s validation pattern is widened from `applications|toolsets` to also allow `conversations`; the endpoint's `@ApiOperation` description changes from "catalog item" to "catalog entity or conversation". No behavior changes for existing catalog-unshare scenarios.

## Impact

- Backend: `apps/chat-api/src/share/dto/discard-shared-catalog-item.dto.ts` (regex), `apps/chat-api/src/share/share.controller.ts` (Swagger description), `apps/chat-api/src/share/share.service.ts` (no logic change — `itemId` already passed through unmodified; conversations have no server-side list cache to invalidate, unlike deployments/toolsets).
- OpenAPI/client: regenerate `libs/chat-api-client`; no new operation, existing `discardSharedCatalogItem` now documented as conversation-capable.
- Frontend: `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx` (menu action, confirmation popup, handler), `apps/chat/src/constants/translation-keys.ts` + all locale JSON files (new keys), no changes to `libs/conversation-panel` (host-supplied `getActions`) or `apps/chat/src/server-api/share.api.ts` (existing `discardSharedCatalogItem` wrapper reused unchanged).
- Out of scope: owner-side revoke-for-everyone, unshare of published-with-me (Organization tab) conversations, bulk/multi-select unshare, unshare from an open chat's own header menu, feature flags.
