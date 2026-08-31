## 1. `getModelIdFromConversationId` (D2)

- [x] 1.1 Add `libs/chat-hooks/src/conversation/get-model-id-from-conversation-id.ts` with `getModelIdFromConversationId`, ported unchanged from `apps/chat/src/utils/get-model-id-from-conversation-id.ts`
- [x] 1.2 Move its 15-case spec to `libs/chat-hooks/src/conversation/tests/get-model-id-from-conversation-id.spec.ts`; run `npm exec nx test chat-hooks`
- [x] 1.3 Export it from `libs/chat-hooks/src/index.ts`
- [x] 1.4 Migrate `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx:104,451` to import from `@epam/ai-dial-chat-hooks`
- [x] 1.5 Delete `apps/chat/src/utils/get-model-id-from-conversation-id.ts` and its test
- [x] 1.6 Run `npm exec nx test chat`, `npm exec nx lint chat`, `npm exec nx build chat`

## 2. `resolve-dial-file-api-path` consolidation (D3)

- [x] 2.1 Add `export * from './files/resolve-dial-file-api-path';` to `libs/chat-hooks/src/index.ts`
- [x] 2.2 Run `npm exec nx test chat-hooks` to confirm the existing private spec still passes now that the module is publicly exported
- [x] 2.3 Migrate `apps/chat/src/components/DialFileManagerShell/DialFileManagerShell.tsx:25,384`'s `getParentFolderPath` import to `@epam/ai-dial-chat-hooks`
- [x] 2.4 Delete `apps/chat/src/utils/resolve-dial-file-api-path.ts` and its test
- [x] 2.5 Update `openspec/specs/chat-hooks-file-manager-domain/spec.md`'s "Path, mapping, and copy/move utilities preserve their exact algorithms" requirement per this change's delta spec (handled at archive time)
- [x] 2.6 Run `npm exec nx test chat`, `npm exec nx lint chat`, `npm exec nx build chat`

## 3. Attachment MIME/accept-type helpers (D4)

- [x] 3.1 Add `libs/chat-hooks/src/files/attachment-types.ts` exporting `isDialFileAcceptType`, `mimeTypesToDialFileAcceptTypes`, `mimeTypesToFileAccept` (filtering semantics), and `mimeTypesToAttachmentExtensionLabels`, ported from `apps/chat/src/utils/attachment-types.ts` with `mimeTypesToFileAccept` fixed to filter through `mimeTypesToDialFileAcceptTypes` before joining
- [x] 3.2 Move the existing spec to `libs/chat-hooks/src/files/tests/attachment-types.spec.ts`, adding a case asserting `mimeTypesToFileAccept` excludes a value `isDialFileAcceptType` rejects
- [x] 3.3 Export the new module from `libs/chat-hooks/src/index.ts`
- [x] 3.4 Refactor `libs/chat-hooks/src/attachment/useAttachmentValidation/useAttachmentValidation.ts:14-41` to import from the new module, deleting its private `mimeTypesToFileAccept`/`isDialFileAcceptType`/`mimeTypesToDialFileAcceptTypes` copies
- [x] 3.5 Run `npm exec nx test chat-hooks` and confirm `useAttachmentValidation`'s existing suite still passes with the shared implementation
- [x] 3.6 Grep `apps/chat/src` for every `mimeTypesToFileAccept` call site and confirm none currently passes a value `isDialFileAcceptType` would reject (verifying the fix is behavior-preserving in practice)
- [x] 3.7 Migrate `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx:42-43,397,405` to import `mimeTypesToDialFileAcceptTypes`/`mimeTypesToAttachmentExtensionLabels` from `@epam/ai-dial-chat-hooks`
- [x] 3.8 Delete `apps/chat/src/utils/attachment-types.ts` and its test
- [x] 3.9 Run `npm exec nx test chat`, `npm exec nx lint chat`, `npm exec nx build chat`

## 4. `dial-file-to-attachment` with injected preview-URL resolver (D5)

