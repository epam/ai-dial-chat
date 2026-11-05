## Why

`apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx` is 1697 lines, with 46 commits in the last 60 days. It is item F3 of the 2026-10-26 refactoring audit. One memoized component owns:

- list derivation;
- export and import with their transfer queues;
- five confirm dialogs: delete, rename, unshare, revoke and unpublish;
- the share popup and the publish panel;
- a 355-line `getActions` row-menu builder;
- about 215 lines of overlay JSX.

It also imports seven server-api members directly (`conversationsApi`, `filesApi`, `shareApi`, `UnauthorizedError`, `unpublishConversation`, `discardSharedCatalogItem`, `revokeSharedAccess`). As a result, a change to the revoke flow means reading the export queue, the rename popup and the list-derivation code too.

## What Changes

The new hooks go in `apps/chat/src/hooks/conversation-panel/` (one per file, with JSDoc, next to `useConversationPanelRouteState`). The new overlay component goes beside the view. Code moves verbatim: the same callbacks, dependency arrays and order.

- **`useConversationTransfer`**: export and import.
  - The error classifiers.
  - The success, warning and error toasts.
  - `useConversationExport` and `useConversationImport` (with `conversationsApi`, `filesApi`, `UnauthorizedError`).
  - Export-all and the import file picker.
  - The queue titles, labels and items.

  It returns `exportSingle`, `handleExportAll`, `handleImportClick`, the file-input wiring and the two queue view models.
- **`useConversationEditDialogs`**: the delete and rename confirm dialogs, with their pending titles, confirm and close handlers, rename labels and AI title generation.
- **`useConversationSharingDialogs`**:
  - the unshare, revoke and unpublish confirm dialogs, the selected unpublish folder, and the share-popup and publish-panel state;
  - recipient counts (`useShareRecipientsCount` with `shareApi`) and publish history;
  - all their confirm and close handlers (with `discardSharedCatalogItem`, `revokeSharedAccess`, `unpublishConversation`).
- **`useConversationRowActions`**: `getActions`, `handleActionMenuOpen`, `handleMoveConversation`, `rowActionsTriggerRef` and the `panelActiveConversationIdRef` that keeps `getActions` stable.
- **`ConversationPanelOverlays`** (`components/ConversationPanel/ConversationPanelOverlays.tsx`): the overlay JSX that is portalled to `document.body`. It contains the hidden import input, the two `TransferQueue`s in their `z-51` wrapper, the five dialogs, `PinnedProjectActionOverlays`, the rename popup, the share popup and the lazy publish panel. It is presentational.
- **`ConversationPanelView.tsx`** keeps:
  - `memo` and the default export;
  - flags and the conversations context;
  - deployments, active-conversation sync, pinned projects and list derivation;
  - the `useMemo` labels and header actions that the memo boundary needs;
  - `sidebarBlock` and the portal.

  It imports no server-api module and drops to about 550 lines.

No behavior changes:

- the same props, default `memo` export, DOM and portal target;
- the same notifications, navigation and i18n keys;
- the same feature-flag gating and request order;
- the same `getActions` identity rules.

### Non-goals

- Changing any row action, dialog, queue or toast.
- Turning `getActions` into a data table.
- Changing `useConversationExport`/`useConversationImport` in `libs/chat-hooks`.
- Removing the stale `../get-conversation-source` mock in the specs, or moving the misplaced revoke comment. Both are noted for a follow-up.

### Acceptance criteria

- `ConversationPanelView.tsx` is under 600 lines and imports nothing from `apps/chat/src/server-api`.
- Each new module has a JSDoc summary and is under 350 lines, except `useConversationRowActions`, which carries the 355-line `getActions` verbatim and was capped at 450. It landed at 575, because its typed parameter list adds about 70 lines. This is recorded rather than reshaping `getActions`.
- `ConversationPanelView.spec.tsx` (124 cases) and `ConversationPanelViewSidebar.spec.tsx` (15 cases) pass without edits. Their module mocks still apply because the new modules import the same specifiers.
- `nx run-many -t test lint build typecheck -p @epam/chat` passes, and so do `validate:docs` and `validate:specs`.

### Alternatives considered

1. **One `useConversationPanelActions` hook holding every handler** (the plan's wording). It would be about 900 lines, which recreates the god module one level down. Rejected.
2. **Hooks by flow plus an overlay component** (chosen). The split follows the existing concern boundaries, and each dialog's state and its overlay pair stay readable.
3. **Splitting `getActions` per menu item.** This changes how the menu is assembled, not just where the code lives. Rejected for this change; it may follow later.

### Rollback

The change is internal to `apps/chat`. Reverting the commit restores it, with no data, API or host change.

## Capabilities

### New Capabilities

- `conversation-panel-view-decomposition`: which hook or component owns each concern of the conversation panel. Other specs' references to `ConversationPanelView` internals map through this table. It also states the memo-boundary and `getActions`-stability constraints, and the no-server-api rule for the view.

### Modified Capabilities

None. Other specs cite `ConversationPanelView` members such as `getActions`, `pendingRevokeId` and the `z-51` queue wrapper. They are covered by the ownership table instead of being rewritten one by one.

## Impact

- **Code:** `apps/chat/src/`.
  - New: `hooks/conversation-panel/useConversationTransfer.ts`, `useConversationEditDialogs.ts`, `useConversationSharingDialogs.ts`, `useConversationRowActions.tsx` (it builds icon JSX), and `components/ConversationPanel/ConversationPanelOverlays.tsx`.
  - Edited: `components/ConversationPanel/ConversationPanelView.tsx`.
- **Tests:** none edited.
- **Docs:** `docs/architecture.md` describes the view by its role. Lines 175, 619 and 702–704 stay true, so there is no edit.
- **Unaffected:**
  - libs and the backend;
  - i18n: keys only move with their code;
  - RTL and a11y (DOM unchanged);
  - feature gating and telemetry.
