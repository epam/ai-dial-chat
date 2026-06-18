## Why

The `add-files-list-api` change adds `GET /api/v1/files/list`, a BFF endpoint that proxies DIAL Core file-storage metadata. Without a UI surface consuming it, the new API is unused. Users have no way to browse and attach their existing DIAL-hosted files from within the chat input — the current "Attach files" action only opens a device file picker. A selection-enabled browser with no file-management mutations is the minimal, reversible integration.

## What Changes

- Extend `AddAttachmentButton` in `libs/conversation-input` with a generic `extraMenuItems` prop so the host app can inject additional menu entries without embedding app knowledge in the lib.
- Extend `InputProps` and `ConversationInputProps` with `onDialFileSystemClick?: () => void` and `dialFileSystemLabel?: string` props. `Input.tsx` passes these as an extra menu item to `AddAttachmentButton`.
- Add `useDialFileManager` hook in `apps/chat/src/hooks/files/useDialFileManager.ts` that fetches from `listFiles`, manages `folderPath` and loading/error state, and returns `DialFileManager`-compatible props.
- Add `DialFileManagerModal` component in `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx` that wraps `DialPopup` + `DialFileManager`, supports multi-file selection, and returns selected files to the app layer.
- Convert selected DIAL files to already-uploaded `Attachment` values at the app edge and pass them into the host-agnostic conversation input through generic `pendingAttachments` props.
- Wire the button and modal into `apps/chat/src/components/ConversationView/ConversationView.tsx`.
- Add i18n keys under `dialFileManager.*` and `conversation.attachMenuDialFileSystem` to `apps/chat/src/i18n/locales/en.json`.

## Capabilities

### New Capabilities

- `dial-file-system-browser`: The chat attachment menu gains a "DIAL file system" entry. Clicking it opens a modal that displays the authenticated user's DIAL-hosted files via the BFF `listFiles` wrapper. Users can navigate folders, select files, and attach the selection to the message draft. All file-management mutation actions (upload, download, delete, rename, copy, move) are absent.

### Modified Capabilities

- `attach-files-menu`: The existing "Attach file" menu entry is unchanged. The menu gains one additional item via the generic `extraMenuItems` extension. The original `onAttachClick` wiring is not modified.

## Non-goals

- Upload, download, delete, rename, move, copy, folder creation, permissions editing — deferred.
- Multi-bucket navigation or bucket picker — deferred; first slice uses a single bucket passed from the app layer.
- Caching file listings at the BFF or frontend layer.
- Recursive pre-fetch of the entire file tree.
- Feature-flag gating — the button is always visible to authenticated users in this slice (no `ENABLED_FEATURES` key assigned yet).

## Acceptance Criteria

1. A "DIAL file system" item appears in the `+` attachment menu next to "Attach file" on both mobile (bottom sheet) and desktop (dropdown).
2. Clicking the item opens a modal with title "DIAL file system".
3. The modal renders `DialFileManager` displaying files from `GET /api/v1/files/list`.
4. Navigating into a subfolder fetches that folder's contents and updates the displayed path.
5. A loading skeleton is shown while files are fetching.
6. An empty-folder state is shown when the folder has no items.
7. An error state is shown on fetch failure; a retry button re-runs the fetch.
8. Files can be selected in the grid; folders cannot be selected for attachment.
9. Clicking "Attach" closes the modal and adds the selected files to the existing message attachment tray without uploading them again.
10. Closing the modal without attaching leaves the message text and local attachment list unmodified.
11. No mutation action (upload / delete / rename / move / copy / download) is rendered in the modal.
12. The modal uses the legacy file-manager height contract: `min(800px, 100dvh)`.
13. All user-visible strings are resolved via `t()` with keys from `en.json`.
14. The modal is responsive on mobile and desktop; RTL layouts are correct.
15. `npm exec nx lint chat`, `npm exec nx typecheck chat`, `npm exec nx test chat` pass.
16. `npm exec nx lint @epam/ai-dial-conversation-input`, `npm exec nx test @epam/ai-dial-conversation-input` pass.

## Alternatives Considered

- **Standalone icon button** — rejected; a second icon button on the input's action row overloads the layout and creates inconsistent mobile UX. The existing `+` dropdown is the canonical attach-action hub.
- **New button outside the input** — rejected; all attachment-related actions belong in the `+` menu so users have one discoverable entry point.
- **Passing DIAL paths or API clients into `libs/conversation-input`** — rejected; the app converts selected files into the existing generic `Attachment` contract before crossing the library boundary.
- **`DialFormPopup` for the modal** — rejected; `DialFormPopup` forces a submit/cancel footer, which is semantically wrong for a read-only browser. `DialPopup` provides a close-only header and arbitrary body.

## Rollback / Backward Compatibility

Purely additive. `extraMenuItems`, `pendingAttachments`, and their consumed callbacks are optional, so existing consumers render identically. Removing the feature requires deleting the modal, conversion utility, and optional props — no existing interface needs a breaking change.

## Closest Existing Files

- `libs/conversation-input/src/components/AddAttachmentButton/AddAttachmentButton.tsx:45` — `menuItems` array pattern; `extraMenuItems` merges into it
- `libs/conversation-input/src/components/Input/Input.tsx:467` — `AddAttachmentButton` usage; `onDialFileSystemClick` forwarded here
- `apps/chat/src/components/RenameConversationPopup/RenameConversationPopup.tsx` — `DialPopup`-family modal pattern (this change uses `DialPopup` directly)
- `apps/chat/src/server-api/files.api.ts` — `listFiles` wrapper added in `add-files-list-api`; consumed by `useDialFileManager`
- `apps/chat/src/components/ConversationView/ConversationView.tsx:48` — `ConversationInput` lazy-load and prop-forwarding pattern; modal state and `onDialFileSystemClick` wired here

## i18n Impact

New keys introduced under two domains:

| Key | English value |
|-----|---------------|
| `conversation.attachMenuDialFileSystem` | `"DIAL file system"` |
| `dialFileManager.title` | `"DIAL file system"` |
| `dialFileManager.attach` | `"Attach"` |
| `dialFileManager.empty` | `"This folder is empty"` |
| `dialFileManager.error` | `"Failed to load files"` |
| `dialFileManager.retry` | `"Retry"` |

## Scope Creep Note

`AddAttachmentButton` accepts generic extra menu items, and `Input` accepts generic already-uploaded `Attachment` values. No API path, endpoint client, bucket lookup, auth context, or DIAL file model enters the lib. `ConversationRoute` / `ConversationView` convert selected `DialFile` values at the app edge and pass only resolved attachments and callbacks across the boundary.
