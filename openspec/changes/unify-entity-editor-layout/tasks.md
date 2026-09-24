# Tasks — unify-entity-editor-layout

**Slicing strategy: contract-first, then vertical.** Slice 1 adds the shared lib contract (`EntityEditor`, `MetadataForm`, `useMetadataForm`) with no visual change. Each later slice moves one editor onto it end to end, and each is independently shippable and revertable. The toolset goes first because it already matches the target, which proves the shell without a UX change. The quick app goes last among the apps because it carries the highest risk (in-place create→edit, iframe readiness).

**Architecture guard (applies to every task under `libs/*`).** The change must not add any of the following to a lib:

- `/api` paths
- `@epam/ai-dial-chat-api-client` or `apps/chat/src/server-api` imports
- app contexts
- i18n (`react-i18next`)
- routing or navigation
- env or feature flags
- storage keys
- analytics

Labels, `bucket`, `FileManagerModal`, `resolveIconUrl`, locale options and submit callbacks stay props. Check this in the diff of each lib slice. Before touching any lib manifest or README, read `.claude/rules/libs.md` and `.claude/rules/lib-styling.md`.

## 1. builder-form: shared shell, metadata form and hook (no visual change)

- [x] 1.1 Add the `MetadataField` string enum (`Avatar`, `Name`, `Version`, `Description`, `Locales`, `Tags`) in `libs/builder-form/src/models/metadata-field.ts`. Extend `libs/builder-form/src/models/deployment-creation-form.ts`:
  - `fields?`, `isNameReadOnly?`, `nameCaption?` and `isDescriptionRequired?` on `DeploymentCreationFormProps`
  - `description?` on `DeploymentCreationFormFieldErrors`
  - JSDoc on every new field
- [x] 1.2 Update `libs/builder-form/src/components/DeploymentCreationForm/DeploymentCreationForm.tsx`:
  - render only the requested fields, in fixed order
  - Name takes the full row when Version is hidden
  - read-only Name, name caption, required Description and the Description error
  - focus-first-invalid covers Name → Version → Description
  - default Tags placeholder "Add tags, comma separated" (the host still overrides it)
  - Verification: `npm run test:file -- libs/builder-form/src/components/DeploymentCreationForm/tests/DeploymentCreationForm.spec.tsx`. Add cases for the `fields` subset, the full-width Name, and focus moving to Description.
- [x] 1.3 Move `libs/toolset-editor/src/components/GeneralForm/GeneralForm.tsx` and its models to `libs/builder-form/src/components/MetadataForm/MetadataForm.tsx` + `libs/builder-form/src/models/metadata-form-props.ts` as `MetadataForm` / `MetadataFormProps` / `MetadataFormLabels`:
  - pass through the new options
  - group the picker props into an optional `avatarPicker` (`MetadataFormAvatarPicker`) with a new host callback `resolveAttachedIconUrl(result)`; no `chat-hooks` import; render the avatar only when `fields` includes `Avatar` and `avatarPicker` is set
  - move its test to `libs/builder-form/src/components/MetadataForm/tests/MetadataForm.spec.tsx`
  - Verification: `npm run test:file -- libs/builder-form/src/components/MetadataForm/tests/MetadataForm.spec.tsx`
- [x] 1.4 Add `useMetadataForm` in `libs/builder-form/src/hooks/useMetadataForm.ts`:
  - JSDoc explaining why the hook exists: one touched and error policy for every editor
  - seed once per `reseedKey`
  - `attemptSubmit`, `visibleErrorCodes`, `isDirty`, `reset`
  - stable callbacks and a memoised return value
- [x] 1.5 Unit tests for `useMetadataForm` in `libs/builder-form/src/hooks/tests/useMetadataForm.spec.ts`:
  - errors are hidden until touched
  - all errors appear after `attemptSubmit`
  - a re-render with the same `reseedKey` keeps edits
  - `SEMVER_VERSION_PATTERN` is respected
  - callback identity is stable
  - Verification: `npm run test:file -- libs/builder-form/src/hooks/tests/useMetadataForm.spec.ts`
