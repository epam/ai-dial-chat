## 1. Backend: archive extraction and validation core (risk-first — the security boundary)

- [x] 1.1 Add `SKILL_ARCHIVE_UPLOAD_MAX_BYTES` (default 20 MiB) to `apps/chat-api/src/config/environment.config.ts` `EnvironmentVariables`, validated alongside the existing `SKILL_UPLOAD_MAX_FILES`/`SKILL_FILE_UPLOAD_MAX_BYTES`/`SKILL_UPLOAD_MAX_TOTAL_BYTES`/`SKILL_TRANSFER_TIMEOUT_MS`; add it to `apps/chat-api/.env.template` and document it in `apps/chat-api/README.md`.
- [x] 1.2 Create `apps/chat-api/src/skills/import/skills-archive-extraction.service.ts` (or equivalent name) implementing container validation (ZIP signature, corrupt/truncated rejection), the two-pass `yauzl` entry-count ceiling check, and wrapper-directory detection/stripping per design.md D4.
- [x] 1.3 In the same service, implement per-entry path-safety checks reusing `isValidSkillRelativePath`/`SKILL_MANIFEST_FILE` from `apps/chat-api/src/skills/utils/skill-path.util.ts`, plus new encrypted-entry and symbolic-link-entry rejection (design.md D5) and directory-entry exclusion.
- [x] 1.4 Implement exactly-one-manifest and duplicate-normalized-path detection (design.md D4 steps 4–5), each producing the specified `400`/`422` outcome.
- [x] 1.5 Implement incremental decompressed-size enforcement while streaming each entry (per-file 1 MiB, total 16 MiB), aborting the read on first breach rather than trusting declared ZIP metadata (design.md D6).
- [x] 1.6 Implement strict-UTF-8 decoding of the extracted `SKILL.md` and YAML-frontmatter parsing requiring non-empty string `name`/`description`, reusing the existing manifest-parsing utility referenced by `skill-manifest-parsing` rather than a second parser.
- [x] 1.7 Unit test (`apps/chat-api/src/skills/import/skills-archive-extraction.service.spec.ts`) covering: corrupt ZIP, truncated ZIP, non-ZIP with `.zip` extension, too-many-entries, single wrapper directory stripped correctly, ambiguous multi-directory layout rejected, zero-manifest rejected, multiple-manifest rejected, duplicate normalized paths, directory entries excluded, ZIP-slip (`..`/absolute/backslash) paths rejected, reserved-segment (`files`/`v`) paths rejected, `.dial-resource`/`.dial-folder` segments rejected, encrypted entry rejected, symlink entry rejected, per-file size limit breached mid-stream, total size limit breached mid-stream, file-count limit breached, invalid UTF-8 manifest rejected, missing/malformed frontmatter rejected, empty `name`/`description` rejected.
- [x] 1.8 Prove via unit test that every rejection path in 1.7 produces zero calls into any Core-facing collaborator (mock `SkillsUploadService`/`SkillsPackageService` and assert zero invocations).

## 2. Backend: disk staging, interceptor, and cleanup

- [x] 2.1 Add a Skill-specific archive-upload interceptor (new file under `apps/chat-api/src/skills/import/`, modeled on `apps/chat-api/src/files/archive-upload.interceptor.ts:18`) using Multer `diskStorage` with `SKILL_ARCHIVE_UPLOAD_MAX_BYTES` as the `fileSize` limit and `.single('file')`.
- [x] 2.2 Implement guaranteed cleanup (temp file removal, open `yauzl` handle close) on success, every validation failure, timeout, and unexpected error, reusing the basename/path-containment safety check from `archive-upload.interceptor.ts` for the deletion step itself.
- [x] 2.3 Implement timeout and client-disconnect abort using `AbortSignal.any([signal, timeoutSignal])` plus `req.on('close', ...)`, matching `SkillsUploadService`'s existing pattern, wrapping both extraction and the downstream Core call.
- [x] 2.4 Unit/integration test: client disconnect mid-extraction aborts work and removes the temp file; timeout aborts work, removes the temp file, and surfaces a service-unavailable response; a completed request (success or failure) never leaves a temp file behind.

