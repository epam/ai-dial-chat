## Context

This design adds a selection-enabled DIAL file-browser modal reachable from the chat input's attachment menu. File-management mutations remain disabled. All NestJS conventions, RTL rules, library isolation rules, and TypeScript conventions are governed by `AGENTS.md`, `.claude/rules/*.md`, and `apps/chat-api/AGENTS.md` — they are not repeated here.

---

## Button Placement and Interaction Flow

`AddAttachmentButton` currently renders a single "Attach file" menu item. It is extended with a generic `extraMenuItems` prop whose elements are merged after the existing `attachLabel` item. The host `Input.tsx` passes a "DIAL file system" extra item when `onDialFileSystemClick` is provided.

```
User clicks + → menu/bottom-sheet opens
  ├── "Attach file" (existing)    → fileInputRef.current?.click()
  └── "DIAL file system" (new)   → onDialFileSystemClick?.()
```

On desktop the menu is a `DialDropdown`. On mobile it is the `BottomSheet`. Both surfaces iterate over the merged `menuItems` array, so the extra item appears in both without branching in the app layer.

State for the modal (`isDialFileManagerOpen`) lives in `ConversationView`. `ConversationView` renders `DialFileManagerModal` adjacent to the `ConversationInput` lazy component.

---

## `AddAttachmentButton` Extension

**File**: `libs/conversation-input/src/components/AddAttachmentButton/AddAttachmentButton.tsx`

Add one optional prop:

```ts
interface ExtraMenuItem {
  /** Unique key for the item. */
  key: string;
  /** Display label. */
  label: string;
  /** Icon node rendered to the left of the label. */
  icon: ReactNode;
  /** Callback when the item is selected. */
  onClick: () => void;
}

interface AddAttachmentButtonProps {
  // ...existing props...
  /** Additional menu items appended after "Attach file". */
  extraMenuItems?: ExtraMenuItem[];
}
```

`menuItems` is now:

```ts
const menuItems = useMemo(
  () => [
    { key: 'attach', label: attachLabel, icon: <IconPaperclip ... />, onClick: onAttachClick },
    ...(extraMenuItems ?? []),
  ],
  [attachLabel, onAttachClick, extraMenuItems],
);
```

Library isolation: `ExtraMenuItem` carries no server-api knowledge. The app resolves label strings and callbacks before passing them in.

---

## `InputProps` / `ConversationInputProps` Extension

**File**: `libs/conversation-input/src/models/Input.ts` (`InputProps`)
**File**: `libs/conversation-input/src/models/ConversationInput.ts` (`ConversationInputProps`)

Two new optional props added to each:

```ts
/** Called when user selects "DIAL file system" from the attach menu. When absent, the menu item is not rendered. */
onDialFileSystemClick?: () => void;
/** Label for the "DIAL file system" menu item. Defaults to `'DIAL file system'`. */
dialFileSystemLabel?: string;
```

`Input.tsx` maps these to `extraMenuItems` on `AddAttachmentButton`:

```ts
const dialFileSystemMenuItem = useMemo(
  () =>
    onDialFileSystemClick
      ? [{ key: 'dial-fs', label: dialFileSystemLabel ?? 'DIAL file system', icon: <IconFile size={BASE_ICON_SIZE} aria-hidden />, onClick: onDialFileSystemClick }]
      : [],
  [onDialFileSystemClick, dialFileSystemLabel],
);
```

`ConversationInput.tsx` forwards both props to `Input`.

Icon: `IconFile` from `@tabler/icons-react`, matching the action's purpose: attaching a file rather than opening a folder.

---

## `useDialFileManager` Hook

**File**: `apps/chat/src/hooks/files/useDialFileManager.ts`

### Responsibilities

- Accept `bucket: string` and optional `rootLabel: string`.
- Maintain `folderPath: string` state (path within the bucket; `""` = root).
- Fetch items via `listFiles({ bucket, path: folderPath })` inside `useEffect` with a `cancelled` flag.
- Maintain `isLoading: boolean` and `error: string | null` state.
- Store each visited folder response in a path-keyed cache and rebuild the accumulated `DialFile[]` hierarchy from that cache.
- Handle `onPathChange` from `DialFileManager`: strip the virtual root prefix and update `folderPath`.
- Expose a `retry` callback that re-runs the current fetch.

### Public API

