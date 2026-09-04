## ADDED Requirements

### Requirement: Real MCP App tools are discovered per-deployment via `tools/list`, keyed by tool name

**Revised** (supersedes the original `Stage.mcp_app` design — see `design.md` D5, third revision). DIAL Core does not attach a UI resource reference to individual stages/tool-call results; the UI resource is a property of the **tool's declaration**, returned by the MCP `tools/list` method as `_meta.ui.resourceUri`. `apps/chat/src/hooks/conversation/useMcpAppTools.ts`'s `useMcpAppTools(deployment)` SHALL, whenever `deployment.features.mcp === true` and `deployment.type` is `'toolset'` or `'application'`, call `listMcpAppTools` (`apps/chat/src/server-api/mcp-apps.ts`, backed by `apps/chat-api`'s `GET /api/v1/toolsets/mcp-apps/tools`) and keep the full list of matching tools as `McpAppToolRef[]`, each `{ toolsetId: string; resourceUri: string; toolName: string; mcpToolName: string; kind: McpDeploymentKind }`.

`McpAppToolRef.kind` mirrors `deployment.type` at discovery time (`'toolset'` for a toolset deployment, `'application'` for an application). It is passed through `callMcpAppTool` in `apps/chat/src/server-api/mcp-apps.ts` and forwarded as `McpAppToolCallRequestDto.kind` to `apps/chat-api`, which uses it to select the correct Core MCP proxy prefix for `tools/list`/`tools/call` (`/v1/toolset/{id}/mcp` vs `/v1/deployments/{id}/mcp` — see `design.md` D4).

`libs/chat-shared`'s `Stage` interface SHALL NOT carry an `mcp_app` field — there is no per-stage UI resource reference in the actual DIAL Core contract, so no such field is populated or read anywhere in the codebase.

#### Scenario: Deployment without MCP support yields no tool refs

- **WHEN** `deployment.features.mcp` is not `true`
- **THEN** the direct-discovery source yields no tool refs and issues no request

#### Scenario: Deployment with MCP support and UI-capable tools yields their refs

- **WHEN** `deployment.features.mcp === true` and Core's `tools/list` response includes a tool with `_meta.ui.resourceUri: 'ui://widget/1'`
- **THEN** `useMcpAppTools` returns an array including `{ toolsetId, resourceUri: 'ui://widget/1', toolName: <that tool's name> }`

---

### Requirement: Tool discovery also resolves a toolset an MCP-incapable application delegates to internally, via the tool-call naming convention (`design.md` D9)

**Added** — a quick/custom application (`deployment.type === 'application'`, `deployment.features.mcp` not `true`) can internally call a separate, MCP-capable toolset without Core exposing that link on the application's own deployment metadata (`DeploymentItemDto`/`ApplicationDetailsDto`, including `applicationProperties`). `useMcpAppTools(deployment, messages, toolsets)` (`toolsets` from `useDeployments()`'s already-loaded catalog) SHALL additionally:

1. Call `apps/chat/src/utils/mcp-app.ts`'s `collectToolCallNames(messages)` to collect every real tool-call name seen so far in the conversation (per `design.md` D8's `resolveToolCalls`).
2. For each toolset in `toolsets` whose `displayName` (falling back to `id`) is a string such that `` `${displayName}_` `` prefixes one of those collected names, and that has not already been queried this session, call `listMcpAppTools(toolset.id, 'toolset')` against that toolset's real, bucket-qualified id (not the bare display name, which does not resolve on Core).
3. For each returned tool, set `McpAppToolRef.mcpToolName` to the tool's real, unprefixed name (as returned by `listMcpAppTools`) and `McpAppToolRef.toolName` to `` `${toolset.displayName}_${toolName}` `` — the former is what `useOpenMcpAppCanvas` passes to `AppRenderer`/`onToolCall` (the mounted app only recognizes its own real name), the latter is what `findMcpAppForMessage`/`resolveMcpAppToolCallSeed`'s name-matching (`design.md` D8) compares against the message's tool-call name. Passing the re-prefixed `toolName` to `AppRenderer` instead of `mcpToolName` was a confirmed bug (design.md D9): the mounted app silently ignores a seed addressed to a name it doesn't recognize, rendering with no `toolInput`/`toolResult` despite a real, matched tool call.

