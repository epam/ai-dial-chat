## MODIFIED Requirements

### Requirement: Authorize-URL construction

`buildToolsetAuthorizeUrl(auth, redirectUri, state)` SHALL return an authorization-code URL carrying
`response_type=code`, `client_id`, `redirect_uri`, `state`, and — when present on the supplied auth
settings — `code_challenge`, `code_challenge_method`, a space-joined `scope`, and the RFC 8707
`resource` indicator. It SHALL return
`null` rather than throw for a configuration that cannot produce a valid URL. The `state` value SHALL
be generated per flow by the caller-facing entry points and SHALL double as the flow id.

The authorization endpoint SHALL use the `http:` or `https:` scheme; any other scheme (such as
`javascript:` or `data:`) SHALL yield `null` so it never reaches the popup. Plain `http:` SHALL be
accepted for any host, matching the endpoints DIAL Core stores (issue #9311).

`resource` comes from `ToolsetOAuthSettings.resource` (and the structurally identical
`ExternalServiceOAuthSettings.resource`), which carries DIAL Core's stored `auth_settings.resource`.
The builder SHALL add it trimmed, as one `resource` query parameter, when it is non-blank, and SHALL
omit the parameter otherwise. It SHALL NOT validate or rewrite the value — DIAL Core validated it on
save and sends the same value on the token exchange, and the two legs must match. A server that
enforces RFC 8707 on both legs rejects the exchange with `invalid_target` when the authorize leg
lacks it (issue #9682, epam/ai-dial-core#2218).

#### Scenario: Complete configuration

- **WHEN** the auth settings carry a `clientId` and an `https:` `authorizationEndpoint`
- **THEN** the returned URL carries `response_type=code`, that client id, the redirect URI, and the
  generated state

#### Scenario: Unusable configuration returns null

- **WHEN** `clientId` or `authorizationEndpoint` is absent, blank, unparseable, or uses a protocol
  other than `http:`/`https:`
- **THEN** the builder returns `null` and no exception escapes

#### Scenario: Plain-HTTP authorization endpoint is accepted

- **WHEN** the authorization endpoint uses `http:`, on any host
- **THEN** the builder returns a URL, so the OAuth flow starts as it does for `https:`

#### Scenario: PKCE and scopes forwarded when present

- **WHEN** the auth settings carry `codeChallenge`, `codeChallengeMethod`, and a non-empty scope list
- **THEN** the URL carries `code_challenge`, `code_challenge_method`, and one space-joined `scope`
  parameter; each is omitted when its source value is absent or empty

#### Scenario: Resource forwarded when present

- **WHEN** the auth settings carry `resource: "https://mcp.notion.com/mcp"`
- **THEN** the URL carries exactly one `resource` parameter whose decoded value is
  `https://mcp.notion.com/mcp`

#### Scenario: Blank resource omitted

- **WHEN** `resource` is absent, `''`, or whitespace only
- **THEN** the URL has no `resource` parameter and is otherwise identical to the URL built without it

## ADDED Requirements

### Requirement: Shared OAuth-settings mapper

`@epam/ai-dial-chat-hooks` SHALL export `toToolsetOAuthSettings(source)` from its root and its
`./oauth` entry point (declared in `libs/chat-hooks/src/oauth/authorize-url.ts`). It maps the public
OAuth client fields of a DIAL Core auth-settings DTO — `clientId`, `authorizationEndpoint`,
`scopesSupported`, `codeChallenge`, `codeChallengeMethod`, `resource` — onto a `ToolsetOAuthSettings`
(`scopesSupported` becomes `scopes`). Its parameter is the structural interface
`ToolsetOAuthSettingsSource` (in `libs/chat-hooks/src/oauth/models.ts`), which both the toolset
`DialToolsetAuthSettingsDto` and the external-service `GetExternalServiceResponseDto` /
`ApplicationExternalServiceDto` satisfy, so the lib does not import either DTO for it. An `undefined`
source SHALL yield an object whose fields are all `undefined`, so callers can pass
`toolset?.authSettings` directly. It is pure and non-rendering.

Every login entry point that builds `oauthSettings` from a fetched DTO SHALL use it instead of
copying fields one by one:

- `libs/chat-hooks/src/oauth/useToolsetLogin/useToolsetLogin.ts` (the settings re-read through
  `getToolset`),
- `libs/chat-hooks/src/catalog/useCatalogToolsetCredentials/useCatalogToolsetCredentials.ts`,
- `libs/chat-hooks/src/catalog/application-credentials.ts` (`buildApplicationCredentialLoginParams`),
- `apps/chat/src/utils/signin-interrupt.ts` (both the toolset and the external-service resolvers),
- `apps/chat/src/pages/ApplicationEditor/setup/AppEditorIframe.tsx` (the QuickApps
  external-service relay).

`useToolsetLogin` and `useExternalServiceLogin` SHALL pass `oauthSettings.resource` through
unchanged when they copy the caller's settings into the settings they hand the popup.
The QuickApps toolset relay and the toolset editor already pass the editor form's auth state, which
carries `resource` once `ToolsetAuthFormData` has it.

#### Scenario: Toolset DTO maps every public field

- **WHEN** `toToolsetOAuthSettings` receives `{ clientId: 'c', authorizationEndpoint: 'https://idp/authorize', scopesSupported: ['a', 'b'], codeChallenge: 'x', codeChallengeMethod: 'S256', resource: 'https://mcp.example.com/mcp' }`
- **THEN** it returns `{ clientId: 'c', authorizationEndpoint: 'https://idp/authorize', scopes: ['a', 'b'], codeChallenge: 'x', codeChallengeMethod: 'S256', resource: 'https://mcp.example.com/mcp' }`

#### Scenario: Missing source

- **WHEN** it receives `undefined`
- **THEN** it returns settings with every field `undefined`, and `buildToolsetAuthorizeUrl` on them
  returns `null`

#### Scenario: Every entry point carries a stored resource

- **WHEN** a toolset or external service whose stored auth settings include `resource` is signed in
  to from the catalog credentials, the sign-in interrupt dialog, application credentials, or a
  QuickApps relay
- **THEN** the popup is navigated to an authorize URL carrying that `resource`