```ts
interface UseDialFileManagerOptions {
  /** DIAL Core bucket to browse. */
  bucket: string;
  /** Display name for the root folder node. Defaults to `'All files'`. */
  rootLabel?: string;
}

interface UseDialFileManagerResult {
  /** Hierarchical items for DialFileManager's `items` prop. */
  items: DialFile[];
  /** True while the current folder is loading. */
  isLoading: boolean;
  /** Non-null when the last fetch failed. */
  error: string | null;
  /** Current path in DialFileManager format (e.g. `"/All files"`, `"/All files/reports/"`). */
  path: string;
  /** Pass directly to DialFileManager's `onPathChange`. */
  onPathChange: (nextPath?: string) => void;
  /** Re-runs the fetch for the current `folderPath`. */
  retry: () => void;
}
```

### Path Mapping

`DialFileManager` uses a single slash-delimited path string starting with `/`. The hook maintains a virtual root segment built from `rootLabel` (default `"All files"`). The mapping is:

| `folderPath` (BFF) | `path` (DialFileManager) |
|--------------------|--------------------------|
| `""` (root) | `"/All files"` |
| `"reports/"` | `"/All files/reports/"` |
| `"reports/q1/"` | `"/All files/reports/q1/"` |

When `onPathChange(nextPath)` fires, the hook strips the `"/All files"` prefix (or `/` prefix) and uses the remainder as the new `folderPath`. If `nextPath` is undefined or equals the root label path, `folderPath` resets to `""`.

### Fetch Pattern

```ts
useEffect(() => {
  let cancelled = false;
  setIsLoading(true);
  setError(null);

  listFiles({ bucket, path: folderPath })
    .then(({ items: flat }) => {
      if (cancelled) return;
      setCache((previous) => new Map(previous).set(folderPath, flat));
    })
    .catch(() => {
      if (cancelled) return;
      setError('dialFileManager.error'); // i18n key; modal resolves it via t()
    })
    .finally(() => {
      if (!cancelled) setIsLoading(false);
    });

  return () => { cancelled = true; };
}, [bucket, folderPath, retryCounter]);
```

`retryCounter` is a `number` incremented by `retry()` to re-trigger the effect without changing `folderPath`.

### Selection and No Mutation Logic

The hook exposes no upload, delete, move, copy, or rename callbacks. The modal enables `GridSelectionMode.MULTIPLE`, keeps `selectedPaths` controlled, and filters selection to `DialFileNodeType.ITEM` rows. The `DialFileManager` receives no file-management mutation callbacks.

---

## `DialFileManagerModal` Component

**File**: `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`

Wraps `DialPopup` + `DialFileManager`. Receives `isOpen`, `onClose`, `bucket`, and label strings as props.

```tsx
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
```

### Modal Behavior

- `DialPopup` with `size={PopupSize.Lg}`, `header={title}`, and an important `!h-[min(800px,100dvh)]` height override to beat the ui-kit's desktop `height: auto`, match the legacy modal's capped 800px height, and prevent row-count-driven resizing.
- The popup and `DialFileManager` use `bg-layer-sunken`.
- The ui-kit popup body (`[aria-label='popup-description']`) is overridden to `flex min-h-0 flex-col`. Inside it, the file-manager wrapper and `DialFileManager` use `grow`, reproducing the legacy `flex column → grow file-manager area` layout while keeping scrolling inside that area.
- `DialFileManager` receives `gridClassName="size-full"` and AG Grid `domLayout: 'normal'`. The ui-kit grid otherwise sizes itself from its rows (`autoHeight`), leaving unused modal space below short listings.
- The footer uses `px-6 py-4`, matching the ui-kit's standard popup action spacing.
- On mobile the modal occupies most of the viewport (handled by `DialPopup` size classes).
- The modal body contains either:
  - `DialFileManager` (when not in error state)
  - An error card with message + retry button (when `error != null`)
- `filesLoading` is forwarded to `DialFileManager` which renders a skeleton overlay.
- `emptyStateTitle` and `emptyStateDescription` are forwarded for the empty-folder state.
- The footer renders an "Attach" primary button, disabled until at least one file is selected.
- `DialPopup`'s `onClose` triggers `onClose` without changing the draft.
- Clicking "Attach" returns selected file items through `onAttach`.

### FileManager Prop Mapping (Read-only)

