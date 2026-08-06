## ADDED Requirements

### Requirement: Real MCP App tools are discovered per-deployment via `tools/list`, keyed by tool name

**Revised** (supersedes the original `Stage.mcp_app` design — see `design.md` D5, third revision). DIAL Core does not attach a UI resource reference to individual stages/tool-call results; the UI resource is a property of the **tool's declaration**, returned by the MCP `tools/list` method as `_meta.ui.resourceUri`. `apps/chat/src/hooks/conversation/useMcpAppTools.ts`'s `useMcpAppTools(deployment)` SHALL, whenever `deployment.features.mcp === true` and `deployment.type` is `'toolset'` or `'application'`, call `listMcpAppTools` (`apps/chat/src/server-api/mcp-apps.ts`, backed by `apps/chat-api`'s `GET /api/v1/toolsets/mcp-apps/tools`) and keep the full list of matching tools as `McpAppToolRef[]`, each `{ toolsetId: string; resourceUri: string; toolName: string }`.

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

### Requirement: The message body renders a normal-size primary "Open App" button below the stages when a match is found

**Revised three times** (supersedes the original `StageItem`-hosted action, the intermediate `MessageActions`-bar placement, and the `Stage`-keyed lookup — see `design.md` D5). Neither `libs/conversation-stages` (`StageItem`/`StagesPanel`/`CollapsedGroup`) nor `libs/conversation-messages` (`MessageActionsProps`/`MessageActions.tsx`) carry any MCP-Apps-related field. The trigger is a plain `PrimaryButton` rendered directly by `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx`, inside the message's `afterContent`, immediately below the `CollapsedGroup` stages block.

`ConversationMessageItem.tsx` SHALL compute `mcpAppMatch = findMcpAppForMessage(msg, mcpAppTools)` and, when both `mcpAppMatch` and an `onOpenApp` callback are available, render `<PrimaryButton label={openCanvasLabel} onClick={() => onOpenApp(mcpAppMatch, mcpAppKey, resolveMcpAppToolCallSeed(msg, mcpAppMatch.toolName))} />` with **no `size` prop** — it uses `PrimaryButton`'s default size (`ElementSize.Standard`), not the small size used by icon-row actions elsewhere in the message. The label reads "Open App" (`AttachmentCanvasI18nKeys.OpenAppLabel`).

#### Scenario: Message with a matched tool shows the Open App button below its stages

- **WHEN** `findMcpAppForMessage` returns a match for a message, and `onOpenApp` is supplied to `ConversationMessageItem`
- **THEN** a `PrimaryButton` labeled "Open App" is rendered immediately below the `CollapsedGroup` stages block, at default (non-small) size

#### Scenario: Message without a match shows no Open App button

- **WHEN** `findMcpAppForMessage` returns `undefined` for a message
- **THEN** no "Open App" button is rendered

#### Scenario: onOpenApp omitted hides the action even when a match is found

- **WHEN** a message has a match but the caller does not pass `onOpenApp`
- **THEN** no "Open App" button is rendered

---

### Requirement: The canvas auto-opens for the last message with a matched tool

**Revised** (supersedes the original manual-only posture and the stage-keyed guard — see `design.md` D5, revised). `apps/chat/src/hooks/attachment/useAutoOpenMcpAppCanvas.ts`'s `useAutoOpenMcpAppCanvas(messages, mcpAppTools)` SHALL, on every `messages`/`mcpAppTools` change, locate the last message (by index) for which `findMcpAppForMessage` returns a match (`apps/chat/src/utils/mcp-app.ts`'s `findLastMcpAppMessage`, scanning newest-first) and call `openMcpAppCanvas` for that match — without requiring a click.

**Once-per-message guard:** the hook SHALL track the most recently auto-opened message via a key (`` `${messageIndex}:mcp-app` ``, from `mcpAppCanvasKey(messageIndex)`) in a ref, and SHALL only call `openMcpAppCanvas` when that key changes — so a rerender that doesn't introduce a *new* matched message does not reopen a canvas the user has since closed.

**Manual override:** the "Open App" button (previous requirement) remains available regardless of auto-open state, so the user can reopen a closed canvas or open an earlier message's app instead of the auto-opened last one.

#### Scenario: A new matched message auto-opens the canvas

- **WHEN** the conversation's message list gains a new message for which `findMcpAppForMessage` returns a match, and no other message has already been auto-opened for that exact message index
- **THEN** `openMcpAppCanvas` is called for that match without any user click

#### Scenario: Multiple matched messages only auto-open the last one

- **WHEN** the conversation contains more than one message with a match
- **THEN** only the last such message's match is passed to `openMcpAppCanvas`

#### Scenario: Closing the auto-opened canvas is not immediately reversed by an unrelated rerender

- **WHEN** the user closes the canvas that was auto-opened for a given message, and `messages` re-renders without introducing a new matched message
- **THEN** `openMcpAppCanvas` is not called again for that same message

