## ADDED Requirements

### Requirement: Remote theme origins are configured by the operator

`apps/chat-api/src/config/environment.config.ts` (`EnvironmentVariables`) SHALL declare:

| Variable | Type | Default | Meaning |
| --- | --- | --- | --- |
| `THEMES_ALLOWED_ORIGINS` | optional string | unset | Comma-separated list of exact `https://host[:port]` origins that may be fetched as remote themes. |
| `APP_THEMES_ENABLED` | optional boolean | `false` | Whether the per-application theme feature is offered to clients. |

`THEMES_SERVICE_TIMEOUT_MS` (existing, default `5000`) SHALL also bound remote theme requests.

`THEMES_ALLOWED_ORIGINS` SHALL be parsed once at construction into a `Set<string>` of origins, each
validated with `new URL()` and required to have protocol `https:`. An entry that does not parse, or
whose protocol is not `https:`, SHALL be dropped and logged at `warn` level on startup; it SHALL NOT
prevent boot.

When `APP_THEMES_ENABLED` is `true` and the parsed origin set is empty, the service SHALL log a
`warn` on startup stating that remote themes are enabled but no origin is allow-listed.

`features.appThemesEnabled` SHALL be registered in
`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts` as
`{ type: 'feature', valueType: 'boolean', visibility: 'client', defaultValue: false, envVar: 'APP_THEMES_ENABLED' }`
with a matching `FeatureKey.AppThemesEnabled = 'features.appThemesEnabled'` member in
`apps/chat-api/src/app-config/feature-flags/feature-key.enum.ts`. No `allowedRolesEnvVar` is
declared — the flag is deployment-wide.

#### Scenario: Origins are parsed into a set

- **WHEN** `THEMES_ALLOWED_ORIGINS` is `https://a.example.com, https://b.example.com:8443`
- **THEN** both origins are admitted and no warning is logged

#### Scenario: A non-https entry is dropped

- **WHEN** `THEMES_ALLOWED_ORIGINS` contains `http://a.example.com`
- **THEN** that entry is dropped, a `warn` is logged naming it, the application boots, and requests
  for that origin are rejected

#### Scenario: The feature is on with no allowlist

- **WHEN** `APP_THEMES_ENABLED=true` and `THEMES_ALLOWED_ORIGINS` is unset
- **THEN** a `warn` is logged at startup, `features.appThemesEnabled` is still reported `true` to
  clients, and every remote theme request is rejected with 400

---

### Requirement: Remote theme configuration endpoint

`apps/chat-api/src/themes/` SHALL expose a versioned controller
`@Controller({ path: 'themes', version: '1' })` — separate from the existing unversioned
`@Public()` `ThemeController`, which is unchanged — registered by `ThemesModule`.

`GET /api/v1/themes/remote` SHALL:

- require an authenticated session (it is NOT `@Public()`);
- accept a single query parameter `themeUrl`, validated by a `GetRemoteThemeDto` with
  `@IsString() @IsNotEmpty() @IsUrl({ protocols: ['https'], require_protocol: true })` and an
  `@ApiProperty` describing it;
- respond `200` with `ThemeConfigResponseDto`;
- carry `@Header('Cache-Control', 'public, max-age=300')`;
- use the handler name `getRemoteTheme`, which `operationIdFactory` turns into the generated SDK
  method `getRemoteTheme`.

The service SHALL resolve the upstream request as follows, **before opening any socket**:

1. parse `themeUrl` with `new URL()`; a parse failure is a `BadRequestException`;
2. reject a protocol other than `https:` with a `BadRequestException`;
3. reject an origin not present in the allow-listed origin set with a `BadRequestException` whose
   message names neither the resolved address nor any upstream detail;
4. request `<origin><pathname>/config.json` with the supplied URL's query and fragment discarded.

The fetch SHALL use `redirect: 'manual'`; a 3xx response SHALL be mapped to `BadGatewayException`.
A response body larger than 256 KB SHALL be rejected with `BadGatewayException` without being
parsed.

