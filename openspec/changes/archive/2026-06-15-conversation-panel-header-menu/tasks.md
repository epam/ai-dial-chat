# Tasks: conversation-panel-header-menu

> **Dependency**: All tasks assume the `bulk-conversation-deletion` change is merged and `apps/chat/src/server-api/conversations.api.ts` already exports `deleteAllConversations()`. If not yet merged, implement this change in a branch that is rebased on top of `bulk-conversation-deletion`.

---

## Slice 1 — Library extension: `headerActions` prop

### 1.1 Add `headerActions?: ReactNode` to `ConversationPanelProps`

File: `libs/conversation-panel/src/models/ConversationPanel.ts`

Add after the `onPanelResizeStop` entry in `ConversationPanelProps`:

```ts
/**
 * Content rendered in the right action group of the panel header bar.
 * The app supplies any ReactNode — the library does not prescribe its content.
 */
headerActions?: ReactNode;
```

`ReactNode` is already imported from `'react'`. No new import is needed.

### 1.2 Forward `headerActions` to `SidebarPanel.rightActions`

File: `libs/conversation-panel/src/components/ConversationPanel/ConversationPanel.tsx`

Destructure `headerActions` from the props object and pass it to `SidebarPanel`:

```tsx
<SidebarPanel
  // …existing props…
  rightActions={headerActions}
>
```

### 1.3 Architecture guard

Verify that `libs/conversation-panel/src/` contains no import of:
- `@epam/chat-api-client`
- `apps/chat/src/server-api`
- `ConversationsContext`, `DeploymentsContext`, or any app context
- `ROUTES`, `useNavigate`, or routing modules
- `useTranslation`, `t()`, or i18n modules
- `process.env` or environment variables

### 1.4 Verification

```bash
npm exec nx typecheck conversation-panel
npm exec nx lint conversation-panel
```

No errors.

---

## Slice 2 — i18n keys

### 2.1 Add keys to `ConversationPanelI18nKeys`

File: `apps/chat/src/constants/translation-keys.ts`

Append to the `ConversationPanelI18nKeys` enum:

```ts
PanelActionsLabel = 'conversationPanel.panelActionsLabel',
DeleteAllChatsLabel = 'conversationPanel.deleteAllChatsLabel',
DeleteAllConfirmTitle = 'conversationPanel.deleteAllConfirmTitle',
DeleteAllConfirmDescription = 'conversationPanel.deleteAllConfirmDescription',
DeleteAllConfirmButton = 'conversationPanel.deleteAllConfirmButton',
DeleteAllError = 'conversationPanel.deleteAllError',
DeleteAllPartialError = 'conversationPanel.deleteAllPartialError',
```

### 2.2 Add English strings to `en.json`

File: `apps/chat/src/i18n/locales/en.json`

Inside the `"conversationPanel"` object, add after the last existing key:

```json
"panelActionsLabel": "Conversation panel actions",
"deleteAllChatsLabel": "Delete all conversations",
"deleteAllConfirmTitle": "Delete All Conversations?",
"deleteAllConfirmDescription": "All conversations will be permanently deleted. This action cannot be undone.",
"deleteAllConfirmButton": "Delete all",
"deleteAllError": "Failed to delete all conversations. Please try again.",
"deleteAllPartialError": "Some conversations could not be deleted. The list has been refreshed."
```

### 2.3 Verification

```bash
npm exec nx typecheck chat
npm exec nx lint chat
```

No errors.

---

## Slice 3 — Context extension: `deleteAllConversations`

### 3.1 Update `ConversationsContextType`

File: `apps/chat/src/context/ConversationsContext.tsx`

Add `ConversationDeletionResultDto` to the existing `@epam/chat-api-client` import:

```ts
import type { ConversationListItemDto, ConversationDeletionResultDto } from '@epam/chat-api-client';
```

Add `deleteAllConversations as apiDeleteAllConversations` to the existing `'../server-api/conversations.api'` import.

Add to `ConversationsContextType`:

```ts
/**
 * Delete every conversation in the authenticated user's bucket.
 * Returns the structured result. On complete success the local list is cleared.
 * On partial failure the list is re-fetched. On total failure local state is unchanged.
 * Throws if the API call itself fails before returning per-item results.
 */
deleteAllConversations: () => Promise<ConversationDeletionResultDto>;
```

### 3.2 Implement `deleteAllConversations` in the provider

Inside `ConversationsProvider`, after the `duplicateConversation` implementation:

```ts
const deleteAllConversations = useCallback(async (): Promise<ConversationDeletionResultDto> => {
  const result = await apiDeleteAllConversations();

  if (result.failed.length === 0) {
    setConversations([]);
  } else if (result.deleted > 0 || result.alreadyAbsent > 0) {
    await refreshConversations();
  }

  return result;
}, [refreshConversations]);
```

Add `deleteAllConversations` to the `useMemo` value object and its dependency array.

### 3.3 Verification

```bash
npm exec nx typecheck chat
npm exec nx lint chat
```

No errors.

---

## Slice 4 — View: overflow trigger and confirmation popup

### 4.1 Add imports to `ConversationPanelView.tsx`

