## Why

File manager UI (`DialFileManager`, `DialFoldersTree`, file models, actions, tabs, column keys, selection modes, upload/conflict types, etc.) was extracted from `@epam/ai-dial-ui-kit` into a dedicated package `@epam/ai-dial-react-file-manager` (current dev version `0.1.0-dev.13`). AI DIAL Chat still imports all file-manager symbols from ui-kit. We need to switch imports to the new package so the app tracks the intended package boundary and stays compatible when ui-kit removes those exports. This is a straight copy migration — the new package has the same public API and behavior — so there must be zero user-visible regression.

## What Changes

- Add `@epam/ai-dial-react-file-manager` (pinned to `0.1.0-dev.13` or latest compatible dev release) to the workspace root `package.json`; keep `@epam/ai-dial-ui-kit` for general design-system components.
- Import `@epam/ai-dial-react-file-manager/styles.css` in `apps/chat/src/main.tsx` immediately after the ui-kit stylesheet.
- Verify/align the `@epam/ai-dial-ui-kit` peer version the new package declares against the version this repo uses.
- Migrate every file-manager-specific import in `apps/chat/src/components/DialFileManagerShell/`, `apps/chat/src/components/DialFileManagerModal/`, `apps/chat/src/hooks/files/**`, `apps/chat/src/utils/file-name.ts`, and `apps/chat/src/utils/attachment-types.ts` from `@epam/ai-dial-ui-kit` to `@epam/ai-dial-react-file-manager`, keeping non-file-manager ui-kit imports (`PrimaryButton`, `Spinner`, `DialPopup`, `NotificationVariant`, `PopupSize`, etc.) unchanged.
- Migrate `libs/publish-panel/src/components/PublishFoldersTree/PublishFoldersTree.tsx` to import `DialFile`, `DialFileNodeType`, `DialFoldersTree` from the new package, and add `@epam/ai-dial-react-file-manager` as a peer dependency in `libs/publish-panel/package.json`.
- Update test mocks that reference `@epam/ai-dial-ui-kit` file-manager exports (component specs, hook specs, `PublishFoldersTree` tests) to mock `@epam/ai-dial-react-file-manager` instead.
- Update documentation-only spec import-path references (no requirement behavior changes) in the modified capabilities listed below.
- **No behavioral changes**: attach modal, standalone `/file-manager` page, folder picker, upload/conflict/copy/move/rename/delete/sharing/metadata flows, i18n, and RTL/a11y all stay identical.
- **No backend/BFF changes**: `apps/chat-api` files endpoints and `useDialFileManager` hook logic stay unchanged except import paths for types.
- **No architecture refactor**: `DialFileManagerShell` and the `hooks/files/**` hooks stay where they are; this is import/dependency migration only.

## Capabilities

### New Capabilities

(none — dependency/import migration only)

Confirmed by grep, only the specs below actually name `@epam/ai-dial-ui-kit` in their requirement text (the remaining capabilities in the Impact area — `file-manager-shell`, `dial-file-manager-attach-folders`, `dial-file-manager-attach-validation`, `file-manager-standalone-page`, `file-manager-tab-config`, `file-manager-search`, `file-manager-tree-state`, `file-manager-grid-editing-scroll`, `file-manager-upload*`, `file-manager-download`, `file-manager-delete-ui`, `file-manager-copy-move`, `file-manager-sharing`, `file-manager-operation-ux`, `file-manager-attach-modal-polish`, `file-manager-shared-list`, `publish-panel-library`, `dial-file-manager-hook-decomposition` — describe behavior without naming the package, so they need no spec delta):

### Modified Capabilities

Documentation-only import-path references updated; no requirement behavior changes:

- `dial-file-manager-attach-ui`
- `file-manager-tabs`
- `dial-file-system-picker`
- `file-manager-folder-picker`
- `file-manager-duplicate`
- `file-manager-metadata`

**`file-manager-rename-ui` and `file-manager-folder-creation` are unaffected**, discovered during implementation: `NOT_ALLOWED_SYMBOLS_REGEXP` is not re-exported by `@epam/ai-dial-react-file-manager` (confirmed by inspecting the published package), so it stays sourced from `@epam/ai-dial-ui-kit` in both code and spec text — no delta needed for either capability.

## Impact

- **Dependencies**: root `package.json`, `libs/publish-panel/package.json`
- **Styles**: `apps/chat/src/main.tsx`
- **Frontend imports**: ~25 files under `apps/chat/src/{components,hooks,utils}/**` and `libs/publish-panel/src/components/PublishFoldersTree/`
- **Tests**: file-manager component specs, hook specs, `PublishFoldersTree` tests
- **Out of scope**: ui-kit version bump beyond peer compatibility, extracting file-manager into a new workspace lib, API/OpenAPI changes, feature additions
