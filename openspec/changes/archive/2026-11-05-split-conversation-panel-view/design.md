## Context

The structure map of `ConversationPanelView.tsx` (1697 lines) groups it into these concerns:

| Concern | Lines | Size |
| --- | --- | --- |
| Transfer helpers, export and import | 251–389, 509–590 | ~250 |
| Deployments | 391–402 | |
| Active sync, plus the ref copy effect | 411–430 | |
| Five `useAsyncConfirmDialog` instances and share/publish state | 432–491 | |
| Recipients and publish history | 500–507 | |
| List derivation | 606–720 | |
| `handleMoveConversation` | 722–737 | |
| `handleActionMenuOpen` | 745–783 | |
| `getActions` | 785–1139 | 355 |
| Confirm and close handlers | 1141–1378 | |
| Labels and header actions | 1380–1444 | |
| `sidebarBlock` | 1446–1469 | |
| Overlays | 1474–1687 | |

The only local effect copies `panelActiveConversationId` into a ref that `getActions` reads at click time.

Two specs render the view: 124 and 15 cases. They mock the following by module specifier:

- the server-api modules;
- the Conversations, Notification, Deployments and User contexts;
- `usePinnedProjectsPanel` and `useUiFeature`.

These mocks keep working when a hook in another file imports the same specifiers.

App rules apply: custom hooks go in `apps/chat/src/hooks/`, one per file with a JSDoc on why, and contexts are read through their hooks.

## Goals / Non-Goals

**Goals:**

- One flow per module, with explicit parameters and returns.
- The view is under 600 lines and imports no server-api module.
- The same behavior, the same memo boundary and the same `getActions` stability.

**Non-Goals:**

- Behavior changes.
- Reshaping `getActions`.
- Test cleanups.

## Decisions

### D1 — Four hooks and one overlay component

Hooks:

- `useConversationTransfer`
- `useConversationEditDialogs`
- `useConversationSharingDialogs`
- `useConversationRowActions`

Component: `ConversationPanelOverlays`.

The two dialog hooks split along the server-api line. Delete and rename only use context actions. Unshare, revoke, unpublish, share and publish use the share and publish APIs, the recipient counts and the publish history. Each half stays under 350 lines.

### D2 — Hooks read contexts themselves, the view passes view-level values

Each hook calls the hooks it needs:

- `useTranslation`, `useNotification`, `useOperationNotification`;
- `useConversations`, `useNavigate`;
- `usePublishErrorNotification`, and so on.

Calling these hooks is idempotent, so moving a call does not change behavior. The view passes in only values it computes, such as:

- `panelActiveConversationId`, `items`;
- the feature flags;
- `toContextId`/`getRawItem`, `findDeployment`, `selectedItemId`;
- `conversations`;
- the props `onDuplicateReadonly` and `onRequestedFilterChange`.

`useConversationRowActions` receives the dialog openers and setters from the two dialog hooks. Recipients and publish history come from `useConversationSharingDialogs`, and `exportSingle` comes from `useConversationTransfer`.

### D3 — Call order

The view calls the hooks in this order:

1. flags and context;
2. `useConversationTransfer`, which keeps export before import, as today;
3. deployments, active sync and pinned projects;
4. `useConversationEditDialogs` and `useConversationSharingDialogs`, which keep the dialog order delete, unshare, revoke, rename, unpublish within and across the two hooks as declared today;
5. list derivation;
6. `useConversationRowActions`.

The ref-copy effect moves with `panelActiveConversationIdRef` into `useConversationRowActions`. It still runs after `useActiveConversationSync`, because the hook is called later.

The three state setters that `getActions` calls now arrive from `useConversationSharingDialogs`. They are listed in its dependency array, because `react-hooks/exhaustive-deps` cannot see that a setter returned by a hook is stable. React keeps setters stable, so `getActions` keeps its identity.

### D4 — Overlays are presentational

`ConversationPanelOverlays` receives:

- the transfer view models;
- each dialog's state and handlers, as the hooks' return objects;
- `deleteConfirmationLabels`;
- the pinned-project overlay props;
- `rowActionsTriggerRef`;
- the publish history entries;
- the sharing and publishing flags.

It renders the same JSX, and the view still portals it with `createPortal(…, document.body)`. The lazy `PublishConversationPanelContainer` declaration moves with it.

### D5 — Verification

Each slice runs:

- `ConversationPanelView.spec.tsx` and `ConversationPanelViewSidebar.spec.tsx`;
- ESLint from `apps/chat`.

At the end, the `it` counts are compared with the baseline. Nx targets run with `NX_WORKSPACE_ROOT_PATH` pinned to the worktree, as in earlier changes, because the worktree's `node_modules` is a junction.

## Risks / Trade-offs

- **[`getActions` loses identity stability]** The hook keeps the ref pattern and the same 23-entry dependency array, and the memo-boundary spec case runs on every slice.
- **[A hook-to-hook dependency cycle]** The data flows one way: transfer and dialogs, then row actions. Dialog hooks never read row actions.
- **[`useConversationRowActions` stays above 350 lines]** This is accepted, because `getActions` moves verbatim (the 450 cap is in the proposal). Splitting it per item is a follow-up.
- **[A spec text that names a moved member reads as stale]** The ownership table in `conversation-panel-view-decomposition` maps every such reference.
