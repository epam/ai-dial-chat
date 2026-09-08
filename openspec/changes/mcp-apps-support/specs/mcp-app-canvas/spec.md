## ADDED Requirements

### Requirement: `AttachmentContentType.McpApp` variant

`libs/attachment-canvas/src/types/attachment-canvas.ts` SHALL add a new enum member `AttachmentContentType.McpApp`.

`libs/attachment-canvas/src/models/attachment-canvas.ts` SHALL add a new member to the `AttachmentCanvasContent` discriminated union:

```ts
import { McpUiHostContext } from '@modelcontextprotocol/ext-apps/app-bridge';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

interface McpAppCanvasContent {
  type: AttachmentContentType.McpApp;
  html: string;                               // resource body fetched by the app layer from chat-api's raw-passthrough GET; passed straight to @mcp-ui/client's AppFrame
  sandboxUrl: string;                          // isolated-origin mcp-app-sandbox-proxy URL, resolved by the app layer from client config
  toolInput?: Record<string, unknown>;        // seed: arguments of the matched tool call, from resolveMcpAppToolCallSeed
  toolResult?: CallToolResult;                // seed: result of the matched tool call, from resolveMcpAppToolCallSeed
  hostContext?: McpUiHostContext;             // UI context sent to the View on ui/initialize; built by the app layer — see mcp-app-trigger requirement
  onToolCall: (name: string, args: unknown) => Promise<CallToolResult>; // proxies to chat-api; app-level adapter, no MCP/session knowledge in this type
  onOpenLink?: (url: string) => boolean | void;              // decides whether a ui/open-link URL is opened; omitted ⇒ renderer opens http(s) URLs in a new tab itself
  onRequestDisplayMode?: (mode: McpAppDisplayMode) => McpAppDisplayMode | void; // answers a ui/request-display-mode request with the mode actually applied
  onReload?: () => void;                      // signal for the app layer to re-fetch from scratch, bypassing its cache (see design.md D12)
}
```

`McpAppDisplayMode` (`NonNullable<McpUiHostContext['displayMode']>`, i.e. the MCP Apps protocol's `'inline' | 'fullscreen' | 'pip'` union) is exported from `libs/attachment-canvas`'s public barrel alongside `McpAppCanvasContent`. The original spec's `toolName: string` field is **removed** — after the renderer swap below, nothing reads it (its doc comment's claim of being "forwarded on every onToolCall" was drift); the mounted app is addressed by its seed and `onToolCall`'s own `name` argument, never by a host-side tool-name field.

`html` is the body of `chat-api`'s raw-passthrough mirror of DIAL Core's `GET /v1/deployments/{deploymentId}/mcp/resources?uri=...` (see `mcp-app-proxy-api`), fetched via JS by `useOpenMcpAppCanvas` (see `mcp-app-trigger`) — not loaded as an iframe `src` (see `design.md` D3 for why: `@mcp-ui/client`'s `AppFrame` needs HTML content, not a URL). `sandboxUrl` points at the new `mcp-app-sandbox-proxy` app (see that capability) and is passed to `AppFrame`'s `sandbox` prop. `CallToolResult` is imported from `@modelcontextprotocol/sdk/types.js` — the MCP protocol's own result shape for a `tools/call`, not a host-specific type. `McpUiHostContext` is imported from `@modelcontextprotocol/ext-apps/app-bridge` — the MCP Apps protocol type for the `ui/initialize` response payload; `@modelcontextprotocol/ext-apps` is added as a **peer dependency** of `libs/attachment-canvas` alongside `@mcp-ui/client` (it is already a transitive dep through `@mcp-ui/client`, but the type import requires it to be declared as a direct peer so version changes don't silently break the type contract).

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

`libs/attachment-canvas/src/components/McpAppCanvasRenderer/McpAppCanvasRenderer.tsx` SHALL mount the app via `@mcp-ui/client`'s `AppFrame` component plus a host-owned `AppBridge` instance (originally specified as `AppRenderer`; **revised** — see `design.md` D13 for why: `AppRenderer` creates its `AppBridge` internally and never forwards `ui/request-display-mode` to the host, so the component constructs `new AppBridge(null, hostInfo, capabilities, { hostContext })` itself and renders `<AppFrame html sandbox appBridge toolInput toolResult onSizeChanged onInitialized onError />`). Behaviour:

