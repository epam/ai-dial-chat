## Why

The `publish-share` branch delivered a UI-only prototype of "Publish catalog entity to Organization folder" (`PublishPanel`, `PublishFooter`, `PublishHistoryList`, a temporary custom `PublishFolderPicker`, and mock wiring in `CatalogView`). The prototype validated the UX and props contract, but it runs entirely on mock data and a bespoke tree component. To ship the feature, the temporary tree must be replaced with the ui-kit `DialFoldersTree`, and the publish flow must be backed by real Organization-folder data and a real publish API instead of mocks.

## What Changes

- Upgrade `@epam/ai-dial-ui-kit` to a version exporting `DialFoldersTree` (`FileManager/components/FoldersTree`) and replace the temporary `PublishFolderPicker` in `libs/catalog` with a thin wrapper around it (`showFiles={false}`, no context menu, single-folder selection, inline folder creation, RTL-correct).
- **BREAKING** (lib-internal): delete `PublishFolderPicker` and `publish-folder-tree.ts` from `libs/catalog` once the `DialFoldersTree`-based wrapper reaches visual/behavioral parity; downstream lib tests referencing the old component are removed/updated.
- Add an app-level adapter hook (e.g. `apps/chat/src/hooks/catalog/useCatalogPublishFolders.ts`) that loads the Organization/public folder tree lazily (pattern reused from `useDialFileManager` and `GET /api/v1/files/public`), maps it to the lib's folder-node contract, and resolves write-access per folder.
- Design and implement a catalog publish BFF/API surface in `apps/chat-api` (`POST /api/v1/catalog/{entityType}/{entityId}/publish`, `GET /api/v1/catalog/{entityType}/{entityId}/publish-history`, and, if the existing files tree cannot be reused, `GET /api/v1/catalog/publish-folders`), with DTOs, Swagger docs, and a regenerated `@epam/chat-api-client`.
- Wire `CatalogView` end-to-end: replace `MOCK_PUBLISH_FOLDERS`, `MOCK_PUBLISH_HISTORY`, and the fake `handlePublish`/write-access logic with real server-api calls; keep the success toast and map API errors to the existing `hasSubmitError`/callout UX; scope `isPublishVisible` to editable/user-owned entities.
- Add/update unit tests for the new lib wrapper, the app adapter hook, `CatalogView` wiring, and the new backend endpoints; add a manual QA checklist mirroring `docs/filemanager-7501-test-cases.md`.

Explicitly out of scope for this change (carried over from the prototype and not being reconsidered here): `FolderAccess` audience picker, Shared-vs-Organization publish scope tabs, and `PublishCalloutKind.Info`.

## Capabilities

### New Capabilities
- `catalog-publish-flow`: end-to-end user-facing behavior of publishing a catalog entity to an Organization folder — folder selection via `DialFoldersTree`, inline folder creation, replace-version/no-access/error callouts, publish history, and visibility rules — backed by real data instead of mocks.
- `catalog-publish-api`: backend contract for publishing a catalog entity and retrieving its publish history (and, if needed, the publish-folder tree), including DTOs, versioning, and error mapping.

### Modified Capabilities
(none — `catalog-use-in-chat` and other existing catalog specs are unaffected by this change)

## Impact

- `libs/catalog`: `PublishFolderPicker` replaced by a `DialFoldersTree` wrapper; `usePublishFlow`, `derivePublishState`, and the folder-node type contract updated to match ui-kit data shapes where needed.
- `@epam/ai-dial-ui-kit` dependency version bump (to the release exporting `DialFoldersTree`); migration guide review required.
- `apps/chat`: new hook(s) under `apps/chat/src/hooks/catalog/`, new/updated `server-api` wrappers, `CatalogView` mock data and handlers removed, i18n keys (`CatalogI18nKeys`) added to `en.json` (and Arabic locale for RTL parity).
- `apps/chat-api`: new domain module (e.g. `apps/chat-api/src/catalog-publish/`) with controller, service, DTOs, and tests; OpenAPI spec regenerated; `@epam/chat-api-client` rebuilt.
- Reference patterns: `useDialFileManager`, `DialFileManagerPage`, `openspec/specs/file-manager-folder-picker/spec.md`, archived `2026-07-04-use-in-chat-catalog`.