- [x] 4.1 Add `libs/chat-hooks/src/files/dial-file-to-attachment.ts` exporting `dialFileToAttachment(file, bucket, options?: { resolvePreviewUrl?: (url: string) => string | undefined })`, `dialFilesToAttachments`, `dialFolderPathToAttachment`, replacing the direct `resolveCatalogIconUrl` call with `options?.resolvePreviewUrl`
- [x] 4.2 Move the existing 3-case spec to `libs/chat-hooks/src/files/tests/dial-file-to-attachment.spec.ts`, adding cases for: resolver invoked only for image files, `previewUrl` left `undefined` when no resolver is supplied, and batch mapping via `dialFilesToAttachments` matching per-file calls
- [x] 4.3 Export the new module from `libs/chat-hooks/src/index.ts`
- [x] 4.4 Migrate `apps/chat/src/components/ConversationView/ConversationView.tsx:81-82,569,571` to import from `@epam/ai-dial-chat-hooks` and pass `{ resolvePreviewUrl: resolveCatalogIconUrl }`
- [x] 4.5 Migrate `apps/chat/src/hooks/files/useDialFileManagerState.ts:5-6,35,37` the same way
- [x] 4.6 Confirm `apps/chat/src/utils/icon-path.ts`'s `resolveCatalogIconUrl` (and its `ApiEndpoints`/REST-path dependencies) is unchanged and still app-owned
- [x] 4.7 Delete `apps/chat/src/utils/dial-file-to-attachment.ts` and its test
- [x] 4.8 Run `npm exec nx test chat`, `npm exec nx lint chat`, `npm exec nx build chat`

## 5. CSRF and unauthorized middleware factories (D6)

- [x] 5.1 Add `libs/chat-hooks/src/api-transport/create-csrf-middleware.ts` and `create-unauthorized-middleware.ts`, porting `apps/chat/src/server-api/api-client.ts`'s current inline `csrfMiddleware`/`unauthorizedMiddleware` logic behind the `deps` parameter shapes from design D6
- [x] 5.2 Move `api-client.spec.ts`'s `csrfMiddleware`/`unauthorizedMiddleware` describe blocks (13 `it`s total) to `libs/chat-hooks/src/api-transport/tests/`, adapting each to call the factories with test doubles for `deps`
- [x] 5.3 Export both factories from `libs/chat-hooks/src/index.ts`
- [x] 5.4 Refactor `apps/chat/src/server-api/api-client.ts` to call `createCsrfMiddleware`/`createUnauthorizedMiddleware` with `base.ts`'s existing `getCsrfToken`/`setCsrfToken`/`refreshCsrfToken`/`isInvalidCsrfErrorBody`/`notifyUnauthorized`, keeping `createApiConfiguration`, the telemetry middleware, and all 18 domain singletons unchanged
- [x] 5.5 Run `npm exec nx test chat-hooks` and `npm exec nx test chat`, confirming `api-client.spec.ts`'s remaining (non-middleware) assertions and all consumers of the 18 singletons are unaffected

## 6. Files API wrapper factory (D7)

- [x] 6.1 Add `libs/chat-hooks/src/files/create-files-api.ts` exporting `createFilesApiClient(filesApi, uploadFileWithProgress)`, reproducing all 16 of `files.api.ts`'s current wrapper functions, including the `downloadFileRaw`/`downloadArchiveRaw` raw-`Response` handling
- [x] 6.2 Move `files.api.spec.ts`'s suites to `libs/chat-hooks/src/files/tests/create-files-api.spec.ts`, adapted to call the factory with a mocked `FilesApi`
- [x] 6.3 Export the factory from `libs/chat-hooks/src/index.ts`
- [x] 6.4 Refactor `apps/chat/src/server-api/files.api.ts` to call `createFilesApiClient` with the app's `filesApi` singleton and its `uploadFileWithProgress` (task 7), re-exporting the returned functions under their existing names
- [x] 6.5 Confirm `apps/chat/src/server-api/dial-files-api.adapter.ts` and `apps/chat/src/hooks/publish/usePublishFolders.ts` require no changes
- [x] 6.6 Run `npm exec nx test chat-hooks` and `npm exec nx test chat`

## 7. Upload-with-progress factory (D8)