- [x] 1.6 Add `EntityEditor` in `libs/builder-form/src/components/EntityEditor/EntityEditor.tsx`, with models in `libs/builder-form/src/models/entity-editor-props.ts`:
  - composes `EditorLayout` + two `EditorSection`s + `NeutralButton`/`PrimaryButton`
  - `extraActions`, `hideStandardActions`, `metadataFooter`, `setupTitle`, and an `alert` region with `role="alert"`
  - English defaults
  - `memo`
  - public `dial-*` class names added to `libs/builder-form/src/constants/public-class-names.ts`
  - Tabler icons use `stroke={DIAL_KIT_ICON_STROKE}`
- [x] 1.7 Component tests in `libs/builder-form/src/components/EntityEditor/tests/EntityEditor.spec.tsx`, using role/label/text queries only:
  - the heading and the two section headings
  - action order
  - `hideStandardActions`
  - the metadata-only layout (no Setup)
  - disabled rules: submitting vs. `isSubmitDisabled`
  - the alert region
  - Verification: `npm run test:file -- libs/builder-form/src/components/EntityEditor/tests/EntityEditor.spec.tsx`
- [x] 1.8 Export the new components, types, enum and hook from `libs/builder-form/src/index.ts`. Update `libs/builder-form/README.md` with the `EntityEditor`, `MetadataForm`, `MetadataField` and `useMetadataForm` sections, the public class table, and compiling examples with every required prop.
- [x] 1.9 In `libs/toolset-editor/src/index.ts`, reduce `GeneralForm` to a `@deprecated` thin wrapper over `MetadataForm` that keeps its current props and supplies `resolveAttachedIconUrl` via `dialFileToAttachment`; keep its avatar tests in `libs/toolset-editor/src/components/GeneralForm/tests/GeneralForm.spec.tsx`. Update `libs/toolset-editor/README.md`.
  - Verification: `npm run test:file -- libs/toolset-editor/src/components/ToolsetEditor/tests/ToolsetEditor.spec.tsx`, then `npm run verify:changed` and `npm run validate:docs`.

## 2. Toolset on the shared shell

- [x] 2.1 Rebuild `libs/toolset-editor/src/components/ToolsetEditor/ToolsetEditor.tsx` on `EntityEditor` + `MetadataForm`, and on `useMetadataForm` with `validateVersionPattern: true`:
  - endpoint and auth validation stay local
  - no direct `EditorLayout`/`EditorSection` usage remains
  - the existing props contract is unchanged
- [x] 2.2 Add a test to `libs/toolset-editor/src/components/ToolsetEditor/tests/ToolsetEditor.spec.tsx` asserting the Metadata/Setup headings, the header actions, and that errors appear only for touched fields.
  - Verification: `npm run test:file -- libs/toolset-editor/src/components/ToolsetEditor/tests/ToolsetEditor.spec.tsx`, then `npm run verify:changed`.

## 3. Generic application editor + custom app

- [x] 3.1 Add `apps/chat/src/types/application-editor.ts`:
  - the `ApplicationEditorKind` and `ApplicationCreateStrategy` string enums
  - `ApplicationEditorDefinition`, `ApplicationSetupProps`, `ApplicationSetupHandle` and `MetadataPayload`
- [x] 3.2 Add hooks. Each hook gets its own file with JSDoc explaining why it exists.
  - `apps/chat/src/hooks/application-editor/useApplicationAvatarPicker.ts`: `bucket`, `FileManagerModal`, `resolveIconUrl`, the MIME/size constants from `apps/chat/src/constants/files.ts`, and the one memoised picker label object.
  - `useMetadataLabels.ts`: `DeploymentCreationFormLabels` from `EditorI18nKeys`.
  - `useEditedApplication.ts`: waits for `useDeployments()` to settle, and uses a cancelled flag for any async work.
- [x] 3.3 Unit tests for the three hooks:
  - `apps/chat/src/hooks/application-editor/tests/useApplicationAvatarPicker.spec.ts`
  - `apps/chat/src/hooks/application-editor/tests/useMetadataLabels.spec.ts`
  - `apps/chat/src/hooks/application-editor/tests/useEditedApplication.spec.ts` (unknown id after settle, pending while loading)
  - Verification: `npm run test:file -- apps/chat/src/hooks/application-editor/tests/useEditedApplication.spec.ts` (and the other two).
