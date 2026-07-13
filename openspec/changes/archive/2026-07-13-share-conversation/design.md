## Context

`ConversationPanelView.getActions` (`apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx:226-317`) builds the per-conversation `DropdownItem[]` consumed by `ConversationRow` (`libs/conversation-panel/src/components/ConversationGroup/ConversationRow.tsx`). Owned, non-readonly conversations currently get `pin`/`unpin`, `rename`, `duplicate`, `delete`; readonly/shared/published items (`isReadonlyItem`, line 232-235) only get `pin` + `duplicate`.

Catalog entities already have an equivalent flow: `ShareButton` → `SharePopoverContainer` (`apps/chat/src/components/SharePopoverContainer/SharePopoverContainer.tsx`) → `useShareLink` (`apps/chat/src/hooks/useShareLink/useShareLink.ts`) → `getShareLink` (`apps/chat/src/utils/share-link.ts`) → `createShareLink` (`apps/chat/src/server-api/share.api.ts`) → `POST /api/v1/share` (`apps/chat-api/src/share/share.controller.ts:26-66`), proxying DIAL Core. The DTO (`CreateShareLinkDto`) takes a generic `itemId` (DIAL Core resource path) + `access: ShareAccess[]` — it has no catalog-specific fields, so a conversation's resource path is a valid `itemId` with no backend contract change.

The presentational `SharePopover` (`libs/share/src/components/SharePopover/SharePopover.tsx`) is host-agnostic: it takes `url`, `isLoading`, `error`, `access`, `canEditAccess`, `onAccessChange`, `onClose`, and a flat `labels` object. `canEditAccess` is a static per-entity-type boolean today (`EDITABLE_ACCESS_TYPES` in `SharePopoverContainer.tsx:18-23`), decided by the app-level container — not something the lib itself knows about entity types.

## Goals / Non-Goals

**Goals:**

- Add a "Share" action to the conversation panel's per-row action menu for owned, non-readonly conversations.
- Reuse `SharePopover`/`AccessControl`/`LinkView`/`QrCode` from `libs/share` and the existing `POST /api/v1/share` + `GET /share/invitations/:id` endpoints as-is.
- Introduce a conversation-specific container (`ShareConversationPopoverContainer`) that mirrors `SharePopoverContainer` but sources its `itemId` from the conversation's resource path instead of a `CatalogItem`.
- Force `canEditAccess={false}` for conversations (view-only sharing) — no new access level, no dropdown, matching the existing static-label behavior already implemented for `CatalogEntityType.Model`.

**Non-Goals:**

- No change to `CreateShareLinkDto`, `ShareController`'s route/DTO shape, or the `POST /api/v1/share` contract beyond the `@ApiOperation.description` wording generalization. (`ShareService`'s internal invitation-URL routing *does* change — see Decision 6 — but the public request/response shape is untouched.)
- No "co-edit" / Edit-access support for conversations in this iteration.
- No change to how a *recipient* opens a shared conversation — that path (third-party bucket resolution) already works (see archived change `2026-06-30-fix-shared-conversation-open`).
- No bulk-share / share-multiple-conversations UI.

## Decisions

1. **New sibling container, not a generalized `SharePopoverContainer`.**
   `SharePopoverContainer` takes `item: CatalogItem` and reads `item.type`/`item.id` from `@epam/ai-dial-catalog`. Conversations have a different shape (`ConversationHistoryItem` panel model vs. the raw `Conversation`/context item resolved via `panelToContextId`, per `ConversationPanelView.tsx:228-235`). Rather than making `SharePopoverContainer` accept a union type (`CatalogItem | ConversationLike`) and branching internally, add `ShareConversationPopoverContainer` as its own component under `apps/chat/src/components/ShareConversationPopoverContainer/`, taking `{ conversationId: string; conversationPath: string; onClose: () => void }` and rendering `<SharePopover canEditAccess={false} .../>` directly.
   - *Alternative considered*: extend `SharePopoverContainer`'s `item` prop to a discriminated union. Rejected — it would leak conversation knowledge into a component whose contract is currently "catalog item in, share popover out," and every future entity type would keep widening that union.