| `DialFileManager` prop | Source |
|------------------------|--------|
| `items` | `useDialFileManager().items` |
| `path` | `useDialFileManager().path` |
| `onPathChange` | `useDialFileManager().onPathChange` |
| `filesLoading` | `useDialFileManager().isLoading` |
| `selectedPaths` | modal-local controlled `Set<string>` |
| `onSelectedPathsChange` | modal-local setter |
| `gridOptions.selectionMode` | `GridSelectionMode.MULTIPLE` |
| `emptyStateTitle` | prop `emptyTitle` (i18n resolved by modal) |
| `emptyStateDescription` | prop `emptyDescription` (i18n resolved by modal) |
| `uploadEnabled` | `false` |
| `onUploadFiles` | omitted |
| `onDeleteFiles` | omitted |
| `onMoveToFiles` | omitted |
| `onCopyFiles` | omitted |
| `onDownloadFiles` | omitted |
| `onCreateFolder` | omitted |
| `onRenameValidate` | omitted |
| `onManagePermissions` | omitted |

### Error State

When `error != null`, the modal body renders:

```tsx
<div role="alert" className="flex flex-col items-center gap-4 p-6">
  <p>{errorMessage}</p>
  <DialButton onClick={retry}>{retryLabel}</DialButton>
</div>
```

`useDialFileManager` is still mounted; `retry()` re-triggers the fetch. The `DialFileManager` is not rendered during the error state (avoid rendering stale items under an error banner).

---

## State Ownership

| State | Owner | Rationale |
|-------|-------|-----------|
| `isDialFileManagerOpen` | `ConversationView` | Modal open/close is a page-level concern; no need for context |
| `folderPath`, `items`, `isLoading`, `error` | `useDialFileManager` | Co-located fetch lifecycle per the `useFavicon` pattern |
| `retryCounter` | `useDialFileManager` | Triggers re-fetch without path change |
| `selectedPaths` | `DialFileManagerModal` | Selection is scoped to one modal session |
| `pendingDialAttachments` | `ConversationRoute` / `ConversationView` | App owns conversion from DIAL files to generic attachments |
| `attachments`, message text | `ConversationInput` / `Input` (lib) | Input merges generic pending attachments into its local tray |

## Attaching Selected DIAL Files

`apps/chat/src/utils/dial-file-to-attachment.ts` converts selected `DialFile` items into the existing `Attachment` model. It preserves a returned `files/{bucket}/{path}` URL when available, otherwise constructs one from the authenticated bucket and item path. Images receive a resolved preview URL.

The app passes the converted list through `pendingAttachments` and clears it through `onPendingAttachmentsConsumed`. `Input` inserts these attachments without calling `onUploadAttachment`, because they already exist in DIAL storage. Duplicate attachment IDs are ignored.

`useDialFileManager` is not placed in a React Context because its state is scoped to the single modal instance. If multiple surfaces need concurrent file-browser state, a context wrapper can be added later.

---

## `ConversationView` Wiring

```tsx
const [isDialFileManagerOpen, setIsDialFileManagerOpen] = useState(false);
const bucket = /* derived from user session / auth context */;

<ConversationInput
  ...existingProps
  onDialFileSystemClick={() => setIsDialFileManagerOpen(true)}
  dialFileSystemLabel={t(ConversationI18nKeys.AttachMenuDialFileSystem)}
/>

{isDialFileManagerOpen && (
  <DialFileManagerModal
    isOpen={isDialFileManagerOpen}
    onClose={() => setIsDialFileManagerOpen(false)}
    onAttach={handleAttachDialFiles}
    bucket={bucket}
    title={t(DialFileManagerI18nKeys.Title)}
    attachLabel={t(DialFileManagerI18nKeys.Attach)}
    emptyTitle={t(DialFileManagerI18nKeys.Empty)}
    emptyDescription=""
    errorMessage={t(DialFileManagerI18nKeys.Error)}
    retryLabel={t(DialFileManagerI18nKeys.Retry)}
  />
)}
```

The `bucket` value is resolved at the app layer. Its derivation (from auth context, user profile API, or env) is outside this change's scope; the implementation task documents the actual source. `DialFileManagerModal` receives only a resolved string, preserving lib isolation.

`DialFileManagerModal` is lazy-loaded with `React.lazy` + `Suspense` (same pattern as other `ConversationView` lazy imports).

---

## Server API Usage