This indirect source only ever adds entries alongside the direct source above; a toolset/application that already declares `features.mcp` is discovered exactly as before, with `mcpToolName === toolName`.

#### Scenario: Application without its own MCP support resolves an internally-delegated toolset by name

- **WHEN** `deployment.features.mcp` is not `true`, a message's real tool-call data names a call `weather_get_weather`, and `toolsets` includes a toolset with `displayName: 'weather'`, `id: 'toolsets/{bucket}/weather__0.0.1'`
- **THEN** `useMcpAppTools` calls `listMcpAppTools('toolsets/{bucket}/weather__0.0.1', 'toolset')` and, if it returns a tool `{ toolName: 'get_weather', resourceUri: 'ui://weather/mcp-app.html' }`, includes `{ toolsetId: 'toolsets/{bucket}/weather__0.0.1', resourceUri: 'ui://weather/mcp-app.html', toolName: 'weather_get_weather', mcpToolName: 'get_weather' }` in the result

#### Scenario: `AppRenderer` receives the tool's real name, not the correlation name

- **WHEN** `useOpenMcpAppCanvas` opens the canvas for a `McpAppToolRef` discovered indirectly, with `toolName: 'weather_get_weather'` and `mcpToolName: 'get_weather'`
- **THEN** the `McpAppCanvasContent` passed to `openCanvas` has `toolName: 'get_weather'`, not `'weather_get_weather'`

#### Scenario: No toolset name prefixes a collected tool-call name

- **WHEN** no toolset's `displayName` prefixes any tool-call name collected from `messages`
- **THEN** `useMcpAppTools` issues no additional `listMcpAppTools` requests beyond the direct-discovery source

#### Scenario: A toolset already queried this session is not re-queried

- **WHEN** the same toolset id was already resolved via indirect discovery for this deployment
- **THEN** a subsequent render with new messages does not re-issue `listMcpAppTools` for that same toolset id

---

### Requirement: Each assistant message is matched against the discovered tools at the message level, not via `Stage`

**Revised** (supersedes stage-based correlation — see `design.md` D5, third revision). `apps/chat/src/utils/mcp-app.ts`'s `findMcpAppForMessage(message, mcpAppTools)` SHALL:

1. Return `undefined` immediately if `mcpAppTools` is empty or `message.role` is not `MessageRole.Assistant`.
2. Read `message.custom_content.state` and, via `resolveToolCalls` (see the tool-call-data requirement below), collect the set of tool names actually called this turn from whichever of `tool_messages` or `tool_execution_history` is present.
3. Return the first entry of `mcpAppTools` whose `toolName` is in that set.
4. If no real call matches (including when neither field is present — e.g. an orchestrator outside the two known shapes), fall back to `mcpAppTools[0]` — preserving "the trigger is always available once the deployment supports it" regardless of whether tool-call correlation data exists for this specific message.

#### Scenario: Assistant message with a matched real tool call

- **WHEN** `message.custom_content.state.tool_messages` (or, equivalently, `state.tool_execution_history`) includes a call to a tool named `refresh_data`, and `mcpAppTools` contains an entry with `toolName: 'refresh_data'`
- **THEN** `findMcpAppForMessage` returns that entry

#### Scenario: Assistant message with no tool-call data falls back to the first discovered tool

- **WHEN** `message.custom_content.state` is `undefined` and `mcpAppTools` is non-empty
- **THEN** `findMcpAppForMessage` returns `mcpAppTools[0]`

#### Scenario: Non-assistant message never matches

- **WHEN** `message.role` is `MessageRole.User` or `MessageRole.System`
- **THEN** `findMcpAppForMessage` returns `undefined` regardless of `mcpAppTools` or `custom_content`

---

### Requirement: The message body renders an always-visible inline preview when a match is found, with a manual expand-to-canvas button

**Revised four times** (supersedes the original `StageItem`-hosted action, the intermediate `MessageActions`-bar placement, the `Stage`-keyed lookup, and the unconditional-auto-open posture — see `design.md` D5, fourth revision / D11). Neither `libs/conversation-stages` (`StageItem`/`StagesPanel`/`CollapsedGroup`) nor `libs/conversation-messages` (`MessageActionsProps`/`MessageActions.tsx`) carry any MCP-Apps-related field. The trigger is `apps/chat/src/components/ConversationView/McpAppInlinePreview/McpAppInlinePreview.tsx`, rendered directly by `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx` inside the message's `afterContent`, immediately below the `CollapsedGroup` stages block.

