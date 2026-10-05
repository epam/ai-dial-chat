Slicing strategy: **risk-first, then vertical**. The BFF acceptance of the marker comes first (design D5 and the Core risk). Then save, load, and the details panel follow as independently verifiable slices.

## 1. BFF accepts the zero-byte folder marker (risk-first)

- [x] 1.1 In `apps/chat-api/src/skills/package/skills-package.service.ts` `validateAndBuildFormData`, accept a `filePaths[i]` containing a `MARKER_NAME` segment (import from `apps/chat-api/src/files/files.constants.ts`) only when it is the non-first final segment, the prefix passes `isValidSkillRelativePath`, and `files[i].buffer.length === 0`. Throw the existing `Invalid supporting file path: …` `BadRequestException` otherwise. Leave the shared `isValidSkillRelativePath` in `apps/chat-api/src/skills/utils/skill-path.util.ts` unchanged (design D5: reserving it there would break the import of Core-exported archives).
- [x] 1.2 Unit tests:
  - In `apps/chat-api/src/skills/package/tests/skills-package.service.spec.ts`: a zero-byte `docs/.dial_folder` is accepted and forwarded as a part; a 5-byte marker, a root `.dial_folder`, `.dial_folder/a.md`, `a/.dial_folder/b`, and a marker under `../` are rejected with 400; a marker counts toward the file-count limit.
  - In `apps/chat-api/src/skills/utils/tests/skill-path.util.spec.ts`: a regression test that the shared validator still accepts `docs/.dial_folder`.
- [x] 1.3 Integration coverage:
  - `apps/chat-api/src/skills/tests/skills.controller.spec.ts` (supertest; the service is mocked): a zero-byte marker part survives multipart parsing and reaches `createSkill` with a 0-length buffer.
  - `apps/chat-api/src/skills/upload/tests/skills-upload.service.spec.ts` (real `SkillsPackageService`, mocked SDK): `updateSkill` forwards the marker part to `uploadSkillFolder`, and a non-empty marker is rejected without calling it.

Verification:
- `npm run test:file -- apps/chat-api/src/skills/package/tests/skills-package.service.spec.ts`
- `npm run test:file -- apps/chat-api/src/skills/utils/tests/skill-path.util.spec.ts`
- `npm run test:file -- apps/chat-api/src/skills/tests/skills.controller.spec.ts`
- Then `npm run verify:changed`. `npm run openapi:check` must stay clean, since no DTO changes.

## 2. Save emits markers for empty folders

Depends on 1.

- [x] 2.1 In `libs/chat-hooks/src/skill/skill.ts`, add the marker helpers as const arrow functions: `SKILL_FOLDER_MARKER` (= `HIDDEN_FILE` from `@epam/ai-dial-chat-shared`), `isSkillFolderMarkerPath`, and `skillFolderMarkerParent`. Export them from the skill barrel only if another module needs them.
- [x] 2.2 In `buildSkillFilesPayload` (same file), append a zero-byte `<folder>/.dial_folder` entry, after the real files, for every Folder node with no descendant node. Update its JSDoc.
- [x] 2.3 In the client `isValidSkillRelativePath` (same file), reserve `.dial_folder`. Update the doc comment to record that the BFF additionally accepts the zero-byte final-segment form.
- [x] 2.4 Unit tests in `libs/chat-hooks/src/skill/tests/skill.spec.ts`:
  - marker for a leaf empty folder
  - no marker for `a` when `a/b` exists
  - no marker for a folder that has a file
  - markers ordered after files, with zero-size blobs
  - helper edge cases (root `.dial_folder` is not a marker)
  - the validator rejects `.dial_folder`
- [x] 2.5 Tests: in `libs/chat-hooks/src/skill/tests/useSkillFileActions.spec.ts`, `validateFolderPath` rejects `.dial_folder` and `docs/.dial_folder`; in `libs/chat-hooks/src/skill/tests/skill-file-batch-validation.spec.ts`, the batch validator marks a staged `docs/.dial_folder` as `pathInvalid`.
- [x] 2.6 Test in `libs/chat-hooks/src/skill/tests/useSkillEditorSubmit.spec.ts`: an edit save with an empty folder node passes `docs/.dial_folder` to `updateSkill`.

Verification:
- `npm run test:file -- libs/chat-hooks/src/skill/tests/skill.spec.ts`
- `npm run test:file -- libs/chat-hooks/src/skill/tests/useSkillFileActions.spec.ts`
- `npm run test:file -- libs/chat-hooks/src/skill/tests/useSkillEditorSubmit.spec.ts`
- Then `npm run verify:changed`.

