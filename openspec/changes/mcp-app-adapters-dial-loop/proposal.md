# Proposal

## Why

MCP App widgets render in quick-app chats but not in DIAL loop chats, even though the loop's tool calls succeed. The chat finds a message's UI tool through quick-app-specific signals (tool calls in `custom_content.state`, tool names prefixed with the toolset's display name). A loop reports neither: it records a tool call only as a stage with display Markdown, and its own `tools/list` lists only loop-management tools. DIAL Core does not yet support MCP Apps for these apps natively, so a temporary, replaceable bridge is needed now, and the quick-app logic that was already a heuristic should be isolated the same way.

## What Changes

- Split the tool-call and discovery heuristics into one **adapter per kind of app**, so each can be replaced or deleted on its own when Core reports MCP App tool calls natively:
  - quick app (existing behavior, moved): tool calls from `custom_content.state`, toolset guessed by the `<ToolsetName>_<tool>` name prefix;
  - DIAL loop (new): tool calls recovered from `custom_content.stages`, UI tools discovered from the toolsets in the application's own configuration;
  - direct (existing behavior, moved): the deployment is itself the MCP server.
- Add DIAL loop support: a loop reply whose stage reports a finished tool call of a configured toolset shows the toolset's MCP App inline, seeded from the stage's printed response.
- A loop match is **never re-called live**: its arguments come from display Markdown and can differ from what the tool received. The app is seeded from the stage's `**Response**` block instead (text content plus `structuredContent` when the block is a JSON object).
- Adapter priority: the first adapter that finds tool calls in a message wins, so a quick app's structured `state` is never overridden by text recovered from stages.
- Reuse over new utilities: the loop check joins the existing schema helpers (`isQuickAppSchema` pattern), and one shared JSON-object parser serves both adapters.
- Document the adapters (applies to, assumption, remove when) in `docs/mcp-apps.md`.
- No **BREAKING** changes: quick-app and direct behavior is unchanged, public exports of `@epam/ai-dial-mcp-apps` are kept, and two are added (`collectDialLoopToolCallNames`, the `McpAppToolCall` type) plus one enum member (`McpAppToolDiscovery.Configured`).

Alternatives considered:

| Option | Verdict |
| --- | --- |
| Keep the heuristics in the shared functions and add the loop case inline | Rejected: ties three kinds of app together, so removing one later means editing shared code. |
| Ask the loop to write `tool_execution_history` into `state` | Not available now (needs the loop team); it would make the loop adapter unnecessary, and is the planned follow-up. |
| Live re-call of the tool with arguments parsed from the stage | Rejected after testing: the parsed id was escaped and decoded, so the tool looked up a different entity ("That entity no longer exists"). |
| One adapter per app kind, loop seeded from the stage response (chosen) | Smallest bridge that works today and is deletable later. |

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `mcp-app-trigger`: tool discovery and message matching gain a DIAL loop source and an adapter priority rule; seeding gains stage-derived data; the live re-call rule excludes loop matches.

## Impact

- `libs/mcp-apps`: `src/adapters/` (quick-app and DIAL loop tool-call extractors, registry), `src/utils/mcp-app.ts` (generic matching, seeding, live re-call), `src/utils/json.ts`, `src/models/mcp-apps.ts`, `src/types/mcp-apps.ts`, `src/index.ts`, README.
- `libs/chat-hooks`: `src/mcp-apps/adapters/` (direct, quick-app, DIAL loop discovery), `src/mcp-apps/useMcpAppTools/useMcpAppTools.ts`, `src/shared/application-schema.ts` (`isDialLoopSchema`), README.
- `apps/chat`: `src/hooks/conversation/useConversationMcpApps.ts` passes the selected deployment's details to the hook.
- `docs/mcp-apps.md`: new "Temporary adapters" section.
- No new backend endpoint, no generated-client change, no new environment variable, no new feature flag. The existing BFF routes (`GET /api/v1/toolsets/mcp-apps/tools`, `mcp-app-resource`) are reused unchanged.
- Library isolation: tool-call extraction works only on a `Message` passed in (`libs/mcp-apps`); anything that needs DIAL data shapes or the API client (discovery, schema check) lives in `libs/chat-hooks`, which the isolation rules allow; the app only passes the deployment details. This touches two shared libs; no global provider or context changes (state stays in the existing `DeploymentsContext`, read through `useDeployments`).
- i18n: none. Accessibility, RTL: none (no new UI).
- Rollback: revert the change; no data or API migration. Quick-app behavior is covered by the unchanged discovery tests.
- Open points: the loop's stage Markdown is not a contract (a format change breaks the adapter); two configured toolsets exposing the same tool name resolve to the first; the stage `**Response**` block is the printed result, which may differ from the tool's `structuredContent`.
