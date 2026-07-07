# Design: conversation-panel-header-menu

## 1. Library extension — `libs/conversation-panel`

### `ConversationPanelProps` (`libs/conversation-panel/src/models/ConversationPanel.ts`)

Add one optional prop after `onPanelResizeStop`:

```ts
/**
 * Content rendered in the right action group of the panel header bar.
 * The app supplies any ReactNode — the library does not prescribe its content.
 * Use this slot to add icon-button triggers or other header controls.
 */
headerActions?: ReactNode;
```

Import `ReactNode` from `'react'` (already imported for other types).

### `ConversationPanel` (`libs/conversation-panel/src/components/ConversationPanel/ConversationPanel.tsx`)

Destructure `headerActions` from props and forward it to `SidebarPanel.rightActions`:

```tsx
const ConversationPanel: FC<ConversationPanelProps> = memo(
  ({
    // …existing props…
    headerActions,
  }) => {
    // …
    return (
      <SidebarPanel
        // …existing props…
        rightActions={headerActions}
      >
        {/* body content unchanged */}
      </SidebarPanel>
    );
  },
);
```

**Architecture guard**: `ConversationPanel.tsx` must not import API clients, server-api wrappers, app contexts (`ConversationsContext`, `DeploymentsContext`), routing (`ROUTES`, `useNavigate`), i18n (`useTranslation`, `t()`), authentication, environment variables, or feature flags. The `headerActions` value is opaque to the library.

---

## 2. Context extension — `apps/chat/src/context/ConversationsContext.tsx`

### `ConversationsContextType`

Add one method to the interface:

```ts
/**
 * Delete every conversation in the authenticated user's bucket.
 *
 * Returns the structured result from the backend. On complete success
 * (failed.length === 0) the local list is cleared immediately. On partial
 * failure the list is re-fetched from the server so the panel reflects
 * actual remaining conversations.
 *
 * Throws if the API call itself fails (network error, 5xx from the server
 * before per-item processing). Partial per-item failures are represented
 * in the returned DTO, not thrown.
 */
deleteAllConversations: () => Promise<ConversationDeletionResultDto>;
```

Import `ConversationDeletionResultDto` from `'@epam/chat-api-client'` alongside the existing `ConversationListItemDto` import.

### Provider implementation

```ts
const deleteAllConversations = useCallback(async (): Promise<ConversationDeletionResultDto> => {
  const result = await apiDeleteAllConversations();

  if (result.failed.length === 0) {
    setConversations([]);
  } else if (result.deleted > 0 || result.alreadyAbsent > 0) {
    await refreshConversations();
  }
  // total failure (deleted === 0 && alreadyAbsent === 0 && failed.length > 0):
  // leave local state unchanged — the view shows an inline error

  return result;
}, [refreshConversations]);
```

Import `deleteAllConversations as apiDeleteAllConversations` from `'../server-api/conversations.api'` alongside the existing imports.

Add `deleteAllConversations` to the `useMemo` value object and its dependency array.

---

## 3. App view — `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`

### New state variables

```ts
const [isDeleteAllPopupOpen, setIsDeleteAllPopupOpen] = useState(false);
const [isDeletingAll, setIsDeletingAll] = useState(false);
const [deleteAllError, setDeleteAllError] = useState<string | null>(null);
const [deleteAllPartialError, setDeleteAllPartialError] = useState<string | null>(null);
```

Destructure `deleteAllConversations` from `useConversations()`.

### Panel header actions node

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

Import `DialDropdown`, `DialIconButton` from `'@epam/ai-dial-ui-kit'` and `IconDotsVertical` from `'@tabler/icons-react'`.

Pass `headerActions` to `ConversationPanel`:

```tsx
<ConversationPanel
  // …existing props…
  headerActions={headerActions}
/>
```