2. **Reuse `useShareLink` unchanged, keyed by conversation resource path.**
   `useShareLink(itemId: string)` (`apps/chat/src/hooks/useShareLink/useShareLink.ts:24`) already only needs a string `itemId` — it has no catalog-specific logic. `ShareConversationPopoverContainer` calls the same hook with the conversation's DIAL Core resource path (the same path format already used by `resolveConversationLocation` for shared-conversation opens). No hook change needed.
   - *Alternative considered*: a parallel `useConversationShareLink` hook. Rejected as duplicate logic — the existing hook is already entity-agnostic.

3. **View-only, no `AccessControl` dropdown, via existing `canEditAccess` prop.**
   `SharePopover` already renders a static label instead of a dropdown when `canEditAccess={false}` (this is the exact path `CatalogEntityType.Model` takes today). Conversations always pass `canEditAccess={false}` and `access={[ShareLinkAccess.View]}` — no new prop or lib change required.

4. **Menu wiring: new `share` action inserted only in the non-readonly branch.**
   In `getActions` (`ConversationPanelView.tsx:277-304`), add a `shareAction` `DropdownItem` (icon: `IconShare` from `@tabler/icons-react`, matching the icon already used by the catalog `ShareButton`; label from a new `ConversationPanelI18nKeys.ShareLabel` key) that opens the popover. Readonly/shared/published conversations (`isReadonlyItem`) do **not** get a Share action — a user cannot re-share a conversation shared *to* them in this iteration (consistent with not supporting re-share chains and keeping the access model simple).
   - Popover trigger/visibility state follows the existing `pendingRenameItem`/`pendingDeleteId` pattern: a new `pendingShareItem` state (`{ id, path } | null`) set by the action's `onClick`.

5. **Popover chrome: `DialPopup` (centered modal), not an anchored `DialDropdown`.**
   The catalog `ShareButton` anchors `SharePopover` inside a `DialDropdown` because it owns the trigger button it renders as `DialDropdown`'s `children`. The conversation row's "..." trigger is owned by `libs/conversation-panel`'s `ConversationRow` — `ConversationPanelView` only supplies `DropdownItem[]` via `getActions`, with no ref to the trigger DOM node to anchor a second overlay to. `SharePopover` also has no close (X) button of its own (relying on the host's dropdown/backdrop chrome), so it needs a host regardless.
   Given `RenameConversationPopup` and the delete `DialConfirmationPopup` — triggered from the exact same row menu — already use `DialFormPopup`/`DialConfirmationPopup` (both built on the centered, scrim-backed `DialPopup`) rather than anchored dropdowns, `ShareConversationPopoverContainer` is hosted in a plain `DialPopup` (`size={PopupSize.Sm}`, `dividers={false}`) for consistency with the rest of this file, instead of replicating the deployment-share anchored-popover UX.
   `DialPopup` unconditionally renders its own header row (title + close button container) even when no `header` prop is given — confirmed by reading the compiled component: the header `<div>` always renders, with `R(t)` (title, an empty `<span>` when `t` is `undefined`) and the close button unless `hideClose`. Passing no `header` therefore still produces a visible, padded empty bar stacked above `SharePopover`'s own title/QR-toggle row — a double-header gap with a stray close button floating above the real header, confirmed visually in a running-app screenshot. The fix is `hideClose` **and** `headerClassName="hidden"` on `DialPopup`, fully collapsing its native header so `SharePopover`'s own header (title + QR/Link toggle) is the only one rendered. Dismissal then relies on `DialPopup`'s `closeOnOutsideClick` (default `true`) and `SharePopover`'s own Escape handling — no dedicated close (X) button, matching how the deployment `ShareButton`'s anchored `DialDropdown` is also dismissed (outside click / Escape, no X) rather than adding one DialPopup doesn't naturally support without reintroducing the empty-row problem.
   - *Alternative considered*: thread a trigger ref out of `ConversationRow`/`getActions` so `DialDropdown` could anchor precisely to the "..." button. Rejected — it would require a `libs/conversation-panel` API change (out of scope) for a cosmetic positioning difference; the centered-modal pattern is already an established, accessible precedent in this exact file.

