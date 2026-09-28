Slicing strategy: **contract-first, then vertical.** Slice 1 fixes the lib contract (types, enum, labels) that the hook and page build against; each later slice delivers one add source end to end (lib → hook → page) and is verifiable on its own.

## 1. Lib contract

- [x] 1.1 Add `SkillFileSourceEntry` and the optional `onCreateFolder`, `validateFolderPath`, `extractArchive`, `pickFromFileSystem` members to `SkillEditorFileActions`, and the new `SkillEditorLabels` fields (design D8, `addUploadLabel`/`removeLabel` marked `@deprecated`) in `libs/skill-editor/src/models/skill-editor-props.ts`, with JSDoc and English defaults.
- [x] 1.2 Add the `SkillFileUploadMode` string enum in `libs/skill-editor/src/types/skill-file-upload-mode.ts`; export it and `SkillFileSourceEntry` from `libs/skill-editor/src/index.ts`.
- [x] 1.3 Add pure helpers `joinSkillPath`, `parentSkillPath`, `resolveAddTarget` and `validateFolderName` to `libs/skill-editor/src/utils/file-tree.ts` (extensionless imports, const arrow functions).
- [x] 1.4 Unit tests for 1.3 in `libs/skill-editor/src/utils/tests/file-tree.spec.ts`: root/folder/file targets, sibling of top-level and nested nodes, every folder-name rule in order (empty, `/`, `\`, `.`, `..`, duplicate sibling, root `SKILL.md`).
  Verification: `npm run test:file -- libs/skill-editor/src/utils/tests/file-tree.spec.ts`

## 2. Add dropdown, node menu and target-aware device upload (lib)

- [x] 2.1 In `libs/skill-editor/src/components/SkillFileUploadDialog/SkillFileUploadDialog.tsx` add `targetFolderPath` and `initialEntries` props; prefix every staged path (dropped, picked, initial files, initial entries) with the target.
- [x] 2.2 In `libs/skill-editor/src/components/SkillEditor/SkillEditor.tsx` replace the header `NeutralButton` with a neutral `ButtonDropdown` built by one `buildAddMenuItems(target)` helper; keep surface drag-and-drop targeting the root.
- [x] 2.3 Rework `getContextMenuItems`: Add child (folders), Add sibling (submenus from `buildAddMenuItems`), Delete (`deleteLabel ?? removeLabel ?? 'Delete'`); `SKILL.md` stays `[]`. All Tabler icons pass `stroke={DIAL_KIT_ICON_STROKE}` and `aria-hidden`.
- [x] 2.4 Tests in `libs/skill-editor/src/components/SkillEditor/tests/SkillEditorFiles.spec.tsx` and `libs/skill-editor/src/components/SkillFileUploadDialog/tests/SkillFileUploadDialog.spec.tsx`: menu entries hidden without host callbacks, `aria-expanded` toggles, folder vs file vs `SKILL.md` menus, Delete calls `onRemoveNode`, header/child/sibling targets prefix staged paths.
  Verification: `npm run test:file -- libs/skill-editor/src/components/SkillEditor/tests/SkillEditorFiles.spec.tsx` and `npm run test:file -- libs/skill-editor/src/components/SkillFileUploadDialog/tests/SkillFileUploadDialog.spec.tsx`

## 3. Create folder (lib → hook → page)

- [x] 3.1 In `SkillEditor.tsx` add `draftFolder` state, inject the sentinel draft node into `treeItems`, pass `renamedPath` / `onRenameSave` / `onRenameCancel` / `onRenameValidate` to `DialFoldersTree`, expand the parent, select the created folder, ignore clicks on the draft.
- [x] 3.2 In `libs/chat-hooks/src/skill/useSkillFileActions.ts` add `onCreateFolder` (dedupe) and `validateFolderPath` (via `isValidSkillRelativePath`, `messages.pathInvalid` / `pathReserved`).
- [x] 3.3 Tests: `SkillEditorFiles.spec.tsx` (root and nested creation, duplicate rejected, Escape cancels, dirty fires after host adds the folder) and a new `libs/chat-hooks/src/skill/tests/useSkillFileActions.spec.ts` (folder added once, reserved/invalid paths rejected).
  Verification: `npm run test:file -- libs/skill-editor/src/components/SkillEditor/tests/SkillEditorFiles.spec.tsx` and `npm run test:file -- libs/chat-hooks/src/skill/tests/useSkillFileActions.spec.ts`
- [x] 3.4 Run `npm run verify:changed` for slices 1–3.

## 4. Upload archive (lib → hook)

- [x] 4.1 In `SkillFileUploadDialog.tsx` add `mode` (`SkillFileUploadMode`): archive mode sets title/drop-zone copy, restricts accept to `.zip`, calls `fileActions.extractArchive` per archive, shows a busy spinner with Confirm disabled, and surfaces extraction error / empty archive in the alert region.
- [x] 4.2 Add `extractSkillArchive` in `libs/chat-hooks/src/skill/skill-archive.ts` (fflate `unzipSync`, skip directories / `__MACOSX/` / `.DS_Store`, `/`-normalize, extension→MIME map) and wire it into `useSkillFileActions` as `fileActions.extractArchive`.
- [x] 4.3 Tests: `libs/chat-hooks/src/skill/tests/skill-archive.spec.ts` (structure preserved, junk skipped, `../` entries returned for validation, corrupt input rejects) and archive-mode cases in `SkillFileUploadDialog.spec.tsx` (entries staged under target, per-row errors from `validateBatch`, error and empty messages, Upload archive hidden without `extractArchive`).
  Verification: `npm run test:file -- libs/chat-hooks/src/skill/tests/skill-archive.spec.ts` and `npm run test:file -- libs/skill-editor/src/components/SkillFileUploadDialog/tests/SkillFileUploadDialog.spec.tsx`

## 5. Open DIAL file system (lib → page)

- [x] 5.1 In `SkillEditor.tsx` wire Open DIAL file system: await `fileActions.pickFromFileSystem()`, open the dialog in files mode with `initialEntries` at the target when non-empty.
- [x] 5.2 Add `apps/chat/src/hooks/skills/useSkillFileSystemPicker.ts` (JSDoc'd): open state, Promise resolver ref, `files/{bucket}/{path}` parsing, parallel `downloadFile` from `apps/chat/src/server-api/files.api.ts` into `File`s, error notification via `showErrorNotification`, resolve `undefined` on close/failure; add `pickFromFileSystem` pass-through to `useSkillFileActions`.
- [x] 5.3 In `apps/chat/src/pages/SkillEditor/SkillEditor.tsx` render the lazy `DialFileManagerModal` (mounted only while open, `canAttachFolders={false}`) with the user's bucket, reusing the composer's existing `DialFileManagerI18nKeys` labels.
- [x] 5.4 Tests: `apps/chat/src/hooks/skills/tests/useSkillFileSystemPicker.spec.ts` (attach resolves downloaded files, close resolves `undefined`, failed download notifies and resolves `undefined`), `SkillEditorFiles.spec.tsx` (resolved entries staged, cancel changes nothing), `apps/chat/src/pages/SkillEditor/tests/SkillEditor.spec.tsx` (Add menu shows all four entries on the page).
  Verification: `npm run test:file -- apps/chat/src/hooks/skills/tests/useSkillFileSystemPicker.spec.ts` and `npm run test:file -- apps/chat/src/pages/SkillEditor/tests/SkillEditor.spec.tsx`

## 6. Host labels and i18n

- [x] 6.1 Add `SkillEditorI18nKeys` members in `apps/chat/src/constants/translation-keys.ts` for every new key in the `skill-file-tree-actions` spec, reusing `ButtonsI18nKeys.Add` / `ButtonsI18nKeys.Delete`.
- [x] 6.2 Add the English strings to `apps/chat/src/i18n/locales/en.json` (check for existing identical values first) and pass every new label from the page's `labels` memo.
  Verification: `npm run test:file -- apps/chat/src/pages/SkillEditor/tests/SkillEditor.spec.tsx`

## 7. RTL, a11y and architecture guard

- [x] 7.1 RTL: confirm every new class in `libs/skill-editor` uses logical properties, no new icon needs mirroring, and add an RTL render assertion (`dir="rtl"`) for the Add dropdown in `SkillEditorFiles.spec.tsx`.
- [x] 7.2 Architecture guard: grep `libs/skill-editor/src` for `/api`, `@epam/ai-dial-chat-api-client`, `server-api`, `fflate`, `bucket`, `files/`, `useTranslation` — none may appear; `libs/chat-hooks` changes must not construct a client or import app contexts.
  Verification: `npm run test:file -- libs/skill-editor/src/components/SkillEditor/tests/SkillEditorFiles.spec.tsx`

## 8. Docs and close-out

- [x] 8.1 Update `libs/skill-editor/README.md` (Add dropdown, node menu, new `fileActions` members, `SkillFileSourceEntry`, `SkillFileUploadMode`, new labels, empty-folder note) and `libs/chat-hooks/README.md` (`useSkillFileActions` new behaviour and `pickFromFileSystem` param).
- [x] 8.2 Run `npm run validate:docs`.
- [x] 8.3 Run `npm run verify:full` once, plus `npm run build:quiet` (new lazy modal import on the page).
- [x] 8.4 Follow-up (out of scope, record only): surface drag-and-drop targeting the hovered folder.
