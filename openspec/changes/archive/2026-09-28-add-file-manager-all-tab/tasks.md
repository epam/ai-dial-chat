<!--
Slicing strategy: risk-first, then vertical.
- Slice 1 unblocks everything: the enum lives in the sibling repo and must be released first.
- Slices 2–3 prove the highest-risk piece (per-section activation + path routing) in chat-hooks with unit tests before any UI depends on it.
- Slices 4–7 then wire shell → config → backend → page end to end.
-->

## 1. Enum member in @epam/ai-dial-react-file-manager (sibling repo, blocks all later slices)

- [x] 1.1 In `c:\projects\ai-dial-react-file-manager\src\types\file-manager.ts`, add `All = 'all'` as the first member of `DialFileManagerTabs`, with a JSDoc line. Change nothing else in `use-file-manager-tabs.tsx`: it already maps `Object.values`.
  - Verification: `npx vitest run src/components/FileManager/hooks/__tests__/use-file-manager-tabs.spec.tsx` in the sibling repo, after adding a case asserting the first tab is `all`.
- [x] 1.2 Document the new member in the sibling repo's `README.md` tab section, release it as the next `0.3.0-dev.N`, and record the version here. Released as `0.3.0-dev.15` (PR epam/ai-dial-react-file-manager#51); the sibling README documents no tab members, so it needed no change.
- [x] 1.3 In this workspace, bump `@epam/ai-dial-react-file-manager` to that version at one range in root `package.json`, `libs/chat-hooks/package.json`, `libs/chat-shared/package.json`, `libs/publish-panel/package.json` and `libs/skill-editor/package.json`. Run `npm install`, then `npm run docs:install-matrix`, and commit the regenerated `docs/host-install-matrix.md`.
  - Verification: `npm run validate:docs`, plus `npm exec nx run-many -t typecheck -p chat-hooks chat-shared chat`. Expect failures only on `Record<DialFileManagerTabs, …>` literals missing an `all` key; slice 4 fixes the shell's and slice 7 the app's. List any other failure here as a follow-up.

## 2. Listing activation and session reset (libs/chat-hooks)

- [x] 2.1 In `libs/chat-hooks/src/files/useDialFileListing/useDialFileListing.ts`, add `isActive?: boolean` (default `true`) and `sessionKey?: string` to `UseDialFileListingOptions`, each with a JSDoc that states its default:
  - Extend the `prevTabRef` reset guard to the combined `${activeTab}|${sessionKey ?? ''}` key.
  - Make the navigation effect and the `listSharedByMe` effect return early (setting `isLoading` to `false`) when inactive, and add `isActive` to their dependency arrays.
  - Make `onExpandedPathsChange`, `onFolderPopupPathChange` and `onSearchFiles` no-ops when inactive.
- [x] 2.2 Thread both options through `UseDialFileManagerOptions` (`libs/chat-hooks/src/files/dial-file-manager.types.ts`) and `useDialFileManager.ts`, passing them to `useDialFileListing` only.
- [x] 2.3 Unit tests in `libs/chat-hooks/src/files/useDialFileListing/tests/useDialFileListing.spec.tsx` for the spec scenarios:
  - an inactive listing makes no requests
  - activation loads the root
  - expand is a no-op while inactive
  - changing `sessionKey` resets navigation
  - a stable `sessionKey` keeps state
  - omitting both options behaves as before (existing tests stay green)
  - Verification: `npm run test:file -- libs/chat-hooks/src/files/useDialFileListing/tests/useDialFileListing.spec.tsx` and `npm run test:file -- libs/chat-hooks/src/files/useDialFileManager/tests/useDialFileManager.spec.tsx`.

## 3. Section composer and path routing (libs/chat-hooks)

- [x] 3.1 Add `resolveSectionByPath(path, sections)` to `libs/chat-hooks/src/files/dial-file-manager-path.util.ts`. It matches the first segment exactly (`/${label}` or `/${label}/…`), normalizes the leading slash, and returns `undefined` for no match. Add tests to `libs/chat-hooks/src/files/tests/dial-file-manager-path.util.spec.ts`: exact root, nested path, a `Shared stuff` folder not matching `Shared`, and an unmatched path.
  - Verification: `npm run test:file -- libs/chat-hooks/src/files/tests/dial-file-manager-path.util.spec.ts`.
