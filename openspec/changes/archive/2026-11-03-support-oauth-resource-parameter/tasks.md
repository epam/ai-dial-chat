Slicing strategy: **contract-first**. Slice 1 fixes the chat-api contract and regenerates the client,
because every frontend slice compiles against the generated `resource` field. Slices 2–4 are then
vertical: the authorize-URL leg for every entry point, then the editor field, then the editor login.
Each slice ends green on `npm run verify:changed`.

## 1. chat-api contract (toolsets + external services)

- [x] 1.0 Bump `@epam/ai-dial-typescript-sdk` from `0.2.0-dev.15` to `0.2.0-dev.23` (exact pin) in
      `apps/chat-api/package.json` and refresh the root `package-lock.json` with `npm install`; confirm
      `components['schemas']['ResourceAuthSettings']` now has `resource?: string`. Land the bump alone
      first so any fallout from the additive org-unit changes is isolated.
      Verification: `npm exec nx typecheck chat-api`, `npm exec nx test chat-api`
- [x] 1.1 Add `apps/chat-api/src/common/validators/oauth-resource.pattern.ts` exporting
      `OAUTH_RESOURCE_PATTERN` (`/^(?:[A-Za-z][A-Za-z0-9+.-]*:[^\s#]+)?$/`) and its message, following
      `display-name.pattern.ts`; add a co-located spec for `''`, `https://mcp.notion.com/mcp`,
      `urn:example:x` (accepted) and a relative value, a `#fragment`, whitespace, a line break (rejected).
      Verification: `npm run test:file -- apps/chat-api/src/common/validators/oauth-resource.pattern.spec.ts`
- [x] 1.2 Toolsets: add `resource?: string` to `ToolsetAuthSettingsBodyDto`
      (`apps/chat-api/src/toolsets/dto/toolset-body.dto.ts`) with `@ApiPropertyOptional`,
      `@IsOptional @IsString @MaxLength(2048) @Matches(OAUTH_RESOURCE_PATTERN)`; forward it in the OAuth
      branch of `toDialAuthSettings` when `!= null` (typed by the SDK's `ResourceAuthSettings`, no local
      extension); do **not** touch `OAUTH_MERGEABLE_KEYS`;
      copy `resource` in `mapAuthSettings`; add `resource?` to `DialToolsetAuthSettingsDto`
      (`apps/chat-api/src/openapi/openapi-response.dto.ts`).
      Verification: `npm run test:file -- apps/chat-api/src/toolsets/tests/toolset-body.dto.spec.ts apps/chat-api/src/toolsets/mutation/tests/toolsets-mutation.service.spec.ts apps/chat-api/src/toolsets/listing/tests/toolsets-listing.service.spec.ts`
- [x] 1.3 Toolset tests: DTO accepts a valid / `''` resource and rejects the invalid ones with `400`;
      the mutation service forwards a value and `''`, drops it for `API_KEY`, and does **not** refill an
      omitted `resource` from the stored toolset while still refilling the other mergeable keys; the
      listing/details mapping returns `resource` and omits it when Core has none.
      Verification: same files as 1.2.