`ConversationMessageItem.tsx` SHALL compute `mcpAppMatch = findMcpAppForMessage(msg, mcpAppTools)` and, when both `mcpAppMatch` and an `onOpenApp` callback are available and the message's canvas is not currently open (`!isMcpAppOpenedInCanvas`), render `McpAppInlinePreview` with `match={mcpAppMatch}`, `toolCall={resolveMcpAppToolCallSeed(msg, mcpAppMatch.toolName)}`, the shared `cache` (`McpAppResponseCache`, see the response-cache requirement below), `cacheKey={mcpAppCanvasKey(index)}`, and `onExpand={() => onOpenApp(mcpAppMatch, mcpAppKey, toolCall)}`. When the message's canvas *is* currently open, a placeholder ("Opened in Canvas") renders instead of the inline preview.

`McpAppInlinePreview` (backed by `useMcpAppInlinePreview`) independently fetches the resource HTML and resolves the tool result — it does not touch `AttachmentCanvas`'s panel/loading-state machinery, so it can render alongside the message instead of taking over a side panel. It renders:

- Nothing (`null`), when `useMcpAppSandboxUrl()` is unavailable (no sandbox proxy configured) or `match` is absent — matching `useOpenMcpAppCanvas`'s own no-op posture in that case. This status SHALL be computed synchronously on the initial render (not only inside an effect), so an unconfigured sandbox never renders any part of the preview box, even for a single frame.
- A bordered box spanning the full available width, sized to the mounted app's actual content height (not fixed-height), with a header strip above the app's rendered content containing a reload button (`IconRefresh`) and an expand-to-canvas button (`IconArrowsMaximize`, calling `onExpand`) — the header sits outside the app's content so it can never be overlapped by whatever the app draws.
- A loading spinner, an error message, or the mounted `McpAppCanvasRenderer` inside that box, depending on fetch/resolve status.

#### Scenario: Message with a matched tool shows the inline preview below its stages

- **WHEN** `findMcpAppForMessage` returns a match for a message, `onOpenApp` is supplied to `ConversationMessageItem`, and the message's canvas is not open
- **THEN** `McpAppInlinePreview` is rendered immediately below the `CollapsedGroup` stages block, full-width, sized to its content

#### Scenario: Message without a match shows no inline preview

- **WHEN** `findMcpAppForMessage` returns `undefined` for a message
- **THEN** no inline preview is rendered

#### Scenario: onOpenApp omitted hides the inline preview even when a match is found

- **WHEN** a message has a match but the caller does not pass `onOpenApp`
- **THEN** no inline preview is rendered

#### Scenario: No sandbox proxy configured hides the inline preview entirely, with no flash

- **WHEN** `useMcpAppSandboxUrl()` returns unavailable for a message with a match
- **THEN** `McpAppInlinePreview` renders nothing, from its very first render — not even a loading spinner for one frame

#### Scenario: Expanding the inline preview opens the full-width canvas

- **WHEN** the user activates the inline preview's expand button
- **THEN** `onOpenApp` is called with the message's matched tool, canvas key, and tool-call seed, opening `AttachmentCanvas`

---

### Requirement: The canvas never opens automatically; it is reached only via the inline preview's expand button