- The `AppBridge` is created inside a mount-scoped `useEffect` (not during render), with host info `{ name: 'MCP-UI Host', version: '1.0.0' }` and capabilities `{ openLinks: {} }` — the same defaults `AppRenderer` used — and its `hostContext` option seeded from `content.hostContext`. The bridge is `close()`d on unmount (a close failure is `console.error`-logged, not thrown).
- The `AppFrame`'s `sandbox` prop is `{ url: new URL(content.sandboxUrl) }`, memoized on `sandboxUrl` — `AppFrame` re-creates its sandbox iframe whenever the URL object's identity changes, so a literal `new URL(...)` per render would churn the iframe on every host re-render. The `html` prop skips `@mcp-ui/client`'s own resource-fetching path entirely — the renderer never issues its own network request for the resource. `hostContext` is forwarded to the bridge via `setHostContext` whenever the (resize-merged) value changes, so a live resize reaches the app as `ui/notifications/host-context-changed`.
- Every `tools/call` request the mounted app issues SHALL be forwarded to `content.onToolCall(name, args)` via the bridge's `oncalltool` handler; the resolved/rejected result SHALL be relayed back to the app through the bridge's response channel.
- Every `ui/open-link` request the mounted app issues SHALL be answered per the open-link requirement below; every `ui/request-display-mode` request per the display-mode requirement below.
- The handlers read `content`'s callbacks through a ref refreshed after every render (the pattern `@mcp-ui/client`'s `AppRenderer` uses internally), so a host that re-renders with new callbacks does not need to re-create the bridge.
- The component MUST NOT read from any app-level context (auth, theme, i18n, feature flags) — all data required is passed in through `McpAppCanvasContent`, matching the constraint already placed on `VisualizerCanvasRenderer`.
- Display a loading state until the frame signals readiness (`onInitialized`/`onSizeChanged` callbacks) or an error (`onError` for an initialization/channel-level failure — individual tool-call failures are relayed to the app as normal JSON-RPC errors via `onToolCall`'s return value and do NOT put the renderer itself into an error state).

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
- **THEN** the host-owned `AppBridge` is `close()`d and `AppFrame`'s own unmount cleanup removes its iframes from the DOM

---

### Requirement: `ui/open-link` requests open http(s) URLs in a new tab; the host can intercept

**Added** (`design.md` D13). The mounted app's `ui/open-link` request (`params: { url }` — e.g. a draw.io app asking the host to open `https://app.diagrams.net/?...#create=...`) SHALL be handled by `McpAppCanvasRenderer`'s host-owned `AppBridge`:

- When `content.onOpenLink` is provided, it is called with the requested `url`; the app receives an error result (`{ isError: true }`) exactly when the callback returns `false`, and a success result otherwise.
- When `content.onOpenLink` is omitted, the renderer's own default applies: the URL is parsed with `new URL`; only `http:`/`https:` protocols are opened — `window.open(url, '_blank', 'noopener,noreferrer')` — and every other scheme (e.g. `javascript:`, `data:`) is rejected. A parse failure or a `null` return from `window.open` (browser pop-up blocker) is also an error result.

The scheme allowlist exists because the guest app is untrusted content — a `javascript:` URL must never reach `window.open`. `noopener`/`noreferrer` prevent the opened page from holding a reference back to the host window.

#### Scenario: an http(s) link from the app opens in a new tab

- **WHEN** the mounted app sends `ui/open-link` with `params: { url: 'https://app.diagrams.net/?pv=0&grid=0#create=...' }` and `content.onOpenLink` is omitted
- **THEN** the URL is opened via `window.open(url, '_blank', 'noopener,noreferrer')`
- **AND** the app receives a success result

#### Scenario: a non-http(s) link is rejected

- **WHEN** the mounted app sends `ui/open-link` with `params: { url: 'javascript:alert(1)' }`
- **THEN** no window is opened
- **AND** the app receives an error result (`{ isError: true }`)

#### Scenario: the host callback's refusal is relayed as an error result

- **WHEN** `content.onOpenLink` is provided and returns `false` for a requested URL
- **THEN** the app receives an error result (`{ isError: true }`)

#### Scenario: a blocked pop-up is reported as an error result

- **WHEN** `window.open` returns `null` for an otherwise-allowed `http(s)` URL (browser pop-up blocker)
- **THEN** the app receives an error result (`{ isError: true }`)

---

### Requirement: `ui/request-display-mode` requests switch the app between the inline and fullscreen surfaces

**Added** (`design.md` D13). The mounted app's `ui/request-display-mode` request (`params: { mode: 'inline' | 'fullscreen' | 'pip' }`) SHALL be handled by `McpAppCanvasRenderer`'s host-owned `AppBridge`:

- When `content.onRequestDisplayMode` is provided, it is called with the requested `mode`; the app receives `{ mode: <the callback's return value> }` — the mode actually applied, which per the MCP Apps protocol "may differ from requested if not supported". A `void`/`undefined` return answers with the current mode.
- When `content.onRequestDisplayMode` is omitted, the app is answered with the current mode (`content.hostContext?.displayMode ?? 'inline'`) — no surface switch happens.

The host advertises the switchable modes via `hostContext.availableDisplayModes` (see the `useMcpAppHostContext` requirement in `mcp-app-trigger`), so a well-behaved app knows which requests can succeed before sending one.

The two consuming surfaces map the request as follows:

- **Inline preview** (`libs/mcp-apps`'s `McpAppInlinePreview`): a `'fullscreen'` request expands into the full-width canvas via the same `onExpand` callback the expand button uses, answering `'fullscreen'`; any other request (including `'pip'` and `'inline'`) keeps the preview, answering `'inline'`.
- **Full-width canvas** (`libs/chat-hooks`'s `useOpenMcpAppCanvas`): an `'inline'` request closes the canvas — restoring the message's inline preview without re-fetching, since both surfaces share the `McpAppResponseCache` — and answers `'inline'`; any other request keeps the canvas, answering `'fullscreen'`.

#### Scenario: an inline-preview app asking for fullscreen expands into the canvas

- **WHEN** an app mounted in a message's inline preview sends `ui/request-display-mode` with `params: { mode: 'fullscreen' }`
- **THEN** the preview's `onExpand` is called, opening the full-width canvas for the same message
- **AND** the app receives `{ mode: 'fullscreen' }`

#### Scenario: a canvas app asking for inline closes the canvas

- **WHEN** an app mounted in the full-width canvas sends `ui/request-display-mode` with `params: { mode: 'inline' }`
- **THEN** the canvas closes and the message's inline preview renders in its place (served from the shared response cache, with no re-fetch)
- **AND** the app receives `{ mode: 'inline' }`

#### Scenario: an unsupported mode is answered with the current mode

- **WHEN** an app mounted in the inline preview sends `ui/request-display-mode` with `params: { mode: 'pip' }`
- **THEN** the preview stays mounted and no surface switch happens
- **AND** the app receives `{ mode: 'inline' }` — the current mode, per the protocol's "may differ from requested if not supported"

#### Scenario: no host callback answers with the current mode

- **WHEN** `content.onRequestDisplayMode` is omitted and the app sends `ui/request-display-mode`
- **THEN** the app receives `{ mode: <content.hostContext?.displayMode ?? 'inline'> }` and no surface switch happens

---

### Requirement: app-initiated `ui/notifications/host-context-changed` container-dimension requests resize the frame

**Added** after runtime investigation of apps that send `ui/notifications/host-context-changed` **upstream** (app→host) with `params.containerDimensions` (e.g. `{ width: 670, height: 382 }`) instead of the standard `ui/notifications/size-changed` notification. The MCP Apps protocol's `AppNotification` union includes the method in the app→host direction, and this repo's sandbox proxy (`apps/mcp-app-sandbox`) relays every inner-iframe message verbatim — but `@mcp-ui/client`'s `AppFrame` registers no handler for it, so `AppBridge` silently drops the request and the iframe stays at its hardcoded `100%`-wide/`600px`-tall defaults (observed as unexplained extra bottom space under such apps).

`McpAppCanvasRenderer` SHALL register a notification handler on its host-owned `AppBridge` (via the MCP SDK `Protocol`'s `setNotificationHandler` with `@modelcontextprotocol/ext-apps`' `McpUiHostContextChangedNotificationSchema`) that applies `params.containerDimensions` to the sandbox iframe — the same inline `style.width`/`style.height` pixel assignment `AppFrame` performs for `size-changed` notifications:

- A fixed `width`/`height` replaces the iframe's current inline dimensions (its `100%`-wide default or any earlier app-reported size).
- `maxWidth`/`maxHeight` are applied as CSS clamps (`style.maxWidth`/`style.maxHeight`) and only bound the existing dimensions.
- Notifications without `containerDimensions` (or with it absent/undefined) leave the iframe untouched.
- The `.fullscreenFrame` stylesheet rule (`!important`) keeps winning in the fullscreen canvas, so a request never shrinks that surface.

This is renderer-internal mechanics — like `size-changed` handling, it is not a `McpAppCanvasContent` callback; the host has no policy decision to make about an app sizing itself. The handler queries the iframe from the renderer's own container at invocation time (`AppFrame` creates the iframe in its own mount effect, which may run after the renderer's bridge-creation effect).

#### Scenario: a fixed-size request resizes the iframe

- **WHEN** the mounted app sends `ui/notifications/host-context-changed` with `params: { containerDimensions: { width: 670, height: 382 } }`
- **THEN** the sandbox iframe's inline style becomes `width: 670px` and `height: 382px`

#### Scenario: a max-constraint request clamps instead of replacing

- **WHEN** the mounted app sends `containerDimensions: { maxWidth: 670 }`
- **THEN** the iframe's `style.maxWidth` is set to `670px` and its width is otherwise unchanged

#### Scenario: a request without containerDimensions is a no-op

- **WHEN** the mounted app sends `ui/notifications/host-context-changed` without a `containerDimensions` field
- **THEN** the iframe's dimensions are left untouched

#### Scenario: the fullscreen canvas ignores the request

- **WHEN** an app mounted in the fullscreen canvas sends `containerDimensions: { width: 670, height: 382 }`
- **THEN** the `.fullscreenFrame` `!important` rule keeps the iframe filling 100% of the canvas panel

---

### Requirement: inner (untrusted content) iframe sandbox attribute for MCP Apps

**Corrected by runtime investigation (see `mcp-app-sandbox-proxy`'s "Sandbox permissions are not configurable per-render" requirement for the full finding):** there is no way to pass a `permissions`/`sandbox`-attribute override through `AppRenderer`'s props to either of the two nested sandboxed iframes. Both are hardcoded:

- The **outer** host↔proxy iframe (an isolated-origin iframe pointed at `content.sandboxUrl`, created internally by `@mcp-ui/client`'s `AppFrame`) is hardcoded by that vendored library to `sandbox="allow-scripts allow-same-origin allow-forms"`. Nothing in `AppRenderer`'s public props reaches this value.
- The **inner** untrusted-content iframe, created by `apps/mcp-app-sandbox/src/app/sandbox-page.ts` itself (see `mcp-app-sandbox-proxy`), defaults to the identical string and exposes a `params.sandbox` override channel over `postMessage` — but `@mcp-ui/client`'s `AppFrame` never sends that override (its `sendSandboxResourceReady` call only ever includes `{ html, csp }`), so in practice this channel is currently unreachable from `apps/chat`.

Neither iframe ever grants `allow-same-origin` to the tool-supplied HTML, which satisfies this requirement's original security intent (no same-origin relaxation for untrusted content) — but the specific mechanism this requirement described (`AppRenderer`'s `sandbox.permissions` prop set to `'allow-scripts'`) does not exist in the installed library version and has been removed from `McpAppCanvasRenderer.tsx` as dead code. The actual, load-bearing default lives in `apps/mcp-app-sandbox/src/app/sandbox-page.ts`'s hardcoded `sandbox` attribute string, not in this component.

There is no tool-declared permissions payload in DIAL Core's Phase 1 contract (no `_meta.ui.permissions` field is returned by the resource endpoint) — no permissions beyond `allow-scripts` are requested anywhere in the pipeline today. If a later phase introduces one, that is a new requirement against a real payload, not something to speculatively build now.

#### Scenario: same-origin relaxation is bounded to the isolated sandbox origin

- **WHEN** an `McpAppCanvasContent` is rendered
- **THEN** the inner iframe ultimately holding the tool-supplied HTML has `sandbox="allow-scripts allow-same-origin allow-forms"` (matching the outer host↔proxy iframe hardcoded by `@mcp-ui/client`'s `AppFrame`)
- **AND** `allow-same-origin` grants the tool HTML the `mcp-app-sandbox` deployment's own isolated origin, not the chat application's origin — chat cookies, localStorage, sessionStorage, and DOM remain inaccessible because the sandbox proxy is deployed at a distinct origin from the chat app
- **AND** `allow-top-navigation` is never included in either iframe's sandbox attribute

---

### Requirement: `AttachmentCanvas` switch handles McpApp variant

`libs/attachment-canvas/src/components/AttachmentCanvas/AttachmentCanvas.tsx` SHALL extend its switch over `AttachmentContentType` with a `case AttachmentContentType.McpApp` branch that renders `<McpAppCanvasRenderer content={content} />` inside the panel body. The panel chrome (header, close button, resize handle, keyboard/ARIA behaviour) SHALL be identical to the chrome used for other content types.

**Feature flag:** none. The variant is reachable only when the app builds an `McpAppCanvasContent` from a resolved stage UI resource.

#### Scenario: rendering switch dispatches to the MCP app branch

- **WHEN** `AttachmentCanvas` is rendered with an `McpAppCanvasContent`
- **THEN** the panel body contains a mounted `McpAppCanvasRenderer`
- **AND** the panel header renders the `fileName` as usual