`useDialFileManager` calls `listFiles` from `apps/chat/src/server-api/files.api.ts`, which delegates to `filesApi.listFiles(...)` from the generated `@epam/chat-api-client`. No `fetch` calls, no `base.ts` helpers, no direct `/api/v1/files/list` string in frontend code.

The hook deliberately does not use `convertFlatToHierarchical`: folder responses arrive incrementally, while the file manager needs previously loaded ancestors and siblings to remain in the tree. `buildFromCache` maps each cached `ListFilesItemDto` to `DialFile`, preserves `url`, and recursively joins cached child folders.

**Dependency**: `listFiles` in `files.api.ts` and the generated `filesApi.listFiles` method are introduced by the `add-files-list-api` change. This change depends on that change being merged and the OpenAPI client regenerated before implementing Slice 2 onward.

---

## Library Isolation Note

`libs/conversation-input` is extended with:
- `ExtraMenuItem` interface (key, label, icon, onClick — no server-api knowledge)
- `extraMenuItems?: ExtraMenuItem[]` prop on `AddAttachmentButton`
- `onDialFileSystemClick?: () => void` and `dialFileSystemLabel?: string` on `InputProps` / `ConversationInputProps`
- `pendingAttachments?: Attachment[]` and `onPendingAttachmentsConsumed?: () => void` for generic already-uploaded attachments

No API paths, generated client imports, auth utilities, i18n keys, routing helpers, or app contexts enter the lib. The app resolves the label via `t()` and passes the resolved string. The app resolves the bucket and provides a callback. `ExtraMenuItem.icon` is a `ReactNode` — the app decides which icon to render.

`apps/chat` imports `@epam/chat-api-client` (via `server-api/files.api.ts`), `@epam/ai-dial-ui-kit` (`DialFileManager`, `DialPopup`, `DialFile`), and the new `useDialFileManager` hook. These imports do not cross into any lib.

---

## Loading / Empty / Error / Retry States

| State | Trigger | UI |
|-------|---------|----|
| Loading | `isLoading === true` | `filesLoading={true}` on `DialFileManager` → built-in skeleton |
| Empty | `items.length === 0 && !isLoading && !error` | `emptyStateTitle` / `emptyStateDescription` on `DialFileManager` |
| Error | `error != null` | Error card replaces `DialFileManager`; retry button visible |
| Success | `items.length > 0 && !isLoading && !error` | `DialFileManager` with file grid |

Initial mount always triggers the loading state before the first fetch resolves.

---

## Accessibility Requirements

- `DialPopup` provides a modal `role="dialog"` with `aria-labelledby` pointing at the title — no extra ARIA needed on the container.
- The error card uses `role="alert"` so screen readers announce the failure immediately.
- The retry button is a focusable `DialButton` with a visible label (not icon-only).
- Focus is trapped inside `DialPopup` while open (built-in).
- `DialFileManager` navigation (tree sidebar, breadcrumbs, file grid rows) uses the ui-kit's built-in keyboard support.

---

## RTL / Responsive Requirements

- All directional Tailwind classes in the modal and hook-driven UI use logical equivalents (`ms-*`, `ps-*`, `start-*`, `text-start`) per `.claude/rules/rtl.md`.
- `DialPopup` and `DialFileManager` use ui-kit's built-in RTL support via `dir="rtl"` on `<html>` — no extra mirroring needed in the modal body.
- No physical `left-*` / `right-*` classes in `DialFileManagerModal`.
- Responsive breakpoints: `DialPopup` uses `size={PopupSize.Lg}` which renders full-width on small screens and a centered max-width dialog on larger ones.
- Project Tailwind breakpoints (`mobile`, `desktop`) are used for any custom responsive overrides; `sm:` / `md:` / `lg:` / `xl:` are not introduced.

---

## Generated-client Dependency on `add-files-list-api`

`useDialFileManager` imports `listFiles` from `apps/chat/src/server-api/files.api.ts`. That wrapper was introduced in the `add-files-list-api` change. Before implementing Slice 2 (hook), confirm:

1. `listFiles` exists in `apps/chat/src/server-api/files.api.ts`.
2. `filesApi.listFiles(...)` exists in `libs/chat-api-client/src/generated/src/apis/FilesApi.ts`.
3. `ListFilesResponseDto` and `ListFilesItemDto` exist in the generated models.

If the `add-files-list-api` tasks are not yet merged, implement the hook behind a local stub and swap in the real wrapper when the branch lands.
