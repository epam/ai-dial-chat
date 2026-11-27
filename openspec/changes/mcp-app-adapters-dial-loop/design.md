# Design

## Context

See `proposal.md` for motivation. Today the chat decides whether to show an MCP App for an assistant message in three steps: discover the tools that declare `_meta.ui.resourceUri` (`useMcpAppTools` in `libs/chat-hooks`), match the message to one of them (`findMcpAppForMessage` in `libs/mcp-apps`), and build the seed and the tool result the app is mounted with (`resolveMcpAppToolCallSeed`, `resolveMcpAppToolResult`). The first two steps relied on quick-app signals: tool calls in `custom_content.state`, and tool names shaped `<ToolsetName>_<tool>`.

Observed for a DIAL loop application (local repro against a dev environment, logs read from chat-api):

- the application has `features.mcp: true` and `applicationTypeSchemaId` ending in `dial-loop`;
- its own `tools/list` returns nine loop-management tools with no `_meta.ui.resourceUri`;
- `custom_content.state` holds only session metadata, no tool calls;
- a tool call appears only as a stage, for example `show_entity_card (0.04s, Start: 12:45:41)`, with Markdown content: a `**Request**` bullet list, then a `**Response**` code block;
- the toolsets it uses are listed in `applicationProperties.toolsets`, which the chat already loads through `getDeploymentDetails` into `DeploymentsContext` (`selectedDeploymentDetails`).

DIAL Core will support MCP Apps natively later, so everything added for loops, and the quick-app logic already in place, is a temporary bridge.

## Goals / Non-Goals

**Goals:**

- A loop reply shows the same MCP App widget a quick-app reply does.
- Each kind of app's heuristic lives in one place, documented, and can be removed without touching generic code.
- No change in quick-app or direct behavior.
- Reuse existing helpers rather than adding parallel ones.

**Non-Goals:**

- Changing the loop, DIAL Core, or any backend endpoint.
- A live, interactive widget for loops (no re-call; the widget is a snapshot of the stage response).
- Reliable argument recovery from stage text.
- A plugin or registry API for third parties; the registry is an internal list.

## Decisions

**D1. One adapter per kind of app, in two halves.** The tool-call half (a pure function over a `Message`) lives in `libs/mcp-apps/src/adapters/<kind>/`; the discovery half (needs DIAL data shapes and the API client) lives in `libs/chat-hooks/src/mcp-apps/adapters/<kind>/`. The split follows the library isolation rules: `libs/mcp-apps` imports no API client and no host knowledge, while `libs/chat-hooks` is the lib allowed to adapt DIAL Core data and the generated client. Generic matching, seeding and rendering keep no heuristic. Removing a kind is deleting its two folders and its registry line plus its call in `useMcpAppTools`. Alternative: one folder per kind containing both halves in `libs/chat-hooks` and passing extractors into `libs/mcp-apps`: rejected because `findMcpAppForMessage` and the seed functions are called from the app and from `libs/mcp-apps` hooks, and would need a new injected parameter at every call site for no isolation gain.

**D1 note.** `libs/mcp-apps` now knows the DIAL loop display format (the timing suffix and the `**Request**`/`**Response**` markers). That is deliberate: the input is only a `Message`, and the quick-app `state` parsing is the precedent. If more adapters appear, the loop adapter is the first candidate to move into `libs/chat-hooks`.

**D2. First adapter that finds calls wins.** `extractMessageToolCalls` tries adapters in priority order (quick-app `state`, then DIAL loop stages) and returns the first non-empty result. A first version concatenated all adapters, which let stage text override a quick app's real arguments through the "last matching call wins" rule, and a live re-call would then have used lossy arguments. Priority order removes that interaction by construction. Alternative: concatenate and dedupe by name: rejected, it keeps the override risk.

**D3. Loop applicability is decided by discovery, not by extraction.** Extraction is keyed only on the stage format (content starts with `**Request**`), so it can run for any message and costs a cheap prefix check. A stage-reported call only matters if discovery produced a tool with that name, and discovery for loops runs only when the deployment details' schema id ends in `dial-loop`. The stage scan itself is also skipped unless the app is a loop with configured toolsets. Alternative: gate extraction by schema id in `libs/mcp-apps`: rejected, it would give that lib deployment knowledge.

**D4. Schema detection reuses the existing helper pattern.** `isDialLoopSchema` joins `isQuickAppSchema` and `isCustomAppSchema` in `libs/chat-hooks/src/shared/application-schema.ts`, using the same id-suffix matching and the same schema-like input (and the same open TODO about the lack of a capability field in Core). Alternative: a private check in the adapter: rejected (found in review as a duplicate).

**D5. Details must belong to the active deployment.** `useConversationMcpApps` passes `selectedDeploymentDetails` from `useDeployments`, which follows the globally selected deployment, while the conversation's deployment can be fixed to another one. `useMcpAppTools` ignores details whose `id` differs from the active deployment's id. No new context: state stays in `DeploymentsContext`.

**D6. Display-derived arguments are never replayed; a configured match is never re-called live and is seeded from the stage response.** `resolveMcpAppToolResult` treats only `direct` and `indirect` matches as safe to replay, and only with real arguments: a call recovered from a stage is marked display-derived, and that mark travels on the seed, so the rule follows where the data came from, not which adapter found the tool (a review caught that a `direct` match could otherwise replay stage text). A `direct` match with a display-derived seed is re-called with `{}`, and an `indirect` one is not re-called. The first implementation did re-call with arguments parsed from the stage and the tool answered "That entity no longer exists": the stage showed `Entity Card\_\_1.0.0` while the real id was `Entity%20Card__1.0.0` (escaped underscores, decoded `%20`). The seed's `toolResult` carries the response text plus `structuredContent` when the block parses as a JSON object, which is what the entity-card app reads. Alternatives: re-encode spaces and unescape (guesses that break for plain-text values), or call a different tool to look the entity up (tool-specific): both rejected.

**D7. Reuse over new utilities.** One `parseJsonObject` in `libs/mcp-apps/src/utils/json.ts` replaces the OpenAI-arguments parser in the quick-app adapter and a second copy that the loop adapter first had. Toolset id helpers (`isPublicToolsetId`) are reused from `libs/chat-hooks/src/oauth/toolset-id.ts`. No existing helper removes Markdown backslash escapes (the repo's helpers add them), so the small unescape stays in the loop adapter.

**D8. `Configured` stays in the shared `McpAppToolDiscovery` enum.** It is produced only by the loop adapter, and the live-call rule needs to tell it apart from `Indirect`. Moving it elsewhere would only add indirection.

## Risks / Trade-offs

- The stage text is display Markdown, not a contract → the loop adapter breaks if the format changes; one spec pins the current format and the docs name the assumption. Mitigation: the planned follow-up asks the loop for a structured tool-call record, after which the adapter is deleted.
- A loop widget is a snapshot of the printed response, not live → accepted for now; documented as a limit.
- Two configured toolsets exposing the same tool name resolve to the first → rare; documented.
- A response block that itself contains a code fence is cut at the first closing fence → a test documents it.
- The stage check runs on every `messages` change for a loop with toolsets (each streaming chunk) → it exits at the first stage that starts with `**Request**` and parses nothing.
- A failed listing of a configured toolset is retried only when the loop inputs change → matches the existing quick-app limitation.

## Migration Plan

Frontend-only; no data, API or config migration. Rollback is reverting the change. Quick-app and direct paths are covered by the unchanged discovery and matching tests.
