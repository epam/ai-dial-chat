## Why

Every toast in the chat app (success, info, warning, error and loading) currently appears at the **top center** of the viewport. There, a toast covers the page header and the top of the conversation. That is the area the user is reading. The product request is to move all alert toasts to the **bottom-right corner**. This is the conventional place for transient feedback, and the corner where the app's import/export/transfer progress panels already sit.

## What Changes

- The single app-level toast stack, `NotificationContainer` (`apps/chat/src/components/Notification/NotificationContainer.tsx`), moves from top-center to the **bottom-end** corner from the `desktop` breakpoint up. This is bottom-right in LTR and bottom-left in RTL, because the anchor is a logical `end`, not a physical `right`.
- On phones (below `desktop`) the stack anchors to the **bottom** edge and spans the viewport width minus the existing 16px gutter (`px-4`). This keeps today's rule that a toast can never be wider than the screen.
- Arrival order is unchanged: the newest toast renders last, nearest the bottom edge. The stack still scrolls once it reaches the viewport height, and it now scrolls to its end whenever a toast is added, so the newest toast is never hidden below the fold of an overflowing bottom-anchored stack.
- The stack keeps `z-70`. While a toast is visible it draws **over** the `TransferQueue` panels (`fixed inset-e-4 bottom-4 z-51` in `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx` and `libs/chat-shared/src/file-manager/DialFileManagerShell/DialFileManagerShell.tsx`). This is an accepted trade-off (decided with the requester): toasts are transient, auto-dismiss after 5s unless they carry an action or request ID, and are closable.
- The existing specs that call the placement "top-center" are updated to match.

Not breaking: no API, prop, context or i18n change. Every caller of `useNotification()` keeps working unchanged. It is a one-file style change, and rollback is a revert of that file.

**Alternatives considered:** (1) offset the toast stack above the visible `TransferQueue` by measuring it, rejected because it couples two unrelated surfaces (one of them in a lib) for a transient overlap; (2) move the `TransferQueue` panels to bottom-start, rejected because it touches `libs/chat-shared` and a second app surface for no requested benefit; (3) bottom-end on phones too, rejected because a ≤600px toast already fills a phone's width, so a full-width bottom stack is the honest layout.

**Non-goals:** the inline `Notification` banners rendered inside page content (`libs/publish-panel` `PublishPanel` / `PublishAccessRules`, `apps/chat/src/pages/ToolsetAuthCallback/ToolsetAuthCallback.tsx`) are not toasts and stay where they are. Toast content, variants, dismissal timing, the Request ID row and the `NotificationContext` API are unchanged. No enter/exit animation is added.

**Acceptance criteria**

- From `desktop` up, every toast raised through `useNotification()` renders in the bottom-end corner (bottom-right in LTR, bottom-left in RTL).
- Below `desktop`, toasts render at the bottom edge with a 16px gutter and never exceed the viewport width.
- Multiple toasts stack upward from the bottom edge with the newest nearest it, and the stack scrolls instead of overflowing the viewport.
- The gaps between and around toasts stay click-through.
- `NotificationContainer.spec.tsx` passes, and the specs no longer describe the placement as top-center.

## Capabilities

### New Capabilities

- `notification-placement`: where the app-level toast stack sits in the viewport (bottom-end on desktop, full-width bottom on phones), its stacking order, overflow, click-through behaviour and z-order relative to other fixed surfaces.

### Modified Capabilities

- `attachment-network-error-notification`: the requirement text says the notification is "top-center" and cites a centering pair; it now defers placement to `notification-placement`.
- `attachment-file-too-large-error`: the RTL note says "top-center portal"; it now defers to `notification-placement`.
- `attachment-unsupported-type-error`: same RTL-note correction.
- `file-manager-delete-ui`: the RTL requirement says toast placement uses `start-1/2`; it now names the bottom-end logical anchor.

## Impact

- **Code:** `apps/chat/src/components/Notification/NotificationContainer.tsx` (container classes and the placement comment only); `apps/chat/src/components/Notification/tests/NotificationContainer.spec.tsx`.
- **Scope:** app-only. No `libs/*` change, no global provider change (`NotificationProvider` in `apps/chat/src/context/NotificationContext.tsx` is untouched). The closest existing pattern for the bottom-end anchor is the `TransferQueue` wrapper (`apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`, `fixed inset-e-4 bottom-4`).
- **i18n:** none, because no new user-visible strings are added.
- **Docs:** no `docs/` file describes toast placement. Only the four specs listed above are affected.
- **Dependencies / backend / OpenAPI:** none.
