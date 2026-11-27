# Tasks

Slicing strategy: vertical, risk-first. The adapter split (group 1) lands first with no behavior change, then the DIAL loop slice (groups 2 and 3) runs end to end, then the review follow-ups (group 4). Implementation of groups 1 to 4 is already committed on `feat/mcp-app-adapters`; the boxes record what was verified. Architecture guard for every `libs/*` task: the lib contains no `/api` paths, generated-client imports, `server-api` imports, app contexts, auth/session/env access, feature flags, routing, analytics, or storage knowledge (`libs/mcp-apps` imports only `@epam/ai-dial-chat-shared` and the MCP SDK types; `libs/chat-hooks` imports the generated client types only, never a client instance).

## 1. Adapter split with no behavior change

- [x] 1.1 Move the quick-app tool-call logic (`state` shapes, `sanitizeToolName`, `collectToolCallNames`) into `libs/mcp-apps/src/adapters/quick-app/quick-app-tool-calls.ts`, add the `McpAppToolCall` model, and add the priority registry `libs/mcp-apps/src/adapters/tool-calls.ts`. Verification: `npm run test:file -- libs/mcp-apps/src/utils/tests/mcp-app.findMcpAppForMessage.spec.ts libs/mcp-apps/src/utils/tests/mcp-app.resolveMcpAppToolResult.spec.ts libs/mcp-apps/src/adapters/quick-app/tests/quick-app-tool-calls.sanitizeToolName.spec.ts` passes unchanged.
- [x] 1.2 Make `libs/mcp-apps/src/utils/mcp-app.ts` generic: matching and seeding read `extractMessageToolCalls`, with no kind-specific heuristic left in the file. Update the exports in `libs/mcp-apps/src/index.ts`. Verification: the existing specs above pass, and `npm exec nx run @epam/ai-dial-mcp-apps:typecheck` is clean.
- [x] 1.3 Split `useMcpAppTools` discovery into `libs/chat-hooks/src/mcp-apps/adapters/direct/direct-discovery.ts` and `libs/chat-hooks/src/mcp-apps/adapters/quick-app/quick-app-discovery.ts`, keeping the hook as thin orchestration with a cancel guard for the direct listing. Verification: `npm run test:file -- libs/chat-hooks/src/mcp-apps/useMcpAppTools/tests/useMcpAppTools.spec.ts` passes unchanged.

## 2. DIAL loop: tool calls and discovery