---

### Requirement: `useOpenMcpAppCanvas` hook opens the canvas for a discovered tool's UI resource

**Revised** (supersedes the `Stage`-keyed signature — see `design.md` D5, third revision). `apps/chat/src/hooks/attachment/useOpenMcpAppCanvas.ts` SHALL expose `openMcpAppCanvas(match: McpAppToolRef, canvasKey?: string, toolCall?: McpAppToolCallSeed): Promise<boolean>`, following the `openCanvas`/`AttachmentCanvasContext` pattern already used by `useOpenAttachmentCanvas`:

1. Return `false` immediately if `mcpAppSandboxUrl` (from `AppConfigContext`, see `mcp-app-sandbox-proxy`) is unavailable — no sandbox proxy deployed/configured means this feature cannot render safely, same "absence isn't failure" posture as `mcp_apps.domain_override`.
2. Call `closePanel()` and `closeSourcesPanel()` synchronously (same mutual-exclusivity contract as every other canvas trigger in the `canvas` capability), then `openCanvasLoading(title, canvasKey)` where `title` is the fixed `AttachmentCanvasI18nKeys.McpAppTitle` string, not any per-tool or per-stage name.
3. Call `fetchMcpAppResourceHtml(match.toolsetId, match.resourceUri)` (`mcp-app-proxy-api` client wrapper, `apps/chat/src/server-api/mcp-apps.ts`) — a GET against the `mcp-app-resource` route, resolving to the response body's text.
4. On success, build an `McpAppCanvasContent` with `html` set to the fetched text, `sandboxUrl: mcpAppSandboxUrl`, `toolName: match.toolName`, `toolInput: toolCall?.toolInput`, `toolResult: toolCall?.toolResult`, and `onToolCall` bound to a `apps/chat/src/server-api/mcp-apps.ts` wrapper that POSTs to the tool-call-forwarding endpoint with `match.toolsetId`. Call `openCanvas(content, title, canvasKey)` and return `true`.
5. On failure (the fetch rejects or resolves with an error status), call `closeCanvas()` and return `false`.

`ConversationView.tsx` SHALL pass `openMcpAppCanvas` as the `onOpenApp` prop to `ConversationMessageItem`, which uses it (per the trigger requirement above) to build the in-message "Open App" button's `onClick` handler, and separately calls it directly from the auto-open hook.

**Memoization:** `openMcpAppCanvas` SHALL be wrapped in `useCallback`, matching `useOpenAttachmentCanvas`'s existing hooks.

**i18n:** the loading/error labels shown while resolving the resource reuse the existing `AttachmentCanvasI18nKeys` (`AriaLabel`, `LoadErrorLabel`) — no new keys are needed for the canvas chrome. A key `AttachmentCanvasI18nKeys.OpenAppLabel` (`en.json` value: `"Open App"`) is added for the message action's visible text, and a separate `AttachmentCanvasI18nKeys.McpAppTitle` (`"MCP App"`) is used as the canvas title.

#### Scenario: Successful resolution opens the canvas

- **WHEN** `openMcpAppCanvas` is called for a valid `McpAppToolRef`, `mcpAppSandboxUrl` is available, and `fetchMcpAppResourceHtml` succeeds
- **THEN** `AttachmentCanvasContext.content` becomes an `McpAppCanvasContent` with the fetched `html` and `sandboxUrl: mcpAppSandboxUrl`
- **AND** the function resolves to `true`

#### Scenario: Resource fetch failure shows an error state in the still-open canvas

- **WHEN** `fetchMcpAppResourceHtml` rejects (network error) or resolves with a non-OK status
- **THEN** the canvas stays open and its content becomes an `ErrorCanvasContent` (`errorType: Forbidden` for an HTTP `403`, `LoadFailed` otherwise), with a `label` override so the message reads "Failed to load MCP App" / the MCP-App-specific permission message rather than the generic per-file wording
- **AND** the function resolves to `false`

#### Scenario: No sandbox proxy configured is a no-op

- **WHEN** `openMcpAppCanvas` is called for a valid `McpAppToolRef` but `mcpAppSandboxUrl` is unavailable
- **THEN** no panel state changes, no fetch is issued
- **AND** the function resolves to `false`

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

The "Open App" trigger and its auto-open behavior SHALL NOT be gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` — availability is driven entirely by whether `useMcpAppTools` discovered any UI-capable tool for the active deployment, which itself depends on the upstream MCP tool declaring a UI resource.

**RTL impact:** none — the button is a normal block-level element in the message flow, direction-agnostic.

#### Scenario: Available whenever the deployment has a discovered tool, without any flag check

- **WHEN** `useMcpAppTools` returns a non-empty array for the active deployment
- **THEN** the "Open App" button is shown (via the `mcpAppTools[0]` fallback at minimum), and auto-open fires, regardless of any `ENABLED_FEATURES` configuration