**Reversed** (supersedes the third revision's auto-open behavior — see `design.md` D5, fourth revision / D11). `apps/chat/src/hooks/attachment/useAutoOpenMcpAppCanvas.ts` and `apps/chat/src/utils/mcp-app.ts`'s `findLastMcpAppMessage` SHALL NOT exist in the codebase — no message's MCP App canvas opens without an explicit user action. `ConversationView.tsx` SHALL NOT call any auto-open hook.

The full-width canvas (`AttachmentCanvas`) opens only when the user activates a matched message's inline preview's expand-to-canvas button (previous requirement), or its reload button while already expanded (see the response-cache requirement below).

#### Scenario: A new matched message never opens the canvas by itself

- **WHEN** the conversation's message list gains a new message for which `findMcpAppForMessage` returns a match
- **THEN** `openMcpAppCanvas` is not called for that match unless the user activates the inline preview's expand button

#### Scenario: Multiple matched messages each only ever show their own inline preview

- **WHEN** the conversation contains more than one message with a match
- **THEN** each such message renders its own inline preview; none of them opens the full-width canvas without its own explicit expand click

---

### Requirement: `useOpenMcpAppCanvas` hook opens the canvas for a discovered tool's UI resource

**Revised twice** (supersedes the `Stage`-keyed signature, and the earlier no-cache/`displayMode: 'inline'` version — see `design.md` D5 third revision, D11, D12). `apps/chat/src/hooks/attachment/useOpenMcpAppCanvas.ts` SHALL accept a shared `McpAppResponseCache` (see the response-cache requirement below) and expose `openMcpAppCanvas(match: McpAppToolRef, canvasKey?: string, toolCall?: McpAppToolCallSeed, forceReload = false): Promise<boolean>`, following the `openCanvas`/`AttachmentCanvasContext` pattern already used by `useOpenAttachmentCanvas`.

The hook builds its `hostContext` via the shared `useMcpAppHostContext('fullscreen')` (see below) — **not** `'inline'`; the canvas is the full-width, take-over-the-panel presentation, and `'inline'` is reserved for the message-body preview (previous requirement).

Steps:

1. Return `false` immediately if `mcpAppSandboxUrl` (from `AppConfigContext`, see `mcp-app-sandbox-proxy`) is unavailable — no sandbox proxy deployed/configured means this feature cannot render safely, same "absence isn't failure" posture as `mcp_apps.domain_override`.
2. Call `closePanel()` and `closeSourcesPanel()` synchronously (same mutual-exclusivity contract as every other canvas trigger in the `canvas` capability), then `openCanvasLoading(title, canvasKey)` where `title` is the fixed `AttachmentCanvasI18nKeys.McpAppTitle` string, not any per-tool or per-stage name.
3. Compute `seedKey = computeMcpAppSeedKey(toolCall)` and, unless `forceReload` or `canvasKey` is absent, check `cache.get(canvasKey, seedKey)`. On a hit, reuse its `html`/`toolResult` and skip steps 4–5's fetch/re-call. On a miss, call `fetchMcpAppResourceHtml(match.toolsetId, match.resourceUri)` (`mcp-app-proxy-api` client wrapper, `apps/chat/src/server-api/mcp-apps.ts`) and `resolveMcpAppToolResult(match, toolCall)` (D10's live-re-call workaround), then `cache.set(canvasKey, {html, toolResult}, seedKey)`.
4. On success, build an `McpAppCanvasContent` with `html`, `sandboxUrl: mcpAppSandboxUrl`, `toolName: match.mcpToolName` (real name, not correlation name — see `mcp-app-trigger` tool-discovery requirement), `toolInput: toolCall?.toolInput`, `toolResult` (from step 3), `hostContext` (the `'fullscreen'` `McpUiHostContext` above), `onToolCall` bound to a `apps/chat/src/server-api/mcp-apps.ts` wrapper that POSTs to the tool-call-forwarding endpoint with `match.toolsetId`, and `onReload` bound to a closure that invalidates the cache entry (`cache.invalidate(canvasKey)`) and re-invokes `openMcpAppCanvas` with `forceReload: true`. Call `openCanvas(content, title, canvasKey)` and return `true`.
5. On failure (the fetch rejects or resolves with an error status), call `closeCanvas()` and return `false`.

`useMcpAppHostContext(displayMode: 'inline' | 'fullscreen')` (`apps/chat/src/hooks/attachment/useMcpAppHostContext.ts`) is the single source of the `McpUiHostContext` (imported from `@modelcontextprotocol/ext-apps/app-bridge`) both the canvas and the inline preview build from, populated as follows — this is the UI context delivered to the View during `ui/initialize`:
   - `theme`: `mcpAppTheme ?? currentTheme` (`AppConfigContext`/`ThemeContext`) — admin override when set, otherwise the user's active theme.
   - `locale`: `i18n.language` — the active BCP 47 locale tag.
   - `timeZone`: `Intl.DateTimeFormat().resolvedOptions().timeZone` — the user's IANA timezone.
   - `userAgent`: `mcpAppUserAgent ?? 'ai-dial-chat'` — admin-configurable host identifier (`MCP_APP_USER_AGENT` env var, from `AppConfigContext.config.mcpAppUserAgent`); falls back to `'ai-dial-chat'` when unset.
   - `platform`: `'web'` — static platform type.
   - `displayMode`: the caller-supplied `'inline'` or `'fullscreen'` — `'fullscreen'` for `useOpenMcpAppCanvas`, `'inline'` for `useMcpAppInlinePreview`.
   - `styles.variables`: a `Partial<Record<McpUiStyleVariableKey, string>>` built by reading each `McpUiStyleVariableKey` from `getComputedStyle(document.documentElement)` (calling `getPropertyValue(key).trim()`) and omitting keys whose resolved value is the empty string. The app SHALL define CSS variables with the exact `McpUiStyleVariableKey` names (e.g. `--color-background-primary`, `--color-text-primary`, …) mapped from its own design-token system in a global stylesheet, so that this read produces a complete set of theme values for the hosted View. `McpUiStyleVariableKey` is the union type of all standardized MCP UI CSS variable names (backgrounds, text, borders, rings, typography, border-radius/width, shadows) exported from `@modelcontextprotocol/ext-apps/app-bridge`.

