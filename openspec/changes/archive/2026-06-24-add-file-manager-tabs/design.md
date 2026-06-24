# Design: add-file-manager-tabs

## Context

`useDialFileManager` accepts a single `bucket` and always calls `listFiles(bucket, path)`. `DialFileManagerModal` passes the user's own bucket with no tab UI. The ui-kit already exports `useDialFileManagerTabs`, `DialFileManagerTabs` (`my_files | shared | organization | review`), and `FileManagerColumnKey`; no ui-kit changes are required.

The BFF (`apps/chat-api/src/files/`) currently exposes `GET /api/v1/files/list` (single-bucket proxy). Listing shared resources requires calling the DIAL Core sharing API; listing public/organization files requires listing the public bucket (`public`). Neither route exists today.

Gap matrix rows closed by this change: **#7** (tabs), **#8** (tab-specific filters/upload rules), **#11** (grid columns including UpdatedAt and Author). Row #13 (Author column) closed partially (Shared tab only). The "no tabs" note in `openspec/changes/archive/2026-06-20-add-file-manager-delete/design.md §5a` is superseded.

## Goals / Non-Goals

**Goals:**
- Three-tab attach modal: My files, Shared with me, Organization.
- Each tab loads from its own listing source (not one bucket with client-side filter).
- Per-tab column matrix: Author only on Shared; UpdatedAt on all tabs with locale-aware formatting.
- Per-tab actions: Delete only on My files; Download on all.
- Per-tab upload rules: disabled on Organization; disabled at Shared root; WRITE-gated on My files and nested Shared folders.
- `sharedWithMeIds` wired to `DialFileManager` on Shared tab.