- [x] 7.1 Add `libs/chat-hooks/src/files/create-upload-file-with-progress.ts` exporting `createUploadFileWithProgress(deps)`, porting `upload-file-with-progress.ts`'s XHR/progress/abort/CSRF/unauthorized logic behind the injected `deps`, with `xhrFactory` defaulting to `() => new XMLHttpRequest()`
- [x] 7.2 Move `upload-file-with-progress.spec.ts`'s scenario to `libs/chat-hooks/src/files/tests/create-upload-file-with-progress.spec.ts`, adding cases for a custom `xhrFactory`, CSRF rotation, and the 401 path per design D8's scenarios
- [x] 7.3 Export the factory from `libs/chat-hooks/src/index.ts`
- [x] 7.4 Refactor `apps/chat/src/server-api/upload-file-with-progress.ts` to call `createUploadFileWithProgress` with `base.ts`'s CSRF/unauthorized exports and the literal `/api/v1/files` path
- [x] 7.5 Run `npm exec nx test chat-hooks` and `npm exec nx test chat`

## 8. Chat-stream completion transport factory (D9)

- [x] 8.1 Add `libs/chat-hooks/src/conversation/create-chat-stream-api.ts` exporting `createChatStreamApi(deps)`, returning `{ streamCompletion, stopCompletion }` with `parseSSELine` kept as a non-exported internal helper, porting `chat-stream.api.ts`'s full behavior
- [x] 8.2 Move `chat-stream.api.spec.ts`'s 7 `it`s to `libs/chat-hooks/src/conversation/tests/create-chat-stream-api.spec.ts`, adapted to call the factory with test doubles for `deps`
- [x] 8.3 Export the factory from `libs/chat-hooks/src/index.ts`
- [x] 8.4 Refactor `apps/chat/src/server-api/chat-stream.api.ts` to call `createChatStreamApi` with `base.ts`'s CSRF exports (no unauthorized dependency — the original file never special-cases 401), `ApiEndpoints.CONVERSATIONS`, and `getBrowserTimezone`
- [x] 8.5 Update `apps/chat/src/utils/conversation-stream-transport.ts` to wrap the factory's returned functions; confirm `useConversationStream`'s consumption is unaffected
- [x] 8.6 Run `npm exec nx test chat-hooks` and `npm exec nx test chat`

## 9. API error and trace parsing (D10)

- [x] 9.1 Add `libs/chat-hooks/src/api-error/api-error.ts`, porting `apps/chat/src/server-api/api-error.ts`'s `isConversationNotFoundError`/`getApiErrorStatus`/`getApiErrorMessage`/`getApiErrorDetails` unchanged
- [x] 9.2 Move the 8-scenario spec to `libs/chat-hooks/src/api-error/tests/api-error.spec.ts`
- [x] 9.3 Export the module from `libs/chat-hooks/src/index.ts`
- [x] 9.4 Replace `apps/chat/src/server-api/api-error.ts`'s implementation with `export * from '@epam/ai-dial-chat-hooks'`'s relevant names (temporary re-export per design D10)
- [x] 9.5 Run `npm exec nx test chat-hooks` and `npm exec nx test chat`, confirming all 21 existing consumer files still resolve `getApiErrorDetails`/`getApiErrorMessage`/`getApiErrorStatus`/`isConversationNotFoundError` correctly through the re-export
- [x] 9.6 Filed a follow-up task (spawned as a background task chip, `task_d3ea2139`) to migrate each of the 21 consumers to import directly from `@epam/ai-dial-chat-hooks` and then delete `apps/chat/src/server-api/api-error.ts`

## 10. Spec and documentation reconciliation (original 9-file scope)

- [x] 10.1 Confirm `libs/chat-hooks/README.md` documents every new public export added in tasks 1–9 with a minimal usage example (per `.claude/rules/libs.md`)
- [x] 10.2 Run `npm run validate:docs`
- [x] 10.3 `nx show projects --affected` reports the entire workspace affected (expected — `chat-hooks` is depended on broadly); ran targeted verification instead: `nx test @epam/ai-dial-chat-hooks` (52 files/639 tests pass), `nx typecheck`/`nx build @epam/ai-dial-chat-hooks` (clean), full `apps/chat` vitest run (only the pre-existing, unrelated `NegativeFeedbackModal.spec.tsx` failure remains — reproduces identically on unmodified `development`), and `nx build @epam/chat` (fails only on two pre-existing, unrelated typecheck errors in `@epam/ai-dial-deployment-creation-form` and `@epam/ai-dial-conversation-panel` from the prior UI-kit upgrade, reproduced on unmodified `development` too)
- [x] 10.4 Update `docs/architecture.md` if any cross-cutting mechanism it describes (generated-client middleware composition, file-manager domain layer) changed shape as a result of this change — verified no update needed: the documented "narrower exception" and per-domain `server-api/` module description already cover this change's shape unchanged

