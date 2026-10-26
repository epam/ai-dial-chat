## Why

DIAL Core's toolset `GET` responses (`getCustomToolSet`, `getToolset`) now carry `auth_settings.client_secret_hint` — the last four characters of the stored OAuth client secret (e.g. `"d4c6"`) — and never the secret itself. Chat NG drops the field in its chat-api allowlist mappers, so a user editing an OAuth "Custom login" toolset sees an empty Client secret field and cannot tell whether a secret is stored at all, or which one. GitHub-style secret lists (`*****f4fb9c46`) show the same hint, and users expect it here.

## Problem

- `mapAuthSettings` (`apps/chat-api/src/toolsets/utils/toolset-mapper.util.ts`) and `mapToolsetAuthSettings` (`apps/chat-api/src/deployments/utils/deployment-mapper.util.ts`) copy an explicit allowlist of `auth_settings` fields; `client_secret_hint` is not on it, so neither `DialToolsetDto.authSettings` (`GET /api/v1/toolsets/{toolsetName}`) nor `DeploymentDetailsDto.toolsetDetails.authSettings` (`GET /api/v1/deployments/{deployment}/details`) carries it.
- `authSettingsDtoToForm` (`apps/chat/src/utils/toolsets.ts`) therefore has nothing to seed, and `AuthSection` (`libs/toolset-editor/src/components/AuthSection/AuthSection.tsx`) renders the Client secret `PasswordInput` with its generic placeholder, `Enter client secret`, even when Core holds a secret.

## Solution

- **chat-api:** add `clientSecretHint?: string` to `DialToolsetAuthSettingsDto` (`apps/chat-api/src/openapi/openapi-response.dto.ts`) and `ToolsetAuthSettingsDto` (`apps/chat-api/src/deployments/dto/deployment-details.dto.ts`), mapped from `client_secret_hint` in both allowlist mappers. Regenerate `libs/chat-api-client`. The hint is never accepted on a write: `ToolsetBodyDto` stays unchanged, and `preserveHiddenAuthSettings`' `OAUTH_MERGEABLE_KEYS` does not gain it.
- **App edge:** `authSettingsDtoToForm` copies `clientSecretHint` into the form state; `formToToolsetBody` keeps building `clientSecret` only from what the user typed, so the hint can never travel back as a secret.
- **`libs/toolset-editor`:** `ToolsetAuthFormData` gains a read-only `clientSecretHint?: string`. When it is set and the user has typed no new secret, `AuthSection` shows the masked hint (`******d4c6`) as the Client secret placeholder and a caption saying that leaving the field empty keeps the saved secret. The masking format is a label function with an English default, so the lib stays host-agnostic and i18n-free.

Model to follow: the existing allowlist mappers themselves, and the `apiKeyHeaderHint` label-function pattern used by `libs/catalog` (`ItemDetailsTexts.apiKeyHeaderHint`).

## What Changes

- `DialToolsetAuthSettingsDto` and `ToolsetAuthSettingsDto` gain optional `clientSecretHint`; OpenAPI spec and generated client are regenerated (additive, non-breaking).
- `ToolsetAuthFormData.clientSecretHint` (new optional field), `AuthSectionLabels.clientSecretHintPlaceholder` (label function, default `` (hint) => `******${hint}` ``) and `AuthSectionLabels.clientSecretKeepCaption` (default `Leave empty to keep the saved secret.`) in `libs/toolset-editor`, plus README.
- New i18n key `toolsetEditor.auth.clientSecretKeepCaption` in `apps/chat/src/i18n/locales/en.json` and `ToolsetEditorI18nKeys`. The masked placeholder is not translated (asterisks plus the hint).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalog-toolsets`: the camelCase `authSettings` on `GET /api/v1/toolsets` and `GET /api/v1/toolsets/{toolsetName}` additionally carries `clientSecretHint`.
- `deployment-details-api`: `ToolsetAuthSettingsDto` on `GET /api/v1/deployments/{deployment}/details` additionally carries `clientSecretHint`.
- `toolset-authentication`: editing an OAuth "Custom login" toolset shows the saved secret's masked hint and keeps the stored secret when the field is left empty.
- `toolset-editor-library`: `ToolsetAuthFormData`/`AuthSectionLabels` gain the hint field and its two labels; the hint is display-only.

## Non-goals

- Revealing, copying, or verifying the secret. Only Core's own hint is shown.
- External-service (application editor) OAuth secrets. Whether Core sends a hint there is unverified; out of scope until it is.
- Catalog details panel / `AppEditorIframe` UI. They receive the field through `ToolsetAuthSettingsDto` for parity but render nothing new.
- Any change to how Core treats an omitted `client_secret` on a toolset update. This change relies on the behaviour the editor already depends on: omitted means "keep the stored secret" (the `isEditMode` rule in `toolset-authentication`).

## Alternatives considered

- **Pre-fill the input with `******d4c6` as its value** — rejected: the masked string would be submitted as the new secret on save unless every write path filtered it, and the reveal toggle would "show" a fake secret.
- **Show the hint only as a caption, keep the generic placeholder** — viable, but the user explicitly asked for the GitHub-style `******d4c6` in place; a placeholder plus an explanatory caption gives both the familiar look and an accessible explanation (placeholders alone are not reliable descriptions).
- **Mask in chat-api and send `******d4c6`** — rejected: presentation belongs to the UI, and the DTO should carry Core's value unchanged.

## Acceptance criteria

1. Opening the editor for an OAuth "Custom login" toolset whose Core response has `client_secret_hint: "d4c6"` shows an empty Client secret input with placeholder `******d4c6` and the caption `Leave empty to keep the saved secret.`
2. Saving without typing a secret sends no `clientSecret` in `PATCH /api/v1/toolsets/{toolsetName}`; the stored secret is unchanged and the next `GET` returns the same hint.
3. Typing a new secret and saving sends that secret; after the cache is invalidated by the write, the editor shows the new hint.
4. A toolset whose Core response has no `client_secret_hint` (older Core, or no secret stored) renders exactly as today.
5. Neither `GET /api/v1/toolsets/{toolsetName}` nor `GET /api/v1/deployments/{deployment}/details` ever returns `clientSecret`/`codeVerifier`; only `clientSecretHint` is added.

## Impact

- **chat-api:** `openapi-response.dto.ts`, `deployment-details.dto.ts`, `toolset-mapper.util.ts`, `deployment-mapper.util.ts` and their specs; `npm run openapi` + `npm run openapi:check`.
- **Generated client:** `libs/chat-api-client` (`openapi.json` and models) — regenerated, never hand-edited.
- **App:** `apps/chat/src/utils/toolsets.ts`, `ToolsetApplicationEditor.tsx` (labels), `translation-keys.ts`, `en.json`.
- **Lib (`libs/toolset-editor`):** `toolset-form.ts`, `auth-section-props.ts`, `AuthSection.tsx`, README. Host knowledge stays outside the lib: it receives the already-resolved hint through `ToolsetAuthFormData` and its copy through `labels`; it never sees the DTO, the endpoint, or Core.
- **i18n:** one new key (`toolsetEditor.auth.clientSecretKeepCaption`).
- **Caching:** none new. The hint rides in the existing 60-second `toolsets:single:<sub>:<toolsetName>` and `deployments:details:<sub>:<deployment>` entries, both cleared by `ToolsetsListingService.invalidateCaches` after every toolset write.
- **Rollback / compatibility:** purely additive (optional DTO field, optional form field, optional labels). Reverting removes the hint; older Core versions simply never send it.
