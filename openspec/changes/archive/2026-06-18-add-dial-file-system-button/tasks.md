## Slice 1 — Discover and document FileManager API

### 1.1 Read DialFileManager props via ui-kit MCP

Use `getEntityDetails("component", "DialFileManager")` and `getEntityDetails("type", "DialFile")` to confirm the current prop signatures, especially:
- Which props to pass for read-only mode
- The `path` / `onPathChange` controlled navigation contract
- `filesLoading`, `emptyStateTitle`, `emptyStateDescription` availability
- That no `uploadEnabled` / mutation callbacks default to enabled

Record any differences from the design's prop table in design.md before proceeding to Slice 2.

Confirm the `DialFile` shape needed by the local incremental folder-cache adapter.

### 1.2 Verify `add-files-list-api` prerequisite

Check that `apps/chat/src/server-api/files.api.ts` exports `listFiles`, and that `libs/chat-api-client/src/generated/src/apis/FilesApi.ts` contains `filesApi.listFiles(...)`. If missing, note that Slice 2 must use a local stub until the branch is merged.

### 1.3 Verify slice 1

No code changes in this slice. Output: updated design notes if the MCP reveals prop differences.

---

## Slice 2 — Extend `AddAttachmentButton`, `InputProps`, and `ConversationInputProps`

### 2.1 Add `ExtraMenuItem` interface and `extraMenuItems` prop to `AddAttachmentButton`

In `libs/conversation-input/src/components/AddAttachmentButton/AddAttachmentButton.tsx`:

1. Define `ExtraMenuItem` interface inline (key, label, icon, onClick) above `AddAttachmentButtonProps`.
2. Add `extraMenuItems?: ExtraMenuItem[]` to `AddAttachmentButtonProps` (with JSDoc).
3. Update the `menuItems` `useMemo` to spread `extraMenuItems ?? []` after the default item.
4. Update `useMemo` dependency array to include `extraMenuItems`.

Architecture guard: `ExtraMenuItem` MUST NOT reference any type from `@epam/chat-api-client`, `apps/chat/src/server-api`, i18n, routing, or auth utilities.

### 2.2 Add `onDialFileSystemClick` and `dialFileSystemLabel` to `InputProps`

In `libs/conversation-input/src/models/Input.ts`:
- Add `onDialFileSystemClick?: () => void` with JSDoc.
- Add `dialFileSystemLabel?: string` with JSDoc (default note: `'DIAL file system'`).

### 2.3 Forward new props through `Input.tsx` to `AddAttachmentButton`

In `libs/conversation-input/src/components/Input/Input.tsx`:
1. Destructure `onDialFileSystemClick` and `dialFileSystemLabel` from props.
2. Build `dialFileSystemMenuItem` with `useMemo`:
   ```ts
   const dialFileSystemMenuItem = useMemo(
     () =>
       onDialFileSystemClick
         ? [{ key: 'dial-fs', label: dialFileSystemLabel ?? 'DIAL file system', icon: <IconFile size={BASE_ICON_SIZE} aria-hidden />, onClick: onDialFileSystemClick }]
         : [],
     [onDialFileSystemClick, dialFileSystemLabel],
   );
   ```
3. Pass `extraMenuItems={dialFileSystemMenuItem}` to `<AddAttachmentButton />`.

Import `IconFile` from `@tabler/icons-react`.

### 2.4 Add `onDialFileSystemClick` and `dialFileSystemLabel` to `ConversationInputProps` and forward through `ConversationInput`

In `libs/conversation-input/src/models/ConversationInput.ts`:
- Add the same two optional props with JSDoc.

In `libs/conversation-input/src/components/ConversationInput/ConversationInput.tsx`:
- Destructure and forward both props to `<Input />`.

### 2.5 Unit tests for `AddAttachmentButton` with extra items

In `libs/conversation-input/src/components/AddAttachmentButton/tests/AddAttachmentButton.spec.tsx` (create or extend):
- Renders only "Attach file" when `extraMenuItems` is absent.
- Renders "Attach file" + extra item label when `extraMenuItems` has one entry.
- Clicking the extra item calls its `onClick`.

### 2.6 Verify slice 2

```sh
npm exec nx lint conversation-input
npm exec nx typecheck conversation-input
npm exec nx test conversation-input
```

---

## Slice 3 — Implement `useDialFileManager` hook

### 3.1 Create `apps/chat/src/hooks/files/useDialFileManager.ts`

Implement the hook per the design:

```ts
/**
 * Manages DIAL file-storage browsing state for DialFileManager.
 * Fetches one folder at a time via listFiles and converts the flat response
 * into a DialFile hierarchy while retaining previously loaded folders.
 * Exposes read-only props for DialFileManager; no mutation callbacks.
 */
export const useDialFileManager = ({ bucket, rootLabel = 'All files' }: UseDialFileManagerOptions): UseDialFileManagerResult => { ... }
```

- `useEffect` with `cancelled` flag and `retryCounter` dependency.
- On success: store the response under `folderPath` and rebuild the accumulated hierarchy.
- On failure: `setError('dialFileManager.error')`.
- `onPathChange` strips the virtual root prefix; uses `useCallback`.
- `retry` increments `retryCounter`; uses `useCallback`.
- JSDoc on the exported function explaining WHY the cancelled flag is needed.