- [x] 3.4 Add `apps/chat/src/pages/ApplicationEditor/ApplicationEditorPage.tsx`. It implements the shared lifecycle from `application-editor-registry`:
  - mode, loading spinner and metadata state
  - submit order: attemptSubmit → validateSetup → confirm → request
  - saving overlay with `inert` + `aria-live="polite"`
  - alert region with API detail and request id
  - notifications, `refetchDeployments()`, and `returnUrl` navigation
  - `renderPage` / `renderExtraActions` / `hideStandardActions` plumbing
  - memoised labels and callbacks
- [x] 3.5 Move `apps/chat/src/pages/ToolsetEditor/EditorForm/CustomAppSettingsForm.tsx` to `apps/chat/src/pages/ApplicationEditor/setup/CustomAppSetup.tsx`, implementing `ApplicationSetupProps`. Add `apps/chat/src/pages/ApplicationEditor/definitions/customAppDefinition.tsx`:
  - `AllAtOnce`
  - `SEMVER_VERSION_PATTERN`
  - confirmation via `customApp.saveConfirm*`
  - create/update through `apps/chat/src/server-api/applications.ts`, with payloads identical to today's `CustomAppEditor.tsx` L354/L399
  - title keys
  - Name/Description placeholder overrides
- [x] 3.6 Add `apps/chat/src/pages/ApplicationEditor/definitions/toolsetDefinition.tsx`, using `renderPage` to delegate to the lib `ToolsetEditor`. Move the wiring from `apps/chat/src/pages/ToolsetEditor/ToolsetEditor.tsx` into it, using `useApplicationAvatarPicker` and `useMetadataLabels` so the duplicated picker labels go away. Add `definitions/index.ts` with `APPLICATION_EDITOR_DEFINITIONS`.
- [x] 3.7 Point `ROUTES.CustomAppEditor` and `ROUTES.ToolsetEditor` in `apps/chat/src/app/app.tsx` at a lazy `ApplicationEditorPage`, with `kind` and a `Suspense` fallback. Delete:
  - `apps/chat/src/pages/ToolsetEditor/CustomAppEditor.tsx`
  - `apps/chat/src/pages/ToolsetEditor/CustomAppEditorView.tsx`
  - `apps/chat/src/pages/ToolsetEditor/ToolsetEditor.tsx`
  - `apps/chat/src/pages/ToolsetEditor/EditorForm/`
- [x] 3.8 Page tests in `apps/chat/src/pages/ApplicationEditor/tests/ApplicationEditorPage.spec.tsx`:
  - a fake kind registered with only a definition renders and creates
  - invalid Name blocks the request and focuses the field
  - API failure shows the alert with the request id
  - an unknown edit id redirects with `replace`
  - the registry has three kinds and only the toolset uses `renderPage`
- [x] 3.9 Port the behaviour cases of `apps/chat/src/pages/ToolsetEditor/tests/CustomAppEditor.spec.tsx` to `apps/chat/src/pages/ApplicationEditor/tests/customAppDefinition.spec.tsx`:
  - blur errors
  - submit attempt with invalid metadata
  - the confirmation popup
  - a single create request with metadata + setup
  - edit-mode load and save
  - the invalid MIME type blocking save
  - the saving overlay

  Move the toolset page cases from `apps/chat/src/pages/ToolsetEditor/tests/ToolsetEditor.spec.tsx` to `apps/chat/src/pages/ApplicationEditor/tests/toolsetDefinition.spec.tsx`.
  - Verification: `npm run test:file -- apps/chat/src/pages/ApplicationEditor/tests/ApplicationEditorPage.spec.tsx` (and the two definition specs), then `npm run verify:changed`.

## 4. Quick app on the generic page