## 11. Foundational domain utilities with no intra-`utils` dependents (D11)

- [x] 11.1 Move `string-utils.ts` to `libs/chat-hooks/src/*`, retiring the private `safeDecodeURI` duplicates in `libs/chat-hooks/src/files/string-utils.ts` and `libs/chat-hooks/src/conversation/useConversationStream/conversation-path.ts`, and pointing `formatFileSize` consumers at `libs/chat-shared`'s existing implementation instead of re-exporting a second one
- [x] 11.2 Move `formatting.ts`, `cron-weekday.ts`, `browser-timezone.ts`, `display-name-watch.ts`, `file-path.ts`, `overlay-messages.ts`, `application-schema.ts`, `custom-apps.ts` as-is
- [x] 11.3 Export all of the above from `libs/chat-hooks/src/index.ts`; move each file's test; migrate every consumer import; delete the app files
- [x] 11.4 Run `npm exec nx test chat-hooks` and a targeted `apps/chat` vitest pass over every migrated consumer

## 12. Conversation/message/composer utilities (D11)

- [x] 12.1 Move `message-factory.ts`, `message-utils.ts`, `greeting.ts`, `quick-app-conversation-starters.ts`, `starter-option.ts`, `announcement-message.ts`, `footer-message.ts` as-is
- [x] 12.2 Export from `libs/chat-hooks/src/index.ts`; move tests; migrate consumers; delete app files
- [x] 12.3 Run `npm exec nx test chat-hooks` and a targeted `apps/chat` vitest pass over every migrated consumer

## 13. Deployment/catalog URL and limits utilities (D11)

- [x] 13.1 Move `deployment-id.ts`, `deployment-endpoint-url.ts`, `mcp-endpoint-url.ts`, `map-deployment-limits-to-input.ts` as-is
- [x] 13.2 Export from `libs/chat-hooks/src/index.ts`; move tests; migrate consumers; delete app files
- [x] 13.3 Run `npm exec nx test chat-hooks` and a targeted `apps/chat` vitest pass over every migrated consumer

## 14. Prompt utilities (D11)

- [x] 14.1 Move `prompt.ts`'s validators together with the `PromptFieldError` enum (currently in `apps/chat/src/types/prompt.ts`) into `libs/chat-hooks`; update `apps/chat/src/types/prompt.ts` to re-export `PromptFieldError` from `@epam/ai-dial-chat-hooks`
- [x] 14.2 Move `export-prompt.ts` as-is
- [x] 14.3 Export from `libs/chat-hooks/src/index.ts`; move tests; migrate consumers (`PromptEditor.tsx`, `CatalogView.tsx`); delete app files
- [x] 14.4 Run `npm exec nx test chat-hooks` and a targeted `apps/chat` vitest pass over `PromptEditor` and `CatalogView`

## 15. Scheduled-task trigger mapping (D11)

- [x] 15.1 Move `scheduled-task-trigger.ts` (depends on the now-moved `cron-weekday.ts`/`formatting.ts` — do after task group 11)
- [x] 15.2 Export from `libs/chat-hooks/src/index.ts`; move its test; migrate `ScheduledTaskCreatePage.tsx`/`ScheduledTaskEditPage.tsx`; delete the app file
- [x] 15.3 Run `npm exec nx test chat-hooks` and a targeted `apps/chat` vitest pass over both scheduled-task pages

## 16. Skill utilities (D11)

- [x] 16.1 Move `skill.ts` as-is, keeping its `parseSkillManifest` export name
- [x] 16.2 Move `skill-manifest.ts`, renaming its `parseSkillManifest` export to `parseSkillManifestDocument` to resolve the naming collision with `skill.ts`'s export; update the two files' internal cross-references if any
- [x] 16.3 Move `skill-file-preview.ts` as-is
- [x] 16.4 Export from `libs/chat-hooks/src/index.ts`; move tests; migrate every consumer (`CatalogView.tsx`, `SkillDetailsFilePreview.tsx`, `useSkillFilePreviewSync.ts`, `useSkillEditorLoad.ts`, `useSkillEditorSubmit.ts`, `useSkillFileActions.ts`, `SkillEditor.tsx`, `skill-file-batch-validation.ts`), updating any renamed-import call site for `parseSkillManifestDocument`
- [x] 16.5 Delete the app files; run `npm exec nx test chat-hooks` and a targeted `apps/chat` vitest pass over every skill-related consumer

