## 1. BFF: Public bucket listing endpoint

- [x] 1.1 Add `ListPublicFilesQueryDto` in `apps/chat-api/src/files/dto/` with `path?`, `token?`, `limit?`, `recursive?` fields and class-validator decorators (no `bucket` — fixed to `PUBLIC_BUCKET`)
- [x] 1.2 Implement `listPublicFiles(query)` method in `FilesService` calling the existing single-bucket list infrastructure with `bucket = 'public'`; permissions always `false`
- [x] 1.3 Add `GET /api/v1/files/public` handler in `FilesController` with `@Throttle({ default: { limit: 60, ttl: 60000 } })` and `@ApiTags('files')`
- [x] 1.4 Write unit/integration tests for the public listing endpoint (happy path, empty result, 401, 502)
- [x] 1.5 Regenerate OpenAPI client (`npm run generate:api` or equivalent) and verify `filesApi.listPublicFiles(...)` is generated

## 2. BFF: Shared files listing endpoint

- [x] 2.1 Add `ListSharedFilesQueryDto` in `apps/chat-api/src/files/dto/` with `path?`, `token?`, `limit?` and class-validator decorators
- [x] 2.2 Verify the DIAL Core SDK method for shared resources (`@epam/ai-dial-typescript-sdk`) — confirm method name, parameter shape (`resourceTypes: ['FILE']`), and response fields; document any deviation in a code comment
- [x] 2.3 Implement `listSharedFiles(query)` method in `FilesService` calling the DIAL Core sharing SDK method and mapping results with `normalizeFileItem`
- [x] 2.4 Add `GET /api/v1/files/shared` handler in `FilesController` with `@Throttle({ default: { limit: 60, ttl: 60000 } })`
- [x] 2.5 Write unit/integration tests for the shared listing endpoint (has items, empty, 401, 502)
- [x] 2.6 Regenerate OpenAPI client and verify `filesApi.listSharedFiles(...)` is generated

## 3. Frontend: Server-API wrappers

- [x] 3.1 Add `listPublicFiles(params)` wrapper in `apps/chat/src/server-api/files.api.ts` delegating to `filesApi.listPublicFiles(...)`
- [x] 3.2 Add `listSharedFiles(params)` wrapper in `apps/chat/src/server-api/files.api.ts` delegating to `filesApi.listSharedFiles(...)`
- [x] 3.3 Verify TypeScript compiles with no errors (`npm exec nx typecheck chat`)

## 4. Frontend: useDialFileManager multi-source refactor

- [x] 4.1 Add `activeTab?: DialFileManagerTabs` to `UseDialFileManagerOptions`; default to `DialFileManagerTabs.MyFiles` when omitted (backward compat — existing call sites unchanged)
- [x] 4.2 Add `sharedWithMeIds?: string[]` and tab-dependent `visibleColumns`, `dateLocale`, `dateOptions`, `actionLabels` to `UseDialFileManagerResult`
- [x] 4.3 Branch the fetch `useEffect` by `activeTab`: call `listFiles(bucket, path)` for `my_files`, `listSharedFiles(path)` for `shared`, `listPublicFiles(path)` for `organization`
- [x] 4.4 On `activeTab` change: clear `cache`, clear `listingPermissionsCache`, reset `folderPath` to `''`, clear `selectedPaths` if managed by hook (coordinate with modal layer)
- [x] 4.5 Extract `sharedWithMeIds` from Shared tab root listing (root-level item paths when `folderPath === ''` and `activeTab === shared`)
- [x] 4.6 Compute `uploadEnabled` per the tab × folder matrix: `organization` → always `false`; `shared` root → `false`; `shared` nested → `canWriteCurrentFolder`; `my_files` → `canWriteCurrentFolder`
- [x] 4.7 Compute `visibleColumns` per tab: `shared` adds `FileManagerColumnKey.Author`; others omit it (all include `Name`, `UpdatedAt`, `Size`, `Actions`)
- [x] 4.8 Compute `actionLabels` per tab: `my_files` includes `Delete`; `shared` and `organization` omit `Delete`
- [x] 4.9 Source `dateLocale` from `i18n.language` (via `useTranslation`) and return fixed `dateOptions = { year: 'numeric', month: 'short', day: '2-digit' }`
- [ ] 4.10 Write unit tests for the hook covering: tab switch clears cache + path; uploadEnabled matrix (5 scenarios from spec); visibleColumns per tab; actionLabels per tab; sharedWithMeIds present only on Shared tab

## 5. Frontend: DialFileManagerModal tab wiring

- [x] 5.1 Call `useDialFileManagerTabs` with i18n-translated labels for `my_files`, `shared`, `organization` and pass result into `useDialFileManager({ activeTab })`
- [x] 5.2 Wire `toolbarOptions.tabs`, `toolbarOptions.activeTab`, `toolbarOptions.onTabChange` from `useDialFileManagerTabs`
- [x] 5.3 Derive tab-aware `gridOptions` from hook result: `visibleColumns`, `dateLocale`, `dateOptions`, `actionLabels` — wrap in `useMemo` depending on `activeTab` and label props
- [x] 5.4 Derive tab-aware `treeOptions.actionLabels` and `bulkActionsToolbarOptions.actionLabels` (Delete absent on non-my_files tabs)
- [x] 5.5 Pass `sharedWithMeIds` from hook to `DialFileManager` (present only on Shared tab)
- [x] 5.6 Reset `selectedPaths` to `new Set()` in `toolbarOptions.onTabChange` callback (before delegating to `handleTabChange`)
- [x] 5.7 Verify `toolbarOptions.isNewButtonDisabled` and `disabledNewButtonTooltip` still wired correctly from hook's `uploadEnabled`

## 6. i18n

- [x] 6.1 Add tab label keys to `apps/chat/src/i18n/locales/en.json`: `dialFileManager.tab.myFiles`, `dialFileManager.tab.shared`, `dialFileManager.tab.organization`
- [x] 6.2 Add column header keys: `dialFileManager.column.modifiedDate`, `dialFileManager.column.size`, `dialFileManager.column.author` (for future column header wiring; document approach in code comment if ui-kit mechanism is confirmed)
- [x] 6.3 Add matching enum members in `apps/chat/src/constants/translation-keys.ts` for all new keys

## 7. Tests and Gap Matrix

- [x] 7.1 Write component tests for `DialFileManagerModal` tab rendering: three tabs visible; tab switch calls `onTabChange`; selectedPaths cleared on switch
- [x] 7.2 Write component tests for Delete action visibility: present on my_files grid/bulk/tree, absent on shared and organization
- [x] 7.3 Write component tests for uploadEnabled: organization always false; shared root false; my_files WRITE-gated
- [x] 7.4 Write component test for `sharedWithMeIds`: passed to `DialFileManager` only on Shared tab
- [x] 7.5 Write component test for `visibleColumns`: Author column included only on Shared tab
- [x] 7.6 Run `npm exec nx affected --target=test --base=origin/development-1.0` and fix any regressions
- [x] 7.7 Run `npm exec nx affected --target=lint --base=origin/development-1.0` and resolve all lint errors
- [x] 7.8 Update `docs/dial-file-manager-legacy-modal-gap-matrix.md`: rows #7, #8, #11 → ✅; row #13 (Author column) → partial ✅ (Shared tab only)
- [x] 7.9 Add note in `docs/dial-file-manager-legacy-modal-gap-matrix.md` superseding the "no tabs" simplification from the delete change archive
