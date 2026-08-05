## 1. Backend: DTOs and services

- [x] 1.1 Remove `intro` field from `apps/chat-api/src/applications/dto/create-application.dto.ts`, `update-application.dto.ts`, and `application.dto.ts`
- [x] 1.2 Remove `intro` field from `apps/chat-api/src/toolsets/dto/toolset-body.dto.ts`
- [x] 1.3 Remove `intro` field from `apps/chat-api/src/deployments/dto/raw-deployment.dto.ts` (leave `introText`/`intro_text` untouched)
- [x] 1.4 Remove `body.intro`/`raw.intro` forwarding and mapping in `apps/chat-api/src/applications/applications.service.ts`
- [x] 1.5 Remove `intro` forwarding and mapping in `apps/chat-api/src/toolsets/toolsets.service.ts`
- [x] 1.6 Remove the `intro` mapping (`intro: raw.intro`) in `apps/chat-api/src/deployments/deployments.service.ts` (leave `introText` derivation from `intro_text` untouched)
- [x] 1.7 Update the Swagger description text in `apps/chat-api/src/applications/applications.controller.ts` that lists `intro` among the General-step fields
- [x] 1.8 Update backend tests: `applications.controller.spec.ts`, `applications.service.spec.ts`, `create-application.dto.spec.ts`, `update-application.dto.spec.ts`, `deployments.service.spec.ts`, `toolset-body.dto.spec.ts`, `toolsets.service.spec.ts` — remove `intro` fixtures/assertions
- [x] 1.9 Run `npm exec nx test chat-api`, `npm exec nx lint chat-api`, `npm exec nx build chat-api`

## 2. API contract regeneration