## 3. Load restores folders from markers

Depends on 2.

- [x] 3.1 In `libs/chat-hooks/src/skill/skill.ts` `unpackSkillArchive`, route marker entries into a new `folders: string[]` field on `UnpackedSkillArchive` instead of `files`, and update its JSDoc.
- [x] 3.2 In `libs/chat-hooks/src/skill/useSkillEditorLoad.ts`:
  - add `folders` to `LoadedSkill`
  - in `loadSkillArchive`, pass the unpacked `folders` through
  - in `loadSkillFiles`, move marker items into `folders` before the download fan-out
  - in the load effect, `setFiles` with the file nodes followed by Folder nodes for the marker parents that are not already file paths
- [x] 3.3 In `libs/chat-hooks/src/skill/useSkillFileActions.ts` `extractArchive`, skip entries for which `isSkillFolderMarkerPath` is true, alongside `.DS_Store`.
- [x] 3.4 Tests in `libs/chat-hooks/src/skill/tests/skill.spec.ts` (where the `unpackSkillArchive` suite lives): a ZIP with `docs/.dial_folder` yields `folders: ['docs']` and no `files` key for it.
- [x] 3.5 Tests in `libs/chat-hooks/src/skill/tests/useSkillEditorLoad.spec.ts`:
  - ZIP route produces a `docs` Folder node and no content-map entry
  - listing fallback produces a Folder node and never calls `downloadSkillFile` for the marker
- [x] 3.6 Test in `libs/chat-hooks/src/skill/tests/skill-archive.spec.ts` (the `extractSkillArchive` suite behind `fileActions.extractArchive`): it skips `docs/.dial_folder`.

Verification:
- `npm run test:file -- libs/chat-hooks/src/skill/tests/skill-archive.spec.ts`
- `npm run test:file -- libs/chat-hooks/src/skill/tests/useSkillEditorLoad.spec.ts`
- `npm run test:file -- libs/chat-hooks/src/skill/tests/useSkillFileActions.spec.ts`
- Then `npm run verify:changed`.

## 4. Details panel hides the marker

Independent of 3; depends on 2.1.

- [x] 4.1 In `libs/chat-hooks/src/catalog/map-skill-to-catalog-item.ts` `buildSkillContentTree`, treat an item named `SKILL_FOLDER_MARKER` as a folder entry for its stripped parent path, skipping it when the parent is empty, and never emit a file node for it. Update the function's JSDoc.
- [x] 4.2 Tests in `libs/chat-hooks/src/catalog/tests/map-skill-to-catalog-item.spec.ts`:
  - a relative `docs/.dial_folder` yields an empty `docs` folder
  - a Core-prefixed `{skillPath}/files/docs/.dial_folder` is hidden
  - a root-level marker yields nothing
  - the file count excludes the marker (counted with a local file-node counter, since `countFileNodes` is internal to `libs/catalog`)

Verification:
- `npm run test:file -- libs/chat-hooks/src/catalog/tests/map-skill-to-catalog-item.spec.ts`
- Then `npm run verify:changed`.

## 5. Architecture guard and docs

- [x] 5.1 Architecture guard: confirm that `libs/skill-editor`, `libs/catalog` and `libs/skills` contain no reference to `.dial_folder` or `HIDDEN_FILE`. Confirm that the `libs/chat-hooks` changes add no client construction, app context, env, route or i18n import, and that relative imports stay extensionless.
- [x] 5.2 In `libs/skill-editor/README.md`, replace "A folder exists only in the editor until a file is added to it — the host decides whether an empty folder survives a save." with a statement that the library treats folders as plain nodes and persistence is the host's concern (the DIAL Chat host keeps empty folders through a storage marker).
- [x] 5.3 Also update `libs/chat-hooks/README.md` (new public marker helpers via its `export *` of `skill/skill`, payload/unpack/`extractArchive` behaviour). Run `npm run validate:docs`.

## 6. Close

- [x] 6.1 Run `npm run verify:full` once. Every step of `verify:full` passed, but each was run separately: on this machine every Nx run exits 1 at shutdown (`os error 32`, a file lock held by another Nx process), after the step's own "Successfully ran" line. That exit code stops the `&&` chain.
  - typecheck: 34 projects
  - lint: 37 projects
  - test: 35 projects
  - `format:check` run directly
- [ ] 6.2 Follow-up, out of scope: consider counting empty-folder markers in `validateBatch`'s projected file count (`libs/chat-hooks/src/skill/skill-file-batch-validation.ts`) so the limit error appears before Save.