For the canvas specifically (`displayMode: 'fullscreen'`), `McpAppCanvasRenderer` additionally watches its own root element with a `ResizeObserver` and merges the live pixel size into `hostContext.containerDimensions` before it reaches `AppRenderer` — every resize of the canvas panel sends a live `ui/notifications/host-context-changed` message to the mounted app — and forces its iframe to `100%`/`100%` width/height via CSS so it fills the panel instead of sizing to the app's own reported content size (which is reserved for the inline preview). See `design.md` D12.

`ConversationView.tsx` SHALL create one `McpAppResponseCache` (`useMcpAppResponseCache(conversation.id)`) and pass it to `useOpenMcpAppCanvas`, and pass `openMcpAppCanvas` as the `onOpenApp` prop to `ConversationMessageItem`, which uses it (per the trigger requirement above) to build the inline preview's expand-button `onClick` handler. Nothing calls it automatically (see the no-auto-open requirement above).

**Memoization:** `openMcpAppCanvas` SHALL be wrapped in `useCallback`, matching `useOpenAttachmentCanvas`'s existing hooks.

**i18n:** the loading/error labels shown while resolving the resource reuse the existing `AttachmentCanvasI18nKeys` (`AriaLabel`, `LoadErrorLabel`) — no new keys are needed for the canvas chrome. `AttachmentCanvasI18nKeys.ExpandAppLabel` (`en.json` value: `"Expand app"`) labels the inline preview's expand button; `AttachmentCanvasI18nKeys.McpAppTitle` (`"MCP App"`) is used as the canvas title; the shared `ButtonsI18nKeys.Reload` (`"Reload"`) labels both the inline preview's and the canvas's reload actions.

#### Scenario: Successful resolution opens the canvas

- **WHEN** `openMcpAppCanvas` is called for a valid `McpAppToolRef`, `mcpAppSandboxUrl` is available, and the cache misses and `fetchMcpAppResourceHtml` succeeds
- **THEN** `AttachmentCanvasContext.content` becomes an `McpAppCanvasContent` with the fetched `html`, `sandboxUrl: mcpAppSandboxUrl`, and `hostContext.displayMode: 'fullscreen'`
- **AND** the function resolves to `true`

#### Scenario: A cache hit skips the fetch and live re-call

- **WHEN** `openMcpAppCanvas` is called with a `canvasKey` and `toolCall` whose `computeMcpAppSeedKey` matches a still-fresh (under 15 minutes old) cache entry for that key, and `forceReload` is not set
- **THEN** the cached `html`/`toolResult` are reused, and neither `fetchMcpAppResourceHtml` nor `resolveMcpAppToolResult` is called

#### Scenario: Resource fetch failure shows an error state in the still-open canvas

- **WHEN** `fetchMcpAppResourceHtml` rejects (network error) or resolves with a non-OK status
- **THEN** the canvas stays open and its content becomes an `ErrorCanvasContent` (`errorType: Forbidden` for an HTTP `403`, `LoadFailed` otherwise), with a `label` override so the message reads "Failed to load MCP App" / the MCP-App-specific permission message rather than the generic per-file wording
- **AND** the function resolves to `false`

#### Scenario: No sandbox proxy configured is a no-op

- **WHEN** `openMcpAppCanvas` is called for a valid `McpAppToolRef` but `mcpAppSandboxUrl` is unavailable
- **THEN** no panel state changes, no fetch is issued
- **AND** the function resolves to `false`

---

