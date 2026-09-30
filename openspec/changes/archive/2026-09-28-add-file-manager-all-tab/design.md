## Context

The standalone File storage page (`apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx`) composes a single `useDialFileManager` for the active tab and renders it through `DialFileManagerShell` (`libs/chat-shared/src/file-manager/DialFileManagerShell/DialFileManagerShell.tsx`). Every layer below the page is **one tab = one source = one root**:

- `useDialFileListing` holds one `rootLabel`, one `folderPath`, one `cache` and one `listingPermissionsCache`. It calls `fetchByTab(filesApi, activeTab, …)` from five places (mount/navigation effect, `invalidateFolders`, `onFolderPopupPathChange`, `onExpandedPathsChange`, search), and resets everything when `activeTab` changes (`useDialFileListing.ts:163-186`).
- `useDialFileManager` derives `uploadEnabled`, `visibleColumns` and `actionLabels` from `activeTab` (`useDialFileManager.ts:127-175`). `useDialFileUploadBatch`/`useDialFileMutations` also receive `activeTab` and resolve Shared owner buckets via `sharedRootMetaRef`.
- `DialFileManagerShell` reads `activeTab` for the strip value, the tree header, `showUploadArchiveAction` (`:323-327`), the root empty state (`:493`) and the grid-editing-scroll reset (`:207-209`).
- The tab enum `DialFileManagerTabs` is owned by `@epam/ai-dial-react-file-manager` (sibling repo, `src/types/file-manager.ts:1`), and its `useDialFileManagerTabs` builds chips from `Object.values(enum)`. `@epam/ai-dial-ui-kit` still ships a legacy copy of the enum that `apps/chat` imports in places.
- The tab set is configured by `FILE_MANAGER_AVAILABLE_TABS` → `ClientConfigResponseDto.fileManagerTabs` → `useAppConfig().config.fileManagerTabs` → `useDialFileManagerTabConfig` (page) / `useFileAttachmentPicker.allowedTabs` (modal).

`DialFileManager` already accepts `items: DialFile[]` as an array of top-level nodes, and treats `activeTab` as an opaque value (strip value plus a search reset in `use-file-search.ts:135`). So a multi-root tree needs no change in the grid/tree component beyond the enum member.

## Goals / Non-Goals

**Goals:**

- An All tab on `/files` whose tree has one top-level folder per enabled source tab, each behaving exactly as its own tab.
- No second copy of the per-tab rules (action matrix, upload rules, columns, Shared owner-bucket resolution).
- The single tabs behave exactly as today, including the reset on tab switch.
- Library isolation is preserved: section names and the enabled-section list come from the app edge.

**Non-Goals:** everything listed under Non-goals in `proposal.md`: no All in pickers, no cross-section transfer, no cross-section search, no ui-kit enum change, no new endpoints.

## Decisions

### D1. Compose one `useDialFileManager` per section behind a routing hook

New hook `useDialFileManagerSections` in `libs/chat-hooks/src/files/useDialFileManagerSections/useDialFileManagerSections.ts`:

```ts
interface DialFileManagerSection {
  tab: DialFileManagerTabs; // MyFiles | Shared | Organization
  rootLabel: string;        // translated, supplied by the host
}

interface UseDialFileManagerSectionsOptions
  extends Omit<UseDialFileManagerOptions, 'activeTab' | 'rootLabel'> {
  activeTab: DialFileManagerTabs;       // may be All
  sections: DialFileManagerSection[];   // enabled source tabs, in display order
}

interface UseDialFileManagerSectionsResult extends UseDialFileManagerResult {
  sectionTab: DialFileManagerTabs;      // source tab of the browsed folder; never All
}
```

Internally it calls `useDialFileManager` **three times, unconditionally and in a fixed order** (MyFiles, Shared, Organization), so the hook order never depends on configuration. Each call gets a fixed `activeTab` equal to its section tab and its section's `rootLabel`, falling back to the tab id for a section absent from `sections`. It also gets:

- `isActive = sectionEnabled && (activeTab === section.tab || activeTab === All)`
- `sessionKey = activeTab`

Output:

- **Single tab** (`activeTab !== All`): the matching section's result object, returned unchanged (referentially stable), plus `sectionTab = activeTab`.
- **All**: a merged result built per D3.

