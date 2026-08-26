## Why

Assistant messages already show tool-call activity as inert `StagesPanel` rows (`custom_content.stages` — see the `stage-visualization` capability) and MCP servers are already wired into the product as **toolsets** (`catalog-toolsets`, `toolset-authoring` — each toolset is an MCP endpoint DIAL Core connects to on the assistant's behalf). Today a tool's *result* can only render as plain text/JSON/an attachment. The [MCP Apps extension](https://modelcontextprotocol.io/extensions/apps/overview) lets an MCP tool declare an interactive `ui://` HTML resource, rendered host-side in a sandboxed iframe with a live postMessage channel back into the tool session. Supporting it lets toolset authors ship dashboards, config forms, and rich viewers directly into the conversation instead of dumping raw text, and keeps ai-dial-chat compatible with the growing MCP Apps ecosystem (map/3D viewers, business-app examples, etc.) other MCP hosts (Claude Desktop, VS Code Copilot) already render.

## What Changes

- Add a new `AttachmentCanvasContentType.McpApp` variant to `libs/attachment-canvas`, rendered by a new `McpAppCanvasRenderer` that mounts the app's `ui://` resource in a sandboxed iframe and speaks the MCP Apps postMessage/JSON-RPC dialect via a client library (`@mcp-ui/client` or `App Bridge` from `@modelcontextprotocol/ext-apps`) — **not** the existing `VisualizerConnector` protocol used by `custom-visualizers`, which is a different, incompatible wire format.
- Extend the `Stage` model (`stage-visualization` capability) so a stage carrying `_meta.ui.resourceUri` renders an "Open app" action (`StageItem`) instead of / in addition to its collapsible text body.
- Add an `apps/chat/src/hooks/attachment/useOpenMcpAppCanvas.ts`-style hook that opens `AttachmentCanvas` with `McpAppCanvasContent` when that action is activated, following the existing `openCanvas`/`AttachmentCanvasContext` pattern (mutually exclusive with the sources panel and conversation panel, same as every other canvas trigger).
- Add a thin `apps/chat-api` proxy surface mirroring DIAL Core's confirmed MCP Apps contract (`epam/ai-dial-core` PR #1745, merged 2026-07-31): a raw-passthrough `GET` that proxies Core's `GET /v1/deployments/{deploymentId}/mcp/resources?uri=...` (fetched by `apps/chat` via JS — see below), and a `POST` that forwards an app-initiated `tools/call` through Core's existing generic MCP proxy (`/v1/deployments/{id}/mcp`) — the same route already used for LLM-driven tool calls, not a new Core endpoint. Frontend and `libs/attachment-canvas` never talk to an MCP server directly.
- Add a new, isolated-origin Nx app `apps/mcp-app-sandbox` implementing the MCP Apps double-iframe sandbox-proxy pattern required by `@mcp-ui/client` (adapted from `modelcontextprotocol/ext-apps`'s reference implementation). This is genuinely new deployable infrastructure, chosen deliberately over a lighter same-origin or hand-rolled alternative because it provides real cross-origin isolation for untrusted tool-supplied HTML, per explicit direction to favor the more secure option even at higher implementation cost.
- Render via `@mcp-ui/client`'s `AppRenderer`: `apps/chat` fetches the resource HTML via the `chat-api` GET endpoint above and passes it directly (`html` prop, no further fetching by the library), pointed at the new sandbox-proxy app's URL, with the inner untrusted iframe's `sandbox` attribute forced to exactly `allow-scripts` (overriding the library's less-strict default). The sandbox-proxy app's own fixed, restrictive CSP is the primary enforcement layer for the rendered tool HTML — Core's Phase 1 does not surface a separate tool-declared permissions payload (mic/camera/etc.) to enforce.

## Capabilities

### New Capabilities

- `mcp-app-canvas`: `McpApp` content type, sandboxed iframe renderer, and postMessage/JSON-RPC bridge for rendering an MCP tool's `ui://` resource inside `AttachmentCanvas`.
- `mcp-app-trigger`: surfacing an "Open app" action on a stage/tool-call whose result declares `_meta.ui.resourceUri`, and opening the canvas from it.
- `mcp-app-proxy-api`: `apps/chat-api` endpoints that fetch a toolset's UI resource and forward app-initiated `tools/call` requests to the owning MCP session.
- `mcp-app-sandbox-proxy`: a new isolated-origin Nx app (`apps/mcp-app-sandbox`) implementing the MCP Apps double-iframe sandbox-proxy page that `@mcp-ui/client` requires to render untrusted tool HTML safely.

### Modified Capabilities

- `stage-visualization`: `Stage` gains an optional UI-resource reference and `StageItem` gains an "Open app" action when it is present, alongside (not replacing) the existing collapsible-content behavior.
- `canvas`: `AttachmentCanvas`'s content-type switch gains an `McpApp` branch, following the same pattern as the existing `Visualizer` branch.

## Impact

- **Affected libs**: `libs/attachment-canvas` (new content type, new renderer, new peer dependency on `@mcp-ui/client`), `libs/conversation-stages` (stage model + `StageItem` action).
- **Affected apps**: `apps/chat` (new hook, resource-fetch + client-config wiring, `AttachmentCanvasContainer` wiring, i18n keys), `apps/chat-api` (new proxy endpoints/domain module, new `mcpAppSandboxUrl` client-config key, env config). **New app**: `apps/mcp-app-sandbox` (isolated-origin sandbox-proxy service).
- **New dependency**: `@mcp-ui/client` (confirmed compatible with this repo's React 19 via spike — `design.md` D2).
- **New deployment surface**: `apps/mcp-app-sandbox` must be deployed at an origin distinct from `apps/chat`'s (own hostname/port + env-configured Referer allowlist); operators who don't deploy/configure it simply don't get the "Open app" trigger, same posture as an unconfigured `mcp_apps.domain_override` on the Core side.
- **DIAL Core dependency — confirmed, not blocking.** `epam/ai-dial-core` PR #1745 ships the resource-fetch endpoint and `_meta.ui.domain` rewrite; app-initiated `tools/call` forwarding reuses Core's existing generic MCP proxy, no Core change needed for that. `_meta.ui.resourceUri` only appears for deployments where an admin has configured `mcp_apps.domain_override` — toolsets without it simply won't show an "Open app" action, by design, not by failure.
- **No breaking changes** to existing attachment/visualizer/stage behavior — this is purely additive.