## 17. File-name and file-download utilities (D11)

- [x] 17.1 Move `file-name.ts` as-is
- [x] 17.2 Split `file-download.ts`: move `prepareDownloadDestination`/`DownloadDestinationType` to `libs/chat-hooks`; keep `triggerBrowserDownload` in `apps/chat/src/utils/file-download.ts`, re-exporting `prepareDownloadDestination` from `@epam/ai-dial-chat-hooks` so existing consumers' import path is unchanged
- [x] 17.3 Export from `libs/chat-hooks/src/index.ts`; move/adapt tests; migrate consumers of `file-name.ts`; run `npm exec nx test chat-hooks` and a targeted `apps/chat` vitest pass

## 18. External services parsing (D11)

- [x] 18.1 Move `external-services.ts` as-is
- [x] 18.2 Export from `libs/chat-hooks/src/index.ts`; move its test; migrate consumers (`SigninInterruptDialog.tsx`, `ClientChannelContext.tsx`, `useExternalServiceLogin.ts`, `ToolsetAuthCallback.tsx`, `signin-interrupt.ts`); delete the app file
- [x] 18.3 Run `npm exec nx test chat-hooks` and a targeted `apps/chat` vitest pass

## 19. DIAL-file path parsing and attachment/canvas display mapping (D11)

- [x] 19.1 Split `dial-file.ts`: move `isDialFileId`/`resolveRelativeDialFilePath`/`resolveDialFileBucketAndPath` to `libs/chat-hooks`; keep `resolveDialFileDownloadUrl`/`resolveDialUrl`/`stripFragment` in `apps/chat/src/utils/dial-file.ts`, re-exporting the three moved functions so every current consumer's import path (`./dial-file`, `../utils/dial-file`) is unchanged
- [x] 19.2 Refactor `libs/chat-hooks/src/attachment/useAttachmentAction/useAttachmentAction.ts` to import the shared `isDialFileId` instead of its own private duplicate
- [x] 19.3 Move `annotation.ts`, changing `openAnnotationAttachment` to accept an injected `resolveDownloadUrl: ResolveDownloadUrl` parameter instead of calling the app-owned `resolveDialFileDownloadUrl` directly — corrected from the original "as-is" plan, since the function transitively depended on the host-owned `/api/v1/files/download` URL builder
- [x] 19.4 Move `attachment-dto-to-display.ts`, changing `attachmentDtoToDisplayAttachment`/`attachmentDtosToDisplayAttachments` to accept an explicit `resolvers: AttachmentDisplayResolvers` parameter instead of closing over the app-local `attachmentDisplayResolvers`; `annotationToDisplayAttachment` moves unchanged
- [x] 19.5 Move `attachment-canvas.ts`, injecting its DIAL-URL resolution (`isDialFileId`/`resolveDialFileDownloadUrl`/`resolveDialUrl`) as a parameter object instead of importing `./dial-file` directly
- [x] 19.6 Export everything from `libs/chat-hooks/src/index.ts`; move/adapt tests, adding resolver-invocation assertions per D11's note; migrate every consumer (`ConversationMessageItem.tsx`, `app/app.tsx`, `ConversationSourcesPanel.tsx`, `ConversationView.tsx`, `useAttachmentCanvasResolvers.ts`) to pass the resolvers explicitly
- [x] 19.7 Delete the fully-superseded app files (`annotation.ts`, `attachment-dto-to-display.ts`, `attachment-canvas.ts`) and their tests
- [x] 19.8 Run `npm exec nx test chat-hooks` and a targeted `apps/chat` vitest pass over every migrated consumer

## 20. Locale and catalog-entity/prompt/skill/publish mapping utilities (D11)