- [x] 4.1 Move `apps/chat/src/pages/AppsEditor/SettingsStep.tsx` to `apps/chat/src/pages/ApplicationEditor/setup/QuickAppSetup.tsx`, with `AppEditorIframe.tsx` and `AppPreviewChat.tsx` moved alongside:
  - `forwardRef` `ApplicationSetupHandle` (`save(metadata)` and `triggerPreviewSave()`)
  - the pending-create placeholder when there is no `appId`
  - the no-editor placeholder
  - `onReadyChange` reporting
  - the `ReadyToSave`/`LoggedOut`/readiness-timeout/save-timeout logic moved over from `apps/chat/src/pages/AppsEditor/AppsEditor.tsx`
  - a mobile `min-h-[640px]` iframe area
- [x] 4.2 Add `apps/chat/src/pages/ApplicationEditor/definitions/quickAppDefinition.tsx`:
  - `MetadataFirst`
  - `validateNamePattern: true` + `SEMVER_VERSION_PATTERN`
  - `create` → `createApplication` with the same body and seeded `applicationProperties` as today's `apps/chat/src/pages/AppsEditor/GeneralForm.tsx`
  - `renderExtraActions` Preview/Exit preview with `aria-pressed`
  - title via `appsEditor.createTitle`/`editTitle` with `displayName` fallback
  - after `SaveSuccess`: the `features.skills_supported` reassertion, then the refetch sequencing
  - `hasChanges`-aware preview refetch
- [x] 4.3 In `ApplicationEditorPage`, implement the `MetadataFirst` in-place switch:
  - Created notification
  - `setSearchParams` with `replace` adding `appId`
  - edit title and Save label
  - readiness re-gating on the iframe remount
  - ignore the `step`/`isCreating` params
- [x] 4.4 Point `ROUTES.AppsEditor` in `apps/chat/src/app/app.tsx` at `ApplicationEditorPage kind={ApplicationEditorKind.QuickApp}`. Delete:
  - `apps/chat/src/pages/AppsEditor/AppsEditor.tsx`
  - `apps/chat/src/pages/AppsEditor/GeneralForm.tsx`
  - `apps/chat/src/pages/AppsEditor/SettingsStep.tsx`
  - their specs `GeneralForm.spec.tsx`, `SettingsStep.spec.tsx` and `AppsEditor.spec.tsx`, after the port in 4.5

  Move `apps/chat/src/pages/AppsEditor/tests/AppEditorIframe.spec.tsx` and `AppPreviewChat.spec.tsx` next to their moved components.
- [x] 4.5 Tests in `apps/chat/src/pages/ApplicationEditor/tests/quickAppDefinition.spec.tsx` covering the `app-editor-flow` "Unit tests for the quick-app definition" list, plus:
  - Save forwards `general` (also after an in-place create)
  - Preview sends no `general`
  - Save and Preview gated by `ReadyToSave`
  - `LoggedOut` suppresses and clears the readiness error
  - save timeout
  - Created/Edited notifications
  - legacy `?step=settings` link opens edit mode

  Add `apps/chat/src/pages/ApplicationEditor/setup/tests/QuickAppSetup.spec.tsx` for the three placeholder/iframe states and the handle forwarding.
  - Verification: `npm run test:file -- apps/chat/src/pages/ApplicationEditor/tests/quickAppDefinition.spec.tsx apps/chat/src/pages/ApplicationEditor/setup/tests/QuickAppSetup.spec.tsx`, then `npm run verify:changed`.

## 5. Prompt and skill adopt the shared left panel

- [ ] 5.1 Rebuild `libs/prompt-editor/src/components/PromptEditor/PromptEditor.tsx` (all three render paths: form, loading, load error) on `EntityEditor`:
  - `metadata` = `MetadataForm fields={[Name, Description]}`, keeping the existing ids, placeholders and error props
  - `setup` = the Instructions editor block
  - `submitLabel` picks between `labels.createLabel` and `labels.saveLabel` by mode
  - update the prop models and `libs/prompt-editor/README.md`