- [x] 2.1 Run `npm run openapi` to regenerate `libs/chat-api-client/openapi.json` and the generated client from the updated backend DTOs (full regeneration reverted — this environment's fresh openapi-generator-cli download (7.15.0) introduced an unrelated `function`→`_function` rename on `PublishRuleDto`; applied only the `intro`-specific removals by hand to keep this change scoped)
- [x] 2.2 Run `npm run openapi:check` and confirm no unrelated schema drift
- [x] 2.3 Confirm `intro` no longer appears in `libs/chat-api-client/openapi.json` or `libs/chat-api-client/src/generated/src/models/index.ts` (except unrelated `introText`)
- [x] 2.4 Build/lint `chat-api-client`: `npm exec nx build chat-api-client`, `npm exec nx lint chat-api-client`

## 3. Frontend models and mappers

- [x] 3.1 Remove `intro` from `apps/chat/src/models/toolsets.ts`
- [x] 3.2 Remove `intro` from `apps/chat/src/types/apps-editor.ts`
- [x] 3.3 Remove `intro` default value and DTO/form mapping in `apps/chat/src/utils/toolsets.ts`
- [x] 3.4 Remove `intro` mapping in `apps/chat/src/utils/map-deployment-to-catalog-item.ts`
- [x] 3.5 Remove `intro` default in `apps/chat/src/constants/custom-apps.ts`
- [x] 3.6 Remove `intro` field from `libs/catalog/src/models/catalog-item.ts`
- [x] 3.7 Remove `introLabel`/`introCaptionClassName` from `libs/catalog/src/models/item-details-props.ts`
- [x] 3.8 Update the doc comment in `libs/catalog/src/types/detail-tab.ts` that references `item.intro ?? item.description`
- [x] 3.9 Update `apps/chat/src/utils/tests/map-deployment-to-catalog-item.spec.ts` and `apps/chat/src/utils/tests/toolsets.spec.ts` — remove `intro` fixtures/assertions

## 4. Frontend UI: toolset and quick app editors

- [x] 4.1 Remove the Intro input, form state, and `IntroTooLong` handling from `apps/chat/src/pages/ToolsetEditor/EditorForm/GeneralForm.tsx`
- [x] 4.2 Remove `'intro'` from tracked form fields and its `TooLong` error handling in `apps/chat/src/pages/ToolsetEditor/ToolsetEditor.tsx`
- [x] 4.3 Remove `deployment.intro` passthrough in `apps/chat/src/pages/ToolsetEditor/CustomAppEditor.tsx`
- [x] 4.4 Remove the Intro input, form state, and `IntroTooLong` handling from `apps/chat/src/pages/AppsEditor/GeneralForm.tsx`
- [x] 4.5 Remove `existingDeployment.intro` passthrough in `apps/chat/src/pages/AppsEditor/AppsEditor.tsx`
- [x] 4.6 Update `EditorForm/tests/GeneralForm.spec.tsx`, `EditorForm/tests/SettingsForm.spec.tsx`, `AppsEditor/tests/GeneralForm.spec.tsx`, `AppsEditor/tests/AppPreviewChat.spec.tsx` — remove `intro` fixtures/assertions (AppPreviewChat.spec.tsx had no true `intro` field usage — only unrelated `introText`)

## 5. Shared deployment-creation-form library

- [x] 5.1 Remove the Intro field from `libs/deployment-creation-form/src/components/DeploymentCreationForm/DeploymentCreationForm.tsx`
- [x] 5.2 Remove the `intro` length-validation rule and field-error case from `libs/deployment-creation-form/src/utils/validate-deployment-creation-fields.ts`
- [x] 5.3 Remove `intro` from `libs/deployment-creation-form/src/models/deployment-creation-form.ts` and `libs/deployment-creation-form/src/models/validation.ts`
- [x] 5.4 Update `validate-deployment-creation-fields.spec.ts` and `DeploymentCreationForm/tests/DeploymentCreationForm.spec.tsx`
- [x] 5.5 Run `npm exec nx test deployment-creation-form`, `npm exec nx lint deployment-creation-form` (test target hits a pre-existing environment issue — same "Cannot read properties of undefined (reading 'config')" failure reproduced on the unmodified branch; lint passes)

## 6. Catalog display

- [x] 6.1 Update `libs/catalog/src/components/CardGrid/Card.tsx` to render `item.description` instead of `item.intro ?? item.description`
- [x] 6.2 Update `libs/catalog/src/components/Details/Summary/Summary.tsx` to render `item.description` directly (remove the Intro-specific fallback and any now-unused `introLabel` caption logic; caption now reuses `tabAboutLabel` ?? 'About')
- [x] 6.3 Update `libs/catalog/src/components/Details/tests/DetailsPanel.spec.tsx` — remove `intro` fixtures/assertions (no `intro` fixture existed; renamed the one test whose name referenced "intro section")
- [x] 6.4 Run `npm exec nx test catalog`, `npm exec nx lint catalog`, `npm exec nx build catalog` (test target hits the same pre-existing environment-wide vitest setup issue reproduced on the unmodified branch — all 22 test files fail identically; lint and build pass)

## 7. i18n cleanup

- [x] 7.1 Remove unused `Intro*` translation-key constants (labels, placeholders, `IntroTooLong` error messages) from `apps/chat/src/constants/translation-keys.ts`
- [x] 7.2 Remove the corresponding `Intro*` entries from `apps/chat/src/i18n/locales/en.json` (only `en.json` exists — no other locale files to update)

## 8. Final verification

- [x] 8.1 Grep `\bintro\b` (case-insensitive, word-boundary) across `apps/` and `libs/` and confirm zero true-positive hits remain (excluding `introText`/`intro_text` and the unrelated comment in `starter-option.ts`) — confirmed clean; also fixed a stale doc comment in `libs/catalog/src/components/Details/TabsContent/About.tsx`
- [x] 8.2 Run `npm exec nx affected --target=lint --base=origin/development-1.0` — passes (0 errors; only pre-existing unrelated warnings)
- [ ] 8.3 Run `npm exec nx affected --target=test --base=origin/development-1.0` — not completed; run was interrupted by the user before finishing. Prior spot-checks (chat-api's applications/toolsets/deployments suites, 297 tests) passed; broader suite run across all affected projects was not confirmed
- [x] 8.4 Run `npm exec nx affected --target=build --base=origin/development-1.0` — passes (20 affected projects build successfully)