- [x] 3.2 Add `FileManagerNotificationReason.CrossSectionTransferUnsupported` to `libs/chat-hooks/src/files/dial-file-manager.types.ts` (JSDoc line). Make `fetchByTab` in `libs/chat-hooks/src/files/dial-file-manager-mapping.util.ts` reject with an `Error` for `DialFileManagerTabs.All`, with a test in `libs/chat-hooks/src/files/tests/dial-file-manager-mapping.util.spec.ts` ("fetchByTab refuses All").
  - Verification: `npm run test:file -- libs/chat-hooks/src/files/tests/dial-file-manager-mapping.util.spec.ts`.
- [x] 3.3 Create `libs/chat-hooks/src/files/useDialFileManagerSections/useDialFileManagerSections.ts` per design D1/D3/D6:
  - three unconditional `useDialFileManager` calls (MyFiles, Shared, Organization), each with its fixed tab, `isActive` and `sessionKey = activeTab`
  - a passthrough of the section result for single tabs
  - on All: browsed-section state (reset on `activeTab` change), the merged memoized result, and routed memoized callbacks
  - the cross-section refusal for copy/move
  - `sectionTab`
  - exported `DialFileManagerSection`, `UseDialFileManagerSectionsOptions` and `UseDialFileManagerSectionsResult` types, with JSDoc on every property
  - Export it all from `libs/chat-hooks/src/index.ts`. Use extensionless relative imports and arrow-function helpers.
- [x] 3.4 Unit tests in `libs/chat-hooks/src/files/useDialFileManagerSections/tests/useDialFileManagerSections.spec.tsx`, with a mocked `DialFilesApi`, covering every scenario of the `file-manager-all-tab` spec's composer, All view, routing, cross-section and reset requirements:
  - a single tab passes the section result through unchanged
  - a disabled section never loads
  - hook order is independent of `sections`
  - three roots appear in order
  - expanding Shared routes only `/Shared` paths
  - browsing a shared folder applies Shared rules
  - the Shared root disables upload
  - Organization is read-only
  - My files actions match the My files tab
  - delete routes to the owning section
  - a label prefix does not mis-route
  - the upload queue survives section navigation
  - copying from Organization into My files is refused
  - a move within My files proceeds
  - switching All → My files resets navigation
  - Verification: `npm run test:file -- libs/chat-hooks/src/files/useDialFileManagerSections/tests/useDialFileManagerSections.spec.tsx`.
- [x] 3.5 Architecture guard: confirm `useDialFileManagerSections.ts` imports no `apps/*`, `server-api`, app context, `react-i18next`, env or config, and builds no client. It only uses the injected `filesApi` and parameters. Record the check in the PR description.
- [x] 3.6 Update `libs/chat-hooks/README.md` with a `useDialFileManagerSections` subsection whose example compiles against the real signature (including required `sections`/`activeTab`), and document the `isActive`/`sessionKey` options.
  - Verification: `npm run validate:docs`; after the slice, `npm run verify:changed`.

## 4. Shell gates on sectionTab (libs/chat-shared)

- [x] 4.1 Add `sectionTab?: DialFileManagerTabs` (JSDoc: source tab of the browsed folder, never `All`, omitted by single-source controllers) to `libs/chat-shared/src/file-manager/file-manager-controller.ts`. Extend `libs/chat-shared/src/file-manager/tests/file-manager-controller.spec.ts` so that both `UseDialFileManagerResult` and `UseDialFileManagerSectionsResult` stay assignable.
- [x] 4.2 In `libs/chat-shared/src/file-manager/DialFileManagerShell/DialFileManagerShell.tsx`, compute `gateTab = controller.sectionTab ?? activeTab` and use it for `showUploadArchiveAction`, the root `emptyStateByTab` lookup and the grid-editing-scroll reset effect. Keep `activeTab` for `treeOptions.activeTab` and `treeHeaderByTab`.
- [x] 4.3 Tests in `apps/chat/src/components/DialFileManagerShell/tests/DialFileManagerShell.spec.tsx`, using role/label/text queries:
  - the upload-archive entry is shown on All inside My files
  - the entry is hidden on All inside Organization
  - the root empty state follows the section
  - the strip still shows All pressed (`aria-pressed`)
  - controllers without `sectionTab` behave as before
  - Add the `all` key to the fixtures' `Record<DialFileManagerTabs, …>` literals.
  - Verification: `npm run test:file -- apps/chat/src/components/DialFileManagerShell/tests/DialFileManagerShell.spec.tsx` and `npm run test:file -- libs/chat-shared/src/file-manager/tests/file-manager-controller.spec.ts`.
