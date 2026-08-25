## ADDED Requirements

### Requirement: `AttachmentContentType.McpApp` variant

`libs/attachment-canvas/src/types/attachment-canvas.ts` SHALL add a new enum member `AttachmentContentType.McpApp`.

`libs/attachment-canvas/src/models/attachment-canvas.ts` SHALL add a new member to the `AttachmentCanvasContent` discriminated union:

```ts
interface McpAppCanvasContent {
  type: AttachmentContentType.McpApp;
  html: string;                     // resource body fetched by the app layer from chat-api's raw-passthrough GET; passed straight to @mcp-ui/client's AppRenderer
  sandboxUrl: string;                // isolated-origin mcp-app-sandbox-proxy URL, resolved by the app layer from client config
  toolName: string;                 // the tool call that produced this resource — forwarded on every onToolCall
  onToolCall: (name: string, args: unknown) => Promise<CallToolResult>; // proxies to chat-api; app-level adapter, no MCP/session knowledge in this type
}
```

`html` is the body of `chat-api`'s raw-passthrough mirror of DIAL Core's `GET /v1/deployments/{deploymentId}/mcp/resources?uri=...` (see `mcp-app-proxy-api`), fetched via JS by `useOpenMcpAppCanvas` (see `mcp-app-trigger`) — not loaded as an iframe `src` (see `design.md` D3 for why: `@mcp-ui/client`'s `AppRenderer` needs HTML content, not a URL). `sandboxUrl` points at the new `mcp-app-sandbox-proxy` app (see that capability) and is passed to `AppRenderer`'s `sandbox` prop. `CallToolResult` is imported from `@modelcontextprotocol/sdk/types.js` — the MCP protocol's own result shape for a `tools/call`, not a host-specific type.

`isDownloadable(content)` SHALL return `false` for an `McpAppCanvasContent` value — there is no underlying file to download.

**RTL impact:** none directly; canvas panel chrome already handles direction. The mounted app's own internal layout is outside this repo's control.

**i18n impact:** none on the lib side; all lib-facing strings are passed as props with English defaults per the no-i18n-in-libs rule.

#### Scenario: McpApp content is not downloadable

- **WHEN** the canvas is opened with an `McpAppCanvasContent` and `onDownload` is provided
- **THEN** the download button in the canvas header is not rendered

#### Scenario: Panel opens with MCP app content

- **WHEN** `openCanvas` is called with an `McpAppCanvasContent` and `fileName`
- **THEN** `AttachmentCanvasContext.content` equals the passed content
- **AND** `AttachmentCanvasContainer` re-renders with the panel open and the MCP app renderer inside

---

### Requirement: `McpAppCanvasRenderer` component

`libs/attachment-canvas/src/components/McpAppCanvasRenderer/McpAppCanvasRenderer.tsx` SHALL mount the app via `@mcp-ui/client`'s `AppRenderer` component (confirmed via spike, `design.md` D2). Behaviour:

- Render `<AppRenderer html={content.html} sandbox={{ url: new URL(content.sandboxUrl) }} toolName={content.toolName} onCallTool={...} onError={...} />`. The `html` prop skips `AppRenderer`'s own resource-fetching path entirely — the renderer never issues its own network request for the resource.
- **Correction (found by runtime inspection of `@mcp-ui/client@<installed version>`'s bundled source):** the `sandbox` prop's `permissions` field does not exist in `@mcp-ui/client`'s actual `AppRenderer`/`AppFrame` implementation — only `sandbox.url` and `sandbox.csp` are read (`AppFrame`'s resource-ready message only ever sends `{ html, csp }`). A `permissions: 'allow-scripts'` value that was previously passed here was inert and has been removed; see the sandbox-attribute requirement below for where the inner iframe's `sandbox` attribute is actually controlled.
- Every `tools/call` request the mounted app issues SHALL be forwarded to `content.onToolCall(name, args)` via `onCallTool`; the resolved/rejected result SHALL be relayed back to the app through `AppRenderer`'s response channel.
- The component MUST NOT read from any app-level context (auth, theme, i18n, feature flags) — all data required is passed in through `McpAppCanvasContent`, matching the constraint already placed on `VisualizerCanvasRenderer`.
- Display a loading state until `AppRenderer`'s initialization handshake completes (its ref/`onError` callbacks signal this — no separate "ready" event is fabricated).
- Display an error state if `AppRenderer`'s `onError` fires for an initialization/channel-level failure (individual tool-call failures are relayed to the app as normal JSON-RPC errors via `onCallTool`'s return value and do NOT put the renderer itself into an error state).
- On unmount, `AppRenderer`'s own cleanup (its internal iframe teardown) applies; the component does not need to manually destroy a separate client instance.

