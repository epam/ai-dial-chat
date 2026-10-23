# Tasks

Slicing strategy: vertical; three slices, all implemented.

## 1. Mobile Files card

- [x] 1.1 Add `SkillFilesSummary` in `libs/skill-editor/src/components/SkillFilesSummary/SkillFilesSummary.tsx` and use it for the mobile Files pane in `libs/skill-editor/src/components/SkillEditor/SkillEditor.tsx`. Verification: `npm run test:file -- libs/skill-editor/src/components/SkillFilesSummary/tests/SkillFilesSummary.spec.tsx libs/skill-editor/src/components/SkillEditor/tests/SkillEditor.spec.tsx`.
- [x] 1.2 Expose `filesCardBackground`, `filesCardBorder`, `editingFileLabelClassName` and `editingFileNameClassName`, and set the 20px mobile gap above the selected file. Verification: `npm run validate:docs`.

## 2. Bottom-sheet dialogs and Create folder

- [x] 2.1 Add `SkillEditorDialog` (`BottomSheet` below `desktop`, `Popup` above it) and move the upload dialog onto it, with the optional drop-zone description. Verification: `npm run test:file -- libs/skill-editor/src/components/SkillEditorDialog/tests/SkillEditorDialog.spec.tsx libs/skill-editor/src/components/SkillFileUploadDialog/tests/SkillFileUploadDialog.spec.tsx`.
- [x] 2.2 Add `SkillCreateFolderDialog` for the mobile pane, reusing `useDraftFolder`'s validation through `validateNewFolder` / `createFolder`. Verification: `npm run test:file -- libs/skill-editor/src/components/SkillEditor/tests/SkillEditorFiles.spec.tsx`.

## 3. Replace or duplicate

- [x] 3.1 Ask Replace / Duplicate in the upload dialog for an existing file's path; stage `replacesExisting` or a `buildDuplicatePath` name; move focus with the step. Verification: `npm run test:file -- libs/skill-editor/src/components/SkillFileUploadDialog/tests/SkillFileUploadDialog.spec.tsx`.
- [x] 3.2 Accept replacements and reject folder paths in `validateSkillFileBatch`; overwrite without a new node and bump `contentRevisions` in `useSkillFileActions`. Verification: `npm run test:file -- libs/chat-hooks/src/skill/tests/skill-file-batch-validation.spec.ts libs/chat-hooks/src/skill/tests/useSkillFileActions.spec.ts`.
- [x] 3.3 Mark the editor dirty after a replacing commit; reopen a replaced preview; fingerprint `contentRevisions` for a create retry. Verification: `npm run test:file -- libs/skill-editor/src/components/SkillEditor/tests/SkillEditorFiles.spec.tsx libs/chat-hooks/src/skill/tests/useSkillEditorSubmit.spec.ts apps/chat/src/hooks/attachment/tests/useSkillFilePreviewSync.spec.ts`.
- [x] 3.4 Wire the host labels and i18n keys in `apps/chat/src/pages/SkillEditor/SkillEditor.tsx`. Verification: `npm run test:file -- apps/chat/src/pages/SkillEditor/tests/SkillEditor.spec.tsx`.

## 4. Specs and docs

- [x] 4.1 Update the main specs and both lib READMEs, then run `npm run validate:specs` and `npm run validate:docs`. Verification: both commands pass.