If `listFiles` is not yet available (Slice 1.2 found it missing), implement with a typed stub:
```ts
const listFiles = (_params: unknown): Promise<{ items: ListFilesItemDto[] }> =>
  Promise.resolve({ items: [] });
```
Replace the stub when `add-files-list-api` is merged.

### 3.2 Unit tests for `useDialFileManager`

Create `apps/chat/src/hooks/files/tests/useDialFileManager.spec.tsx`:

- **Initial load**: renders with `isLoading: true`, resolves to `items` and `isLoading: false`.
- **Empty folder**: resolves to `items: []` with `isLoading: false` and `error: null`.
- **Load error**: `listFiles` rejects → `error` is set, `isLoading: false`.
- **Retry**: calling `retry()` triggers a new `listFiles` call; after success, `error` clears.
- **Folder navigation via `onPathChange`**: calling `onPathChange('/All files/reports/')` sets `folderPath` to `"reports/"` and triggers a new fetch.
- **Unmount during fetch**: unmounting sets `cancelled = true`; no `setState` called after resolve.
- **`onPathChange` root reset**: `onPathChange('/All files')` resets `folderPath` to `""`.

All tests mock `listFiles`; no live BFF calls.

### 3.3 Verify slice 3

```sh
npm exec nx lint chat
npm exec nx typecheck chat
npm exec nx test chat
```

---

## Slice 4 — Implement `DialFileManagerModal` component

### 4.1 Create `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`

```ts
interface Props {
  isOpen: boolean;
  onClose: () => void;
  bucket: string;
  title: string;
  onAttach: (files: DialFile[]) => void;
  attachLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  errorMessage: string;
  retryLabel: string;
}

const DialFileManagerModal: FC<Props> = (...) => {
  const { items, isLoading, error, path, onPathChange, retry } = useDialFileManager({ bucket });
  return (
    <DialPopup open={isOpen} header={title} size={PopupSize.Lg} onClose={onClose}>
      {error != null ? (
        <div role="alert" className="flex flex-col items-center gap-4 p-6">
          <p>{errorMessage}</p>
          <DialButton onClick={retry}>{retryLabel}</DialButton>
        </div>
      ) : (
        <DialFileManager
          items={items}
          path={path}
          onPathChange={onPathChange}
          filesLoading={isLoading}
          emptyStateTitle={emptyTitle}
          emptyStateDescription={emptyDescription}
          uploadEnabled={false}
        />
      )}
    </DialPopup>
  );
};

export default memo(DialFileManagerModal);
```

Import `DialPopup`, `PopupSize`, `DialFileManager`, `DialButton` from `@epam/ai-dial-ui-kit`.
All directional Tailwind classes in the modal body must use logical properties.

Architecture guard: `DialFileManagerModal` MUST NOT import `listFiles`, `filesApi`, `@epam/chat-api-client`, `useTranslation`, routing helpers, auth utilities, or storage keys. Server-api calls live entirely in `useDialFileManager`.

### 4.2 Unit tests for `DialFileManagerModal`

Create `apps/chat/src/components/DialFileManagerModal/tests/DialFileManagerModal.spec.tsx`:

- Renders `DialPopup` with title "DIAL file system" when `isOpen={true}`.
- Renders error card with `role="alert"` and retry button when `useDialFileManager` returns `error != null`.
- Calls `retry` when the retry button is clicked.
- Renders `DialFileManager` when `useDialFileManager` returns `error: null`.
- Calls `onClose` when the popup close button is clicked.
- Does NOT render when `isOpen={false}`.

Mock `useDialFileManager` in tests.

### 4.3 Verify slice 4

```sh
npm exec nx lint chat
npm exec nx typecheck chat
npm exec nx test chat
```

---

## Slice 5 — Wire button and modal into `ConversationView`

### 5.1 Add modal state and bucket resolution to `ConversationView`

In `apps/chat/src/components/ConversationView/ConversationView.tsx`:

1. Add `const [isDialFileManagerOpen, setIsDialFileManagerOpen] = useState(false);`.
2. Resolve `bucket`: determine the correct source (e.g., user auth context or profile endpoint). Document the source in a comment if non-obvious.
3. Pass to `<ConversationInput>`:
   ```tsx
   onDialFileSystemClick={() => setIsDialFileManagerOpen(true)}
   dialFileSystemLabel={t(ConversationI18nKeys.AttachMenuDialFileSystem)}
   ```
4. Lazy-load `DialFileManagerModal`:
   ```ts
   const DialFileManagerModal = lazy(async () => {
     const module = await import('@/components/DialFileManagerModal/DialFileManagerModal');
     return { default: module.default };
   });
   ```