- [x] 1.4 External services: add `resource?` (same validators, Swagger description stating that a
      `PUT` without it erases a stored value) to `ExternalServiceAuthSettingsBodyDto`
      (`apps/chat-api/src/external-services/dto/external-service-definition.dto.ts`); add `resource?` to
      `GetExternalServiceResponseDto` (`external-service.dto.ts`); in
      `apps/chat-api/src/external-services/external-services.mapper.ts` read `auth_settings.resource`
      in `mapDialExternalServiceToDto` and forward it in `toDialExternalServiceDefinition` (both typed
      by the SDK's `ResourceAuthSettings`).
      Verification: `npm run test:file -- apps/chat-api/src/external-services/tests/external-services.mapper.spec.ts apps/chat-api/src/external-services/tests/external-services-definition.controller.spec.ts apps/chat-api/src/external-services/tests/external-services-definition.service.spec.ts`
- [x] 1.5 External-service tests: mapper returns/omits `resource` (single service and listing entry);
      definition forwards a value and `''`; the controller (supertest) answers `400` for an invalid
      `resource` without calling the service.
      Verification: same files as 1.4.
- [x] 1.6 Regenerate the contract: `npm run openapi`, `npm run openapi:check`, then
      `npm exec nx build chat-api-client` and `npm exec nx lint chat-api-client`. Confirm the
      regenerated `ToolsetAuthSettingsBodyDto`, `DialToolsetAuthSettingsDto`,
      `ExternalServiceAuthSettingsBodyDto` and `GetExternalServiceResponseDto` models carry an optional
      `resource`, and that no operation id changed. No `apps/chat/src/server-api` wrapper change is
      needed (methods unchanged). Do not hand-edit `libs/chat-api-client/src/generated`.
- [x] 1.7 Slice check: `npm exec nx test chat-api`, `npm exec nx lint chat-api`, then `npm run verify:changed`.
      Result: typecheck and `lint chat-api` pass. Three failures predate this change and are left
      alone (each fails on the untouched base too): `apps/chat-api/src/files/tests/files.controller.spec.ts`
      "maps a DIAL Core 401 to 401", `libs/conversation-input/.../AddAttachmentButton.prompts.spec.tsx`
      "renders the overlay content in the desktop flyout on keyboard open", and prettier errors in
      `libs/chat-hooks/src/conversation/tests/scheduled-task-grouping.spec.ts`.

## 2. Authorize URL carries `resource` from every entry point

- [x] 2.1 `libs/chat-hooks/src/oauth/models.ts`: add `resource?: string` to `ToolsetOAuthSettings`
      and declare `ToolsetOAuthSettingsSource` (structural: `clientId`, `authorizationEndpoint`,
      `scopesSupported`, `codeChallenge`, `codeChallengeMethod`, `resource`, all optional, JSDoc on each).
- [x] 2.2 `libs/chat-hooks/src/oauth/authorize-url.ts`: set `resource` (trimmed, non-blank only) in
      `buildToolsetAuthorizeUrl`; add `toToolsetOAuthSettings(source?)`; export it from
      `libs/chat-hooks/src/index.ts` and `libs/chat-hooks/src/entry-points/oauth.ts`.
      Verification: `npm run test:file -- libs/chat-hooks/src/oauth/tests/authorize-url.spec.ts`
- [x] 2.3 Unit tests in `libs/chat-hooks/src/oauth/tests/authorize-url.spec.ts`: resource forwarded
      once and decoded equal; absent / `''` / whitespace omitted with an otherwise identical URL;
      `toToolsetOAuthSettings` maps every field (`scopesSupported` → `scopes`) and handles `undefined`.
      Update `libs/chat-hooks/src/tests/remaining-reuse-public-api.spec.ts` if it pins the export list.
      Verification: `npm run test:file -- libs/chat-hooks/src/oauth/tests/authorize-url.spec.ts libs/chat-hooks/src/tests/remaining-reuse-public-api.spec.ts`
- [x] 2.4 Pass `resource` through in the lib copies: `useToolsetLogin` (initial `authSettings` copy and
      the `getToolset` re-read, the latter via `toToolsetOAuthSettings(fresh)`), and
      `useExternalServiceLogin` (`ExternalServiceOAuthSettings.resource` + its copy).
      Verification: `npm run test:file -- libs/chat-hooks/src/oauth/useToolsetLogin/tests/useToolsetLogin.spec.ts libs/chat-hooks/src/external-services/tests/useExternalServiceLogin.spec.ts`
- [x] 2.5 Replace hand copies with `toToolsetOAuthSettings` in
      `libs/chat-hooks/src/catalog/useCatalogToolsetCredentials/useCatalogToolsetCredentials.ts` and
      `libs/chat-hooks/src/catalog/application-credentials.ts`; add a test per site asserting the
      `resource` reaches the login params.
      Verification: `npm run test:file -- libs/chat-hooks/src/catalog/useCatalogToolsetCredentials/tests/useCatalogToolsetCredentials.spec.ts libs/chat-hooks/src/catalog/tests/application-credentials.spec.ts`
- [x] 2.6 Replace hand copies in `apps/chat/src/utils/signin-interrupt.ts` (toolset and external
      service resolvers) and the external-service relay in
      `apps/chat/src/pages/ApplicationEditor/setup/AppEditorIframe.tsx`; extend
      `apps/chat/src/pages/ApplicationEditor/setup/tests/AppEditorIframe.spec.tsx` and the
      `SigninInterruptDialog` tests to assert `resource` is forwarded.
      Verification: `npm run test:file -- apps/chat/src/pages/ApplicationEditor/setup/tests/AppEditorIframe.spec.tsx apps/chat/src/components/SigninInterruptDialog/tests/SigninInterruptDialog.spec.tsx`
      Done as: the relay assertion in `AppEditorIframe.spec.tsx` plus a new
      `apps/chat/src/utils/tests/signin-interrupt.spec.ts` covering both resolvers directly (the dialog
      spec drives only API-key flows, so the mapping is asserted where it happens).
- [x] 2.7 Architecture guard for `libs/chat-hooks`: the new mapper and model import no generated
      client, `/api` path, app context, env, routing or i18n; `npm exec nx lint chat-hooks` passes the
      module-boundary rules.
- [x] 2.8 Slice check: `npm run verify:changed`.

## 3. Toolset editor Resource field

- [x] 3.1 `libs/toolset-editor`: add `resource?: string` to `ToolsetAuthFormData` and `ToolsetFormErrors`
      (`src/models/toolset-form.ts`); `resourceLabel` / `resourcePlaceholder` to `AuthSectionLabels`
      (`src/models/auth-section-props.ts`) and `resourceInvalid` to `ToolsetEditorValidationLabels`
      (`src/models/toolset-editor-props.ts`), each with JSDoc stating its English default.
- [x] 3.2 Add `isValidOAuthResource` to `libs/toolset-editor/src/utils/toolsets.ts` and use it in
      `isToolsetAuthValid` (OAuth + `WithConfig` only); add `'resource'` to `AUTH_ERROR_FIELDS` and the
      `WithConfig` branch of `validateSetup` in `src/components/ToolsetEditor/ToolsetEditor.tsx`.
      Verification: `npm run test:file -- libs/toolset-editor/src/utils/tests/toolsets.spec.ts libs/toolset-editor/src/components/ToolsetEditor/tests/ToolsetEditor.spec.tsx`
- [x] 3.3 Render the `Input` (`id="toolset-resource"`, not required) after Scopes inside the
      `WithLogin.WithConfig` block of `src/components/AuthSection/AuthSection.tsx`, wired like the
      token-endpoint input (`labelProps`, `placeholder`, `error`, `invalid`, `disabled`).
      Verification: `npm run test:file -- libs/toolset-editor/src/components/AuthSection/tests/AuthSection.spec.tsx`
- [x] 3.4 Tests (role/label queries): the Resource textbox appears only for OAuth + With Login &
      Config; a relative value and a `#fragment` show the invalid message and keep save/Log In
      disabled; blank is valid; the field is disabled while saving; the error is exposed through the
      textbox's accessible description.
      Verification: same files as 3.2 and 3.3.
      Note: `AuthSection.spec.tsx` mocks the kit `Input`, so the `aria-describedby` wiring of the
      error is the kit 2.0 `Input`'s own (`error` prop), not asserted here; the field passes `error`
      and `invalid` exactly like the token-endpoint input.
- [x] 3.5 RTL check: the new input uses only the existing form column classes (no physical-direction
      utilities, no icon); confirm by reviewing the diff of `AuthSection.tsx` against `.claude/rules/rtl.md`.
- [x] 3.6 Architecture guard for `libs/toolset-editor`: no `t()`/i18n import, no host route, no
      generated client added; strings only through `*Labels` defaults.
- [x] 3.7 Host mapping in `apps/chat/src/utils/toolsets.ts`: `authSettingsDtoToForm` reads
      `resource ?? ''`; `formToToolsetBody(form, redirectUri, isUpdate)` writes `resource` only for
      OAuth + `WithConfig` (trimmed; blank → `''` when `isUpdate`, omitted on create). Pass
      `Boolean(toolsetId)` from `apps/chat/src/pages/ApplicationEditor/toolset/ToolsetApplicationEditor.tsx`.
      Tests in `apps/chat/src/utils/tests/toolsets.spec.ts`: round-trip, clear → `''`, create blank →
      omitted, `WithLogin` and `API_KEY` → no key.
      Verification: `npm run test:file -- apps/chat/src/utils/tests/toolsets.spec.ts`
- [x] 3.8 i18n: add `ResourceLabel`, `ResourcePlaceholder`, `ResourceInvalid` to `ToolsetEditorI18nKeys`
      (`apps/chat/src/constants/translation-keys.ts`) as `toolsetEditor.auth.resourceLabel` /
      `.resourcePlaceholder` / `.resourceInvalid`, the English strings to
      `apps/chat/src/i18n/locales/en.json` (check `en.json` for an existing identical value first), and
      fill the three labels with `t()` in `ToolsetApplicationEditor.tsx`.
- [x] 3.9 Slice check: `npm run verify:changed`.

## 4. Editor login uses the stored resource

- [x] 4.1 In `apps/chat/src/hooks/toolsets/useToolsetEditorOAuthLogin.ts`, route `WithConfig` logins
      with a blank `auth.resource` through the open-popup → `ensureSaved` → `fetchToolsetAuthSettings`
      → `navigateToolsetOAuthPopup` sequence the dynamic branch already uses (extract the shared steps
      into a local helper rather than duplicating them), and return the fetched `auth`; leave the
      filled-field path unchanged.
- [x] 4.2 Tests in `apps/chat/src/hooks/toolsets/tests/useToolsetEditorOAuthLogin.spec.ts`: blank
      field → popup opened before save, settings read, authorize URL carries the stored `resource`,
      outcome reports the fetched auth; filled field → no read; read failure → popup closed, `Failed`
      with trace id.
      Verification: `npm run test:file -- apps/chat/src/hooks/toolsets/tests/useToolsetEditorOAuthLogin.spec.ts`
- [x] 4.3 Slice check: `npm run verify:changed`.

## 5. Docs and specs

- [x] 5.1 `libs/chat-hooks/README.md` (OAuth Popup Flow section): document `ToolsetOAuthSettings.resource`,
      the `resource` authorize parameter, `ToolsetOAuthSettingsSource` and `toToolsetOAuthSettings`
      with a compiling example; `ExternalServiceOAuthSettings.resource` in the external-services section.
- [x] 5.2 `libs/toolset-editor/README.md`: the new `AuthSectionLabels` / `ToolsetEditorValidationLabels`
      fields and their defaults, `ToolsetAuthFormData.resource`, and that the field shows only for static
      OAuth registration.
- [x] 5.3 Check `docs/` for toolset/external-service OAuth descriptions (use the `dial-docs` skill)
      and update any that list the authorize parameters or auth-settings fields; no
      `docs/architecture.md` change is expected (no new lib, route, context or endpoint).
      Result: no change needed — the only `docs/` hits are the BFF OIDC login and offline-credentials
      diagrams, which do not cover toolset or external-service OAuth.
- [x] 5.4 Run `npm run validate:docs`, `npm run validate:specs` and `npm run spec:impact`.

## 6. Close-out

- [x] 6.1 `npm run build:quiet` (lib entry points and the generated client changed).
- [x] 6.2 `npm run verify:full`.
      Result: `typecheck:full` passes; `test:full` and `lint:check` fail only on the pre-existing
      issues recorded under 1.7 (`files.controller.spec.ts` "maps a DIAL Core 401 to 401" and the
      prettier errors in `scheduled-task-grouping.spec.ts`), so `verify:full` cannot go green on this
      branch until those are fixed separately.

## 7. Follow-ups (out of scope, record only)

- [ ] 7.1 Confirm with the Core PR author whether `resource: ""` on create still triggers the
      Protected Resource Metadata lookup; if so, simplify `formToToolsetBody` to always send `''` (design D4).