**Non-Goals:**
- Review tab (defer — distinct review-bucket logic, low priority).
- Search (#9), pagination UI (#12), expandedPaths (#10).
- Full-page FM route (standalone FM page, Copy/Move/Share actions).
- Rename action implementation (wire label only if slice already ships).
- Move/Copy/Unshare/Info/ManagePermissions actions in modal.

## Decisions

### Decision 1: BFF endpoint shape — Option B (separate dedicated endpoints)

Three options were considered:

- **Option A**: `GET /api/v1/files/browse?tab=my_files|shared|organization` — BFF picks the right SDK call based on `tab`. Single route but couples file-list endpoint to UI tab semantics; breaks the existing single-bucket contract cleanly defined in the `file-list` spec.
- **Option B (chosen)**: Two new endpoints: `GET /api/v1/files/shared` and `GET /api/v1/files/public`. `GET /api/v1/files/list` stays unchanged for the user bucket. Frontend switches by `activeTab`.
- **Option C**: Extend `GET /api/v1/files/list` with a `source=user|shared|public` query param. Mixes concerns in one route; harder to version and rate-limit independently.

**Option B** is chosen because it:
- Keeps the existing `file-list` spec and generated client method (`filesApi.listFiles`) unchanged.
- Gives each source an independent rate limit and error surface.
- Mirrors the conversations-api multi-source pattern (`/conversations/list` merges internally, but files sources are more distinct).
- New `operationId`s (`listSharedFiles`, `listPublicFiles`) generate typed SDK methods immediately; no generated-client gap.

`GET /api/v1/files/shared` proxies DIAL Core sharing API (`getSharedResources({ resourceTypes: ['FILE'] })`).
`GET /api/v1/files/public` proxies `listFiles` on the fixed public bucket (`PUBLIC_BUCKET = 'public'`), existing pattern from conversations.

### Decision 2: Tab state ownership — modal layer (not hook)

`useDialFileManagerTabs` is a ui-kit hook that owns `activeTab` + `tabs` list. It must be called at the modal level so that `toolbarOptions.tabs / activeTab / onTabChange` can be wired directly from that state. `useDialFileManager` receives `activeTab` as a prop (not state) so it stays a pure data hook and remains testable per-tab in isolation.

### Decision 3: Client-side item filtering deferred in favour of server-side filtering

The legacy approach applied `SharedWithMeFilters` / `PublishedWithMeFilter` on the client after merging a single listing. With Option B, each endpoint returns only the correct items by construction (`/shared` returns only items shared with the user; `/public` returns only the public bucket). No client-side filter is needed at launch. `sharedWithMe` / `publishedWithMe` boolean flags on `ListFilesItemDto` are NOT added to the user-bucket endpoint at this time — they would only be needed for legacy client-filter compat which is no longer required.

### Decision 4: `useDialFileManager` refactor strategy — multi-source, not multi-hook

A single `useDialFileManager` accepts `activeTab` and internally branches fetch logic. The alternative (three separate hooks, one per tab) would duplicate cache management, path navigation, upload/delete logic, and error handling. The single-hook approach keeps the modal's hook-call count bounded and avoids prop-drilling the tab-specific sub-hook results.

The hook's `bucket` prop becomes optional (used only for `my_files` tab; derived from `user.bucket` at the call site). For `shared` and `organization` tabs, the bucket is determined by the endpoint, not the caller.

### Decision 5: UpdatedAt locale source — `i18n.language`

`dateLocale` for `gridOptions` is sourced from `i18n.language` (react-i18next) at the modal level and passed to the hook result. This is consistent with how other locale-aware formatting works in the app. RTL languages (Arabic, Hebrew, etc.) use standard BCP-47 locale codes which `Intl.DateTimeFormat` handles natively — no special mapping required.

```ts
const dateOptions: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
};
```

Column header labels for `updatedAt` / `size` / `author` are passed via `gridOptions.columnDefs` overrides (or ui-kit `columnLabels` if the prop exists — confirm at implementation time); i18n keys: `dialFileManager.column.modifiedDate`, `dialFileManager.column.size`, `dialFileManager.column.author`.

## Tab × Columns × Actions × Upload Matrix

This table is the authoritative contract for implementation and tests:

| Tab | `visibleColumns` (in order) | Row/bulk actions | `uploadEnabled` |
|-----|----------------------------|-----------------|-----------------|
| `my_files` | Name, UpdatedAt, Size, Actions | **Download**, **Delete** | WRITE on current folder (`canWriteCurrentFolder`) |
| `shared` | Name, UpdatedAt, Size, **Author**, Actions | **Download** only | `false` at shared root; `canWriteCurrentFolder` in nested folders |
| `organization` | Name, UpdatedAt, Size, Actions | **Download** only | Always `false` |
| `review` | — (out of scope) | — | — |

Delete MUST be hidden on `shared` / `organization` even when the folder has WRITE permission (matches legacy `FileManagerModal` `actionsByTab`). Delete is only shown on `my_files` and remains gated by `canWriteCurrentFolder`.

## Architecture

```
DialFileManagerModal
  ├── useDialFileManagerTabs(tabLabels, initialTab)
  │     → { activeTab, handleTabChange, tabs }
  └── useDialFileManager({ bucket, activeTab, rootLabels, i18nLanguage })
        → { items, path, onPathChange, uploadEnabled, visibleColumns,
            dateLocale, dateOptions, actionLabels, sharedWithMeIds, … }
```

`DialFileManager` receives:
- `toolbarOptions.tabs`, `toolbarOptions.activeTab`, `toolbarOptions.onTabChange`
- `gridOptions.visibleColumns`, `gridOptions.dateLocale`, `gridOptions.dateOptions`, `gridOptions.actionLabels`
- `treeOptions.actionLabels`
- `sharedWithMeIds`
- `uploadEnabled`

### Tab switch lifecycle (in `useDialFileManager`)

1. `activeTab` changes.
2. Clear cache (`setCache(new Map())`), clear permissions cache.
3. Reset `folderPath` to `''` (tab root).
4. Fire new fetch for the incoming tab's listing source.
5. On Shared tab: extract `sharedWithMeIds` from the response (item IDs that are root-level shared entries).

### Listing sources

| Tab | BFF endpoint | DIAL Core SDK call |
|-----|-------------|-------------------|
| `my_files` | `GET /api/v1/files/list?bucket={userBucket}&path=` | `listFiles` |
| `shared` | `GET /api/v1/files/shared?path=` | `getSharedResources({ resourceTypes: ['FILE'] })` |
| `organization` | `GET /api/v1/files/public?path=` | `listFiles` on `PUBLIC_BUCKET='public'` |

### BFF: `GET /api/v1/files/shared`

```
Query: path? (string, default ''), token? (string), limit? (int, 1-1000)
Response: ListFilesResponseDto (same shape as /files/list)
Rate limit: @Throttle({ default: { limit: 60, ttl: 60000 } })
Auth: session cookie
```

DIAL Core call: `client.getSharedResources({ body: { resourceTypes: ['FILE'] } })`. Response items are mapped to `ListFilesItemDto` via the existing `normalizeFileItem` logic (same fields; `bucket` set to the item's bucket from the sharing response). No `sharedWithMe` flag added — the endpoint itself guarantees all items are shared.

### BFF: `GET /api/v1/files/public`

```
Query: path? (string, default ''), token? (string), limit? (int, 1-1000), permissions? (boolean, default false)
Response: ListFilesResponseDto
Rate limit: @Throttle({ default: { limit: 60, ttl: 60000 } })
Auth: session cookie
```

DIAL Core call: `listFiles` with `bucket = PUBLIC_BUCKET` and provided `path`. Uses the existing single-bucket listing infrastructure. `permissions` defaults to `false` (users cannot write to public bucket, so permission info is irrelevant).

### OpenAPI client regeneration

Both new operationIds (`listSharedFiles`, `listPublicFiles`) will be generated into `@epam/chat-api-client` after Swagger update. Frontend wrappers added to `apps/chat/src/server-api/files.api.ts`.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| DIAL Core sharing API shape differs from expected (`getSharedResources`) | Verify exact SDK method + response shape from `@epam/ai-dial-typescript-sdk` before implementing BFF; add integration test with a mock DIAL Core. |
| Shared tab root: what constitutes "shared root" for `uploadEnabled=false` | Legacy: `isRootId(currentPath)`. In new hook: `folderPath === ''` on the shared tab → `uploadEnabled = false`. Nested folders use `canWriteCurrentFolder`. |
| `sharedWithMeIds` extraction: what IDs to pass | Pass the `path` (API path) of each root-level item from the shared listing response. The ui-kit uses these to identify the roots of the shared tree. Confirm field name with ui-kit `sharedWithMeIds` docs at implementation time. |
| Date column empty-state for items lacking `updatedAt` | Hook already returns `undefined` for missing `updatedAt`. UI kit renders an empty cell. No special handling needed; document as acceptable empty state. |
| OpenAPI client regeneration scope | Regeneration is required after BFF changes. Coordinate with CI to regenerate before frontend slice lands. |
| Delete regression on existing My files behavior | Hook `actionLabels` for `my_files` must still include `Delete`; tests must confirm Delete is absent from `shared` and `organization` action label maps. |

## Migration Plan

1. **BFF slice** (no UI change): add `GET /api/v1/files/shared` and `GET /api/v1/files/public`, regenerate client.
2. **Hook refactor**: extend `useDialFileManager` to accept `activeTab` + switch per-tab; default `activeTab = DialFileManagerTabs.MyFiles` for backward compat (no call-site changes until UI slice).
3. **UI slice**: wire `useDialFileManagerTabs` in modal, wire per-tab options, close gap matrix rows.
4. **Tests + gap matrix update**.

No user-visible regression on existing My files flow — default tab is `my_files`, which uses the unchanged `listFiles` endpoint and the same `bucket` prop.

## Open Questions

- Confirm exact SDK method for shared resources: `client.getSharedResources(...)` — verify parameter shape in `@epam/ai-dial-typescript-sdk` types.
- Confirm `sharedWithMeIds` field semantics in ui-kit: which field from `DialFile` should be collected as the IDs array?
- Column header override mechanism: does ui-kit expose `gridOptions.columnLabels` or must we use `gridOptions.columnDefs` with custom `headerName`? Determine at implementation time and document in the UI slice task.
