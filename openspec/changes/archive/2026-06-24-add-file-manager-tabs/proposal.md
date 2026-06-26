## Why

`DialFileManagerModal` currently browses only the authenticated user's personal bucket — it has no tabs, no Shared or Organization listing, and no per-tab column/action/upload rules. This blocks the Shared and Organization attach flows and leaves gap-matrix rows #7–8 (tabs + tab-specific filters/upload rules) and #11 (grid columns including Author and UpdatedAt) open. P1 because every future multi-source attach path depends on this foundation.

## What Changes

- Add `My files`, `Shared with me`, and `Organization` tabs to `DialFileManagerModal` using ui-kit `useDialFileManagerTabs` + `toolbarOptions.tabs / activeTab / onTabChange`.
- Extend `useDialFileManager` to accept multi-source tab config and switch listing source on tab change (user bucket → shared resources API → public bucket).
- Add two new BFF endpoints for shared-file and public-file listing that mirror the conversations multi-source list pattern.
- Implement per-tab `visibleColumns` (Author column only on Shared tab), `dateLocale` / `dateOptions` for UpdatedAt formatting, per-tab action sets (Delete only on My files), and upload rules (disabled on Organization; disabled at Shared root).
- Wire `sharedWithMeIds` from the Shared listing into `DialFileManager` for correct tree root navigation.
- Add i18n keys for tab labels and column headers (`dialFileManager.tab.*`, `dialFileManager.column.*`).
- Close gap-matrix rows #7, #8, #11; partially close #13 (Author column).
- Supersede the "no tabs" note in `openspec/changes/archive/2026-06-20-add-file-manager-delete/design.md §5a`; Delete becomes tab-aware again.

## Capabilities

### New Capabilities

- `file-manager-tabs`: Tab navigation for `DialFileManagerModal` — tab state, per-tab listing source, column matrix, action matrix, upload rules, and `sharedWithMeIds` wiring. Covers gap-matrix rows #7, #8, #11.
- `file-manager-shared-list`: New BFF endpoint(s) for listing files shared with the current user and public/organization files; extends the existing `file-list` infrastructure with new routes.

### Modified Capabilities

- `file-list`: Add `GET /api/v1/files/shared` and `GET /api/v1/files/public` endpoints (or a composite browse endpoint) so the frontend can retrieve shared and organization files via BFF. DTO extended with `sharedWithMe` and `publishedWithMe` boolean flags where applicable.
- `dial-file-manager-attach-ui`: `DialFileManagerModal` gains tab UI, per-tab grid/tree/toolbar options, and locale-aware UpdatedAt column — existing attach validation and selection logic unchanged.

## Impact

- **BFF (`apps/chat-api`)**: New controller methods / routes for shared-file listing (DIAL Core sharing API) and public-file listing (public bucket); updated `ListFilesItemDto` with optional `sharedWithMe` / `publishedWithMe` fields; updated Swagger → OpenAPI client regeneration required.
- **Frontend hook (`apps/chat/src/hooks/files/useDialFileManager.ts`)**: Significant refactor — accept `activeTab`, branch fetch logic per tab, expose `visibleColumns`, `dateLocale`, `dateOptions`, tab-dependent `uploadEnabled`, `actionLabels`, and `sharedWithMeIds`.
- **Frontend component (`apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`)**: Wire `useDialFileManagerTabs`, pass tabs to `toolbarOptions`, use tab-dependent `gridOptions` / `treeOptions` / `bulkActionsToolbarOptions`.
- **i18n (`apps/chat/src/i18n/locales/en.json`)**: New keys for tab labels, column headers.
- **Spec updates**: `openspec/specs/file-list/spec.md` gains new endpoint requirements; `openspec/specs/dial-file-manager-attach-ui/spec.md` gains tab / column / action requirements.
- **Gap matrix**: Rows #7, #8, #11 → ✅; row #13 (Author) → partial ✅.
- **No external dependency changes**: ui-kit already exports `useDialFileManagerTabs`, `DialFileManagerTabs`, `FileManagerColumnKey`.