- [x] 4.4 Update `libs/chat-shared/README.md` wherever it documents `FileManagerController`/`DialFileManagerShell`, adding `sectionTab` and noting that the `all` key is now required in `treeHeaderByTab`/`emptyStateByTab`.
  - Verification: `npm run validate:docs`.

## 5. Tab config and picker exclusion (libs/chat-hooks)

- [x] 5.1 In `libs/chat-hooks/src/files/useDialFileManagerTabConfig/useDialFileManagerTabConfig.ts`:
  - Prepend `All` to `TAB_PRIORITY_ORDER`.
  - Drop `All` from `tabs` unless at least two of `my_files`/`shared`/`organization` are enabled.
  - Run the correction effect against the rendered `tabs`.
  - Keep `tabs` `useMemo`'d.
- [x] 5.2 Tests in `libs/chat-hooks/src/files/useDialFileManagerTabConfig/tests/useDialFileManagerTabConfig.spec.ts` for every scenario in the `file-manager-tab-config` delta:
  - the default renders four tabs with All first
  - a legacy explicit config without `all` is unchanged
  - All is hidden when only one source tab is enabled
  - a narrowed config hides a tab
  - a config excluding `my_files` corrects the active tab on mount
  - a late config corrects the active tab
  - unknown ids are ignored
- [x] 5.3 In `libs/chat-hooks/src/files/useFileAttachmentPicker/useFileAttachmentPicker.ts`, always remove `All` from the chip list and correct an `initialTab` of `All` to the first enabled source tab. Add tests to `libs/chat-hooks/src/files/useFileAttachmentPicker/tests/useFileAttachmentPicker.spec.ts` ("default config shows three tabs", "initialTab of All is corrected").
  - Verification: `npm run test:file -- libs/chat-hooks/src/files/useDialFileManagerTabConfig/tests/useDialFileManagerTabConfig.spec.ts` and `npm run test:file -- libs/chat-hooks/src/files/useFileAttachmentPicker/tests/useFileAttachmentPicker.spec.ts`; after the slice, `npm run verify:changed`.

## 6. Backend accepts and defaults to all (apps/chat-api)

- [x] 6.1 Follow `apps/chat-api/AGENTS.md`. Update:
  - `FILE_MANAGER_ALLOWED_TABS` in `apps/chat-api/src/app-config/config-registry/env-config.provider.ts` to `['all', 'my_files', 'shared', 'organization']`
  - the `fileManager.availableTabs` `defaultValue` in `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`
  - the default list in `apps/chat-api/src/app-config/client-config.mapper.ts`
  - the `@ApiProperty` example in `apps/chat-api/src/app-config/dto/client-config-response.dto.ts`
- [x] 6.2 Tests:
  - `apps/chat-api/src/app-config/tests/config-registry/env-config.provider.spec.ts`: `all` is an accepted id, the unset default is four tabs, a fully-invalid value falls back to four tabs
  - `apps/chat-api/src/app-config/tests/config-registry/config-registry.constants.spec.ts`: the default value lists `all` first
  - `apps/chat-api/src/app-config/tests/client-config.mapper.spec.ts` and `apps/chat-api/src/app-config/tests/app-config.controller.spec.ts`: the default deployment returns four tabs
  - Verification: `npm run test:file -- apps/chat-api/src/app-config/tests/config-registry/env-config.provider.spec.ts`, then the other three spec files the same way; then `npm exec nx lint chat-api`.
- [x] 6.3 Run `npm run openapi` and `npm run openapi:check`, then `npm exec nx build chat-api-client` and `npm exec nx lint chat-api-client`. Only the example should change in `libs/chat-api-client/openapi.json`; do not hand-edit generated files.
- [x] 6.4 Update the `FILE_MANAGER_AVAILABLE_TABS` row in `apps/chat-api/README.md` (allowed ids now include `all`, default `all,my_files,shared,organization`, All shown only with ≥2 source tabs) and the commented default in `apps/chat-api/.env.template`.
  - Verification: `npm run validate:docs`.

## 7. Page wiring, i18n and notification (apps/chat)