5. Render adjacent to `<ConversationInput>`:
   ```tsx
   <Suspense fallback={null}>
     {isDialFileManagerOpen && (
       <DialFileManagerModal
         isOpen={isDialFileManagerOpen}
         onClose={() => setIsDialFileManagerOpen(false)}
         bucket={bucket}
         title={t(DialFileManagerI18nKeys.Title)}
         onAttach={handleAttachDialFiles}
         attachLabel={t(DialFileManagerI18nKeys.Attach)}
         emptyTitle={t(DialFileManagerI18nKeys.Empty)}
         emptyDescription=""
         errorMessage={t(DialFileManagerI18nKeys.Error)}
         retryLabel={t(DialFileManagerI18nKeys.Retry)}
       />
     )}
   </Suspense>
   ```

### 5.2 Verify existing attach behavior is unmodified

Confirm `onUploadAttachment`, `onAttachmentsChange`, and the existing props passed to `<ConversationInput>` are unchanged. Run the existing `ConversationRoute.spec.tsx` test to validate no regressions.

### 5.3 Verify slice 5

```sh
npm exec nx lint chat
npm exec nx typecheck chat
npm exec nx test chat
```

---

## Slice 6 — Add i18n keys and translation constants

### 6.1 Add keys to `apps/chat/src/i18n/locales/en.json`

Under `"conversation"`:
```json
"attachMenuDialFileSystem": "DIAL file system"
```

Under a new top-level `"dialFileManager"` object:
```json
"dialFileManager": {
  "title": "DIAL file system",
  "empty": "This folder is empty",
  "error": "Failed to load files",
  "retry": "Retry"
}
```

### 6.2 Add i18n key constants

In the relevant `apps/chat/src/constants/translation-keys.ts` enum (or create `DialFileManagerI18nKeys` and extend `ConversationI18nKeys`):
- `ConversationI18nKeys.AttachMenuDialFileSystem = 'conversation.attachMenuDialFileSystem'`
- `DialFileManagerI18nKeys.Title = 'dialFileManager.title'`
- `DialFileManagerI18nKeys.Empty = 'dialFileManager.empty'`
- `DialFileManagerI18nKeys.Error = 'dialFileManager.error'`
- `DialFileManagerI18nKeys.Retry = 'dialFileManager.retry'`

### 6.3 Verify slice 6

```sh
npm exec nx lint chat
npm exec nx typecheck chat
```

---

## Slice 7 — RTL and responsive verification

### 7.1 Audit `DialFileManagerModal` for physical Tailwind classes

Run `grep -n 'ml-\|mr-\|pl-\|pr-\|text-left\|text-right\|left-\|right-\|border-l-\|border-r-\|rounded-l-\|rounded-r-' apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx` and replace any found with logical equivalents per `.claude/rules/rtl.md`.

### 7.2 Audit `AddAttachmentButton` changes

Run the same grep on the changed lines in `libs/conversation-input/src/components/AddAttachmentButton/AddAttachmentButton.tsx`. No physical directional class should be added.

### 7.3 Verify `IconFile` does not need RTL mirroring

`IconFile` has no left/right navigation meaning. Confirm no `rtl:scale-x-[-1]` is needed.

### 7.4 Verify slice 7

```sh
npm exec nx lint chat
npm exec nx lint conversation-input
```

---

## Slice 8 — Final full-project verification

```sh
npm exec nx lint  conversation-input
npm exec nx typecheck conversation-input
npm exec nx test  conversation-input

npm exec nx lint  chat
npm exec nx typecheck chat
npm exec nx test  chat

npm exec nx affected --target=lint      --base=origin/development-1.0
npm exec nx affected --target=typecheck --base=origin/development-1.0
npm exec nx affected --target=test      --base=origin/development-1.0
npm exec nx affected --target=build     --base=origin/development-1.0
```

No slice is complete while any of these is red for a project it touches.

---

## Slice 9 — Complete file selection and attach integration

### 9.1 Match legacy modal height and file icon

- Set `DialPopup` height in `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx` to `h-[min(800px,100dvh)]`.
- Keep the file manager body flexible with `h-full min-h-0` so its internal grid owns scrolling.
- Replace the attachment menu's folder icon with `IconFile`.

### 9.2 Enable file-only multi-selection

- Control `selectedPaths` in `DialFileManagerModal`.
- Use `GridSelectionMode.MULTIPLE`.
- Reject folder rows through `isRowSelectable`.
- Add an i18n "Attach" footer button and return selected `DialFile[]` through `onAttach`.

### 9.3 Convert and deliver selected files at the app edge

- Add `apps/chat/src/utils/dial-file-to-attachment.ts`.
- Convert selected files to already-uploaded generic `Attachment` values in `ConversationRoute` and `ConversationView`.
- Add generic `pendingAttachments` / `onPendingAttachmentsConsumed` props to `libs/conversation-input`.
- Insert pending attachments without invoking upload; deduplicate by attachment ID.

Architecture guard: `libs/conversation-input` must not import `DialFile`, bucket/path helpers, server-api clients, app contexts, or download route logic.

### 9.4 Verify slice 9

```sh
npm exec nx test @epam/ai-dial-conversation-input
npm exec nx typecheck @epam/ai-dial-conversation-input
npm exec nx lint @epam/ai-dial-conversation-input
npm exec nx test @epam/chat
npm exec nx typecheck @epam/chat
npm exec nx lint @epam/chat
```