#### Scenario: Renderer forwards a tool call to the onToolCall callback

- **WHEN** the mounted app issues a `tools/call` request for a tool named `"refresh_data"`
- **THEN** `content.onToolCall('refresh_data', <args>)` is invoked
- **AND** the value it resolves with is relayed back to the app as the JSON-RPC response

#### Scenario: onToolCall rejection is relayed as a tool error, not a renderer error

- **WHEN** `content.onToolCall` rejects (e.g. the underlying `chat-api` call failed)
- **THEN** the renderer relays a JSON-RPC error response to the app for that specific call
- **AND** the renderer itself remains mounted and interactive (no full-panel error state)

#### Scenario: renderer is torn down on unmount

- **WHEN** `McpAppCanvasRenderer` unmounts
- **THEN** `AppRenderer`'s own unmount cleanup removes its iframes from the DOM

---

### Requirement: inner (untrusted content) iframe sandbox attribute for MCP Apps

**Corrected by runtime investigation (see `mcp-app-sandbox-proxy`'s "Sandbox permissions are not configurable per-render" requirement for the full finding):** there is no way to pass a `permissions`/`sandbox`-attribute override through `AppRenderer`'s props to either of the two nested sandboxed iframes. Both are hardcoded:

- The **outer** host↔proxy iframe (an isolated-origin iframe pointed at `content.sandboxUrl`, created internally by `@mcp-ui/client`'s `AppFrame`) is hardcoded by that vendored library to `sandbox="allow-scripts allow-same-origin allow-forms"`. Nothing in `AppRenderer`'s public props reaches this value.
- The **inner** untrusted-content iframe, created by `apps/mcp-app-sandbox/src/app/sandbox-page.ts` itself (see `mcp-app-sandbox-proxy`), defaults to the identical string and exposes a `params.sandbox` override channel over `postMessage` — but `@mcp-ui/client`'s `AppFrame` never sends that override (its `sendSandboxResourceReady` call only ever includes `{ html, csp }`), so in practice this channel is currently unreachable from `apps/chat`.

Neither iframe ever grants `allow-same-origin` to the tool-supplied HTML, which satisfies this requirement's original security intent (no same-origin relaxation for untrusted content) — but the specific mechanism this requirement described (`AppRenderer`'s `sandbox.permissions` prop set to `'allow-scripts'`) does not exist in the installed library version and has been removed from `McpAppCanvasRenderer.tsx` as dead code. The actual, load-bearing default lives in `apps/mcp-app-sandbox/src/app/sandbox-page.ts`'s hardcoded `sandbox` attribute string, not in this component.

There is no tool-declared permissions payload in DIAL Core's Phase 1 contract (no `_meta.ui.permissions` field is returned by the resource endpoint) — no permissions beyond `allow-scripts` are requested anywhere in the pipeline today. If a later phase introduces one, that is a new requirement against a real payload, not something to speculatively build now.

#### Scenario: same-origin is never granted to the untrusted content

- **WHEN** an `McpAppCanvasContent` is rendered
- **THEN** the inner iframe ultimately holding the tool-supplied HTML has a `sandbox` attribute that never includes `allow-same-origin` (enforced today by `apps/mcp-app-sandbox/src/app/sandbox-page.ts`'s hardcoded default, not by any prop passed from `apps/chat`)

---

### Requirement: `AttachmentCanvas` switch handles McpApp variant

`libs/attachment-canvas/src/components/AttachmentCanvas/AttachmentCanvas.tsx` SHALL extend its switch over `AttachmentContentType` with a `case AttachmentContentType.McpApp` branch that renders `<McpAppCanvasRenderer content={content} />` inside the panel body. The panel chrome (header, close button, resize handle, keyboard/ARIA behaviour) SHALL be identical to the chrome used for other content types.

**Feature flag:** none. The variant is reachable only when the app builds an `McpAppCanvasContent` from a resolved stage UI resource.

#### Scenario: rendering switch dispatches to the MCP app branch

- **WHEN** `AttachmentCanvas` is rendered with an `McpAppCanvasContent`
- **THEN** the panel body contains a mounted `McpAppCanvasRenderer`
- **AND** the panel header renders the `fileName` as usual
