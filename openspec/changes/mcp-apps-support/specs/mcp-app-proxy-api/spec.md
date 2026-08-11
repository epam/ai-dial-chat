## ADDED Requirements

### Requirement: `GET /api/v1/toolsets/{toolsetId}/mcp-app-resource` mirrors DIAL Core's resource endpoint as a raw passthrough

`apps/chat-api/src/toolsets/mcp-apps.controller.ts` (or a sibling controller in the existing `toolsets` domain) SHALL expose:

```
GET /api/v1/toolsets/{toolsetId}/mcp-app-resource?resourceUri={uri}
```

This mirrors DIAL Core's own `GET /v1/deployments/{deployment_name}/mcp/resources?uri={uri}` (`McpResourceController`, `epam/ai-dial-core` PR #1745) — `toolsetId` maps onto Core's `deployment_name` path segment.

- `toolsetId` (path, string) — the toolset ID as already used by `buildToolsetMcpUrl`.
- `resourceUri` (query, string) — the `ui://` URI, as discovered per-tool from Core's `tools/list` `_meta.ui.resourceUri` (see the `mcp-app-trigger` capability's tool-discovery requirement; `Stage` carries no such field) and passed through by the caller; validated with `@Matches` against a `ui://` scheme allowlist regex before the call to Core is made (same check Core itself does).
- Auth: the caller SHALL already have access to the toolset in the current conversation, reusing the same session check as the existing toolset invocation path (`toolset-authentication` capability) — no new grant is introduced.
- **Response is a raw passthrough of Core's response — NOT a JSON DTO.** `chat-api` streams Core's response body unchanged and forwards its `Content-Type` (one of Core's allowed MIME types: `text/html`, `text/plain`, `text/css`, `application/json`, `image/svg+xml`, `image/png`, `image/jpeg`, `image/gif`, `image/webp`), `Content-Security-Policy`, and `X-Content-Type-Options` headers verbatim. There is no `html`/`allowedOrigins`/`permissions` field to synthesize — Core's endpoint doesn't return one.
- `400 BadRequestException` — `resourceUri` fails validation, or Core rejects it as not `ui://`-scheme.
- `403 ForbiddenException` — caller lacks access to the toolset, or Core's consent check denies it.
- `404 NotFoundException` — `toolsetId` does not exist, or Core reports the deployment has no MCP config / no such resource.
- `502 BadGatewayException` — Core reports an upstream MCP fetch/mimetype/empty-body failure, or Core itself is unreachable.
- `429` — Core's own rate limiter tripped; `chat-api` forwards the `Retry-After` header if present.

**OpenAPI / generated client:** `operationIdFactory` → `getToolsetMcpAppResource`. Because the response is a raw byte/text stream with a variable `Content-Type` rather than a fixed JSON schema, the OpenAPI response is documented as a binary/`*/*` content schema (mirroring how Core's own `docs/open_api_core.yaml` documents this route as `200: description: HTML widget content` with no schema). The generated client exposes this as a `Raw`-style method returning the response stream rather than a parsed body. `apps/chat/src/server-api/mcp-apps.ts` exposes `fetchMcpAppResourceHtml(toolsetId, resourceUri)`, which issues a GET against this route and resolves to the response body's text — consumed by `useOpenMcpAppCanvas` (`mcp-app-trigger`) to build `McpAppCanvasContent.html` for `@mcp-ui/client`'s `AppRenderer` (see `design.md` D3; the resource is fetched via JS, not loaded as an iframe `src`).

**Caching:** cache key `mcp-apps:resource:${toolsetId}:${resourceUri}`, TTL `30000ms` (matching the `cached-dial-list-request` default), invalidated only by TTL expiry — a `ui://` resource for a given toolset+URI is treated as effectively static content, mirroring how visualizer URLs are operator-static. Uses `withCachedDialRequest`, caching the raw body + `Content-Type` pair. Because the iframe's own `src` request and `useOpenMcpAppCanvas`'s validation request hit the same URL, the second request is normally a cache hit.

**Rate limiting:** default global throttle applies; no stricter per-route `@Throttle` — this is a read-mostly, cached GET.

#### Scenario: Successful resource fetch

- **WHEN** a caller with toolset access requests `GET /api/v1/toolsets/ts-1/mcp-app-resource?resourceUri=ui%3A%2F%2Fwidget%2F1`
- **THEN** the response is `200` with `Content-Type: text/html` and the widget's HTML body, headers forwarded from Core unchanged

#### Scenario: Cache hit skips the upstream call

- **WHEN** the same `toolsetId`/`resourceUri` pair is requested again within `30000ms`
- **THEN** the cached body/`Content-Type` pair is returned without a new call to Core

#### Scenario: Unknown toolset returns 404

- **WHEN** `toolsetId` does not correspond to any toolset the caller can see
- **THEN** the response is `404`

#### Scenario: Invalid resourceUri returns 400

- **WHEN** `resourceUri` does not match the `ui://` scheme allowlist regex
- **THEN** the response is `400` and no call to Core is made

---

### Requirement: `POST /api/v1/toolsets/{toolsetId}/mcp-app-tool-call` forwards an app-initiated tool call

```
POST /api/v1/toolsets/{toolsetId}/mcp-app-tool-call
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
- `404 NotFoundException` — unknown `toolsetId`.
- `502 BadGatewayException` — Core's proxied `tools/call` returns a JSON-RPC `error`, fails, or times out.

**OpenAPI / generated client:** `operationIdFactory` → `callToolsetMcpAppTool`. Frontend caller: `apps/chat/src/server-api/mcp-apps.ts`, normal generated-client method, awaited directly from `McpAppCanvasContent.onToolCall`.

**No caching** — every call is a live, potentially side-effecting tool invocation.

**Rate limiting:** `@Throttle` stricter than the global default (e.g. 20 requests / 60s per caller+toolset) to bound a runaway or malicious app looping tool calls through the sandboxed iframe, per `design.md`'s risk mitigation.

**Observability:** emit a metric (via the existing `MetricsInterceptor` pattern) tagged by `toolsetId` and `toolName` for call count and latency, and a `Logger` warning on every `403`/`502` outcome (never logging `arguments` contents, which may carry user data).

#### Scenario: Successful tool-call forwarding

- **WHEN** a caller with toolset access POSTs a valid `toolName`/`arguments` body
- **THEN** the response is `200` with the tool's result under `result`

#### Scenario: Tool not exposed by the session is rejected

- **WHEN** `toolName` does not match any tool the toolset's MCP session currently exposes
- **THEN** the response is `403`, even if the caller has general toolset access

#### Scenario: Rate limit exceeded

- **WHEN** a caller exceeds the configured request rate for this route
- **THEN** subsequent requests within the window receive `429`

#### Scenario: Upstream failure surfaces as 502

- **WHEN** the upstream MCP session's `tools/call` errors or times out
- **THEN** the response is `502` and no partial `result` is returned

---

### Requirement: One new environment variable, exposed via existing client-config pipeline

Both endpoints reuse the existing toolset-to-MCP-endpoint resolution already present for toolset invocation (`toolset-authoring`, `deployments-api`) — no new env var is needed for the GET/POST endpoints themselves. DIAL Core's `mcp_apps.domain_override` (`epam/ai-dial-core` PR #1745) is a per-deployment config an admin sets on the Core/deployment side, not an `ai-dial-chat`/`chat-api` environment variable.

One new env var, `MCP_APP_SANDBOX_URL`, is added for the *sandbox-proxy* app's URL (see `mcp-app-sandbox-proxy`) — it is registered as a new client-visible key (`mcpAppSandboxUrl`) in `apps/chat-api/src/app-config`'s existing `CONFIG_DEFINITIONS`/`EnvConfigProvider`/`ClientConfigResponseDto` pipeline, the same mechanism `dialCoreExternalUrl` and `customVisualizers` already use — no new frontend-config mechanism is introduced. When unset, `mcpAppSandboxUrl` resolves to `null` and `apps/chat`'s `useOpenMcpAppCanvas` treats it as "feature unavailable" (see `mcp-app-trigger`), not an error.

#### Scenario: Boot is unaffected when MCP_APP_SANDBOX_URL is unset

- **WHEN** `apps/chat-api` boots with this capability present and `MCP_APP_SANDBOX_URL` unset
- **THEN** boot succeeds exactly as before this change
- **AND** the client config response's `mcpAppSandboxUrl` is `null`