*Alternatives:* (B) a multi-source rewrite of `useDialFileListing` was rejected. It duplicates nothing, but it touches the 743-line hook and every sibling hook that keys off `activeTab`, the widest regression surface in the file manager. (C) All as navigation-only (clicking a root switches tab) was rejected because it contradicts the design. Composition reuses the characterized single-tab logic and its existing test suites as-is.

*Why not keep `useDialFileManager` on the page for single tabs and add a separate All composer?* Two parallel manager sets (four listings) would each need their own activation gating. With one composer the page has one hook and one controller, and the single-tab path is literally the section instance.

### D2. `isActive` and `sessionKey` on `useDialFileListing` / `useDialFileManager`

Both are optional, and their defaults keep today's behaviour (`isActive = true`, `sessionKey = undefined`):

- `isActive === false`: the navigation effect and the `listSharedByMe` effect return early (no request). `isLoading` reports `false`, `items` still renders the (empty) root node, and `onExpandedPathsChange`/`onFolderPopupPathChange`/`onSearchFiles` are no-ops. The modal and every existing caller never pass it.
- `sessionKey` change: runs the **same reset block** the `activeTab` change runs today (cache, permissions, `folderPath`, shared root meta, in-flight/errored sets, popup sets, search, expanded paths). Implementation: the existing `prevTabRef` guard compares a combined `${activeTab}|${sessionKey ?? ''}` key. A switch between All and any single tab therefore resets every section, which preserves "tab switch resets navigation" (`chat-hooks-file-manager-listing` → *Tab switch fully resets cache and navigation state*).
- Transition `isActive: false → true` triggers the navigation effect (it joins the dependency array), so a section loads its root the moment it becomes active.

### D3. Routing contract for the All view

A virtual path belongs to the section whose root label is its first segment. The helper `resolveSectionByPath(path, sections)` lives in `libs/chat-hooks/src/files/dial-file-manager-path.util.ts`. It normalizes a leading slash and matches `/${rootLabel}` exactly or `/${rootLabel}/` as a prefix, so a label such as `Shared` never matches `Shared stuff`. It returns `undefined` for an unmatched path. The **browsed section** is state owned by the composer: it is initialized to the first enabled section, updated by every routed `onPathChange`, and reset to the first enabled section on each `sessionKey` change.

| Controller field | All-view value |
| --- | --- |
| `items` | `sections.map(s => instance(s).items[0])`, one root per enabled section, in `sections` order |
| `path`, `isLoading`, `error`, `retry`, `isSearching`, `searchResults`, `clearSearchResults`, `onSearchFiles` | browsed section's |
| `onPathChange(p)` | `p == null` → browsed section's root. Otherwise resolve the section by `p`, set it as browsed, and forward `p` |
| `expandedPaths` | union of every section's set |
| `onExpandedPathsChange(paths)` | split `paths` by section and call each section's handler with its own subset. Paths that match no section are dropped. The tree's collapse of a top-level folder removes that section's paths only |
| `loadedPaths`, `folderPopupLoadingPaths`, `sharedWithMeIds`, `sharedByMePaths` | union across sections (paths are disjoint by root label, so per-row gating stays exact) |
| `onFolderPopupPathChange(p)` | routed by `p`, `null` → browsed section |
| `uploadEnabled`, `isNewButtonDisabled`, `disabledNewButtonTooltip`, `visibleColumns`, `actionLabels`, `dateLocale`, `dateOptions` | browsed section's |
| `onUploadFiles`/`onUploadArchive`/`onValidateUpload`/`onCreateFolder`/`onCreateFolderValidate` | routed by the destination/parent folder path |
| `onDownloadFiles`/`onDeleteFiles`/`onUnshareFiles`/`onRemoveFilesAccess`/`onGetInfo`/`onRenameValidate` | routed by the first item's path (grid selection is confined to the browsed folder, so to one section) |
| `onCopyFiles`/`onMoveToFiles` | see D6 |
| `uploadBatchState`, `cancelUpload`, `cancelUploadFile`, `clearUploadBatch` | the section with a non-null batch (browsed section preferred), else browsed section's. The queue keeps rendering when the user navigates away mid-upload |
| `isDownloading`/`isDeleting`/`isRenaming`/`isCopying`/`isMoving`/`isUnsharing`/`isRemovingAccess`/`isCreatingFolder`/`isAnyOperationInProgress` | logical OR across sections |
| `cancelCopyMove` | calls every section's (each is a no-op when idle) |
| `fileMetadata`, `isFileMetadataLoading`, `clearMetadata` | section of the last `onGetInfo` call |
| `sectionTab` | browsed section's tab |

