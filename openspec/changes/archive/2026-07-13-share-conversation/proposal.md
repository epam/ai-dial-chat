## Why

Users can already open a conversation someone else shared with them (the backend resolves third-party-bucket paths, and the panel has "Shared"/"Organization" filter tabs), but there is no way to *create* a share link for a conversation in the first place. Deployments/catalog items already have a "Share" control (link + QR, per-type access) shipped in #7710/#7724; conversations in the side panel only expose pin, duplicate, rename, and delete. This proposal extends the conversation action menu with a "Share" action and reuses the existing share popover pattern so users can share a conversation the same way they share a deployment.

## What Changes

- Add a **Share** item to the conversation "..." action menu in the side panel (`ConversationPanelView.getActions`), available for owned, non-readonly conversations.
- Add a conversation-specific share container/hook that reuses the existing `SharePopover` (link/QR view) and `POST /api/v1/share` + `GET /share/invitations/:id` endpoints, passing the conversation's resource path as `itemId`.
- Restrict conversation sharing to view-only access (no Edit level) — conversations are shared to be viewed/duplicated, not co-edited, so the popover renders without the access-level control for this entity type.
- Generalize the backend `share` endpoint's documentation/description from "catalog entity" to "DIAL Core resource (catalog entity or conversation)"; no DTO or route contract changes are required since `CreateShareLinkDto` already takes a generic `itemId` + `access`.
- Add i18n strings for the new "Share" menu action and any conversation-share-specific popover copy.

## Capabilities

### New Capabilities

- `conversation-share`: Sharing a conversation from the panel action menu — trigger, access-level policy (view-only), and wiring to the existing share-link creation flow.

### Modified Capabilities

- `conversation-history-panel`: The "Panel rows expose per-item actions" requirement gains a "Share" entry alongside pin/duplicate/rename/delete, with its own visibility rule (owned, non-readonly conversations only).

## Impact

- **Frontend components**: `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx` (`getActions`), new `apps/chat/src/components/ShareConversationPopoverContainer/` (mirrors `SharePopoverContainer`), reused `libs/share` components (`SharePopover`, `AccessControl`, `LinkView`, `QrCode`).
- **Frontend hooks/utils**: reuse or generalize `apps/chat/src/hooks/useShareLink/useShareLink.ts` and `apps/chat/src/utils/share-link.ts` to accept a conversation resource path instead of only a `CatalogItem`.
- **Backend**: `apps/chat-api/src/share/share.controller.ts` and `share.service.ts` — doc/description update only; `CreateShareLinkDto` (`apps/chat-api/src/share/dto/create-share-link.dto.ts`) is unchanged.
- **i18n**: `apps/chat/src/i18n/locales/en.json` — new keys for the "Share" action and popover copy (all other locale files must be updated per the RTL/i18n rule before merge, or ticketed if out of scope).
- **No breaking changes.**