- [x] 2.1 Add the stage parser `libs/mcp-apps/src/adapters/dial-loop/dial-loop-tool-calls.ts` (name without timing suffix, `**Request**` bullets, `**Response**` block, failed stage has no result) and register it after the quick-app adapter. Verification: `npm run test:file -- libs/mcp-apps/src/adapters/dial-loop/tests/dial-loop-tool-calls.spec.ts` covers name stripping, non-tool stages, running and failed stages, and the seed.
- [x] 2.2 Add `isDialLoopSchema` to `libs/chat-hooks/src/shared/application-schema.ts` next to `isQuickAppSchema`, and the loop discovery `libs/chat-hooks/src/mcp-apps/adapters/dial-loop/dial-loop-discovery.ts` (configured toolset ids from the deployment details, `McpAppToolDiscovery.Configured` refs with unprefixed tool names). Verification: `npm run test:file -- libs/chat-hooks/src/mcp-apps/adapters/dial-loop/tests/dial-loop-discovery.spec.ts` passes.
- [x] 2.3 Wire the loop adapter into `libs/chat-hooks/src/mcp-apps/useMcpAppTools/useMcpAppTools.ts` (fifth parameter `deploymentDetails`, ignored unless its `id` equals the active deployment's, scan skipped unless the app is a loop with toolsets), and pass `selectedDeploymentDetails` from `apps/chat/src/hooks/conversation/useConversationMcpApps.ts`. Verification: `npm run test:file -- libs/chat-hooks/src/mcp-apps/useMcpAppTools/tests/useMcpAppTools.spec.ts` covers listing after a stage call, details of another deployment, and no query before a stage call.

## 3. DIAL loop: seed and no live re-call

- [x] 3.1 Seed a loop match from the stage response, with `structuredContent` when the block is a JSON object, and exclude `McpAppToolDiscovery.Configured` from the live re-call in `libs/mcp-apps/src/utils/mcp-app.ts`. Verification: `npm run test:file -- libs/mcp-apps/src/utils/tests/mcp-app.resolveMcpAppToolResult.spec.ts libs/mcp-apps/src/adapters/dial-loop/tests/dial-loop-tool-calls.spec.ts` covers "a configured match never calls the tool" and the structured seed.
- [x] 3.2 Document the adapters in `docs/mcp-apps.md` ("Temporary adapters" table, add/remove steps, loop limits, revised live re-call rule) and update `libs/mcp-apps/README.md` and `libs/chat-hooks/README.md`. Verification: `npm run validate:docs` passes.

## 4. Review follow-ups (reuse and priority)

- [x] 4.1 Make the first adapter that finds tool calls win in `libs/mcp-apps/src/adapters/tool-calls.ts`. Verification: the spec "prefers the structured state of a quick app over stages in the same message" in `libs/mcp-apps/src/adapters/dial-loop/tests/dial-loop-tool-calls.spec.ts` passes.
- [x] 4.2 Replace the duplicated JSON-object parsers with `libs/mcp-apps/src/utils/json.ts` (`parseJsonObject`), and remove Markdown escapes from string request values. Verification: `npm run test:file -- libs/mcp-apps/src/utils/tests/json.spec.ts` passes, and the quick-app seed specs still pass.
- [x] 4.3 Document the nested code fence limit with a test. Verification: the spec "reads a response only up to its first closing code fence" passes.

## 4b. Review follow-ups (PR review)

- [x] 4b.1 Mark stage-derived tool calls and seeds as display-derived and gate the live re-call on that mark in `libs/mcp-apps/src/utils/mcp-app.ts` (a `direct` match is re-called with `{}`, an `indirect` one is not re-called). Verification: `npm run test:file -- libs/mcp-apps/src/utils/tests/mcp-app.resolveMcpAppToolResult.spec.ts libs/mcp-apps/src/adapters/dial-loop/tests/dial-loop-tool-calls.spec.ts` covers both cases and the seed mark.
- [x] 4b.2 Reword the `Configured` JSDoc in `libs/mcp-apps/src/types/mcp-apps.ts` and the live-re-call comment in `libs/mcp-apps/README.md`. Verification: `npm run validate:docs` passes.
- [x] 4b.3 Replace the stage-name collection with the early-exit `hasDialLoopToolCalls`, and pass id, type and the MCP flag as primitives to `discoverDirectTools` (no `eslint-disable`). Verification: `npm run test:file -- libs/chat-hooks/src/mcp-apps/useMcpAppTools/tests/useMcpAppTools.spec.ts libs/mcp-apps/src/adapters/dial-loop/tests/dial-loop-tool-calls.spec.ts` passes and `npm exec nx lint @epam/ai-dial-chat-hooks` has no `eslint-disable` in the hook.
- [x] 4b.4 Add the hook test for a loop that declares `features.mcp` (direct and configured listings together). Verification: the spec "combines the listing of the loop itself and the configured listing when the loop declares mcp" passes.
- [x] 4b.5 Update `docs/mcp-apps.md`, the delta spec and design D1 and D6 for the rules above. Verification: `npm run validate:docs` and `openspec validate mcp-app-adapters-dial-loop --strict` pass.

## 5. Integration and closing

- [x] 5.1 Run `npm exec nx run-many -- -t typecheck lint -p @epam/ai-dial-mcp-apps @epam/ai-dial-chat-hooks chat` and verify 0 errors.
- [x] 5.2 Run `npm run validate:specs` and `openspec validate mcp-app-adapters-dial-loop --strict`, and verify both pass.
- [ ] 5.3 Close the change with exactly one `npm run verify:full` and verify it passes; archive the change with the apply workflow's archive step afterwards.

## 6. Follow-ups outside this change

- [ ] 6.1 Ask the loop team for a structured tool-call record in `custom_content.state` (`tool_execution_history` shape), so the stage adapter can be deleted. Verification: the loop emits the record and the DIAL loop adapter folders are removed with the quick-app path unchanged.
- [ ] 6.2 Decide, with the loop team, whether the widget needs a live re-call once the loop reports arguments reliably. Verification: a recorded decision; the live re-call rule in `mcp-app-trigger` is updated if it changes.
- [ ] 6.4 Stop a quick-app discovery result that resolves after a deployment switch from being appended to the new deployment's tools (existing behavior, noted in review). A plain cancel flag cannot be used because the effect re-runs on every message update; use a generation counter bumped on deployment change. Verification: a hook test switches deployment while a listing is pending and the late result is ignored.