The merged object and every routed callback are memoized (`useMemo`/`useCallback`) on the section results, so the shell's `useMemo` dependency lists do not churn on unrelated renders.

### D4. `sectionTab` on `FileManagerController`; the shell gates on it

`FileManagerController` gains `sectionTab?: DialFileManagerTabs` ("source tab of the browsed folder; omitted by single-source controllers"). `DialFileManagerShell` computes `const gateTab = controller.sectionTab ?? activeTab` and uses it for `showUploadArchiveAction`, the root empty state (`labels.emptyStateByTab[gateTab]`), and the grid-editing-scroll reset. `activeTab` remains the strip value and the tree header key.

The shell's "root empty state" test is `path` depth ≤ 1. That still holds under All, because each section root is depth 1. The modal passes a plain `useDialFileManager` result with no `sectionTab`, so it is unaffected. `UseDialFileManagerResult` stays structurally assignable (the field is optional).

`treeHeaderByTab` and `emptyStateByTab` are `Record<DialFileManagerTabs, …>`. Adding the enum member forces every host literal to add an `all` key: the page, the modal, and the shell/page/modal test fixtures. `emptyStateByTab[All]` is never read (`gateTab` is never All), so hosts supply the My-files copy.

### D5. Enum member, ordering, and config

- **Enum:** `@epam/ai-dial-react-file-manager` adds `All = 'all'` as the **first** member, so `useDialFileManagerTabs` (which maps `Object.values`) renders it first with no other change there. Reordering string-enum members is not a breaking change. Every chat file that touches the tab enum for this change imports it from `@epam/ai-dial-react-file-manager`, the owner. The legacy ui-kit copy is not extended.
- **Backend:** `FILE_MANAGER_ALLOWED_TABS` and the registry default become `['all', 'my_files', 'shared', 'organization']`. Unknown-id dropping and fully-invalid fallback are unchanged. The fallback default includes `all`. `client-config.mapper.ts` and the DTO example follow. Follow `apps/chat-api/AGENTS.md` for the config-registry and DTO conventions. No endpoint changes, so no authorization or `operationId` change. `npm run openapi` regenerates only the example.
- **Page:** the enabled sections are the source tabs in `fileManagerTabs` (a tab is enabled when `fileManagerTabs` is `undefined` or contains it). The All chip is shown only when `all` is configured **and** at least two sections are enabled. With one section, All would duplicate that tab, so the app filters `all` out of the chip list. `useDialFileManagerTabConfig`'s `TAB_PRIORITY_ORDER` gains `All` first. The page calls `useDialFileManagerTabs(tabLabels, DialFileManagerTabs.All)`, and the existing reset effect corrects to My files when All is filtered out.
- **Pickers:** `useFileAttachmentPicker` always removes `All` from its chip list and from its fallback priority. It composes a single-source manager, and `fetchByTab` has no All branch. `fetchByTab` receiving `All` rejects with an `Error` rather than silently listing My files, so a wiring mistake fails loudly in tests.

### D6. Cross-section copy/move is refused

`useDialFileMutations` resolves the destination with the **source** section's bucket and `sharedRootMeta`, so a destination in another section would write to the wrong coordinates. The composer routes `onCopyFiles`/`onMoveToFiles` to the source section only when the destination resolves to the same section. Otherwise it issues no request and calls `onNotification` with a new `FileManagerNotificationReason.CrossSectionTransferUnsupported`, variant `Warning`.

The app's `file-manager-notification-adapter.ts` maps that reason to the new key `dialFileManager.crossSectionTransferUnsupported`: "Copying and moving between My files, Shared, and Organization isn't supported yet." A drag between sections goes through the same `onMoveToFiles` path, so it is covered.