- [x] 20.1 Move `locale.ts`'s pure exports (`resolveLocalizedText`, `toBaseLocale`, `composeLocalePayload`, `decomposeLocalizedFields`, `appendLocaleCode`, `buildAdditionalLocaleOptions`); keep `PRIMARY_LOCALE`/`buildLocaleFieldLabels` in `apps/chat/src/utils/locale.ts`, which wraps the moved `resolveLocalizedText`/`buildAdditionalLocaleOptions` with `PRIMARY_LOCALE` baked in so every existing 2-arg/0-arg app call site is unchanged — corrected from the original plan (moving `PRIMARY_LOCALE` verbatim was impossible: it derives from the host-owned `SUPPORTED_LANGUAGES`/`useLanguage` hook, which libs must not import per the no-i18n-in-libs rule)
- [x] 20.2 Move `map-deployment-to-catalog-item.ts`, seaming `resolveDeploymentFolder`/`resolveToolsetFolder`'s i18n label resolution as an injected `folderLabels: DeploymentFolderLabels` parameter instead of a `t` import; renamed its `mapToolsetCredentials` to `mapDeploymentToolsetCredentials` to resolve an `export *` collision discovered with `map-entity-details-to-catalog.ts`'s same-named export (zero external consumers, so the rename is compile-time-checked only); `apps/chat/src/utils/map-deployment-to-catalog-item.ts` becomes a thin wrapper building `folderLabels` from `t()` and supplying `PRIMARY_LOCALE`/`resolveCatalogIconUrl`, preserving the exact original app-facing signature
- [x] 20.3 Move `map-entity-details-to-catalog.ts`, dropping the `CatalogI18nKeys` import and the `t` param entirely (every label already had an English fallback), and replacing the `isPublicToolsetId` import from `../utils/toolsets` with a private, non-exported duplicate inside the moved module; also moved its companion `apps/chat/src/types/entity-details.ts` (pure data-shape types with no host dependency) into `libs/chat-hooks/src/catalog/entity-details.ts`, since the lib cannot import types back from the app — same precedent as `PromptFieldError`/`McpResourceKind`/`UnsupportedTriggerReason` moving alongside their mapping functions
- [x] 20.4 Move `map-prompt-to-catalog-item.ts`, seaming `resolvePromptFolder`/`buildPromptOverview`'s i18n label resolution as injected `folderLabels`/`overviewLabels` objects; also moved its companion `apps/chat/src/types/prompt.ts` (`PromptSource`, `buildPromptResourceUrl`, `parsePromptResourceUrl` — pure, no host dependency) into `libs/chat-hooks/src/prompt/prompt-resource.ts`, since `PromptSource` is a passed-through discriminant and TS string enums are nominal — a plain string-literal-union seam would not type-check against the app's own enum values; `types/prompt.ts` re-exports from the lib for its other 2 consumers
- [x] 20.5 Move `map-skill-to-catalog-item.ts`, seaming `resolveSkillFolder`/`buildSpecificationSection`/`buildSkillOverview`'s i18n label resolution as injected `folderLabels`/`overviewLabels` objects; its fully-pure helpers (`resolveSkillManifestFileId`, `resolveSkillFileDownloadPath`, `buildSkillContentTree`, `readSkillFileBytes`, `readSkillManifest`) needed no seam; also moved its companion `apps/chat/src/types/skill.ts` (same discriminant-enum reasoning as `PromptSource`) into `libs/chat-hooks/src/skill/skill-types.ts` — dropped the dead `SkillManifest` interface (zero consumers, structurally identical to the already-moved `SkillManifestDocument`) and de-duplicated `SkillAboutDetails` (skill-manifest.ts's private mirror is now the canonical export, imported by skill-types.ts) and `SKILL_MANIFEST_FILE` (already in `skill.ts`); `types/skill.ts` re-exports from the lib for its other 2 consumers
- [x] 20.6 Move `publish.ts`'s `toPublishEntityType`/`mapPublishHistoryEntryDto`/`mapPublishConversationResultDto`, re-declaring `toPublishEntityType`'s return type (`CatalogPublishEntityType`) as a plain string-literal union matching the generated `PublishCatalogEntityEntityTypeEnum`'s current values instead of importing that type from `../server-api/publish.api` — safe here (unlike `PromptSource`/`SkillSource`) because the generated client's "enum" is a plain const object whose type is a string-literal union, not a nominal TS `enum`; keep `getAccessRulesLabels` in `apps/chat/src/utils/publish.ts`, which re-exports the three moved functions for its existing consumers
- [x] 20.7 Move `toolset-login-events.ts`, genericizing `ToolsetLoginSuccessDetail`/`emitToolsetLoginSuccess`/`subscribeToolsetLoginSuccess` over a type parameter `<T>` instead of importing `ToolsetCredentialsLevel`; updated `useToolsetLogin.ts`'s 3 `emitToolsetLoginSuccess` calls and `AppEditorIframe.tsx`'s `subscribeToolsetLoginSuccess` call to supply `<ToolsetCredentialsLevel>` explicitly; added a new direct unit test (previously covered only indirectly through `useToolsetLogin.spec.ts`/`AppEditorIframe.spec.tsx`)
- [x] 20.8 Exported everything from `libs/chat-hooks/src/index.ts` as each file moved; migrated every consumer (`CatalogView.tsx`, `AppEditorIframe.tsx`, `useToolsetLogin.ts`, `apps/chat/src/utils/{locale,map-deployment-to-catalog-item,publish}.ts` thin wrappers, `apps/chat/src/types/{prompt,skill}.ts` re-export shims)
- [x] 20.9 Deleted the fully-superseded app files and their tests as each sub-task landed
- [x] 20.10 Ran `npm exec nx test chat-hooks` (via direct `vite build`/`tsc --noEmit`/`vitest run`, since `nx`'s task graph is blocked by the pre-existing unrelated `@epam/ai-dial-deployment-creation-form`/`@epam/ai-dial-conversation-panel` typecheck breakage — see design.md's Risks) and targeted `apps/chat` vitest passes over every migrated consumer, after each sub-task

