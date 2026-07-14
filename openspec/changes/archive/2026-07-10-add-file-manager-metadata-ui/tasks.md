## 1. Hook — metadata state and onGetInfo

- [x] 1.1 Add `fileMetadata: DialFile | undefined` and `isFileMetadataLoading: boolean` state to `useDialFileManager` (`apps/chat/src/hooks/files/useDialFileManager.ts`)
- [x] 1.2 Add `onGetInfo(file: DialFile)` `useCallback` to `useDialFileManager`: resolve `file` to `{ bucket, path }` reusing the exact per-tab resolution helper `onDownloadFiles` already calls (current user bucket on `my_files`; item's own bucket for root-level `shared` items; `sharedRootMetaRef`/`resolveOwnerCoords` for nested `shared` folder children; public bucket on `organization`); set `isFileMetadataLoading` true, call `getFileMetadata`, map the `FileMetadataResponseDto` response into the hook's existing `DialFile`-shaped normalization, set `fileMetadata`, clear loading
- [x] 1.3 On `getFileMetadata` rejection, call `onNotification(NotificationVariant.Error, ...)` with a dedicated info-error message and clear `isFileMetadataLoading`
- [x] 1.4 Add `clearMetadata(): void` `useCallback` resetting `fileMetadata` to `undefined` and `isFileMetadataLoading` to `false`
- [x] 1.5 Write unit tests in the hook's existing test file: `onGetInfo` resolves the correct bucket/path per tab (my_files, shared root item, shared nested item, organization), sets/clears loading, populates `fileMetadata` on success, shows a toast and clears loading on failure, `clearMetadata` resets state
- [x] 1.6 Run `npm exec nx test chat` and `npm exec nx lint chat` — both must pass

## 2. Shell wiring

- [x] 2.1 Pass `fileMetadataPopupOptions={{ fileMetadata, loading: isFileMetadataLoading, clearMetadata, header, nameLabel, pathLabel, modifiedDateLabel, sizeLabel, authorLabel }}` (all six label fields translated via new `DialFileManagerShellLabels` fields, per D5) and `onGetInfo` from `useDialFileManager`'s result through `DialFileManagerShell` (`apps/chat/src/components/DialFileManagerShell/DialFileManagerShell.tsx`) to the underlying `DialFileManager` props, matching the installed ui-kit's `FileMetadataPopupOptions` shape exactly
- [x] 2.2 Extend the shell's `gridOptions.actionLabels` computation (grid-only variant of `actionLabels`) to include `DialFileManagerActions.Info` when `actionProfile === DialFileManagerActionProfile.Full` (ui-kit's own per-row context-menu builder excludes folder rows internally — confirmed via `use-grid-context-menu.d.ts`'s `onInfo: (file: DialFile) => void`); computed in the hook's `actionLabels` memo (tab-independent, unlike Delete/Rename/Copy) so Shell's existing `X in tabActionLabels` pattern applies; do not add it to `treeOptions` or `bulkActionsToolbarOptions` actionLabels
- [x] 2.3 Add `infoLabel` and the six `metadata*Label`/`metadataHeader` fields to `DialFileManagerShellLabels` (`apps/chat/src/components/DialFileManagerShell/types/labels.ts`)
- [x] 2.4 Write/extend shell tests: `Info` appears in `gridOptions.actionLabels` with `Full` profile on all three tabs, absent when profile is `Browse`/`Attach`, never present in `treeOptions`/`bulkActionsToolbarOptions` actionLabels; `fileMetadataPopupOptions` contains `fileMetadata`/`loading`/`clearMetadata` plus the six translated label fields
- [x] 2.5 Run `npm exec nx lint chat` and `npm exec nx build chat` — both must pass

## 3. i18n

- [x] 3.1 Add `dialFileManager.infoAction` to `apps/chat/src/i18n/locales/en.json` with a matching `DialFileManagerI18nKeys.InfoAction` member in `apps/chat/src/constants/translation-keys.ts`
- [x] 3.2 Add `dialFileManager.getInfoError` (`DialFileManagerI18nKeys.GetInfoError`) plus the six metadata-popup label keys (`metadataHeader`, `metadataNameLabel`, `metadataPathLabel`, `metadataModifiedDateLabel`, `metadataSizeLabel`, `metadataAuthorLabel`) to `en.json` + `DialFileManagerI18nKeys`, per D5 — the installed ui-kit's `FileMetadataPopupOptions` does expose a label-override prop surface (corrected from an earlier draft of design.md)

## 4. file-manager-tabs spec and full verification

- [x] 4.1 Confirm `DialFileManagerPage` (`apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx`) still passes `actionProfile: DialFileManagerActionProfile.Browse` — this change does NOT flip it to `Full`
- [x] 4.2 Confirm the attach-modal flow (`actionProfile=Attach`) is unaffected — `Info` is gated on `Full` only
- [x] 4.3 Run `npm exec nx affected --target=test --base=origin/development-1.0` — all must pass
- [x] 4.4 Run `npm exec nx affected --target=lint --base=origin/development-1.0` — all must pass
- [x] 4.5 Run `npm exec nx affected --target=build --base=origin/development-1.0` — all must pass