### Delete-all confirm handler

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

  const isPartialFailure =
    result.failed.length > 0 && (result.deleted > 0 || result.alreadyAbsent > 0);
  const isTotalFailure =
    result.failed.length > 0 && result.deleted === 0 && result.alreadyAbsent === 0;

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
```

Import `ConversationDeletionResultDto` from `'@epam/chat-api-client'`.

### Delete-all cancel handler

```ts
const handleCancelDeleteAll = useCallback(() => {
  if (isDeletingAll) return;
  setIsDeleteAllPopupOpen(false);
  setDeleteAllError(null);
}, [isDeletingAll]);
```

### Confirmation popup

Add alongside the existing single-delete `DialConfirmationPopup`:

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

### Partial-failure notification

Add alongside the existing `duplicateError` notification:

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

---

## 4. i18n keys

### `apps/chat/src/constants/translation-keys.ts` — `ConversationPanelI18nKeys`

Add seven new members:

| Enum member | Key string |
|---|---|
| `PanelActionsLabel` | `'conversationPanel.panelActionsLabel'` |
| `DeleteAllChatsLabel` | `'conversationPanel.deleteAllChatsLabel'` |
| `DeleteAllConfirmTitle` | `'conversationPanel.deleteAllConfirmTitle'` |
| `DeleteAllConfirmDescription` | `'conversationPanel.deleteAllConfirmDescription'` |
| `DeleteAllConfirmButton` | `'conversationPanel.deleteAllConfirmButton'` |
| `DeleteAllError` | `'conversationPanel.deleteAllError'` |
| `DeleteAllPartialError` | `'conversationPanel.deleteAllPartialError'` |

### `apps/chat/src/i18n/locales/en.json` — `conversationPanel` object

Add seven new keys:

```json
"panelActionsLabel": "Conversation panel actions",
"deleteAllChatsLabel": "Delete all conversations",
"deleteAllConfirmTitle": "Delete All Conversations?",
"deleteAllConfirmDescription": "All conversations will be permanently deleted. This action cannot be undone.",
"deleteAllConfirmButton": "Delete all",
"deleteAllError": "Failed to delete all conversations. Please try again.",
"deleteAllPartialError": "Some conversations could not be deleted. The list has been refreshed."
```

---

## 5. Accessibility

- `DialIconButton` receives `aria-label={t(ConversationPanelI18nKeys.PanelActionsLabel)}` — localized, never hardcoded English.
- `DialDropdown` manages keyboard opening (Enter/Space on trigger), arrow-key navigation, Escape to close, and focus restoration to the trigger on close. No additional keyboard wiring is needed in the app.
- The trigger button renders as a native `<button>`, ensuring it is focusable, activatable by keyboard, and exposed to screen readers with its computed accessible name.
- `DialConfirmationPopup` is a modal — focus is trapped inside when open and restored to the trigger after closing.
- `disableConfirmButton={isDeletingAll}` prevents double-submission and provides an accessible disabled state during the in-flight request.
- Touch targets: `DialIconButton` inherits at minimum a 44 × 44 px touch target from `@epam/ai-dial-ui-kit` defaults.

---

## 6. RTL support

- `placement="bottom-end"` on `DialDropdown` opens the menu anchored to the logical end edge — this resolves to the left in RTL and the right in LTR, so the menu appears correctly relative to the trigger in both directions.
- The trigger node uses no physical positioning classes.
- `className="fixed bottom-4 start-4 z-50 max-w-sm"` on `DialNotification` uses the logical `start-4` (already used by the existing duplicate-error notification) rather than `left-4`.

---

## 7. Responsive behaviour

- The `headerActions` slot is always visible regardless of panel width or screen size. The `DialIconButton` trigger is small enough (icon-only) not to crowd the header on narrow panels.
- On mobile, the trigger appears to the left of the mobile close button (which is shown when `onToggle` is defined). There is no layout conflict because both are in `rightActions` and `SidebarPanel` places them in a flex row.
- No new `mobile:` / `desktop:` breakpoint classes are needed; the trigger inherits panel header sizing.
- `DialConfirmationPopup` is a centred modal with a fixed max-width — it displays correctly at 360 px, 768 px, 769 px, and 1280 px without additional responsive classes.

---

## 8. State summary

| State variable | Owner | Purpose |
|---|---|---|
| `isDeleteAllPopupOpen` | `ConversationPanelView` | Controls confirmation popup visibility |
| `isDeletingAll` | `ConversationPanelView` | Disables confirm button and shows loading state |
| `deleteAllError` | `ConversationPanelView` | Inline error inside the popup (thrown or total-failure) |
| `deleteAllPartialError` | `ConversationPanelView` | Toast notification for partial failure |

The `ConversationsContext` manages `conversations` list updates (clear on success, re-fetch on partial failure). The view does not reach into `setConversations` directly.

---

## 9. Memoisation requirements

- `panelMenuItems` — `useMemo([t])`: items array is stable across re-renders unless the translation function changes.
- `headerActions` — `useMemo([panelMenuItems, t])`: the `ReactNode` is stable across re-renders.
- `handleConfirmDeleteAll` — `useCallback([deleteAllConversations, activeConversationId, navigate, t])`.
- `handleCancelDeleteAll` — `useCallback([isDeletingAll])`.

These follow the existing memoisation patterns in `ConversationPanelView` (`getActions`, `filterLabels`, `groupLabels`).

---

## 10. Component conventions

- `ConversationPanelView` follows `apps/*` conventions: `Props` interface, `const ComponentName: FC<Props>`, default export `memo(ComponentName)`.
- All event callbacks use `handleEvent` naming inside the component and `onEvent` naming on any props.
- No nested ternaries. The `isTotalFailure` / `isPartialFailure` flags keep the branch logic flat.
- No inline styles; all layout uses Tailwind utility classes.
