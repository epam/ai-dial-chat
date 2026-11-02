Slicing strategy: **vertical, contract-first at the seam** — the backend DTO and regenerated client land first (slice 1) because every later slice compiles against them; then the app edge (slice 2) and the lib UI (slice 3), each verifiable on its own. Slice 4 is docs and the closing gate.

## 1. Backend: forward `client_secret_hint` (chat-api + generated client)

- [x] 1.1 Add `clientSecretHint?: string` to `DialToolsetAuthSettingsDto` in `apps/chat-api/src/openapi/openapi-response.dto.ts` with `@ApiPropertyOptional({ description: 'Last characters of the stored OAuth client secret, as returned by DIAL Core. Never the secret itself.', example: 'd4c6' })`, and map it in `mapAuthSettings` (`apps/chat-api/src/toolsets/utils/toolset-mapper.util.ts`) via `getString(raw, 'client_secret_hint')`. Do not add it to `OAUTH_MERGEABLE_KEYS` or `ToolsetBodyDto`.
- [x] 1.2 Add the same optional field to `ToolsetAuthSettingsDto` in `apps/chat-api/src/deployments/dto/deployment-details.dto.ts` and map it in `mapToolsetAuthSettings` (`apps/chat-api/src/deployments/utils/deployment-mapper.util.ts`); leave `redactToolsetAuthSettings` unchanged.
- [x] 1.3 Tests:
  - `apps/chat-api/src/toolsets/listing/tests/toolsets-listing.service.spec.ts`: a custom toolset whose `getCustomToolSet` `auth_settings` has `client_secret_hint: 'd4c6'` (and a `client_secret`) returns `authSettings.clientSecretHint: 'd4c6'` and no `clientSecret`; without the field, `clientSecretHint` is absent.
  - `apps/chat-api/src/deployments/utils/tests/deployment-mapper.util.spec.ts`: `mapToolsetAuthSettings` copies `client_secret_hint` unchanged and still drops `client_secret`/`code_verifier`.
  - `apps/chat-api/src/toolsets/tests/toolset-body.dto.spec.ts`: a body carrying `authSettings.clientSecretHint` fails validation under the global pipe options (`whitelist`, `forbidNonWhitelisted`).
- [x] 1.4 Regenerate the client: `npm run openapi`, then `npm run openapi:check`; confirm `libs/chat-api-client/openapi.json` and the generated `DialToolsetAuthSettingsDto`/`ToolsetAuthSettingsDto` models gain `clientSecretHint` and nothing else changed. Do not hand-edit generated files. Build and lint `chat-api-client`.

**Verification:** `npm run test:file -- apps/chat-api/src/toolsets/listing/tests/toolsets-listing.service.spec.ts apps/chat-api/src/deployments/utils/tests/deployment-mapper.util.spec.ts apps/chat-api/src/toolsets/tests/toolset-body.dto.spec.ts`, then `npm run verify:changed` once for the slice.

## 2. App edge: seed the hint, never send it