File: `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`

Add to existing `@epam/ai-dial-ui-kit` import:
```ts
DialDropdown,
DialIconButton,
```

Add to existing `@tabler/icons-react` import:
```ts
IconDotsVertical,
```

Add `ConversationDeletionResultDto` to the existing `@epam/chat-api-client` import (or add a new type import if the package is not yet imported).

### 4.2 Add new state variables

After the existing `duplicateError` state:

```ts
const [isDeleteAllPopupOpen, setIsDeleteAllPopupOpen] = useState(false);
const [isDeletingAll, setIsDeletingAll] = useState(false);
const [deleteAllError, setDeleteAllError] = useState<string | null>(null);
const [deleteAllPartialError, setDeleteAllPartialError] = useState<string | null>(null);
```

Destructure `deleteAllConversations` from `useConversations()`.

### 4.3 Build `panelMenuItems` and `headerActions`

After the existing `groupLabels` memo:

```tsx
const panelMenuItems: DropdownItem[] = useMemo(
  () => [
    {
      key: 'delete-all',
      label: t(ConversationPanelI18nKeys.DeleteAllChatsLabel),
      icon: <IconTrashX size={DIAL_ICON_SIZE.SM} className="text-secondary" />,
      danger: true,
      onClick: () => {
        setDeleteAllError(null);
        setIsDeleteAllPopupOpen(true);
      },
    },
  ],
  [t],
);

const headerActions = useMemo(
  () => (
    <DialDropdown items={panelMenuItems} placement="bottom-end">
      <DialIconButton
        aria-label={t(ConversationPanelI18nKeys.PanelActionsLabel)}
        icon={<IconDotsVertical size={DIAL_ICON_SIZE.MD} />}
      />
    </DialDropdown>
  ),
  [panelMenuItems, t],
);
```

### 4.4 Add delete-all handlers

After the existing `handleCloseRenameDialog`:

```ts
const handleConfirmDeleteAll = useCallback(async () => {
  setIsDeletingAll(true);
  setDeleteAllError(null);

  let result: ConversationDeletionResultDto;
  try {
    result = await deleteAllConversations();
  } catch {
    setDeleteAllError(t(ConversationPanelI18nKeys.DeleteAllError));
    setIsDeletingAll(false);
    return;
  }

  setIsDeletingAll(false);

  const isTotalFailure =
    result.failed.length > 0 && result.deleted === 0 && result.alreadyAbsent === 0;
  const isPartialFailure =
    result.failed.length > 0 && (result.deleted > 0 || result.alreadyAbsent > 0);

  if (isTotalFailure) {
    setDeleteAllError(t(ConversationPanelI18nKeys.DeleteAllError));
    return;
  }

  setIsDeleteAllPopupOpen(false);

  if (isPartialFailure) {
    setDeleteAllPartialError(t(ConversationPanelI18nKeys.DeleteAllPartialError));
  }

  if (activeConversationId) {
    navigate(ROUTES.ROOT);
  }
}, [deleteAllConversations, activeConversationId, navigate, t]);

const handleCancelDeleteAll = useCallback(() => {
  if (isDeletingAll) return;
  setIsDeleteAllPopupOpen(false);
  setDeleteAllError(null);
}, [isDeletingAll]);
```

### 4.5 Pass `headerActions` to `ConversationPanel`

In the JSX, add `headerActions={headerActions}` to the `<ConversationPanel>` element.

### 4.6 Add confirmation popup for delete-all

After the existing single-delete `<DialConfirmationPopup>`:

```tsx
<DialConfirmationPopup
  open={isDeleteAllPopupOpen}
  header={t(ConversationPanelI18nKeys.DeleteAllConfirmTitle)}
  confirmLabel={t(ConversationPanelI18nKeys.DeleteAllConfirmButton)}
  cancelLabel={t(ButtonsI18nKeys.Cancel)}
  variant={ConfirmationPopupVariant.Danger}
  isLoading={isDeletingAll}
  disableConfirmButton={isDeletingAll}
  description={
    <>
      <span>{t(ConversationPanelI18nKeys.DeleteAllConfirmDescription)}</span>
      {deleteAllError && (
        <span className="mt-1 block text-error">{deleteAllError}</span>
      )}
    </>
  }
  onConfirm={handleConfirmDeleteAll}
  onCancel={handleCancelDeleteAll}
  onClose={handleCancelDeleteAll}
/>
```

### 4.7 Add partial-error notification

After the existing `duplicateError` notification block:

```tsx
{deleteAllPartialError && (
  <DialNotification
    variant={NotificationVariant.Error}
    message={deleteAllPartialError}
    closable
    onClose={() => setDeleteAllPartialError(null)}
    className="fixed bottom-4 start-4 z-50 max-w-sm"
  />
)}
```

### 4.8 Verification

```bash
npm exec nx typecheck chat
npm exec nx lint chat
```

No errors.

---

## Slice 5 — Tests

### 5.1 Library test: `headerActions` prop

File: `libs/conversation-panel/src/components/ConversationPanel/tests/ConversationPanel.spec.tsx`

Add two test cases to the existing describe block (or create the file if it does not exist):