- [x] 7.1 i18n (dedicated): add `dialFileManager.tab.all` ("All") and `dialFileManager.crossSectionTransferUnsupported` ("Copying and moving between My files, Shared, and Organization isn't supported yet.") to `apps/chat/src/i18n/locales/en.json`, the only locale file in the repo. Add `TabAll` and `CrossSectionTransferUnsupported` to `DialFileManagerI18nKeys` in `apps/chat/src/constants/translation-keys.ts`.
- [x] 7.2 Update `DEFAULT_FILE_MANAGER_TABS` in `apps/chat/src/context/AppConfigContext.tsx` to `['all', 'my_files', 'shared', 'organization']`, and update `apps/chat/src/context/tests/AppConfigContext.spec.tsx` ("context exposes the default before the config request resolves").
  - Verification: `npm run test:file -- apps/chat/src/context/tests/AppConfigContext.spec.tsx`.
- [x] 7.3 Map `CrossSectionTransferUnsupported` to a warning with `t(DialFileManagerI18nKeys.CrossSectionTransferUnsupported)` in `apps/chat/src/components/DialFileManagerShell/file-manager-notification-adapter.ts`, using the notification variant helper (not `showNotification` with an explicit variant). Add a test in `apps/chat/src/components/DialFileManagerShell/tests/file-manager-notification-adapter.spec.ts`.
  - Verification: `npm run test:file -- apps/chat/src/components/DialFileManagerShell/tests/file-manager-notification-adapter.spec.ts`.
- [x] 7.4 In `apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx`:
  - Import `DialFileManagerTabs` from `@epam/ai-dial-react-file-manager`.
  - Add `All` entries to `tabLabels` (`TabAll`), `emptyStateByTab` (My files copy, never read) and `treeHeaderByTab` (`MyFilesTreeHeader`).
  - Call `useDialFileManagerTabs(tabLabels, DialFileManagerTabs.All)`.
  - Build the `useMemo`'d `sections` from `fileManagerTabs`.
  - Replace `useDialFileManager` with `useDialFileManagerSections`.
  - Clear `selectedPaths` when the active tab or `sectionTab` changes.
- [x] 7.5 Add the `all` key to the `Record<DialFileManagerTabs, …>` literals in `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`, switching its enum import to `@epam/ai-dial-react-file-manager`. The modal behaviour is otherwise unchanged (the picker drops All).
- [x] 7.6 Tests in `apps/chat/src/pages/DialFileManagerPage/tests/DialFileManagerPage.spec.tsx` (role/label/text queries): _Note: `DialFileManagerModal.spec.tsx` stubs `useFileAttachmentPicker` with a fake, so an All case there would only test the fake; the real exclusion is covered in `useFileAttachmentPicker.spec.ts` (task 5.3)._
  - the page opens on the All tab with My files browsed
  - a deployment without `all` opens on My files
  - navigating to another section clears the selection
  - the existing tab and size-limit scenarios stay green
  - Update `apps/chat/src/components/DialFileManagerModal/tests/DialFileManagerModal.spec.tsx` so that the default config shows three tabs in the attach modal.
  - Verification: `npm run test:file -- apps/chat/src/pages/DialFileManagerPage/tests/DialFileManagerPage.spec.tsx` and `npm run test:file -- apps/chat/src/components/DialFileManagerModal/tests/DialFileManagerModal.spec.tsx`.
- [x] 7.7 RTL and responsive (dedicated): confirm the change adds no physical-direction classes and no directional icons. Add a page-spec case rendering under `dir="rtl"` that asserts the All chip is first and the tree roots keep their order. Confirm the existing 360px layout requirement (`file-manager-standalone-page` → *Page fits at 360px width with no horizontal scroll*) holds with four chips: the strip wraps or scrolls inside its own container, not the page.
  - Verification: `npm run test:file -- apps/chat/src/pages/DialFileManagerPage/tests/DialFileManagerPage.spec.tsx`; after the slice, `npm run verify:changed` and `npm run build:quiet` (the page bundle and lib exports change).

## 8. Close-out

- [x] 8.1 Grep `apps/chat/src` and `libs/*/src` for any remaining `Record<DialFileManagerTabs` literal or `DialFileManagerTabs` switch lacking `All` that typecheck did not already flag, and fix only those touched by this change. List anything else as a follow-up below.
- [ ] 8.2 Run `npm run validate:docs` and `npm run openapi:check`, then exactly one `npm run verify:full`.

## Follow-ups (out of scope, do not implement here)

- [ ] F.1 Sibling repo: a `destinationItems` prop on `DialFileManager`, so the copy/move popup hides other sections instead of refusing on confirm (design Open Question, D6).
- [ ] F.2 Decide whether the attach modal should offer All (proposal Non-goals).