The parsed configuration SHALL be validated before it is returned: `themes` must be a non-empty
array, every entry must have a non-empty string `id`, and every `colors` value must be a string
whose key matches `^[a-zA-Z0-9-]+$`. Entries with a non-conforming colour key SHALL have that key
dropped; a configuration failing the `themes` check SHALL be a `BadGatewayException`.

Error mapping SHALL otherwise match `ThemeService.getThemes`: upstream `404` →
`NotFoundException`, other non-`ok` → `BadGatewayException`, `AbortError` →
`ServiceUnavailableException`, anything else → `ServiceUnavailableException`.

**Authorization**: any authenticated user. No role restriction — the allowlist, not the caller's
role, is what bounds the outbound request.

**Cache**: key `themes:remote:<sha256(origin + pathname)>`, TTL 300 000 ms, matching the existing
`themes:config` entry. Invalidation is TTL-only.

**Generated-client impact**: new operation `getRemoteTheme`; request has no body; response DTO is
the existing `ThemeConfigResponseDto`. Frontend callers use the normal (non-`Raw`) generated method.

Example request:

```http
GET /api/v1/themes/remote?themeUrl=https%3A%2F%2Fthemes.contoso.example.com HTTP/1.1
```

Example `200` response:

```json
{
  "themes": [
    {
      "id": "light",
      "displayName": "Contoso Light",
      "colors": { "bg-layer-base": "#FFFFFF", "text-primary": "#101418" },
      "app-logo": "contoso-light.svg"
    },
    {
      "id": "dark",
      "displayName": "Contoso Dark",
      "colors": { "bg-layer-base": "#0B0D10", "text-primary": "#F2F4F7" },
      "app-logo": "contoso-dark.svg"
    }
  ],
  "images": {
    "chat-logo-light": "contoso-light.svg",
    "chat-logo-dark": "contoso-dark.svg"
  }
}
```

Example `400` response:

```json
{
  "statusCode": 400,
  "message": "themeUrl origin is not allowed",
  "error": "Bad Request"
}
```

#### Scenario: An allow-listed origin is fetched

- **WHEN** an authenticated user requests
  `/api/v1/themes/remote?themeUrl=https://themes.contoso.example.com` and that origin is
  allow-listed
- **THEN** the service fetches `https://themes.contoso.example.com/config.json` and responds `200`
  with the configuration

#### Scenario: A non-allow-listed origin is rejected before any request

- **WHEN** the requested origin is not in `THEMES_ALLOWED_ORIGINS`
- **THEN** the endpoint responds `400`, and no outbound HTTP request is made

#### Scenario: An internal address is rejected

- **WHEN** `themeUrl` is `https://169.254.169.254/latest/meta-data` and that origin is not
  allow-listed
- **THEN** the endpoint responds `400` with a message that does not disclose whether the address is
  reachable, and no outbound request is made

#### Scenario: A plain-http URL is rejected by DTO validation

- **WHEN** `themeUrl` is `http://themes.contoso.example.com`
- **THEN** the endpoint responds `400` from `ValidationPipe` and the service is never invoked

#### Scenario: Path and query on the supplied URL are handled deterministically

- **WHEN** `themeUrl` is `https://themes.contoso.example.com/brand?x=1#y`
- **THEN** the service requests `https://themes.contoso.example.com/brand/config.json`, discarding
  `?x=1` and `#y`

#### Scenario: A redirect is not followed

- **WHEN** the allow-listed origin responds `302` to `http://10.0.0.1/`
- **THEN** the endpoint responds `502` and the redirect target is not requested

#### Scenario: An oversized body is refused

- **WHEN** the upstream returns a 10 MB `config.json`
- **THEN** the endpoint responds `502` and the body is not parsed into the cache

#### Scenario: A malformed configuration is refused

- **WHEN** the upstream returns `{"themes": []}`
- **THEN** the endpoint responds `502`