6. **Backend contract stays generic; `@ApiOperation.description` updated for discoverability.**
   Update `@ApiOperation.description` on `ShareController.createShareLink` (`share.controller.ts:32-35`) from "for a catalog entity (agent, application, skill, toolset, or model)" to "for a DIAL Core resource (catalog entity or conversation)". No DTO, validation, or route change — `itemId` was never catalog-typed at the schema level.

7. **Accept-invitation redirect must branch on resource kind — this was a real gap, not just doc wording.**
   `ShareService.buildInvitationUrl` hardcoded `SHARE_INVITATION_ROUTE_PATH = '/catalog/shared'`, so every generated share link — including conversation ones — pointed at `/catalog/shared/:invitationId`, whose page (`SharedInvitationPage`) unconditionally accepts the invitation and redirects to `${ROUTES.Catalog}?itemId=...`. A conversation share link would have silently landed the recipient on the catalog instead of the conversation. Fixed by:
   - `share.service.ts`: `getInvitationRoutePath(itemId)` picks `/conversations/shared` when `itemId` starts with `conversations/` (the DIAL Core conversation resource-path prefix, confirmed in `conversation.service.ts`), else `/catalog/shared`. `buildInvitationUrl` now takes `itemId` to make this decision.
   - `types/routes.ts`: new `ROUTES.ConversationSharedInvitation = '/conversations/shared/:invitationId'`, registered as a top-level route in `app.tsx` alongside the existing `ROUTES.SharedInvitation`.
   - `SharedInvitationPage` (`pages/SharedInvitation/SharedInvitation.tsx`) generalized to accept optional `getTargetRoute`/`errorFallbackRoute` props (defaulting to the original catalog behavior, so existing catalog tests are unaffected). A new thin `ConversationSharedInvitationPage` (`pages/ConversationSharedInvitation/`) passes `getTargetRoute={getConversationRoute}` and `errorFallbackRoute={ROUTES.Root}`.
   - *Alternative considered*: have the frontend inspect the accepted `itemId`'s shape and redirect accordingly from a single shared-invitation page/route, instead of two routes. Rejected — the *invitation link itself* (sent to the recipient before they've accepted anything) must already point at a concrete route, and the backend is the only party that knows the resource kind at link-creation time; a single frontend route would still need the backend to pass a kind hint through some other channel, which is more indirection than two parallel routes.

## Risks / Trade-offs

- **[Risk]** DIAL Core's resource-sharing API may reject or behave unexpectedly for conversation-shaped resource paths (untested surface). → **Mitigation**: verify against a real DIAL Core instance in a dev environment as part of implementation; the 502/503 error paths already exist in `ShareController`/`SharePopover`'s `error` prop, so a Core-side rejection surfaces as the existing error UI rather than a crash.
- **[Risk]** Conversation resource path format (bucket-prefixed, may include shared-bucket paths for already-shared items) might need normalization before being sent as `itemId`. → **Mitigation**: only offer Share for owned (non-readonly) conversations, whose path is always in the user's own bucket — no third-party-bucket edge case to handle in this iteration.
- **[Trade-off]** No re-sharing of conversations shared with you. Acceptable per Non-Goals; can be revisited if requested.

## Open Questions

- Should the share link's title/preview (if DIAL Core surfaces one) show the conversation's name, and does that require passing additional metadata beyond `itemId`? To be confirmed once the Core resource-sharing response shape for conversations is verified.
- Confirm whether conversations should get their own throttle bucket on `POST /api/v1/share`, or share the existing `{ limit: 20, ttl: 60000 }`.
