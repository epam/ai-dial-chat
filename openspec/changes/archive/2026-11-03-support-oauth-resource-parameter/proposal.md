## Why

DIAL Core ([epam/ai-dial-core#2218](https://redirect.github.com/epam/ai-dial-core/pull/2218)) adds an optional RFC 8707 `resource` to a toolset's or external service's `auth_settings` and sends it on the token exchange and refresh. Core never builds the authorization URL — Chat does — so authorization servers that check `resource` on both legs (the MCP authorization spec requires it; Notion MCP enforces it) reject the exchange with `invalid_target`, and users cannot sign in to those toolsets from Chat (issue #9682). This change must ship together with the Core PR.

## What Changes

- **Authorize URL.** `buildToolsetAuthorizeUrl` (`libs/chat-hooks/src/oauth/authorize-url.ts:26`) adds `resource=<value>` when the settings carry a non-blank `resource`. `ToolsetOAuthSettings` and `ExternalServiceOAuthSettings` gain `resource?: string`.
- **One mapper instead of six.** Six call sites copy `clientId`/`authorizationEndpoint`/`scopesSupported`/`codeChallenge`/`codeChallengeMethod` field by field into `oauthSettings` (`apps/chat/src/utils/signin-interrupt.ts:28` and `:56`, `apps/chat/src/pages/ApplicationEditor/setup/AppEditorIframe.tsx:569`, `libs/chat-hooks/src/catalog/application-credentials.ts:70`, `libs/chat-hooks/src/catalog/useCatalogToolsetCredentials/useCatalogToolsetCredentials.ts:245`, and the fresh-fetch branch of `useToolsetLogin.ts:191`). A new pure `toToolsetOAuthSettings` in `@epam/ai-dial-chat-hooks` replaces all of them, so `resource` (and the next field) cannot be missed at one of them.
- **Toolset editor.** A "Resource" input in `AuthSection` (`libs/toolset-editor`), shown only for OAuth with static registration (`WithLogin.WithConfig`), optional, validated as an absolute URI without a fragment. Labels come through `AuthSectionLabels` / `ToolsetEditorValidationLabels` with English defaults; `apps/chat` fills them with `t()`.
- **Editor login uses the stored value.** When the Resource field is left blank, Core may resolve it from the server's Protected Resource Metadata at save. The editor's post-save OAuth login (`apps/chat/src/hooks/toolsets/useToolsetEditorOAuthLogin.ts`) reads the stored auth settings in that case, so the authorize URL carries the same `resource` Core sends on the exchange.
- **App mapping.** `authSettingsDtoToForm` / `formToToolsetBody` (`apps/chat/src/utils/toolsets.ts:37`, `:121`) map `resource` both ways. On update a blank field is sent as `''` (Core clears it); an omitted field would keep the stored value, so a cleared field is never dropped. On create a blank field is omitted so Core can discover it.
- **chat-api toolsets** (missing from the issue's scope). `ToolsetAuthSettingsBodyDto` rejects unknown fields (`forbidNonWhitelisted`), so without a `resource` field every save from the new editor would answer `400`. Add `resource` to that DTO, forward it in `toDialAuthSettings` (`apps/chat-api/src/toolsets/utils/toolset-mapper.util.ts:138`), and return it from `mapAuthSettings` (`:362`) / `DialToolsetAuthSettingsDto`. It is deliberately **not** added to `OAUTH_MERGEABLE_KEYS` (`:111`): Core keeps an omitted value itself, and re-sending a stored value would make Core reject a dynamically registered toolset.
- **chat-api external services.** `GetExternalServiceResponseDto` (and `ApplicationExternalServiceDto`, which extends it) returns `resource`; `ExternalServiceAuthSettingsBodyDto` accepts it and `toDialExternalServiceDefinition` forwards it. A PUT replaces the whole object in Core, so a PUT without `resource` erases a stored value; the DTO documents this.
- **Core types.** Bump `@epam/ai-dial-typescript-sdk` in `apps/chat-api/package.json` from `0.2.0-dev.15` to `0.2.0-dev.23`, the first version whose `ResourceAuthSettings` / `ResourceAuthSettingsData` declare `resource?: string` (external services use the same `ResourceAuthSettings`). The rest of the type diff is additive (org-unit operations, `ORG_UNITS` in `ResourceTypes`); chat-api has no exhaustive match over `ResourceTypes`.
- Regenerate the OpenAPI spec and `libs/chat-api-client`; update READMEs (`chat-hooks`, `toolset-editor`) and specs.

Not breaking: every new field is optional, and a toolset or service without `resource` produces the same authorize URL and Core body as today.

## Non-goals

- Dynamic client registration UI. Core resolves `resource` from Protected Resource Metadata there and rejects a supplied value; the field is not shown for `WithLogin.WithLogin`.
- `resource` for NONE / API_KEY / DIAL_NATIVE auth types (Core rejects it).
- Scheduled Tasks offline-credentials consent (`useOfflineCredentialsLogin`) — its `connect` settings come from a different Core endpoint that has no `resource`.
- Showing `resource` in catalog details (`deployments/utils/deployment-mapper.util.ts` `ToolsetAuthSettingsDto`) — no login path reads it.
- The Admin UI counterpart (separate repository).

## Alternatives considered

1. **Add `resource` at each of the six call sites (issue's literal scope).** Smallest diff, but repeats the pattern that makes a missed field silent: one forgotten site means that entry point alone fails with `invalid_target`. Rejected for the single mapper.
2. **Have the BFF build the authorize URL.** Would centralise it, but the popup flow and PKCE state live in the browser by design (`chat-hooks-oauth-popup-flow` spec). Out of proportion for one query parameter.
3. **Always re-fetch stored auth before any editor OAuth login.** Correct but adds a round trip and a popup-ordering change to the path that works today when the field is filled. Chosen narrower: re-fetch only when the form's `resource` is blank.

## Acceptance criteria

- With a stored `resource`, every Chat login entry point (toolset editor, catalog credentials, sign-in interrupt for toolsets and external services, application credentials, QuickApps toolset and external-service relays) opens an authorize URL carrying `resource=<value>`; without it the URL is unchanged.
- The toolset editor shows Resource only for OAuth with static registration, blocks save on a non-absolute URI or one with a `#fragment`, round-trips the stored value, and clearing it removes the value in Core.
- A static toolset saved with a blank Resource whose server publishes metadata signs in to Notion MCP from the editor without `invalid_target`.
- chat-api accepts, forwards and returns `resource` for toolsets and external services; an invalid value is a `400` before reaching Core; the regenerated client exposes it.
- `npm run validate:docs`, `npm run validate:specs`, `npm run openapi:check` and the affected projects' lint/test/build pass.

## Rollback

Revert the commit. Stored `resource` values stay in Core and keep being sent on the token leg, so servers enforcing both legs fail again exactly as before this change; nothing else depends on it.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `chat-hooks-oauth-popup-flow`: the authorize URL carries `resource`; a shared `toToolsetOAuthSettings` mapper feeds every login entry point.
- `toolset-authentication`: the OAuth-with-config form gains an optional, validated Resource field; editor login uses the stored `resource` when the field is blank.
- `toolset-write-api`: toolset create/update accept and forward `resource`, and toolset reads return it.
- `external-service-authentication`: external-service metadata returns `resource`; the declare (`PUT`) body accepts and forwards it.

## Impact

- **Libs:** `libs/chat-hooks` (`oauth/`, `external-services/`, `catalog/`) and `libs/toolset-editor` (`AuthSection`, form model, validation, labels). Both stay host-agnostic: `resource` arrives as data in props (`ToolsetAuthFormData`) or in the already-fetched DTOs the host passes in; neither lib learns a route or calls Core on its own.
- **App:** `apps/chat/src/utils/toolsets.ts`, `utils/signin-interrupt.ts`, `hooks/toolsets/useToolsetEditorOAuthLogin.ts`, `pages/ApplicationEditor/setup/AppEditorIframe.tsx`, `pages/ApplicationEditor/toolset/ToolsetApplicationEditor.tsx`, `constants/translation-keys.ts`, `i18n/locales/en.json`.
- **chat-api:** `apps/chat-api/package.json` + root `package-lock.json` (SDK `0.2.0-dev.23`), `toolsets/dto/toolset-body.dto.ts`, `toolsets/utils/toolset-mapper.util.ts`, `openapi/openapi-response.dto.ts`, `external-services/dto/*.dto.ts`, `external-services/external-services.mapper.ts`, a new `common/validators/oauth-resource.pattern.ts`.
- **API contract:** additive optional `resource` on toolset and external-service request/response DTOs; OpenAPI spec and `libs/chat-api-client` regenerated.
- **i18n:** three new user-visible strings (Resource label, placeholder, invalid-value message) under `toolsetEditor.auth.*` / `toolsetEditor.validation.*`; no RTL impact beyond the existing form layout.
- **Release coupling:** must be merged together with epam/ai-dial-core#2218. Against an older Core, chat-api still accepts `resource` but Core ignores or rejects the unknown field — do not release ahead of Core.