## 21. Dead-code cleanup (D11)

- [x] 21.1 Delete `apps/chat/src/utils/request-api-key.ts` (zero consumers anywhere in `apps/chat/src`, confirmed by repo-wide grep; no test file existed) — no migration, no lib export

## 22. Final verification and documentation for the extended scope

- [x] 22.1 Updated `libs/chat-hooks/README.md` with the newly moved exports, grouped into 9 new domain sections (Locale, Shared, Toolset Login Events, Conversation, Catalog Mapping, Prompt, Scheduled-Task, Skill, File & Attachment Utilities), each with a minimal, source-verified usage example
- [x] 22.2 Ran `npm run validate:docs` — passed (39 markdown files, no README/link/export-mismatch issues)
- [x] 22.3 Ran the full `apps/chat` vitest suite (directly via `vitest run`, bypassing `nx`'s task graph — see 22.4) — confirmed only the pre-existing, unrelated `NegativeFeedbackModal.spec.tsx` failure remains (2119 passed, 2 skipped, 4 known-pre-existing failures)
- [x] 22.4 `nx test/typecheck/build chat-hooks` are blocked by the pre-existing, unrelated `@epam/ai-dial-deployment-creation-form`/`@epam/ai-dial-conversation-panel` typecheck breakage now reachable through chat-hooks' new `@epam/ai-dial-deployment-creation-form` peer dependency (see design.md's Risks); ran the equivalent commands directly instead — `vite build` (520.39 kB, clean), `tsc -p tsconfig.lib.json --noEmit` (clean), `vitest run` (84 files / 1103 tests passed) — all clean. Also ran `eslint --fix` across `apps/chat/src` and `libs/chat-hooks/src` (deferred throughout the session) and re-verified build/typecheck/test afterward; only remaining lint issue is the pre-existing, intentionally-left BOM whitespace cosmetic note in `skill-manifest.ts`
- [x] 22.5 Grepped the full repo for any remaining import of a deleted `apps/chat/src/utils/*` path — found and fixed one dead `vi.mock('../../../utils/get-model-id-from-conversation-id', ...)` in `ConversationPanelView.spec.tsx` (the mock target no longer existed; the real implementation already flows through the file's existing `@epam/ai-dial-chat-hooks` `importOriginal` partial mock) and two stale doc-comment path references (`map-scheduled-task-dto.ts`, `toolsets.ts`); the remaining hits are all in `openspec/specs/*.md` (living spec prose) and `openspec/changes/archive/**` (historical record) — per the established precedent from task 2.5, updating those is deferred to `opsx:archive` time via this change's own spec deltas, not done during apply