- [x] 2.1 In `apps/chat/src/utils/toolsets.ts`, have `authSettingsDtoToForm` set `clientSecretHint: authSettings?.clientSecretHint` (depends on 1.4 and on 3.1's `ToolsetAuthFormData` field — land 3.1 first or together). Leave `formToToolsetBody` building `clientSecret` only from `auth.clientSecret`.
- [x] 2.2 Tests in `apps/chat/src/utils/tests/toolsets.spec.ts`: `toolsetDtoToForm` carries `clientSecretHint` into `auth`; `formToToolsetBody` on a form with `clientSecretHint: 'd4c6'` and an empty `clientSecret` emits no `clientSecret` and no `clientSecretHint`; with a typed secret it emits exactly the typed value.
- [x] 2.3 i18n: add `toolsetEditor.auth.clientSecretKeepCaption` = `Leave empty to keep the saved secret.` to `apps/chat/src/i18n/locales/en.json` and `ClientSecretKeepCaption` to `ToolsetEditorI18nKeys` in `apps/chat/src/constants/translation-keys.ts`; pass it as `clientSecretKeepCaption` in the `settings.auth` labels of `apps/chat/src/pages/ApplicationEditor/toolset/ToolsetApplicationEditor.tsx`. Leave `clientSecretHintPlaceholder` at the lib default.

**Verification:** `npm run test:file -- apps/chat/src/utils/tests/toolsets.spec.ts apps/chat/src/pages/ApplicationEditor/tests/toolsetDefinition.spec.tsx`.

## 3. Lib: display-only hint in `AuthSection` (`libs/toolset-editor`)

- [x] 3.1 Add `clientSecretHint?: string` (display-only; "last characters of the stored client secret, supplied by the host") to `ToolsetAuthFormData` in `libs/toolset-editor/src/models/toolset-form.ts`, and `clientSecretHintPlaceholder?: (hint: string) => string` (default `` (hint) => `******${hint}` ``) plus `clientSecretKeepCaption?: string` (default `'Leave empty to keep the saved secret.'`) to `AuthSectionLabels` in `libs/toolset-editor/src/models/auth-section-props.ts`, each with JSDoc stating its default.
- [x] 3.2 In `libs/toolset-editor/src/components/AuthSection/AuthSection.tsx`, when OAuth `with-config` is active, `isEditMode` is true, `auth.clientSecretHint` is non-empty and `auth.clientSecret` is empty, render the Client secret `PasswordInput` with the masked placeholder and the keep caption; otherwise render it unchanged. First confirm with `getEntityDetails("component", "PasswordInput")` whether the 2.0 `caption` is exposed via `aria-describedby`; if not, render the caption as a sibling with an id and pass `aria-describedby` (pattern: `CredentialsApiKeyOverlay` in `libs/catalog`). Keep the caption on logical spacing only (no `ml-`/`mr-`/`pl-`/`pr-`/`left`/`right` classes); no icon is added, so nothing to mirror.
- [x] 3.3 Confirm `isToolsetAuthValid` / `isToolsetFormValid` (`libs/toolset-editor/src/utils/toolsets.ts`) and `ToolsetEditor`'s `validateSetup` do not read `clientSecretHint` — no code change expected; covered by tests in 3.4.
- [x] 3.4 Tests in `libs/toolset-editor/src/components/AuthSection/tests/AuthSection.spec.tsx`: masked placeholder `******d4c6` and accessible description `Leave empty to keep the saved secret.` in edit mode with an empty secret; regular placeholder and no caption once a secret is typed, in create mode, on "Standard login", and without a hint; host label overrides are used; clicking "Log in" with only a hint hands the host no client secret. Add an `isToolsetAuthValid` case to `libs/toolset-editor/src/utils/tests/toolsets.spec.ts` showing the hint does not satisfy the create-mode secret requirement.
- [x] 3.5 Architecture guard: confirm `libs/toolset-editor/src/**` still imports no `@epam/ai-dial-chat-api-client`, `apps/chat/src/server-api`, `react-i18next`, app context, or `/api` path — the hint arrives only through `ToolsetAuthFormData`, its copy only through `labels`.

**Verification:** `npm run test:file -- libs/toolset-editor/src/components/AuthSection/tests/AuthSection.spec.tsx libs/toolset-editor/src/utils/tests/toolsets.spec.ts libs/toolset-editor/src/components/ToolsetEditor/tests/ToolsetEditor.spec.tsx`, then `npm run verify:changed` once for slices 2–3.

## 4. Docs and closing gate

- [x] 4.1 Document `ToolsetAuthFormData.clientSecretHint` and the two new `AuthSectionLabels` fields in `libs/toolset-editor/README.md`; run `npm run validate:docs`.
- [x] 4.2 Run `npm run validate:specs` and `npm run spec:impact` for the touched specs (`catalog-toolsets`, `deployment-details-api`, `toolset-authentication`, `toolset-editor-library`).
- [x] 4.3 Follow-up (out of scope, record only): confirm with DIAL Core whether external-service OAuth secrets and stored API keys also return a hint; open a separate change if so.
- [ ] 4.4 Close with one `npm run verify:full`.