## 3. Backend: import orchestration and Core call reuse

- [x] 3.1 Create `apps/chat-api/src/skills/import/skills-archive-import.service.ts` that takes the extraction service's output and calls the **existing, unmodified** `SkillsPackageService.validateAndBuildFormData` and `SkillsUploadService.createSkill` — no reimplementation of path/size/duplicate validation or of the Core call.
- [x] 3.2 Derive the destination Skill path from the manifest's `name` using the same path contract the manual-creation flow uses; ensure `SKILL.md` bytes are forwarded unmodified (no rewrite) per design.md D6.
- [x] 3.3 Unit test proving a successful import results in exactly one `uploadSkillFolder` call (spy/mock) carrying the manifest and every extracted file, and that a `412` from that call surfaces as `409` unchanged (reusing `SkillsUploadService`'s existing collision mapping — no new mapping code expected here, just a test proving the reuse holds).

## 4. Backend: controller, DTOs, Swagger, OpenAPI

- [x] 4.1 Add `@Post('import')` to `apps/chat-api/src/skills/skills.controller.ts`, resolving to `POST /api/v1/skills/import`, `operationId: 'importSkillArchive'`, reading `req.user.bucket` for the bucket (never trusting a client-supplied value), wiring the new interceptor and `SkillsArchiveImportService`.
- [x] 4.2 Add `@ApiConsumes('multipart/form-data')`, `@ApiBody` (binary `file` field), `@ApiOperation`, and `@ApiResponse` entries for `201` (`SkillUploadResponseDto`, reused — no new response DTO), `400`, `401`, `403`, `409`, `413`, `422`, `429`, `502`, `503`.
- [x] 4.3 Add `@Throttle({ default: { limit: 5, ttl: 60000 } })` matching `createSkill`/`updateSkill`.
- [x] 4.4 Register the new service/interceptor providers in `apps/chat-api/src/skills/skills.module.ts` scoped to the `import` route only (do not change the existing `MulterModule.registerAsync` memory-storage config used by `createSkill`/`updateSkill`).
- [x] 4.5 Supertest integration tests (`apps/chat-api/src/skills/skills.controller.spec.ts` or a new `skills-import.controller.spec.ts`): happy path (`201`), missing file (`400`), unauthenticated (`401`), collision (`409`), oversized compressed payload (`413`), structural rejection (`422`), rate-limit boundary (`429`), Core unavailable (`502`/`503`).
- [x] 4.6 Run `npm run openapi` and `npm run openapi:check`; verify `chat-api-client` builds and lints (`npm exec nx build chat-api-client`, `npm exec nx lint chat-api-client`) and that the generated `SkillsApi` exposes an `importSkillArchive` method with the expected signature.

## 5. Frontend: server-api wrapper and hook

- [x] 5.1 Add `importSkillArchive` to `apps/chat/src/server-api/skills.api.ts`, calling the generated `@epam/ai-dial-chat-api-client` `SkillsApi.importSkillArchive` method (no raw `fetch`, no `base.ts` wrapper), matching the existing `createSkill`/`updateSkill` wrapper style.
- [x] 5.2 Write a unit test for the wrapper verifying it calls the generated client method with the correct multipart payload and forwards an `AbortSignal` when provided.
- [x] 5.3 Create `apps/chat/src/hooks/skills/useSkillArchiveImport.ts` owning: file-input ref, `idle | uploading | success | error` state, the `importSkillArchive` call, mapping BFF error statuses (400/413/422 → validation, 409 → collision, 429 → rate-limited, 502/503 → service unavailable) to user-facing messages, calling `notifyOperationSuccess(NotifiableEntity.Skill, EntityOperation.Created, { name })` on success, and calling `SkillsContext.refetchSkills()` after success. Guard against starting a second import while one is in flight.
- [x] 5.4 Unit test `useSkillArchiveImport` covering: successful import calls `refetchSkills` and the success notification once; each mapped error status produces the correct error state/message; a second trigger while `uploading` is a no-op; the file input's `value` is reset before invoking the import so re-selecting the same file re-triggers it.

## 6. Frontend: notification copy addition

- [x] 6.1 Add `entityNotifications.skill.createdTitle` / `entityNotifications.skill.created` keys to `apps/chat/src/constants/translation-keys.ts` (`EntityNotificationsI18nKeys`) and `apps/chat/src/i18n/locales/en.json`, following the existing pattern for other entities' `Created` copy.
- [x] 6.2 Add the `[EntityOperation.Created]` entry to the `NotifiableEntity.Skill` row in `apps/chat/src/utils/entity-notification.ts`'s `ENTITY_OPERATION_NOTIFICATIONS` map.
- [x] 6.3 Confirm (via typecheck) that `notifyOperationSuccess(NotifiableEntity.Skill, EntityOperation.Created, ...)` now compiles, and add a unit test asserting the hook/map resolves the expected title/body keys.

## 7. Frontend: Catalog nested menu and file picker

- [x] 7.1 In `apps/chat/src/components/CatalogView/CatalogView.tsx`, replace the flat `skill` entry in the `createOptions` memo with a nested `DropdownItem` (`children: [write-instructions, upload]`), matching the shape used by `exportAction` in `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx:456`. Preserve the existing "Write instructions" navigation unchanged.
- [x] 7.2 Add a hidden `<input type="file" accept=".zip">` with a ref, wired to `useSkillArchiveImport`, following the pattern at `ConversationPanelView.tsx:246`/`:877` (reset `event.target.value = ''` before invoking the import so re-selecting the same file re-triggers `onChange`); give the input an accessible label (e.g. `aria-label`) since it is visually hidden.
- [x] 7.3 Add new `CatalogI18nKeys` entries for "Write instructions" and "Upload" labels and the corresponding `en.json` strings; ensure no hardcoded user-visible strings are introduced.
- [x] 7.4 Add an `aria-live="polite"` status region (or equivalent) surfacing upload-in-progress/success/error state where the notification toast alone is insufficient for screen-reader users tracking an in-page async action.
- [x] 7.5 Verify keyboard operability (submenu opens/navigates/activates via keyboard, `Escape` closes) and touch operability on mobile (no hover-only interaction), and confirm both children meet the existing 44×44 px touch-target minimum. Use only the project's `mobile`/`desktop` Tailwind breakpoints and `useBreakpoint`/`useIsMobile` if any JS branching is needed — no `sm:`/`md:`/`lg:`/`xl:` classes.
- [x] 7.6 Confirm no new physical-direction Tailwind utilities are introduced; if any new icon is added to the submenu items, mirror it in RTL only if it carries directional meaning.
- [x] 7.7 Component tests for `CatalogView` (or a focused test for the new submenu): submenu renders both children; "Write instructions" navigates as before; "Upload" triggers the hidden file input's click; selecting a file invokes the import hook; loading/success/error UI states render as expected; re-selecting the same file re-triggers the flow.
- [x] 7.8 RTL acceptance check: submenu and its labels render correctly with `dir="rtl"` (Arabic), no visual regression in menu direction or icon mirroring.

## 8. Cross-cutting verification

- [x] 8.1 Run `npm run validate:docs` after any README/`.env.template`/lib-README-affecting change (task 1.1).
- [x] 8.2 Run affected lint/typecheck/test/build against `origin/development`: `npm exec nx affected --target=lint --base=origin/development`, `--target=test`, `--target=build` (or the equivalent typecheck target this repo uses), plus targeted `npm exec nx test chat-api`, `npm exec nx lint chat-api`, `npm exec nx test chat`, `npm exec nx lint chat`, `npm exec nx build chat-api-client`, `npm exec nx lint chat-api-client`.
- [x] 8.3 Manually verify in a running app (`npm run start:all`): upload a valid Skill ZIP from the Catalog and confirm it appears; upload a ZIP with a wrapper directory and confirm it still imports; upload a ZIP colliding with an existing Skill name and confirm the collision message; upload a corrupted/non-ZIP file and confirm the validation message; confirm "Write instructions" still navigates to the editor unchanged.
- [x] 8.4 Confirm the existing `POST /api/v1/skills`, `PUT /api/v1/skills`, and `GET /api/v1/skills/download` endpoints and their existing test suites are unaffected (no regressions) by running their existing spec files.
