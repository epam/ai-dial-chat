# Spec Delta

## MODIFIED Requirements

### Requirement: Each assistant message is matched against the discovered tools at the message level, not via `Stage`

**Revised three times** (supersedes stage-based correlation — see `design.md` D5, third revision — and the always-fallback bug fixed as tasks.md item 14.1/14.2). `libs/mcp-apps/src/utils/mcp-app.ts`'s `findMcpAppForMessage(message, mcpAppTools)` SHALL:

1. Return `undefined` immediately if `mcpAppTools` is empty or `message.role` is not `MessageRole.Assistant`.
2. Collect the set of tool names actually called this turn from the tool calls the tool-call adapters recover from the message (see the adapter requirement below): `custom_content.state` (`tool_messages` or `tool_execution_history`) for a quick app, or a stage-reported call for a DIAL loop. The first adapter that finds any call wins.
3. Return the first entry of `mcpAppTools` whose `toolName` is the name of a call that already has a result, if any. A call without a result is still running; it never matches.
4. Otherwise, return the first entry of `mcpAppTools` whose `discovery` is `'direct'` (the deployment itself is the MCP server — regardless of `kind`, i.e. whether it's registered as a Toolset or an Application, see tasks.md 14.6), if any — such a deployment's own response IS its MCP App responding, and it typically never populates `custom_content.state` in the first place, so it can never satisfy step 3.
5. Otherwise, return `undefined`. There is no streaming-time guess: the signature is `findMcpAppForMessage(message, mcpAppTools)`. A message that has not yet reported a finished call to a discovered `discovery: 'indirect'` tool — still streaming or settled — never shows the trigger, even though the deployment supports MCP Apps in general.

**Fixed bugs**: step 5's former fallback applied unconditionally, so once any MCP-capable tool was discovered for the conversation, every settled assistant message showed the inline preview forever. A later revision limited it to streaming messages, but then every answer in a conversation that had already used a tool mounted the app while it streamed, whether or not it ever called that tool (issue 9518). The fallback is gone.

#### Scenario: Assistant message with a matched real tool call

- **WHEN** `message.custom_content.state.tool_messages` (or, equivalently, `state.tool_execution_history`) includes a call to a tool named `refresh_data`, and `mcpAppTools` contains an entry with `toolName: 'refresh_data'`
- **THEN** `findMcpAppForMessage` returns that entry

#### Scenario: Message with no tool-call data and only indirectly-discovered tools shows no preview

- **WHEN** `message.custom_content.state` is `undefined` and every entry of `mcpAppTools` has `discovery: 'indirect'`
- **THEN** `findMcpAppForMessage` returns `undefined`

#### Scenario: A call without a result yet shows no preview

- **WHEN** `message.custom_content.state` lists a call to a discovered `discovery: 'indirect'` tool but no result for it, for example while the answer is still streaming
- **THEN** `findMcpAppForMessage` returns `undefined`, so a later answer in a conversation that already used the tool does not mount the app before its own call has finished

#### Scenario: Message with no tool-call data still matches a self-hosted MCP App

- **WHEN** `message.custom_content.state` is `undefined` and `mcpAppTools` contains an entry with `discovery: 'direct'` (whatever its `kind`)
- **THEN** `findMcpAppForMessage` returns that `discovery: 'direct'` entry

#### Scenario: Non-assistant message never matches

- **WHEN** `message.role` is `MessageRole.User` or `MessageRole.System`
- **THEN** `findMcpAppForMessage` returns `undefined` regardless of `mcpAppTools` or `custom_content`

#### Scenario: A finished stage-reported tool call of a configured toolset matches

- **WHEN** the application is a DIAL loop, `message.custom_content.stages` has a stage named `show_entity_card (0.04s, Start: 12:45:41)` whose content holds a `**Request**` section and a `**Response**` code block, and `mcpAppTools` contains an entry with `discovery: 'configured'` and `toolName: 'show_entity_card'`
- **THEN** `findMcpAppForMessage` returns that entry

#### Scenario: A stage-reported call without a response shows no preview

- **WHEN** the stage has a `**Request**` section but no `**Response**` block yet, or its status is `failed`
- **THEN** `findMcpAppForMessage` returns `undefined`


---

## ADDED Requirements

### Requirement: Tool calls are read by one adapter per kind of app, and the first adapter that finds calls wins

Each kind of app that reports tool calls differently SHALL have its own adapter, with a tool-call half (reads a message) and a discovery half (finds the UI tools). The generic matching, seeding, live re-call and rendering SHALL contain no kind-specific heuristic, so an adapter can be replaced or removed without changing them. Adapters are tried in priority order and the first one that recovers any tool call from a message supplies all of that message's calls: the quick-app adapter (structured `custom_content.state`) comes before the DIAL loop adapter (`custom_content.stages`). A message that carries structured `state` SHALL therefore never have its tool calls, arguments or results replaced or mixed with text recovered from stages. Each adapter is temporary and SHALL be documented, with the assumption it relies on and the condition for removing it, in `docs/mcp-apps.md`.

#### Scenario: Structured state wins over stages in the same message

- **WHEN** a message has both `custom_content.state.tool_execution_history` with a finished call to `show_entity_card` (arguments `{"id":"real"}`) and a stage reporting `show_entity_card` with different request text
- **THEN** the seed's `toolInput` is `{ id: 'real' }` and its `toolResult` is the state's result

#### Scenario: A message with no structured calls falls through to the next adapter

- **WHEN** a message has no `tool_messages` or `tool_execution_history`, but has a stage-reported tool call
- **THEN** that stage-reported call is used

---

### Requirement: A DIAL loop application's configured toolsets are discovered once a stage reports a tool call

A DIAL loop application (its `applicationTypeSchemaId` ends in `dial-loop`) has `features.mcp === true`, but its own `tools/list` holds only loop-management tools, never the UI tools of the toolsets it uses. For such an application, `useMcpAppTools` SHALL read the toolset ids from the deployment details' `applicationProperties.toolsets` and, once at least one message in the conversation reports a tool call as a stage, call `listAppTools` with `kind: 'toolset'` for each configured toolset and keep the tools that declare `_meta.ui.resourceUri` as refs with `discovery: 'configured'`. The ref's `toolName` and `mcpToolName` SHALL both be the tool's real, unprefixed name, because a loop reports the raw tool name. The details SHALL be used only when their `id` equals the active deployment's id; details of another deployment are ignored. No toolset is queried before a stage-reported tool call exists, and none is queried for an application of any other kind. A failed listing for one toolset SHALL leave the others unaffected.

#### Scenario: Configured toolsets are listed after a stage reports a tool call

- **WHEN** the active deployment is a DIAL loop with `applicationProperties.toolsets` naming one toolset, and a message has a stage-reported tool call
- **THEN** `listAppTools` is called for that toolset with `kind: 'toolset'` and the result contains a ref with `discovery: 'configured'` and the tool's real name

#### Scenario: Nothing is queried before a stage-reported call

- **WHEN** the conversation has no stage-reported tool call
- **THEN** no configured toolset is queried

#### Scenario: Details of another deployment are ignored

- **WHEN** the deployment details' `id` differs from the active deployment's id
- **THEN** no configured toolset is queried

#### Scenario: Another application kind is not inspected

- **WHEN** the deployment details' `applicationTypeSchemaId` does not end in `dial-loop`
- **THEN** no configured toolset is queried, whatever its `applicationProperties`

---

### Requirement: A stage-reported tool call seeds the app from its printed response and is never re-called live

For a DIAL loop, a tool call is recovered from a stage whose content starts with a `**Request**` section (a bulleted list of `` `key`: value `` lines), optionally followed by a `**Response**` code block, with the tool's name being the stage name without its trailing ` (<seconds>s, Start: <time>)`. A stage with no `**Request**` section SHALL NOT be treated as a tool call, and a stage whose status is `failed` SHALL have no result. Request values that are valid JSON keep their type; other values are strings with Markdown escapes removed. The seed SHALL be `toolInput` from the request values and `toolResult` whose text `content` is the response block, plus `structuredContent` when the block parses as a JSON object. A `discovery: 'configured'` match SHALL NOT trigger a live re-call of the tool, because the stage text is display Markdown (escaped characters, decoded percent-escapes) and replaying it can address a different resource; the mounted app SHALL be seeded from the stage response instead. The stage text is not a contract, so `toolInput` is informational only: the seed SHALL be marked as display-derived, and a display-derived seed SHALL never supply arguments for a live re-call of any match, whatever its discovery kind. A `discovery: 'direct'` match with a display-derived seed SHALL be re-called with empty input, as when it has no seed, and a `discovery: 'indirect'` match with one SHALL NOT be re-called.

#### Scenario: Stage request and response seed the app

- **WHEN** a stage named `show_entity_card (0.04s, Start: 12:45:41)` has content with request bullets `` - `id`: dial-rag `` and `` - `limit`: 3 `` and a response block `{"entity":{"name":"DIAL RAG"}}`
- **THEN** the seed has `toolInput` `{ id: 'dial-rag', limit: 3 }` and a `toolResult` whose text is the response and whose `structuredContent` is `{ entity: { name: 'DIAL RAG' } }`

#### Scenario: Markdown escapes are removed from string request values

- **WHEN** a request bullet reads `` - `id`: Entity Card\_\_1.0.0 ``
- **THEN** the seed's `toolInput.id` is `Entity Card__1.0.0`

#### Scenario: A configured match never calls the tool

- **WHEN** `resolveMcpAppToolResult` receives a `discovery: 'configured'` match and a seed
- **THEN** it does not call `callTool` and returns the seed's `toolResult`

#### Scenario: A direct match never replays display-derived arguments

- **WHEN** `resolveMcpAppToolResult` receives a `discovery: 'direct'` match and a seed marked display-derived with `toolInput` `{ id: 'a' }`
- **THEN** it calls `callTool` with empty input `{}`, not with `{ id: 'a' }`

#### Scenario: An indirect match with display-derived arguments is not re-called

- **WHEN** `resolveMcpAppToolResult` receives a `discovery: 'indirect'` match and a display-derived seed
- **THEN** it does not call `callTool` and returns the seed's `toolResult`

#### Scenario: A non-tool stage is ignored

- **WHEN** a stage such as `Staging (1.86s, Start: 12:45:28)` has content without a `**Request**` section
- **THEN** it is not reported as a tool call
