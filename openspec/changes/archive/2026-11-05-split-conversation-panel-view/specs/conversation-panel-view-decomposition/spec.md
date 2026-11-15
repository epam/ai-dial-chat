## ADDED Requirements

### Requirement: Conversation panel concerns live in focused hooks and an overlay component

`ConversationPanelView` (`apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`) SHALL delegate its flows as follows:

| Module | Owns |
| --- | --- |
| `apps/chat/src/hooks/conversation-panel/useConversationTransfer.ts` | export and import: error classification, toasts, `useConversationExport`/`useConversationImport` with `conversationsApi` and `filesApi`, export-all, the import file picker, the queue titles, labels and items |
| `apps/chat/src/hooks/conversation-panel/useConversationEditDialogs.ts` | delete and rename confirm dialogs, their pending titles and confirm/close handlers, rename labels, AI title generation |
| `apps/chat/src/hooks/conversation-panel/useConversationSharingDialogs.ts` | unshare, revoke and unpublish confirm dialogs, the selected unpublish folder, share-popup and publish-panel state, recipient counts (`shareApi`), publish history, and their confirm/close handlers (`discardSharedCatalogItem`, `revokeSharedAccess`, `unpublishConversation`) |
| `apps/chat/src/hooks/conversation-panel/useConversationRowActions.tsx` | `getActions`, `handleActionMenuOpen`, `handleMoveConversation`, `rowActionsTriggerRef`, `panelActiveConversationIdRef` |
| `apps/chat/src/components/ConversationPanel/ConversationPanelOverlays.tsx` | the overlays portalled to `document.body`: hidden import input, the `z-51` `TransferQueue` wrapper, the five dialogs, `PinnedProjectActionOverlays`, the rename popup, the share popup, the lazy publish panel |

`ConversationPanelView.tsx` SHALL keep:

- the default `memo` export;
- feature flags and the conversations, deployments and pinned-projects wiring;
- active-conversation sync and list derivation;
- the `useMemo`-stable `labels` and `headerActions`, and `sidebarBlock`.

It SHALL import nothing from `apps/chat/src/server-api`.

A spec that names a `ConversationPanelView` member (for example `getActions`, `pendingRevokeId`, `pendingPublishConversation`, the revoke `ConfirmationPopup`, or the `z-51` queue wrapper) refers to that member in the module this table assigns it to.

The split SHALL NOT change:

- any prop, DOM node, portal target, i18n key, notification or navigation;
- feature-flag gating or the order of upstream requests.

It introduces no endpoint, cache, feature gate or telemetry.

#### Scenario: Existing panel specs pass unchanged

- **WHEN** `ConversationPanelView.spec.tsx` and `ConversationPanelViewSidebar.spec.tsx` run without edits against the split view
- **THEN** every case passes, with the same number of `it` cases as before

#### Scenario: The view no longer imports server-api

- **WHEN** `ConversationPanelView.tsx` is inspected
- **THEN** it has no import from `apps/chat/src/server-api`, and the server-api members it used are imported by the hooks in the table

### Requirement: The panel keeps its memo boundary and a stable row-action builder

`ConversationPanelView` SHALL remain `export default memo(ConversationPanelView)`, with `labels` and `headerActions` memoized in the view as before. `getActions` returned by `useConversationRowActions` SHALL keep its identity when only the active conversation changes, because it reads the active id through `panelActiveConversationIdRef`, as it did before the split.

#### Scenario: Navigation does not re-create the row-action builder

- **WHEN** the active conversation changes and nothing else does
- **THEN** the `getActions` passed to `ConversationListSection` is the same function as on the previous render, as the existing case "keeps the conversations array and getActions when switching between ordinary conversations" in `ConversationPanelView.spec.tsx` asserts