*Alternative:* feed the destination popup only the source section's subtree. That needs a separate `destinationItems` prop on `DialFileManager`, a sibling-repo API change. It stays an Open Question, and the refusal is the safe behaviour in either case.

### D7. Library-isolation statement

`useDialFileManagerSections` receives the configured `filesApi`, `bucket`, translated `rootLabel`s and the enabled `sections` as parameters, and reads no config, env, i18n or context. The new notification reason is structured data; the translated text is produced by the app adapter. `FileManagerController.sectionTab` is a plain enum value. The app edge (`DialFileManagerPage` + `useAppConfig`) owns which sections exist and what they are called. This stays within the second exception in AGENTS.md (`chat-hooks` calls the generated client through the injected `filesApi`).

### D8. States, accessibility, RTL, gating, telemetry, caching

- **Loading:** entering All makes the browsed section (My files) show the grid loader. The other roots show the tree's existing lazy-expand spinner (`loadingPaths`) when expanded.
- **Error:** a section's root failure surfaces through the shell's error/retry panel only while that section is browsed. An expand failure emits the existing `FolderLoadFailed` notification.
- **Empty:** a section root uses that section's `emptyStateByTab` copy via `gateTab`, and subfolders use `folderEmptyStateTitle`, both unchanged.
- **Accessibility:** no new controls. The All chip joins the existing `FilterChips` strip (the `file-manager-tabs` → *Tab strip accessibility* requirement applies unchanged: exactly one `aria-pressed`). Tree semantics and keyboard navigation come from `DialFoldersTree`.
- **RTL:** no new layout. The tree and chips are ui-kit/file-manager components that already use logical properties. No icons are added, so nothing is mirrored.
- **Gating:** not behind `ENABLED_FEATURES`/`ENABLED_FEATURES_ROLES`. Visibility is controlled by `FILE_MANAGER_AVAILABLE_TABS` only, consistent with `file-manager-tab-config` → *No ENABLED_FEATURES_ROLES gating*.
- **Telemetry:** none added.
- **Caching:** no new cache. Each section keeps its own in-memory per-folder listing cache inside its `useDialFileListing` (key = bucket-relative folder path, no TTL). Invalidation is unchanged: mutation-driven `invalidateFolders`/`bumpRetry` within the section, plus a full reset on `sessionKey` change.

## Risks / Trade-offs

- [Two sections translate to the same root label, so routing is ambiguous] → the enabled labels come from distinct i18n keys. `resolveSectionByPath` takes the first match, and a unit test pins that the current `en` labels are pairwise distinct.
- [Three root listings plus `listSharedByMe` when entering All] → only the browsed section's root blocks the grid; the other two are small top-level listings. Accepted. If it proves heavy, D2's `isActive` can be narrowed to "browsed or expanded" without an API change.
- [Merged controller re-renders the shell more often] → the merged object is memoized on the three section results. Only the browsed section's state changes during typical interaction.
- [The app imports `DialFileManagerTabs` from ui-kit in some files, and TS treats the two enum declarations as distinct types] → touched files switch to the file-manager import. The typecheck in `verify:changed` catches any leftover mismatch.
- [Sibling-repo release lag blocks the chat work] → task 1 is the release. Chat tasks start only after the bumped version resolves in `node_modules`.
- [Selection spanning sections] → the grid only selects within the browsed folder, and navigation clears selection as the page does today on tab change (`handleTabChangeWithReset`). The page also clears selection when `sectionTab` changes.

## Migration Plan

1. Release `@epam/ai-dial-react-file-manager` with `DialFileManagerTabs.All`, bump it in this workspace, and run `npm run docs:install-matrix`.
2. Land the hooks, the shell, the backend default and the page in one PR. Deployments with an explicit `FILE_MANAGER_AVAILABLE_TABS` see no change until they add `all`.
3. **Rollback:** set `FILE_MANAGER_AVAILABLE_TABS=my_files,shared,organization` (no deploy of code), or revert the PR. The enum member can stay in the package.

## Open Questions

- Should the copy/move destination popup hide other sections instead of refusing on confirm (D6)? That needs a `destinationItems` prop on `DialFileManager`. Deferred to a follow-up in the sibling repo.
- Should the attach modal get the All tab later? This change keeps the modal single-source (a recorded assumption from the request).