- `'renders headerActions in the panel header when provided'` — render `<ConversationPanel headerActions={<button>Test Action</button>} ...minimalProps />` and assert `screen.getByRole('button', { name: 'Test Action' })` is present.
- `'renders without error when headerActions is omitted'` — render without `headerActions` and assert no thrown error and no unexpected buttons in the header.

Run:

```bash
npm exec nx test conversation-panel
```

All tests pass.

### 5.2 Context tests: `deleteAllConversations`

File: `apps/chat/src/context/tests/ConversationsContext.spec.tsx` (create if not present; place alongside the context file if a `tests/` subfolder does not exist, following the convention in `apps/chat/src/`).

Mock `deleteAllConversations` from `'../server-api/conversations.api'` and `listConversations` for `refreshConversations`. Cover:

1. `'clears conversations on complete success'` — mock returns `{ requested: 3, deleted: 3, alreadyAbsent: 0, failed: [] }`; assert context `conversations` becomes `[]`.
2. `'clears conversations for empty bucket (requested: 0)'` — mock returns `{ requested: 0, deleted: 0, alreadyAbsent: 0, failed: [] }`; assert context `conversations` becomes `[]`.
3. `'calls refreshConversations on partial failure'` — mock returns `{ requested: 3, deleted: 2, alreadyAbsent: 0, failed: [{ id: 'x', code: 'UPSTREAM_ERROR' }] }`; assert `listConversations` is called; returned DTO has `failed.length === 1`.
4. `'does not modify state on total failure'` — mock returns `{ requested: 3, deleted: 0, alreadyAbsent: 0, failed: [<3 items>] }`; assert `conversations` is unchanged and `listConversations` is NOT called.
5. `'propagates thrown error without modifying state'` — mock throws; assert the thrown error propagates and `conversations` is unchanged.

Run:

```bash
npm exec nx test chat
```

All tests pass.

### 5.3 View tests: overflow trigger, dropdown, popup, and error paths

File: `apps/chat/src/components/ConversationPanel/tests/ConversationPanelView.spec.tsx`

Mock `useConversations` (provide `conversations`, `isLoading`, `deleteAllConversations`, and other required fields). Mock `useNavigate`. Mock `useDeployments`. Cover:

1. `'renders the overflow trigger with the accessible label'` — assert `screen.getByRole('button', { name: /conversation panel actions/i })` is present.
2. `'dropdown contains exactly one item: Delete all conversations'` — open dropdown; assert one item with text matching `deleteAllChatsLabel`.
3. `'clicking the item opens the confirmation popup without calling the API'` — click the item; assert the confirmation popup title is visible; assert `deleteAllConversations` mock is NOT called.
4. `'cancelling the popup closes it without calling the API'` — open popup, click Cancel; assert popup is not visible; assert `deleteAllConversations` not called.
5. `'complete success: closes popup and navigates to root when activeConversationId is set'` — mock returns `{ failed: [], deleted: 1, alreadyAbsent: 0, requested: 1 }`; confirm; assert popup closes, `navigate` called with `ROUTES.ROOT`.
6. `'complete success with no active conversation: does not navigate'` — render without `activeConversationId`; confirm; assert `navigate` NOT called.
7. `'total failure: popup stays open with inline error; list unchanged'` — mock returns `{ deleted: 0, alreadyAbsent: 0, failed: [{ id: 'x', code: 'UPSTREAM_ERROR' }], requested: 1 }`; confirm; assert popup is still visible; assert inline error text present; assert `navigate` NOT called.
8. `'partial failure: popup closes, notification shown, navigate called'` — mock returns `{ deleted: 1, alreadyAbsent: 0, failed: [{ id: 'x', code: 'UPSTREAM_ERROR' }], requested: 2 }`; confirm; assert popup closed; assert notification with partial-error text; assert `navigate` called.
9. `'thrown error: popup stays open with inline error'` — mock throws; confirm; assert popup open with error text; assert `isDeletingAll` reset (confirm button enabled again).
10. `'confirm button is disabled during in-flight request'` — click confirm; before resolving the mock, assert the confirm button is disabled.
11. `'partial-error notification is dismissable'` — trigger partial failure; click notification close; assert notification is gone.
12. `'cancel is a no-op while deletion is in progress'` — while API is in flight, click Cancel; assert popup stays open and API is not called a second time.

Run:

```bash
npm exec nx test chat
```

All tests pass.

---

## Slice 6 — Final verification

- [x] 6.1 `npm exec nx typecheck conversation-panel` — no errors
- [x] 6.2 `npm exec nx lint conversation-panel` — no errors
- [x] 6.3 `npm exec nx typecheck chat` — no errors
- [x] 6.4 `npm exec nx lint chat` — no errors
- [x] 6.5 `npm exec nx test conversation-panel` — all tests pass
- [x] 6.6 `npm exec nx test chat` — all tests pass
- [x] 6.7 `npm exec nx affected --target=typecheck --base=origin/development-1.0` — no type errors across affected projects
- [x] 6.8 `npm exec nx affected --target=test --base=origin/development-1.0` — all affected tests pass
