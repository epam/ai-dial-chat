## Why

GitHub issue [#7772](https://github.com/epam/ai-dial-chat/issues/7772): after a destination folder in the Move/Copy popup is successfully loaded and found to be empty, its disclosure caret remains visible. The popup can therefore suggest that the empty folder still has undiscovered children, because `useDialFileListing` currently derives `loadedPaths` only from the outer tree's expanded paths and the host does not pass popup loading state through `treeOptions`.

The closest existing behavior is the cache-backed tree loading in `libs/chat-hooks/src/files/useDialFileListing/useDialFileListing.ts:460` and the File Manager adapter in `apps/chat/src/components/DialFileManagerShell/DialFileManagerShell.tsx:291`.

## What Changes

- Track destination-popup folder paths in `useDialFileListing` and include a path in `loadedPaths` once its listing exists in the shared cache, including a successful empty listing.
- Preserve the exact `DialFile.path` representation, including the trailing slash on non-root folder paths, so `loadedPaths` and `folderPopupLoadingPaths` match the File Manager tree's strict path lookup.
- Pass `folderPopupLoadingPaths` to `DialFileManager` as `treeOptions.loadingPaths`; continue passing the derived `loadedPaths` through the same adapter.
- Upgrade `@epam/ai-dial-react-file-manager` from `0.2.0-dev.3` to `0.2.0-dev.7`, the published version that forwards `treeOptions.loadedPaths` and `treeOptions.loadingPaths` into the destination popup.
- Cover the pending, successful-empty, concurrent outer-tree load, and shell pass-through behavior with regression tests.
- Align the public hook documentation and tree-state specification with the cache-derived state.

### Non-goals

- No change to folder-listing endpoints, cache keys, permissions, Move/Copy operations, or File Manager navigation.
- No new user-visible strings, feature flags, analytics, or host-specific integration inside `libs/chat-hooks`.
- No redesign of the File Manager tree or disclosure icon.

### Acceptance criteria

- While a destination folder is loading, its exact virtual path is present in `folderPopupLoadingPaths` and is forwarded to the popup tree.
- After a successful listing, including `items: []`, the exact folder path is present in `loadedPaths`; an empty folder no longer renders a visible caret.
- A failed or pending listing is not marked loaded, and a popup request that joins an outer-tree request is cleaned up when that shared request settles.
- The workspace resolves `@epam/ai-dial-react-file-manager@0.2.0-dev.7` and a compatible `@epam/ai-dial-ui-kit` peer.
- Existing cache deduplication and tab-reset behavior remain intact, with unit tests, typecheck, lint, and documentation validation passing for the affected projects.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `file-manager-tree-state`: define `loadedPaths` as cache-derived state for both outer-tree and destination-popup paths, and require the shell to forward popup loading paths through `treeOptions`.
- `chat-hooks-file-manager-listing`: define destination-popup pending/success/error behavior, including successful empty listings and exact path identity.

## Impact

- **Affected code:** `libs/chat-hooks/src/files/useDialFileListing/`, `libs/chat-hooks/src/files/useDialFileManager/tests/`, and `apps/chat/src/components/DialFileManagerShell/`.
- **Library boundary:** `libs/chat-hooks` continues to accept an injected `DialFilesApi` and exposes only host-agnostic paths/state; the app-level shell remains the adapter to `@epam/ai-dial-react-file-manager` props.
- **Dependencies/APIs:** upgrades `@epam/ai-dial-react-file-manager` to `0.2.0-dev.7`; npm resolves its `@epam/ai-dial-ui-kit@^0.14.0-dev.13` peer. No backend, OpenAPI, persistence, or schema changes.
- **i18n/RTL/accessibility:** no new strings or layout; the File Manager package retains responsibility for rendering and directionality of its existing caret.
- **Compatibility/rollback:** additive state semantics with no type changes. Reverting the popup-path tracking and `treeOptions.loadingPaths` pass-through restores the previous behavior.
- **Alternatives considered:** deriving loaded state from rendered child count was rejected because an empty successful response and a not-yet-loaded folder both have no children; the listing cache is the authoritative completion signal.
