# mcp-app-proxy-api Specification

## Purpose

Defines the `apps/chat-api` endpoints that fetch a toolset's MCP App UI resource and forward app-initiated `tools/call` requests to the owning MCP session, plus the environment variables that expose the sandbox proxy to the client.

## Requirements

### Requirement: `GET /api/v1/toolsets/{toolsetName}/mcp-app-resource` mirrors DIAL Core's resource endpoint as a raw passthrough

`McpAppController` (`apps/chat-api/src/toolsets/mcp-app.controller.ts`, `@Controller({ path: 'toolsets', version: '1' })`) SHALL expose:

```
GET /api/v1/toolsets/{toolsetName}/mcp-app-resource?resourceUri={uri}
```

This mirrors DIAL Core's own `GET /v1/deployments/{deployment_name}/mcp/resources?uri={uri}` (`McpResourceController`, `epam/ai-dial-core` PR #1745) — `toolsetName` maps onto Core's `deployment_name` path segment.

- `toolsetName` (path, string) — the toolset ID, validated by `GetToolsetDto` (`@IsSafeToolsetName`; slash-separated names are percent-encoded as `%2F`).
- `resourceUri` (query, string) — the `ui://` URI, as discovered per-tool from Core's `tools/list` `_meta.ui.resourceUri` (see the `mcp-app-trigger` capability's tool-discovery requirement; `Stage` carries no such field) and passed through by the caller; validated with `@Matches` against a `ui://` scheme allowlist regex before the call to Core is made (same check Core itself does).
- Auth: the caller SHALL already have access to the toolset in the current conversation, reusing the same session check as the existing toolset invocation path (`toolset-authentication` capability) — no new grant is introduced.
- **Response is a raw passthrough of Core's response — NOT a JSON DTO.** `chat-api` streams Core's response body unchanged and forwards its `Content-Type` (one of Core's allowed MIME types: `text/html`, `text/plain`, `text/css`, `application/json`, `image/svg+xml`, `image/png`, `image/jpeg`, `image/gif`, `image/webp`), `Content-Security-Policy`, and `X-Content-Type-Options` headers verbatim. There is no `html`/`allowedOrigins`/`permissions` field to synthesize — Core's endpoint doesn't return one.
- `400 BadRequestException` — `resourceUri` fails validation, or Core rejects it as not `ui://`-scheme.
- `403 ForbiddenException` — caller lacks access to the toolset, or Core's consent check denies it.
- `404 NotFoundException` — `toolsetName` does not exist, or Core reports the deployment has no MCP config / no such resource.
- `502 BadGatewayException` — Core reports an upstream MCP fetch/mimetype/empty-body failure, or Core itself is unreachable.
- `429` — Core's own rate limiter tripped; `chat-api` forwards the `Retry-After` header if present.

**OpenAPI / generated client:** `operationIdFactory` → `getToolsetMcpAppResource`. Because the response has a variable `Content-Type` rather than a fixed JSON schema, the `200` response is documented only as `description: 'HTML widget content'` with no content schema (mirroring how Core's own `docs/open_api_core.yaml` documents this route). The frontend reads it through the generated client's `getToolsetMcpAppResourceRaw` method. `apps/chat/src/server-api/mcp-apps.ts` only builds `mcpAppsApiClient = createMcpAppsApiClient(toolsetsApi)`; the call itself lives in `libs/chat-hooks/src/mcp-apps/mcp-apps-api-client.ts` as `fetchResourceHtml(toolsetId, resourceUri)`, which calls `getToolsetMcpAppResourceRaw({ toolsetName, resourceUri })`, resolves to `raw.text()`, and throws `McpAppResourceFetchError` (carrying the HTTP status) on a non-OK response. It is consumed by `useOpenMcpAppCanvas` (`mcp-app-trigger`) to build `McpAppCanvasContent.html` for `@mcp-ui/client`'s `AppRenderer` (see `design.md` D3; the resource is fetched via JS, never loaded as an iframe `src`).

**Caching:** cache key `mcp-apps:resource:${toolsetId}:${resourceUri}`, TTL `30000ms` (matching the `cached-dial-list-request` default), invalidated only by TTL expiry — a `ui://` resource for a given toolset+URI is treated as effectively static content, mirroring how visualizer URLs are operator-static. Uses `withCachedDialRequest`, caching the raw body + `Content-Type` pair, so a repeated `fetchResourceHtml` for the same toolset and URI within the TTL is served without a call to Core.

#### Scenario: Successful resource fetch

- **WHEN** a caller with toolset access requests `GET /api/v1/toolsets/ts-1/mcp-app-resource?resourceUri=ui%3A%2F%2Fwidget%2F1`
- **THEN** the response is `200` with `Content-Type: text/html` and the widget's HTML body, headers forwarded from Core unchanged

#### Scenario: Cache hit skips the upstream call

- **WHEN** the same `toolsetId`/`resourceUri` pair is requested again within `30000ms`
- **THEN** the cached body/`Content-Type` pair is returned without a new call to Core

#### Scenario: Unknown toolset returns 404

- **WHEN** `toolsetName` does not correspond to any toolset the caller can see
- **THEN** the response is `404`

#### Scenario: Invalid resourceUri returns 400

- **WHEN** `resourceUri` does not match the `ui://` scheme allowlist regex
- **THEN** the response is `400` and no call to Core is made

---

### Requirement: `POST /api/v1/toolsets/{toolsetName}/mcp-app-tool-call` forwards an app-initiated tool call

`chat-api` SHALL expose `POST /api/v1/toolsets/{toolsetName}/mcp-app-tool-call`, which forwards an app-initiated tool call as a `tools/call` JSON-RPC request through DIAL Core's existing generic MCP proxy.

```
POST /api/v1/toolsets/{toolsetName}/mcp-app-tool-call
```

Request body `McpAppToolCallRequestDto`:

```json
{ "toolName": "refresh_data", "arguments": { "range": "7d" }, "kind": "toolset" }
```

- `toolName: string` — `@IsNotEmpty()`, `@Matches` against an identifier-safe allowlist regex.
- `arguments: unknown` — forwarded verbatim to the MCP session; not deep-validated (opaque tool-defined shape), but the DTO SHALL reject non-JSON-serializable payloads (`@IsObject()` or equivalent) before forwarding.
- `kind: McpDeploymentKindDto` (`'toolset'` | `'application'`) — determines which of Core's two prefix-specific generic MCP proxy routes to target (`/v1/toolset/{id}/mcp` vs `/v1/deployments/{id}/mcp`). Required because a deployment id against the wrong prefix returns `404` from Core. The frontend derives this from `McpAppToolRef.kind`, which mirrors `DeploymentItemDto.type` at discovery time.

`chat-api` forwards this as a `tools/call` JSON-RPC request through DIAL Core's **existing** generic MCP proxy (already used for LLM-driven tool invocation — `ApplicationMcpProxyController`/`ToolSetMcpProxyController`, `epam/ai-dial-core` PR #1745 only consolidated their auth injection), selecting the correct proxy URL via `kind`. This is not a new DIAL Core endpoint or capability — an MCP App's self-initiated tool call is, from Core's perspective, indistinguishable from any other `tools/call` on that deployment's session.

Response (`200`) `McpAppToolCallResponseDto { result: unknown }` — unwrapped from the JSON-RPC response's `result` field.

- `400 BadRequestException` — malformed body.
- `403 ForbiddenException` — caller lacks access to the toolset, or `toolName` is not among the tools the owning MCP session actually exposes (checked server-side against a `tools/list` call, not trusted from the request).
- `404 NotFoundException` — unknown `toolsetName`.
- `429` — DIAL Core rate-limits the request; the BFF forwards the status and `Retry-After` header when present.
- `502 BadGatewayException` — Core's proxied `tools/call` returns a JSON-RPC `error`, fails, or times out.

**OpenAPI / generated client:** `operationIdFactory` → `callToolsetMcpAppTool`. Frontend caller: `callTool(toolsetId, toolName, args, kind)` in `libs/chat-hooks/src/mcp-apps/mcp-apps-api-client.ts`, which calls the normal generated `callToolsetMcpAppTool` method and returns its `result`; `useOpenMcpAppCanvas` awaits it from `McpAppCanvasContent.onToolCall`. The app supplies the configured client through `apps/chat/src/server-api/mcp-apps.ts` (`createMcpAppsApiClient(toolsetsApi)`).

**No caching** — every call is a live, potentially side-effecting tool invocation.

**Observability:** emit a metric (via the existing `MetricsInterceptor` pattern) tagged by `toolsetId` and `toolName` for call count and latency, and a `Logger` warning on every `403`/`502` outcome (never logging `arguments` contents, which may carry user data).

#### Scenario: Successful tool-call forwarding

- **WHEN** a caller with toolset access POSTs a valid `toolName`/`arguments` body
- **THEN** the response is `200` with the tool's result under `result`

#### Scenario: Tool not exposed by the session is rejected

- **WHEN** `toolName` does not match any tool the toolset's MCP session currently exposes
- **THEN** the response is `403`, even if the caller has general toolset access

#### Scenario: DIAL Core rate limit is forwarded

- **WHEN** DIAL Core responds to the tool-call request with HTTP `429`
- **THEN** the BFF returns `429` and forwards `Retry-After` when present

#### Scenario: Upstream failure surfaces as 502

- **WHEN** the upstream MCP session's `tools/call` errors or times out
- **THEN** the response is `502` and no partial `result` is returned

---

### Requirement: `McpAppController` lists a deployment's MCP tools

`McpAppController` SHALL also expose two `tools/list` routes, both taking `ListMcpAppToolsQueryDto` query params — `deploymentId` (`@IsString`, `@MaxLength(2048)`, `@IsSafeDeploymentId`) and `kind` (`McpDeploymentKindDto`) — as query params rather than a path segment, so an application id is not split by Express and does not collide with `ToolsetsController`'s `:toolsetName` route:

- `GET /api/v1/toolsets/mcp-apps/tools` (operationId `listMcpAppTools`) — returns `ListMcpAppToolsResponseDto { tools }`, only the tools that declare `_meta.ui.resourceUri`.
- `GET /api/v1/toolsets/mcp-apps/tool-names` (operationId `listMcpToolNames`) — returns `ListMcpToolNamesResponseDto { toolNames }`, every tool name unfiltered (used by the toolset editor's "Allowed tools" picker).

Both document `400` (invalid `deploymentId` or `kind`), `401`, `404` (deployment not found), and `502` (proxied `tools/list` failed). The frontend calls them through `listAppTools` and `listToolNames` in `libs/chat-hooks/src/mcp-apps/mcp-apps-api-client.ts`.

#### Scenario: Only MCP Apps-capable tools are listed

- **WHEN** a deployment's `tools/list` returns one tool with `_meta.ui.resourceUri` and one without
- **THEN** `GET /api/v1/toolsets/mcp-apps/tools` returns only the first tool
- **AND** `GET /api/v1/toolsets/mcp-apps/tool-names` returns both tool names

---

### Requirement: MCP App environment variables are exposed via the existing client-config pipeline

`chat-api` SHALL expose four optional MCP App environment variables — the sandbox URL, theme override, user-agent override, and host name — to the client through the existing client-config pipeline.

Both endpoints reuse the existing toolset-to-MCP-endpoint resolution already present for toolset invocation (`toolset-authoring`, `deployments-api`) — no new env var is needed for the GET/POST endpoints themselves. DIAL Core's `mcp_apps.domain_override` (`epam/ai-dial-core` PR #1745) is a per-deployment config an admin sets on the Core/deployment side, not an `ai-dial-chat`/`chat-api` environment variable.

**`MCP_APP_SANDBOX_URL`** — added for the *sandbox-proxy* app's URL (see `mcp-app-sandbox-proxy`). Registered as client-visible key `mcpApps.sandboxUrl` → `ClientConfigResponseDto.config.mcpAppSandboxUrl` (`string | null`, defaults `null`). When unset, `mcpAppSandboxUrl` is `null` and `apps/chat`'s `useOpenMcpAppCanvas` treats it as "feature unavailable" (see `mcp-app-trigger`), not an error.

**`MCP_APP_THEME`** — optional admin override for the color theme delivered to all hosted MCP app Views via `hostContext.theme`. Registered as client-visible key `mcpApps.theme` → `ClientConfigResponseDto.config.mcpAppTheme` (`'light' | 'dark' | null`, defaults `null`). All four env vars follow the same `CONFIG_DEFINITIONS`/`EnvConfigProvider`/`ClientConfigResponseDto` pipeline already used by `dialCoreExternalUrl` and `customVisualizers` — no new frontend-config mechanism is introduced.

**`MCP_APP_USER_AGENT`** — optional admin override for the host application identifier delivered to all hosted MCP App Views via `hostContext.userAgent`. Registered as client-visible key `mcpApps.userAgent` → `ClientConfigResponseDto.config.mcpAppUserAgent` (`string | null`, defaults `null`). **Further revised** (see design.md D21): when unset, the client falls back to the browser's own `navigator.userAgent` rather than a fixed `'ai-dial-chat'` string — the app's own identity is now sent separately, via `hostInfo`. The `mcpApps.userAgent` registry description and the `ClientConfigResponseDto.mcpAppUserAgent` Swagger description state the same fallback, matching `useMcpAppHostContext` (`mcpAppUserAgent ?? navigator.userAgent`).

**`MCP_APP_HOST_NAME`** — optional admin override for the host application identifier sent to every mounted MCP App as `hostInfo.name` during its `ui/initialize` handshake. Registered as client-visible key `mcpApps.hostName` → `ClientConfigResponseDto.config.mcpAppHostName` (`string | null`, defaults `null`). When unset, `apps/chat`'s `useMcpAppHostAdapter` (`apps/chat/src/hooks/attachment/useMcpAppHostAdapter.ts`) falls back to `'ai-dial-chat'`.

`EnvironmentVariables` (`apps/chat-api/src/config/environment.config.ts`) SHALL add:

```ts
@IsOptional()
@IsEnum(['light', 'dark'])
MCP_APP_THEME?: 'light' | 'dark';
```

When `MCP_APP_THEME` is set, all users receive that theme in their MCP app Views regardless of their own UI theme preference; when unset (`null`), each client's `useOpenMcpAppCanvas` hook falls back to the user's active theme from `ThemeContext` (always `'dark'` or `'light'` at that point, since system-theme resolves at runtime before the hook runs — see `mcp-app-trigger`).

`EnvironmentVariables` also declares `MCP_APP_SANDBOX_URL`, `MCP_APP_USER_AGENT`, and `MCP_APP_HOST_NAME` as optional strings.

`AppConfigContext` (`apps/chat/src/context/AppConfigContext.tsx`) SHALL carry `mcpAppSandboxUrl`, `mcpAppTheme: 'light' | 'dark' | null`, `mcpAppUserAgent`, and `mcpAppHostName` in `AppConfigState.config`, each loaded from `response.config?.<key> ?? null`.

#### Scenario: MCP_APP_HOST_NAME unset falls back to the default host name

- **WHEN** `MCP_APP_HOST_NAME` is not set
- **THEN** the client config response's `mcpAppHostName` is `null`
- **AND** mounted MCP Apps receive `hostInfo.name: 'ai-dial-chat'`

#### Scenario: Boot is unaffected when MCP_APP_SANDBOX_URL and MCP_APP_THEME are unset

- **WHEN** `apps/chat-api` boots with this capability present and neither env var is set
- **THEN** boot succeeds exactly as before this change
- **AND** the client config response's `mcpAppSandboxUrl` is `null` and `mcpAppTheme` is `null`

#### Scenario: MCP_APP_THEME admin override is reflected in client config

- **WHEN** `MCP_APP_THEME=dark` is set
- **THEN** the client config response's `mcpAppTheme` is `'dark'`