#### Scenario: A colour key with unsafe characters is dropped

- **WHEN** a theme declares `{ "bg-layer-base": "#000", "x;}body{display:none": "#fff" }`
- **THEN** the response carries only `bg-layer-base` for that theme

#### Scenario: The upstream times out

- **WHEN** the allow-listed origin does not respond within `THEMES_SERVICE_TIMEOUT_MS`
- **THEN** the endpoint responds `503`

#### Scenario: A repeat request inside the TTL is served from cache

- **WHEN** the same `themeUrl` is requested twice within five minutes
- **THEN** the second request is served from `themes:remote:<hash>` and makes no outbound request

#### Scenario: An unauthenticated caller is refused

- **WHEN** the endpoint is called without a session
- **THEN** it responds `401` and no outbound request is made

---

### Requirement: Remote theme icon endpoint

`GET /api/v1/themes/remote/icon` SHALL proxy a single image from an allow-listed themes host, with
handler name `getRemoteThemeIcon`.

Its `GetRemoteThemeIconDto` SHALL validate `themeUrl` exactly as `GetRemoteThemeDto` does, and
`iconName` with the same allowlist regex the existing `GetThemeIconDto` uses — alphanumerics, dash,
underscore, and dot only — so that path traversal is rejected before any request is made.

Origin resolution, redirect handling, timeout, and error mapping SHALL be identical to
`GET /api/v1/themes/remote`. The response SHALL carry the MIME type derived from `iconName` via
`mime-types`' `lookup`, defaulting to `image/svg+xml; charset=utf-8`, and
`Cache-Control: public, max-age=300`. A response body larger than 2 MB SHALL be rejected with
`BadGatewayException`.

**Cache**: key `themes:remote:icon:<sha256(origin + pathname)>:<iconName>`, TTL 300 000 ms.

**Generated-client impact**: new operation `getRemoteThemeIcon`. Because the response is binary or
raw SVG rather than JSON, frontend callers SHALL construct the URL and use it directly as an
`<img src>`, exactly as `resolveCatalogIconUrl` does for `/api/themes/icon` today; no generated
method is called for it.

Example request:

```http
GET /api/v1/themes/remote/icon?themeUrl=https%3A%2F%2Fthemes.contoso.example.com&iconName=contoso-dark.svg HTTP/1.1
```

#### Scenario: An icon is proxied from an allow-listed origin

- **WHEN** an authenticated user requests `iconName=contoso-dark.svg` against an allow-listed origin
- **THEN** the endpoint responds `200` with `Content-Type: image/svg+xml` and the file's bytes

#### Scenario: Path traversal in the icon name is rejected

- **WHEN** `iconName` is `../../etc/passwd`
- **THEN** the endpoint responds `400` from `ValidationPipe` and no outbound request is made

#### Scenario: A non-allow-listed origin is rejected

- **WHEN** the origin is not allow-listed
- **THEN** the endpoint responds `400` and no outbound request is made

#### Scenario: A missing icon maps to 404

- **WHEN** the allow-listed origin responds `404`
- **THEN** the endpoint responds `404`

---

### Requirement: Remote theme requests are observable

Every rejection and upstream failure SHALL be logged by `ThemeService` with the existing `Logger`
instance, at `warn` for a client-caused rejection (disallowed origin, bad URL) and `error` for an
upstream failure (timeout, 5xx, oversized or malformed body). Log lines SHALL include the requested
origin and, for icons, the icon name. They SHALL NOT include the caller's identity, session, or any
token.

No new metric is introduced; the existing `MetricsInterceptor` covers the new routes as HTTP
endpoints like any other.

#### Scenario: A disallowed origin is logged as a warning

- **WHEN** a request names a non-allow-listed origin
- **THEN** a `warn` naming that origin is logged, and no token or user identifier appears in the line

#### Scenario: An upstream timeout is logged as an error

- **WHEN** the upstream does not answer within the timeout
- **THEN** an `error` naming the origin and the timeout is logged
