## 1. Types, constants, routing (new files + minimal shared edits)

- [x] 1.1 Create `apps/chat/src/types/toolsets.ts` with local string enums (`ToolsetAuthTypes`, `ToolsetTransportType`, `ToolsetCredentialsLevel`, `ToolsetEditorSteps`, `WithLogin`) and ported interfaces (`ToolsetRedirectState`, `ToolsetFormData`). Note: the loaded toolset entity uses the generated client DTO (target convention) instead of a hand-ported camelCase `ToolsetModel`; editor state is modelled as `ToolsetFormData`. The login/logout request bodies are built directly as the generated `ToolsetLoginBodyDto`/`ToolsetLogoutBodyDto` at each call site, so no separate hand-ported auth-payload types were needed.
- [x] 1.2 Create `apps/chat/src/constants/toolsets.ts` with `ToolsetEditorQuery` enum, `AUTH_TYPE_OPTIONS` (icon + i18n labelKey per auth type), and default name/version constants
- [x] 1.3 Add a single `ToolsetEditor = '/toolset-editor'` member (and a `ToolsetEditorCallback` path) to `apps/chat/src/types/routes.ts`
- [x] 1.4 Add a dedicated, contiguous block of toolset-editor translation keys to `apps/chat/src/constants/translation-keys.ts` and matching keys to `apps/chat/src/i18n/locales/en.json`
- [x] 1.5 Register the `/toolset-editor` and callback `<Route>` (lazy-loaded) in `app.tsx` as a single additive insertion; minimal page shells created to keep the build green

## 2. Backend write + auth endpoints (additive in existing toolsets module)

- [x] 2.1 Add request/response DTOs under `apps/chat-api/src/toolsets/dto/` (`toolset-body.dto.ts`: `ToolsetBodyDto`/`ToolsetAuthSettingsBodyDto`/`MutatedToolsetDto`; `toolset-auth.dto.ts`: login/logout/result) with `class-validator` + `@ApiProperty`, allowlist `@Matches` on endpoint/URL strings
- [x] 2.2 Add `createToolset`, `updateToolset`, `deleteToolset`, `loginToolset`, `logoutToolset` to `ToolsetsService`: create resolves bucket + PUTs `/v1/toolsets/{bucket}/{name}__{version}`; update/delete hit the id path; login/logout proxy `/v1/ops/toolset/signin|signout`. snake_case body mapping, cache invalidation, `mapDialHttpStatus`/`handleDialFetchError`. (Bucket fetch kept inside `try` so network errors map correctly, mirroring the existing `applications.service.ts` `createApplication` pattern.)
- [x] 2.3 Add `@Post`/`@Patch`/`@Delete`/`@Post .../login`/`@Post .../logout` handlers to `ToolsetsController` with `@ApiOperation` (operationIds), full `@ApiResponse` coverage, `@Throttle`, `@HttpCode` (204 delete, 200 login/logout)
- [x] 2.4 Credential payloads (apiKey/code) are never logged; `redactToolsetSecrets` is reused on read responses
- [x] 2.5 Added write-operation specs to `toolsets.service.spec.ts` (happy path, snake_case mapping, cache invalidation, each thrown exception, network error) and `toolsets.controller.spec.ts` (201/200/204, validation rejection incl. bad name + extra prop, invalid enum, missing session) — 54 toolset tests pass
- [x] 2.6 Verified: toolset tests pass, `eslint apps/chat-api/src/toolsets` clean, `nx build chat-api` green. (Note: a pre-existing branch failure in `applications.service.spec.ts` network-error test is unrelated — flagged separately.)

## 3. OpenAPI + generated client + server-api adapter

- [x] 3.1 Ran `npm run openapi` (regenerated spec + `ToolsetsApi` with create/update/delete/login/logout + `ToolsetBodyDto`/`MutatedToolsetDto`/`ToolsetLoginBodyDto`/`ToolsetLogoutBodyDto`/`ToolsetAuthResultDto` models); `npm run openapi:check` passes; `nx build chat-api-client` green
- [x] 3.2 Added create/update/delete/login/logout adapter fns to `apps/chat/src/server-api/toolsets.ts`; lint clean, `nx typecheck chat` green

## 4. Editor page shell, header, view, preview

- [x] 4.1 Create `apps/chat/src/pages/ToolsetEditor/ToolsetEditor.tsx`: load/create-mode detection from `id`, `useSearchParams` step routing, `useState` for `toolset`/`isLoading`/`isSaving`/`step`, `async` load and save functions with `try`/`catch`/`finally`
- [x] 4.2 Implement the route guard: redirect out of the editor when `id` is present but the toolset is not found
- [x] 4.3 Create the editor header with `DialSteps` (General / Settings) + Save & Exit
- [x] 4.4 Create the view splitter (form left / preview right) and the read-only `ToolsetPreview`

## 5. General step

- [x] 5.1 Create `GeneralForm` with `useState` per field: name, version, icon URL (plain `DialInput`), description (`DialTextarea`), topics (`DialTagInput`, sourced from `AppConfigContext`)
- [x] 5.2 Add manual `if`-guard validation (name required) with per-field error state + i18n keys
- [x] 5.3 Add `getStorageSafeUniqueToolsetName` to a domain util (e.g. `apps/chat/src/utils/toolsets.ts`) and use it for the default create-mode name
- [x] 5.4 Add unit tests for `GeneralForm` validation and unique-name generation

## 6. Settings step (connection fields)

- [x] 6.1 Create `SettingsForm` with endpoint (`DialInput`), protocol (`DialSelect` HTTP/SSE), allowed tools (`DialTagInput`)
- [x] 6.2 Add an endpoint-URL validator util (protocol regex, trailing `.`//` guard, `new URL()` parse) with per-field error
- [x] 6.3 Add a copy-endpoint-URL control (`DialIconButton` + clipboard API)
- [x] 6.4 Add unit tests for endpoint validation and copy behavior

## 7. Authentication section

- [x] 7.1 Build the auth type single-select as a plain button list, driven by a single `authenticationType` state (only one option expanded at a time; no ui-kit `DialAccordion` component fit the single-external-state-driven-selection shape, so it is hand-rolled)
- [x] 7.2 Build the login form with conditional fields by `authenticationType` + `WithLogin` (API Key: key header + key; OAuth: client id/secret, endpoints, scopes) and manual validation
- [x] 7.3 Wire logout via `DialConfirmationPopup` and an `onLogout` callback prop; disable selector + fields when logged in or while saving
- [x] 7.4 Implement the OAuth initiate flow: save config, persist `ToolsetRedirectState` to `sessionStorage`, redirect to the provider auth URL
- [x] 7.5 Create the OAuth callback route component: read stored state, call login with `code` + `redirectUri`, return to editor; handle missing-state safely
- [x] 7.6 Add unit tests for the auth type list single-select, conditional validation, and the `sessionStorage` redirect round-trip

## 8. Final verification

- [x] 8.1 `npm exec nx test chat` and `npm exec nx lint chat` pass for the new frontend code
- [x] 8.2 RTL/i18n check: logical Tailwind utilities, no hardcoded `aria-label`, all keys via enums
- [x] 8.3 Confirm zero new entries in `package.json`
- [x] 8.4 Confirm shared-file edits remain minimal/append-only (routes, translation keys, router, controller/module) to limit merge conflicts
- [x] 8.5 Manual smoke test against a real DIAL Core: create, edit, API-key login, OAuth login round-trip, logout