### Requirement: A per-conversation response cache is seed- and TTL-aware, so a settling tool-call seed always triggers exactly one fresh fetch/re-call

**Added** (`design.md` D12, plus the seed-mismatch fix and namespaced-key revision in D12's follow-ups). `apps/chat/src/hooks/attachment/useMcpAppResponseCache.ts`'s `useMcpAppResponseCache(conversationId)` SHALL hold one shared `Map<string, {html, toolResult, seedKey, cachedAt}>` across all conversations, keyed by `` `${conversationId}:${mcpAppCanvasKey}` `` rather than reset per conversation — an entry for one `conversationId` is never returned by `get` for a different `conversationId`, since the namespaced key never matches. `set` SHALL opportunistically delete any entry older than the TTL (below) on every write, bounding the shared map's size without a per-conversation reset. `ConversationView` SHALL create exactly one instance and share it between `useOpenMcpAppCanvas` and (via a required `mcpAppCache` prop on `ConversationMessageItem`) `useMcpAppInlinePreview`, so the inline preview and the canvas reuse the same fetch/live-tool-recall for a given message.

`get(key, seedKey)` SHALL return `undefined` (a miss) — never a cached entry — when: no entry exists for `key`; the stored entry's `seedKey` does not equal the requested `seedKey`; or more than 15 minutes have elapsed since the entry was written (`cachedAt`). `seedKey` SHALL be computed by `apps/chat/src/utils/mcp-app.ts`'s `computeMcpAppSeedKey(toolCall)` — `undefined` when `toolCall` itself is `undefined` (a message whose `custom_content.state` has not yet arrived), otherwise `JSON.stringify(toolCall.toolInput ?? null)`.

This exists because a freshly-streamed assistant message mounts its inline preview before `custom_content.state` carries a real tool call, writing a seedless entry (`seedKey: undefined`, `toolResult: undefined`); without seed-awareness, that entry would be served forever once the message settled and a real seed became available, permanently skipping D10's live tool re-call.

`invalidate(key)` SHALL delete the entry unconditionally, used by both surfaces' reload actions.

#### Scenario: A seedless entry is not reused once the seed settles

- **WHEN** an entry for `key` was written with `seedKey: undefined` (message not yet settled), and a later call to `get(key, seedKey)` passes a defined `seedKey` (the message has since settled to a real tool call)
- **THEN** `get` returns `undefined`, so the caller re-fetches and re-resolves the tool result

#### Scenario: A matching, fresh seed is served from cache

- **WHEN** `get(key, seedKey)` is called with the same `seedKey` an entry for `key` was `set` with, less than 15 minutes ago
- **THEN** `get` returns that entry's `html`/`toolResult`

#### Scenario: An entry older than 15 minutes is treated as a miss

- **WHEN** `get(key, seedKey)` is called with a matching `seedKey`, but the entry was `set` more than 15 minutes ago
- **THEN** `get` returns `undefined`

#### Scenario: Entries are namespaced per conversation

- **WHEN** an entry was `set` for `key` under one `conversationId`, and `useMcpAppResponseCache` is later called with a different `conversationId`
- **THEN** `get(key, seedKey)` under the new `conversationId` returns `undefined`, regardless of `seedKey`, since it resolves a differently-namespaced map entry

---

### Requirement: Real tool-call input/result data seeds the mounted app from `custom_content.state`, in either of two known orchestrator shapes

**Revised** (supersedes the earlier markdown-regex-parsing workaround and the `tool_messages`-only version of this requirement — see `design.md` D8). `apps/chat/src/utils/mcp-app.ts`'s `resolveToolCalls(state)` SHALL normalize whichever of `state.tool_messages` (LangChain-style) or `state.tool_execution_history` (OpenAI chat-completion-style) is present into one internal `Map<tool_call_id, { name, args, result? }>`:

- For `tool_messages`: pair each `type: 'ai'` entry's `tool_calls[].{name,args,id}` with the matching `type: 'tool'` entry's `{tool_call_id, content}`.
- For `tool_execution_history`: pair each `role: 'assistant'` entry's `tool_calls[].{id, function: {name, arguments}}` with the matching `role: 'tool'` entry's `{tool_call_id, content}`; `function.arguments` is a JSON-encoded string and SHALL be parsed into an object (falling back to `{}` if parsing fails or the parsed value isn't an object) before use as `args`.

`resolveMcpAppToolCallSeed(message, toolName)` SHALL find the resolved pair whose `name` equals `toolName` and return `{ toolInput: <args>, toolResult: { content: [{ type: 'text', text: <result content> }] } }` — or `undefined` if `state` is absent or no pair matches. `findMcpAppForMessage` SHALL likewise collect called-tool names from `resolveToolCalls(state)` rather than reading `tool_messages` directly, so both orchestrator shapes drive tool discovery/matching identically.

`libs/chat-shared`'s `Message.custom_content` SHALL include an optional `state?: MessageState` field: `MessageState { tool_messages?: ToolStateMessage[]; tool_execution_history?: ToolExecutionHistoryMessage[] }`, `ToolStateMessage { type: string; name?: string; tool_calls?: ToolCallRequest[]; tool_call_id?: string; content?: string }`, `ToolCallRequest { name: string; args: Record<string, unknown>; id: string }`, `ToolExecutionHistoryMessage { role: string; tool_calls?: OpenAiToolCall[]; tool_call_id?: string; content?: string }`, `OpenAiToolCall { id: string; type: string; function: { name: string; arguments: string } }`. Both fields are wire-verbatim and orchestrator-specific — a given orchestrator is expected to emit at most one (confirmed: `tool_messages` for the StatGPT agent, `tool_execution_history` for a second, unrelated app; neither is a general DIAL Core or MCP Apps spec guarantee). Both `apps/chat-api/src/conversations/utils/apply-chunk.server.ts` and `apps/chat/src/utils/apply-chunk.ts` SHALL extract `delta.custom_content.state` from SSE chunks and merge it wholesale (replace, not accumulate) into `Message.custom_content.state`, alongside the existing `stages`/`attachments`/`form_schema`/`annotations` handling.

#### Scenario: Matching tool_messages pair seeds toolInput and toolResult

- **WHEN** `message.custom_content.state.tool_messages` contains an `'ai'` entry with `tool_calls: [{ name: 'refresh_data', args: { location: 'London' }, id: 'call-1' }]` and a `'tool'` entry with `{ tool_call_id: 'call-1', content: 'ok' }`
- **THEN** `resolveMcpAppToolCallSeed(message, 'refresh_data')` returns `{ toolInput: { location: 'London' }, toolResult: { content: [{ type: 'text', text: 'ok' }] } }`

#### Scenario: Matching tool_execution_history pair seeds toolInput and toolResult, parsing the JSON arguments string

- **WHEN** `message.custom_content.state.tool_execution_history` contains a `role: 'assistant'` entry with `tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'weather_get_weather', arguments: '{"location":"Kyiv, UA"}' } }]` and a `role: 'tool'` entry with `{ tool_call_id: 'call-1', content: 'Weather in Kyiv: ...' }`
- **THEN** `resolveMcpAppToolCallSeed(message, 'weather_get_weather')` returns `{ toolInput: { location: 'Kyiv, UA' }, toolResult: { content: [{ type: 'text', text: 'Weather in Kyiv: ...' }] } }`

#### Scenario: Neither field present yields no seed

- **WHEN** `message.custom_content.state` is `undefined`
- **THEN** `resolveMcpAppToolCallSeed` returns `undefined`

#### Scenario: Chunk with a state field reaches the persisted message

- **WHEN** an SSE delta arrives with `custom_content.state.tool_messages` or `custom_content.state.tool_execution_history` populated
- **THEN** the merged `Message.custom_content.state` reflects that same data, on both the live-streaming path and the persisted/reloaded path

---

### Requirement: No feature-flag gating

The inline preview SHALL NOT be gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` — availability is driven entirely by whether `useMcpAppTools` discovered any UI-capable tool for the active deployment (which itself depends on the upstream MCP tool declaring a UI resource) and whether a sandbox proxy is configured (`useMcpAppSandboxUrl`).

**RTL impact:** none — the preview box is a normal block-level element in the message flow, direction-agnostic.

#### Scenario: Available whenever the deployment has a discovered tool and a sandbox proxy is configured, without any flag check

- **WHEN** `useMcpAppTools` returns a non-empty array for the active deployment, and `useMcpAppSandboxUrl()` is available
- **THEN** the inline preview is shown (via the `mcpAppTools[0]` fallback at minimum), regardless of any `ENABLED_FEATURES` configuration
