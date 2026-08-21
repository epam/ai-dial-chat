## 1. Backend: standalone manifest extraction service

- [x] 1.1 Add `apps/chat-api/src/skills/import/skills-manifest-import.service.ts` (`SkillsManifestImportService`): `extract(manifestPath, signal)` — `stat` the staged file and reject `413` (`PayloadTooLargeException`) if it exceeds `SKILL_FILE_UPLOAD_MAX_BYTES` before reading content; read + strict-UTF-8 decode (`TextDecoder('utf-8', { fatal: true })`) and reject `400` on invalid bytes; call the existing `parseSkillManifestFrontmatter` and reject `400` on `InvalidSkillManifestError`; call the existing `isValidSkillName` and reject `400` if unsafe; return `{ name, skillManifest, filePaths: [], files: [] }` (SKILL.md travels as `skillManifest`, never as a `filePaths`/`files` entry — `SkillsPackageService` rejects that as redundant) matching `SkillsArchiveExtractionService.extract`'s return shape.
- [x] 1.2 Add `apps/chat-api/src/skills/import/tests/skills-manifest-import.service.spec.ts` covering: valid manifest, oversized file (413, no read attempted), invalid UTF-8, missing/malformed frontmatter, blank `name`/`description`, unsafe derived name, empty file, abort-signal propagation.

## 2. Backend: payload-type detection and orchestration

- [x] 2.1 Rename `apps/chat-api/src/skills/import/skills-archive-import.service.ts` → `skills-import.service.ts` (`SkillsArchiveImportService` → `SkillsImportService`), update its constructor to also inject `SkillsManifestImportService`, and add the branch: if the uploaded file's original filename is exactly `SKILL.md` (case-sensitive), call `SkillsManifestImportService.extract`; otherwise call the existing `SkillsArchiveExtractionService.extract` (which already rejects non-ZIP content by signature). Update the "cannot open" archive error message to name both accepted input forms for the case where neither branch matches.
- [x] 2.2 Update `apps/chat-api/src/skills/skills.module.ts` to register `SkillsManifestImportService` as a provider and reference the renamed `SkillsImportService`.
- [x] 2.3 Update `apps/chat-api/src/skills/skills.controller.ts` and `apps/chat-api/src/skills/skills.service.ts` to reference the renamed service (no route, method name, `operationId`, or DTO changes) — pass `file.originalname` through to the orchestrator so it can branch.
- [x] 2.4 Update `@ApiOperation`/`@ApiBody`/`@ApiResponse` Swagger descriptions on the `import` route to state both accepted input forms and the exact, case-sensitive `SKILL.md` filename requirement.
- [x] 2.5 Rename the corresponding spec file `apps/chat-api/src/skills/import/tests/skills-archive-import.service.spec.ts` → `skills-import.service.spec.ts` and extend it: standalone-manifest branch is selected and delegates to `SkillsManifestImportService`; archive branch is selected and delegates to `SkillsArchiveExtractionService` (regression); a filename that is neither `SKILL.md` nor a valid ZIP is rejected `400` before either extractor runs; abort-signal combination still covers both branches; exactly one `uploadSkillFolder` call is made per successful import of either form.
- [x] 2.6 Extend `apps/chat-api/src/skills/tests/skills.controller.spec.ts`'s `POST /api/v1/skills/import` block with cases for: successful standalone `SKILL.md` upload (201, correct response shape), wrong-case/wrong-name `.md` upload that isn't a ZIP (400), oversized standalone manifest (413), malformed UTF-8 standalone manifest (400), missing/blank frontmatter fields (400), Skill-name collision on a standalone-manifest import (409), and a regression case confirming existing archive-upload requests still succeed unchanged.

## 3. Backend: verification

- [x] 3.1 `npm exec nx test chat-api`
- [x] 3.2 `npm exec nx lint chat-api`
- [x] 3.3 `npm exec nx build chat-api`

## 4. API contract and generated client

- [x] 4.1 Regenerate the OpenAPI source (`npm run openapi`) after the Swagger description changes and confirm no request/response schema fields changed beyond descriptions.
- [x] 4.2 `npm run openapi:check`
- [x] 4.3 `npm exec nx build chat-api-client` and `npm exec nx lint chat-api-client`; confirm `libs/chat-api-client/src/generated/src/apis/SkillsApi.ts`'s `importSkillArchive` method signature and `ImportSkillArchiveRequest` shape are unchanged (description-only diff).

## 5. Frontend: picker, validation, and copy

- [x] 5.1 Update the hidden file input's `accept` attribute in `apps/chat/src/components/CatalogView/CatalogView.tsx` from `".zip"` to `".zip,.md"`.
- [x] 5.2 In `apps/chat/src/hooks/skills/useSkillArchiveImport.ts`, add a pre-submit filename check in `handleFileChange`: a selected file whose name ends in `.md` (case-insensitive) but is not exactly `SKILL.md` (case-sensitive) is rejected locally via the existing validation error state without calling `importSkillArchive`; ensure `event.target.value = ''` is still reset first so re-selecting the same file re-fires the check.
- [x] 5.3 Add/update i18n keys in `apps/chat/src/constants/translation-keys.ts` (`SkillArchiveImportI18nKeys`) and `apps/chat/src/i18n/locales/en.json` (`skillArchiveImport.*`) so the file-input `aria-label` and any "Upload" menu help copy state both accepted forms (ZIP archive or a file named exactly `SKILL.md`).
- [x] 5.4 Confirm no changes are needed in `libs/catalog` (the `children`-shaped Create dropdown already supports the existing "Skill" submenu) — verify by re-reading `CreateButton`/`DropdownItem` usage, do not edit `libs/catalog`.

## 6. Frontend: tests

- [x] 6.1 Extend `apps/chat/src/hooks/skills/tests/useSkillArchiveImport.spec.ts`: selecting a file named exactly `SKILL.md` calls `importSkillArchive` and follows the existing success path; selecting `skill.md`/`readme.md`/any other `.md` name shows the validation error without calling the API; re-selecting the same file after a client-side rejection re-triggers the check; existing archive-upload success/error/concurrency-guard cases still pass unchanged.
- [x] 6.2 Extend `apps/chat/src/server-api/tests/skills.api.spec.ts` if the wrapper's call shape needs a regression assertion for a `SKILL.md`-named `File` object (no signature change expected — verify only).
- [x] 6.3 Manually verify in the running app (`npm start` + `npm run start:api`): keyboard-only file-selection flow, screen-reader announcement of the existing `aria-live` status region on success/error, mobile viewport upload, and RTL (`ar`) layout of the Catalog "Upload" menu item and any error/success toast — confirm no new physical-direction classes were introduced.

## 7. Documentation

- [x] 7.1 Update `openspec/specs/skill-archive-import/spec.md` by applying this change's spec deltas (done automatically on archive, but review wording matches the shipped implementation before archiving).
- [x] 7.2 Review `apps/chat-api/README.md` and `docs/architecture.md` for wording that describes `POST /api/v1/skills/import` as ZIP-only; update if found.
- [x] 7.3 Run `npm run validate:docs` if any README, `docs/**`, or lib public API/`package.json` metadata was touched.
