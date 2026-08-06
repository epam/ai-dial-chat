## Why

The `intro` field (a 90-character optional "short catalog-friendly intro" for applications, toolsets, and quick apps) duplicates the existing required `description` field across the stack — every consumer already falls back to `description` when `intro` is absent, and the catalog UI shows `item.intro ?? item.description`. Maintaining a second short-form text field (DTO validation, form input, Swagger docs, generated client type, catalog display logic) adds authoring surface and API contract weight for a field that never diverges in practice from `description` at the surfaces users rely on. Removing it simplifies the General-step authoring form (toolsets, custom apps, quick apps) and the catalog details/card rendering to a single source of truth: `description`.

This is **not** related to `introText` (`conversationStarters.introText` / Quick Apps starter intro text shown on the new-conversation screen) or `raw-deployment.dto.ts`'s upstream `intro_text` mapping — those are separate, unrelated fields and are out of scope for this change.

## What Changes

- **BREAKING**: Remove the `intro` field from `CreateApplicationBodyDto`, `UpdateApplicationBodyDto`, `ApplicationDto`, `ToolsetBodyDto` (chat-api), and the corresponding `intro` property in the OpenAPI contract (`libs/chat-api-client/openapi.json`) and regenerated `@epam/chat-api-client` models. Existing `intro` values already stored in DIAL Core are no longer read or written by this API.
- Remove `intro` handling in `apps/chat-api/src/applications/applications.service.ts` and `apps/chat-api/src/toolsets/toolsets.service.ts` (stop forwarding `body.intro` to DIAL Core on create/update; stop mapping `raw.intro` back into responses).
- Remove `intro` from `apps/chat-api/src/deployments/dto/raw-deployment.dto.ts` and the `intro` mapping in `apps/chat-api/src/deployments/deployments.service.ts` (`introText`/`intro_text` mapping is untouched).
- Remove the Intro input field and its length-validation error (`IntroTooLong`) from the General step of the Toolset editor (`ToolsetEditor/EditorForm/GeneralForm.tsx`, `ToolsetEditor.tsx`, `CustomAppEditor.tsx`) and the Apps editor (`AppsEditor/GeneralForm.tsx`, `AppsEditor.tsx`), and from the shared `DeploymentCreationForm` component and its field validator (`libs/deployment-creation-form`).
- Remove `intro`/`introLabel`/`introCaptionClassName` from `libs/catalog/src/models/catalog-item.ts` and `libs/catalog/src/models/item-details-props.ts`; the catalog details Summary section and `CardGrid/Card.tsx` render `item.description` directly instead of `item.intro ?? item.description`.
- Remove `intro` from frontend models/mappers: `apps/chat/src/models/toolsets.ts`, `apps/chat/src/types/apps-editor.ts`, `apps/chat/src/utils/toolsets.ts`, `apps/chat/src/utils/map-deployment-to-catalog-item.ts`, `apps/chat/src/constants/custom-apps.ts`.
- Remove now-unused `Intro*` i18n keys (labels, placeholders, error messages) from `apps/chat/src/i18n/locales/en.json` and their translation-key constants.
- Update all affected tests (backend DTO/service specs, frontend form/mapper specs, `DetailsPanel.spec.tsx`) to drop `intro` fixtures and assertions.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `applications-write-api`: Remove the `intro` field and its 90-character validation from `CreateApplicationBodyDto`/`UpdateApplicationBodyDto`/`ApplicationDto` and the DIAL Core forwarding behavior.
- `toolset-write-api`: Remove the `intro` field and its 90-character validation from `ToolsetBodyDto` and the DIAL Core forwarding behavior.
- `toolset-authoring`: Remove the Intro input from the General step of the toolset authoring form.
- `quick-app-authoring`: Remove the Intro input from the General step of the quick app authoring form and drop `intro` from the save payload.
- `deployment-creation-form`: Remove the shared Intro input and its length-validation rule from the reusable deployment creation form component.
- `catalog-item-details-fetch`: Remove the distinct `item.intro` field; the details panel's Summary section and the About tab both read `item.description` (no fallback logic needed).

## Impact

- **Affected code**: `apps/chat-api/src/{applications,toolsets,deployments}/**`, `libs/chat-api-client/openapi.json` + generated client, `apps/chat/src/pages/{ToolsetEditor,AppsEditor}/**`, `libs/deployment-creation-form/**`, `libs/catalog/src/{models,components}/**`, `apps/chat/src/{models,types,utils,constants}/**` touching toolsets/apps-editor/catalog mapping, `apps/chat/src/i18n/locales/en.json`.
- **APIs**: Breaking change to the public application and toolset create/update request and response bodies (`intro` field removed) — requires an OpenAPI regeneration (`npm run openapi`) and a version note for API consumers.
- **Dependencies**: None new; `libs/chat-api-client` regeneration is required after backend DTO changes.
- **Out of scope**: `introText`/`intro_text` (Quick Apps starter intro text, `conversationStarters.introText`, `raw-deployment.dto.ts`'s `intro_text` upstream field) — a separate, unrelated field left unchanged.
