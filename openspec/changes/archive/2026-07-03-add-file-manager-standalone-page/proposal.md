## Why

Issue #7502 asks for a standalone file-manager page so users can browse, upload, rename, delete, and download files without opening a conversation and triggering the attach flow — mirroring the legacy Redux `FileManager.tsx` page (`git show development:apps/chat/src/components/FileManager/FileManager.tsx`, route `/file-manager`) that this app no longer exposes after the BFF migration. This change registers the new page at `/files` rather than reclaiming the legacy path (see design.md Decision 1). The prerequisite change `extract-dial-file-manager-shell` (must be archived first) produced `DialFileManagerShell` and a `variant`/`actionProfile` vocabulary on `useDialFileManager` specifically so this page would not need to duplicate the ~600 lines of grid/tree/toolbar wiring the attach modal already has.

## What Changes

- Add `ROUTES.FileManager = '/files'` to `apps/chat/src/types/routes.ts`.
- Register a lazy-loaded route for it in `apps/chat/src/app/app.tsx`, following the existing Catalog route pattern (`RouteErrorBoundary` + `Suspense fallback={<RouteFallback />}`).
- Add a File Manager entry to `NAVIGATION_CONFIG` (`apps/chat/src/constants/navigation.ts`) with a new `NavigationI18nKeys` member and a Tabler folder/files icon.
- Add new page `apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx`: resolves `bucket` via `useUser()` (same source as the attach modal), calls `useDialFileManager({ bucket, variant: 'standalone', actionProfile: 'browse' })`, and renders `DialFileManagerShell` filling the whole route — no `DialPopup`, no attach footer, no page title/header of its own.
- Add a new i18n key under `dialFileManager.page.*` (nav label only) in `apps/chat/src/i18n/locales/en.json` plus a matching `DialFileManagerI18nKeys` enum member in `apps/chat/src/constants/translation-keys.ts`.
- Apply mobile-first responsive layout and RTL logical properties to the page's root container (the shell itself is already responsive/RTL-safe from the prior change).

## Capabilities

### New Capabilities

- `file-manager-standalone-page`: route, navigation entry, page component contract, initial-load behavior, and explicit non-goals (no copy/move/share/review-tab/folder-picker in this change).

### Modified Capabilities

None. `useDialFileManager`'s `variant`/`actionProfile` options and `DialFileManagerShell` (added by `extract-dial-file-manager-shell`) are consumed as-is; no existing requirement from that change or from the attach-modal specs changes behavior. `navigation-routing` (existing spec, `openspec/specs/navigation-routing/spec.md`) gains a new navigation item but its existing requirements (Home/Catalog behavior) are unaffected — verify during specs authoring whether this needs a delta or is purely additive (ADDED requirement in the new capability referencing the existing nav pattern is preferred over touching the existing spec, since no existing requirement's behavior changes).

## Impact

- **Code**: `apps/chat/src/types/routes.ts`, `apps/chat/src/app/app.tsx`, `apps/chat/src/constants/navigation.ts`, `apps/chat/src/constants/translation-keys.ts`, `apps/chat/src/i18n/locales/en.json`, new `apps/chat/src/pages/DialFileManagerPage/` (component + `tests/`).
- **Dependency**: hard-depends on `extract-dial-file-manager-shell` being archived first — `DialFileManagerShell`, `variant`, and `actionProfile` must exist before this change's tasks can start.
- **No** new BFF endpoints, no `libs/*` changes, no changes to the attach modal or `useDialFileManagerState`.
- **Out of scope (explicit non-goals)**: copy/move/duplicate/share/metadata/upload-archive (#7503/#7504), `SelectFolderModal`/`variant: 'folder-picker'` UI (#7503), Review tab (#7505), extracting the shell into `libs/*` (#7506).
- **i18n impact**: yes — one new user-visible string (the nav item label); no other standalone-only copy is needed since the page has no chrome of its own beyond `DialFileManagerShell`.
- **Rollback**: revert is a single-commit revert; removing the route/nav entry has no data migration since the page holds no persisted state beyond what `useDialFileManager` already manages for the attach modal.