- [ ] 5.2 Pass `createLabel: t(ButtonsI18nKeys.Create)` in create mode from `apps/chat/src/pages/PromptEditor/PromptEditor.tsx`.
  - Verification: `npm run test:file -- libs/prompt-editor/src/components/PromptEditor/tests/PromptEditor.spec.tsx apps/chat/src/pages/PromptEditor/tests/PromptEditor.spec.tsx`. Add cases for the Metadata/Setup headings and the primary label by mode, and update `PromptEditor.classes.spec.tsx` if the class names move.
- [ ] 5.3 Rebuild `libs/skill-editor/src/components/SkillEditor/SkillEditor.tsx` on `EntityEditor`:
  - `metadata` = `MetadataForm fields={[Name, Description]} isDescriptionRequired nameCaption isNameReadOnly`, with values still owned by the skill field state
  - `metadataFooter` = the Files pane (mobile accordion + desktop panel)
  - `setup` + `setupTitle` = the selected file path, replacing the local `<h2>`
  - `alert` = `submitError`/`conflict` with "Reload latest"
  - update `libs/skill-editor/README.md`
  - Verification: `npm run test:file -- libs/skill-editor/src/components/SkillEditor/tests/SkillEditor.spec.tsx libs/skill-editor/src/components/SkillEditor/tests/SkillEditorFiles.spec.tsx apps/chat/src/pages/SkillEditor/tests/SkillEditor.spec.tsx`. Add cases for Metadata staying visible when a supporting file is selected and for the mobile order Metadata → Files → Setup. Then run `npm run verify:changed`.

## 6. Cleanup, i18n, RTL, docs

- [ ] 6.1 i18n (dedicated task), in `apps/chat/src/i18n/locales/en.json`, every other locale file and `apps/chat/src/constants/translation-keys.ts`:
  - add `applicationEditor.setupPendingCreate`, `customApp.createTitle`, `customApp.editTitle`, `appsEditor.createTitle`, `appsEditor.editTitle` and `appsEditor.defaultTypeName`
  - move `toolsetEditor.metadataSectionTitle`/`setupSectionTitle` to `editor.metadataSectionTitle`/`editor.setupSectionTitle`
  - set `editor.topicsPlaceholder` to "Add tags, comma separated" and drop `toolsetEditor.general.topicsPlaceholder`
  - remove `editor.stepGeneral`, `editor.nextButton`, `editor.saveButton`, `editor.stepsNavAriaLabel`, `editor.stepOfTotal` and `editor.moreActionsLabel`, after grepping that no usage remains
- [ ] 6.2 Delete `apps/chat/src/components/EditorHeader/` (component + `tests/EditorHeader.spec.tsx`) once `grep -r "EditorHeader" apps/chat/src` finds no importer. Remove the now-empty `apps/chat/src/pages/AppsEditor/` and `apps/chat/src/pages/ToolsetEditor/` folders if no files remain.
- [ ] 6.3 RTL (dedicated task): confirm `EntityEditor`, `MetadataForm`, `QuickAppSetup`, `CustomAppSetup` and the placeholders use only logical classes (`ms/me`, `ps/pe`, `start/end`, `text-start`). The back arrow's mirroring is inherited from `EditorLayout`, and Preview/Eye icons are not mirrored. Add a `dir="rtl"` render assertion to `libs/builder-form/src/components/EntityEditor/tests/EntityEditor.spec.tsx`.
- [ ] 6.4 Docs:
  - `docs/architecture.md`: the route → page map now points to `ApplicationEditorPage`; `EditorHeader` is removed; builder-form owns the entity editor shell.
  - The builder-form, toolset-editor, prompt-editor and skill-editor READMEs (already touched in their slices; re-check).
  - Run `npm run validate:docs`.
- [ ] 6.5 Close the change with exactly one `npm run verify:full`, plus `npm run build:quiet`, since routes and lazy chunks changed.

## 7. Follow-ups (out of scope — record, do not implement)

- [ ] 7.1 Decide whether to unify version validation (toolset's loose `VERSION_PATTERN` vs. semver for the apps). This is a product decision.
- [ ] 7.2 Explore a generic `afterPersist` step so the toolset's post-save OAuth login no longer needs `renderPage`.
- [ ] 7.3 Explore a schema-driven Setup (an auto form from the application-type JSON schema) as an additional `ApplicationEditorDefinition`.
