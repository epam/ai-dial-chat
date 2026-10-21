# MCP Apps

An **MCP App** is an interactive UI that an MCP tool ships alongside its result. The tool declares a `ui://` resource; DIAL Chat fetches that HTML, mounts it in a sandboxed iframe under the assistant message that called the tool, and lets the app talk back to the host — call more tools, open links, switch between an inline preview and a full-width canvas.

DIAL Chat implements the host side of the MCP Apps protocol on top of [`@mcp-ui/client`](https://github.com/MCP-UI-Org/mcp-ui). This page is the map: what runs where, how a message becomes a mounted app, and what an operator has to deploy. The normative detail lives in the specs linked from each section.

## Moving parts

| Part                                                                         | Role                                                                                                                                                                                           |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`apps/chat-api`](../apps/chat-api/README.md#mcp-apps-configuration)         | BFF. Lists a deployment's MCP tools, proxies the `ui://` resource fetch and app-initiated `tools/call` to DIAL Core, publishes the sandbox URL and host identity through client config.        |
| [`apps/mcp-app-sandbox`](../apps/mcp-app-sandbox/README.md)                  | Standalone NestJS app on a **separate origin**. Serves the double-iframe sandbox-proxy page that isolates untrusted tool HTML from the chat origin.                                            |
| [`@epam/ai-dial-mcp-apps`](../libs/mcp-apps/README.md)                       | Host-agnostic core: matching a message to a tool, resolving the seed data, the shared response cache, and the inline preview (`McpAppInlinePreview`).                                          |
| [`@epam/ai-dial-chat-hooks/mcp-apps`](../libs/chat-hooks/README.md#mcp-apps) | DIAL-Core-backed glue: `createMcpAppsApiClient`, tool discovery (`useMcpAppTools`), the host adapter and host context, and `useOpenMcpAppCanvas` for the full-width surface.                   |
| [`@epam/ai-dial-attachment-canvas`](../libs/attachment-canvas/README.md)     | `McpAppCanvasRenderer`: owns the `AppBridge`, mounts `AppFrame`, and handles the JSON-RPC requests the app sends.                                                                              |
| `apps/chat`                                                                  | Wires it together. `ConversationView` discovers tools and owns the cache and canvas; `ConversationMessageItem` renders the inline preview; `useMcpAppHostAdapter` fills theme, locale, config. |

The libs stay host-agnostic: theme, locale, the configured API client and the sandbox URL all arrive through an injected `McpAppHostAdapter`. Only `apps/chat` reads app contexts and i18n.

## From tool call to mounted app

```mermaid
sequenceDiagram
    participant UI as apps/chat
    participant BFF as chat-api
    participant Core as DIAL Core
    participant SB as mcp-app-sandbox (other origin)
    participant App as Tool UI (inner iframe)

    UI->>BFF: GET /api/v1/toolsets/mcp-apps/tools?deploymentId&kind
    BFF->>Core: tools/list (MCP proxy)
    Core-->>BFF: tools with _meta.ui.resourceUri
    BFF-->>UI: McpAppToolRef[]
    Note over UI: assistant message streams in;<br/>findMcpAppForMessage matches it
    UI->>BFF: GET /api/v1/toolsets/{id}/mcp-app-resource?resourceUri=ui://…
    BFF->>Core: GET /v1/deployments/{id}/mcp/resources?uri=…
    Core-->>BFF: HTML (raw passthrough)
    BFF-->>UI: HTML
    UI->>SB: AppFrame loads sandbox page
    SB->>App: inner iframe with the tool HTML
    App->>UI: ui/initialize (via relay)
    UI-->>App: hostContext + hostInfo + seed (toolInput / toolResult)
    App->>UI: tools/call
    UI->>BFF: POST /api/v1/toolsets/{id}/mcp-app-tool-call
    BFF->>Core: tools/call (MCP proxy)
    Core-->>BFF: result
    BFF-->>UI: { result }
    UI-->>App: JSON-RPC response
```

### 1. Discovery

The UI resource is a property of the **tool declaration**, not of a stage or tool-call result: DIAL Core returns it from `tools/list` as `_meta.ui.resourceUri`. `useMcpAppTools(client, deployment, messages, toolsets)` collects the tools that declare one, from two sources:

- **Direct.** The active deployment has `features.mcp === true` and is a toolset or an application. Its own `tools/list` is queried. These refs carry `discovery: 'direct'`.
- **Indirect.** An application without MCP support may call an MCP-capable toolset internally. Core does not expose that link, so the hook guesses it from tool-call names already seen in the conversation: the orchestrator calls a toolset's tool as `sanitizeToolName(`${toolsetDisplayName}_${toolName}`)`, so a call named `Entity_MCP_Server_show_entity_card` points at the toolset `Entity MCP Server`. Each matching toolset is queried once per session. These refs carry `discovery: 'indirect'`.

Every ref keeps two names. `toolName` is the name as it appears in the message (prefixed for indirect discovery) and is used for matching. `mcpToolName` is the tool's real name and is what a live re-call sends — the app only recognizes its own name.

> The name-prefix match is a temporary heuristic. It will be replaced once the orchestrator reports which toolset a call belongs to.

`kind` (`'toolset'` or `'application'`) on a ref only selects the Core MCP proxy route — `/v1/toolset/{id}/mcp` or `/v1/deployments/{id}/mcp`. A wrong prefix is a `404` from Core.

Spec: [`mcp-app-trigger`](../openspec/specs/mcp-app-trigger/spec.md).

### 2. Matching a message

`findMcpAppForMessage(message, mcpAppTools, isStreaming)` runs per assistant message:

1. A discovered tool whose `toolName` was actually called this turn wins.
2. Otherwise, a `discovery: 'direct'` tool — the deployment _is_ the MCP server and typically never reports tool calls at all.
3. Otherwise, while the message is still streaming, the first discovered tool (tool-call data may not have arrived yet). A settled message that called none of the indirect tools shows nothing.

Tool-call data comes from `message.custom_content.state`, which the SSE chunk merge copies verbatim. Two orchestrator shapes are understood: `tool_messages` (LangChain-style) and `tool_execution_history` (OpenAI chat-completion style). `resolveMcpAppToolCallSeed` turns the **last** matching call — a retry beats an earlier failure — into the seed `{ toolInput, toolResult }` the app is mounted with.

### 3. Rendering: inline preview first, canvas on demand

Each matched message renders `McpAppInlinePreview` below its stages (and below a grouped visualizer, if any). It is a bordered box sized to the app's content, with a header showing `mcpToolName` — plus the app's self-reported name and version once `ui/initialize` completes — and two actions: reload and expand.

The full-width canvas **never opens by itself**. It is reached only through the expand button, or when the app requests `fullscreen`. While a message's canvas is open, its inline preview keeps the header but shows an "opened in canvas" placeholder instead of the app, so the same app is never mounted twice.

| App request                                                                                  | Inline preview                                                                       | Canvas                                                                                     |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `ui/request-display-mode: fullscreen`                                                        | Opens the canvas, answers `fullscreen`                                               | Stays, answers `fullscreen`                                                                |
| `ui/request-display-mode: inline`                                                            | Stays, answers `inline`                                                              | Closes the canvas, answers `inline`                                                        |
| `ui/request-display-mode: pip`                                                               | Stays, answers `inline`                                                              | Stays, answers `fullscreen`                                                                |
| `ui/open-link`                                                                               | `http(s)` opens in a new tab (`noopener,noreferrer`); any other scheme is refused    | same                                                                                       |
| `tools/call`                                                                                 | Forwarded to the BFF; a failure is a JSON-RPC error to the app, not a renderer error | same                                                                                       |
| `ui/notifications/size-changed` / upstream `host-context-changed` with `containerDimensions` | Resizes the iframe                                                                   | Ignored — the canvas always fills the panel and sends live `containerDimensions` on resize |

Specs: [`mcp-app-canvas`](../openspec/specs/mcp-app-canvas/spec.md), [`mcp-app-trigger`](../openspec/specs/mcp-app-trigger/spec.md).

### 4. Seeding and the live re-call

Before mounting, `resolveMcpAppToolResult` decides which tool result the app gets:

- For a `direct` match, or an `indirect` match with a real tool call in `custom_content.state`, it **calls the tool again live** with the seed's arguments (or `{}` for a direct match with no seed) and hands the app the fresh `CallToolResult`. The transcript's text result is often not what the app's UI expects.
- For the streaming-only guess (no confirmed call), it passes the transcript result through unchanged.
- If the live call throws, it falls back to the transcript result.

### 5. Host context

Both surfaces build the `McpUiHostContext` sent on `ui/initialize` with `useMcpAppHostContext`:

| Field                   | Value                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `theme`                 | `MCP_APP_THEME` when set, otherwise the user's active theme                                             |
| `locale`                | Active i18n language                                                                                    |
| `timeZone`              | Browser's IANA time zone                                                                                |
| `userAgent`             | `MCP_APP_USER_AGENT` when set, otherwise `navigator.userAgent`                                          |
| `platform`              | `'web'`                                                                                                 |
| `displayMode`           | `'inline'` for the preview, `'fullscreen'` for the canvas                                               |
| `availableDisplayModes` | `['inline', 'fullscreen']`                                                                              |
| `styles.variables`      | The standard MCP UI CSS variables (`--color-background-primary`, …) read from `<html>`'s computed style |
| `containerDimensions`   | Measured at init, then updated live (canvas only)                                                       |

`hostInfo` — the host's identity, separate from the context — is `{ name: MCP_APP_HOST_NAME ?? 'ai-dial-chat', version: <app version> }`.

The MCP UI CSS variables are mapped from the chat's own design tokens in `apps/chat/src/styles.scss`, so a mounted app picks up the current theme.

## Caching

| Layer             | Where                             | Key                                                      | TTL    | Notes                                                                                                                       |
| ----------------- | --------------------------------- | -------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| Resource HTML     | `chat-api`                        | `mcp-apps:resource:${toolsetId}:${resourceUri}`          | 30 s   | `ui://` resources are treated as static.                                                                                    |
| Resource + result | Browser, `useMcpAppResponseCache` | `${conversationId}:${mcpAppCanvasKey(index)}` + seed key | 15 min | Shared by the inline preview and the canvas, so expanding or collapsing never re-fetches. Concurrent loads share one fetch. |
| Tool calls        | —                                 | —                                                        | —      | Never cached: a `tools/call` may have side effects.                                                                         |

The browser cache is **seed-aware**: an entry written while the message was still streaming (no seed yet) is a miss once the real seed arrives, so the live re-call always happens exactly once after the message settles. Reload on either surface invalidates the entry.

## BFF endpoints

All under `McpAppController` (`apps/chat-api/src/toolsets/mcp-app.controller.ts`):

| Endpoint                                                          | Purpose                                                                                                                                                |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/v1/toolsets/mcp-apps/tools?deploymentId&kind`           | Tools that declare `_meta.ui.resourceUri`.                                                                                                             |
| `GET /api/v1/toolsets/mcp-apps/tool-names?deploymentId&kind`      | Every tool name, unfiltered (used by the toolset editor's "Allowed tools" picker).                                                                     |
| `GET /api/v1/toolsets/{toolsetName}/mcp-app-resource?resourceUri` | Raw passthrough of Core's resource endpoint — body, `Content-Type` and CSP headers forwarded as-is. `resourceUri` must be `ui://`.                     |
| `POST /api/v1/toolsets/{toolsetName}/mcp-app-tool-call`           | Forwards `{ toolName, arguments, kind }` as a `tools/call`. `toolName` is checked against the session's real `tools/list` — an unlisted name is `403`. |

These reuse the toolset's existing access check; no new grant is introduced. Core rate limits come back as `429` with `Retry-After`. Request `arguments` are never logged. Full contract: [`mcp-app-proxy-api`](../openspec/specs/mcp-app-proxy-api/spec.md).

## Isolation

Tool HTML is untrusted. It runs two iframes deep:

1. **Outer iframe** — created by `@mcp-ui/client`'s `AppFrame`, pointed at `apps/mcp-app-sandbox` on a **different origin** from the chat.
2. **Inner iframe** — created by the sandbox page itself, holding the tool HTML. Messages are relayed between the host and the inner iframe over `postMessage`.

Both iframes use `sandbox="allow-scripts allow-same-origin allow-forms"`. `allow-same-origin` grants the **sandbox's** origin, not the chat's, so chat cookies, storage and DOM stay out of reach. That is why the sandbox must never share an origin with `apps/chat`.

The sandbox page:

- checks `Origin` (or, without it, `Referer`) against `MCP_APP_SANDBOX_ALLOWED_HOST_ORIGINS` and returns `403` otherwise — an empty list rejects everything;
- sends a fixed, deliberately **permissive** CSP (`default-src *` with inline and eval) because it cannot know what an app loads — isolation comes from the origin split and from `frame-ancestors` locked to the validated host;
- is served `Cache-Control: no-store`, since the page embeds the validated host origin.

Spec: [`mcp-app-sandbox-proxy`](../openspec/specs/mcp-app-sandbox-proxy/spec.md).

## Deploying

1. Deploy `apps/mcp-app-sandbox` (image `ai-dial-chat-mcp-app-sandbox`) on its own host or port, with `MCP_APP_SANDBOX_ALLOWED_HOST_ORIGINS` set to the chat's origin. See the [sandbox README](../apps/mcp-app-sandbox/README.md).
2. Point `MCP_APP_SANDBOX_URL` in `chat-api` at that deployment.
3. Optionally set `MCP_APP_THEME`, `MCP_APP_USER_AGENT` and `MCP_APP_HOST_NAME`. See [MCP Apps configuration](../apps/chat-api/README.md#mcp-apps-configuration).

There is no feature flag. MCP Apps appear whenever a sandbox URL is configured and the active deployment exposes at least one tool with a UI resource. Without `MCP_APP_SANDBOX_URL` nothing renders — not even a placeholder.

## Known limitations

- **Popups are blocked.** Neither iframe's `sandbox` attribute includes `allow-popups`, and `@mcp-ui/client` (7.1.1) hardcodes the outer one. An app's own `window.open` fails; use `ui/open-link` instead. The CSP's `allow-popups` token does not change this.
- **No per-tool permissions or CSP.** DIAL Core returns no permissions payload, and the sandbox has no per-request CSP override.
- **Indirect discovery is a name heuristic** (see [Discovery](#1-discovery)); a toolset whose sanitized display name does not prefix the tool-call name is not found.
- **Only two orchestrator state shapes** (`tool_messages`, `tool_execution_history`) are understood for seeding. Neither is a DIAL Core or MCP Apps guarantee.
