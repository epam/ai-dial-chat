## 1. Verify the DIAL Core contract (resolved — light follow-up only)

- [x] 1.1 Confirmed via `epam/ai-dial-core` PR #1745 (merged 2026-07-31): `tools/list` gains `_meta.ui.domain` rewriting, gated per-deployment by `mcp_apps.domain_override`; `_meta.ui.resourceUri` itself is upstream-server-declared. Documented in `design.md` Context/Open Questions.
- [x] 1.2 Confirmed: `GET /v1/deployments/{deployment_name}/mcp/resources?uri=...` fetches the resource as a raw passthrough; app-initiated `tools/call` forwarding reuses Core's existing generic MCP proxy (`/v1/deployments/{id}/mcp`) — no new Core endpoint. Documented in `design.md` D3/D4.
- [x] 1.3 Findings recorded against `design.md` Open Questions 1–3 (all resolved).
- [ ] 1.4 (Non-blocking, carried forward) Verify against a real MCP-Apps-capable upstream server that its declared `_meta.ui` object uses the field name `resourceUri` — Core's rewrite is agnostic to this, it's upstream-server behavior per the MCP Apps spec, not pinned down by PR #1745.

## 2. Client library spike (D2) — done

- [x] 2.1 Spiked `@mcp-ui/client@7.1.1` by inspecting its packaged type definitions directly (pulled the npm tarball): peer deps (`react`/`react-dom` `^18 || ^19`) match this repo; `AppRenderer` accepts pre-fetched `html` + custom `onCallTool`/etc. handlers (no live MCP client needed) — but requires a `sandbox: { url }` pointing at a separate cross-origin sandbox-proxy page, which reshaped D3 (see `design.md`).
- [x] 2.2 App Bridge spike unnecessary — `@mcp-ui/client` is confirmed compatible and avoids hand-rolling the JSON-RPC dialect (D2's original goal).
- [x] 2.3 Pin `@mcp-ui/client@^7.1.1` as a peer dependency of `libs/attachment-canvas`; decision documented in `design.md` D2/D3/D7.

## 3. Shared types

- [ ] 3.1 Add `AttachmentContentType.McpApp` to `libs/attachment-canvas/src/types/attachment-canvas.ts`.
- [ ] 3.2 Add `McpAppCanvasContent` to the `AttachmentCanvasContent` union in `libs/attachment-canvas/src/models/attachment-canvas.ts`; update `isDownloadable` in `libs/attachment-canvas/src/utils/download.ts` to return `false` for it.
- [x] 3.3 **Revised**: no `Stage` field added — DIAL Core doesn't attach a UI resource reference per-stage. Instead, added `MessageState`/`ToolStateMessage`/`ToolCallRequest` to `libs/chat-shared/src/models/chat.ts` (`Message.custom_content.state.tool_messages`, orchestrator-specific, wire-verbatim) for real tool-call correlation; UI-capable tools are discovered per-deployment via `tools/list` (`McpAppToolRef` in `apps/chat/src/hooks/conversation/useMcpAppTools.ts`) — see `design.md` D5 (third revision) and D8.

## 4. `chat-api` proxy endpoints (mcp-app-proxy-api)

- [ ] 4.1 Add `McpAppToolCallRequestDto`, `McpAppToolCallResponseDto` under `apps/chat-api/src/toolsets/dto/` with `class-validator`/`@ApiProperty` decorators per spec. (No `McpAppResourceDto` — the GET endpoint is a raw passthrough, not a JSON DTO.)
- [ ] 4.2 Implement `GET /api/v1/toolsets/{toolsetId}/mcp-app-resource` in the `toolsets` domain as a raw-passthrough proxy of DIAL Core's `GET /v1/deployments/{toolsetId}/mcp/resources?uri=...`: forward `Content-Type`/`Content-Security-Policy`/`X-Content-Type-Options` and body unchanged, wrap with `withCachedDialRequest` (`mcp-apps:resource:${toolsetId}:${resourceUri}`, 30000ms TTL, caching body+`Content-Type`).
- [ ] 4.3 Implement `POST /api/v1/toolsets/{toolsetId}/mcp-app-tool-call`: validate `toolName` against the session's exposed tools (403 on mismatch), forward as a `tools/call` JSON-RPC request through Core's existing generic MCP proxy (`/v1/deployments/{toolsetId}/mcp`), unwrap `result`/map JSON-RPC `error` to `502`, add per-route `@Throttle`.
- [ ] 4.4 Add `mcpAppSandboxUrl` client-config key (`apps/chat-api/src/app-config`): new `MCP_APP_SANDBOX_URL` env var in `EnvironmentVariables`, new `CONFIG_DEFINITIONS` entry, `EnvConfigProvider` resolution, `ClientConfigResponseDto.config.mcpAppSandboxUrl` (defaults `null`).
- [ ] 4.5 Wire `operationIdFactory` names (`getToolsetMcpAppResource`, `callToolsetMcpAppTool`); run `npm run openapi` and `npm run openapi:check`; build/lint `chat-api-client`.
- [ ] 4.6 Add a `Logger`-based metric/log on `403`/`502` outcomes (no `arguments` contents in logs); wire into the existing `MetricsInterceptor` pattern for call count/latency by `toolsetId`+`toolName`.
- [ ] 4.7 Unit tests (`*.spec.ts`, `@nestjs/testing` + `supertest`): happy path, 400 (invalid `resourceUri`/body), 403 (no toolset access; unexposed tool), 404 (unknown toolset), 502 (upstream failure), 429 (rate limit), cache-hit-skips-upstream, `mcpAppSandboxUrl` null-when-unset.

## 5. `apps/mcp-app-sandbox` — new isolated-origin app (mcp-app-sandbox-proxy)

- [ ] 5.1 Scaffold a new minimal NestJS Nx app `apps/mcp-app-sandbox` (own `package.json`, `Dockerfile`/build target — deployed separately from `apps/chat`/`apps/chat-api`).
- [ ] 5.2 Add `MCP_APP_SANDBOX_ALLOWED_HOST_ORIGINS` (comma-separated) to a new `EnvironmentVariables` class for this app, validated at boot.
- [ ] 5.3 Implement the single route: validate `Referer` against the allowlist (403 if missing/unlisted), then return the self-contained sandbox-proxy HTML (relay/self-test script inlined, adapted from `modelcontextprotocol/ext-apps`'s `examples/basic-host/{sandbox.html,src/sandbox.ts}`) with the validated origin embedded, a fixed restrictive `Content-Security-Policy` header, and `Cache-Control: no-store`.
- [ ] 5.4 Unit/e2e tests (`supertest`): 200 for allowed Referer, 403 for missing/unlisted Referer, response headers (CSP, no-store) asserted.

## 6. `libs/attachment-canvas` renderer (mcp-app-canvas)

- [ ] 6.1 Add `@mcp-ui/client@^7.1.1` as a peer dependency of `libs/attachment-canvas` (`package.json`).
- [ ] 6.2 Create `libs/attachment-canvas/src/components/McpAppCanvasRenderer/McpAppCanvasRenderer.tsx`: render `@mcp-ui/client`'s `AppRenderer` with `html={content.html}`, `sandbox={{ url: new URL(content.sandboxUrl), permissions: 'allow-scripts' }}`, `toolName={content.toolName}`, `onCallTool` wired to `content.onToolCall`, loading/error states driven by `AppRenderer`'s own callbacks per spec.
- [ ] 6.3 Extend `AttachmentCanvas.tsx`'s content-type switch with the `McpApp` branch rendering `McpAppCanvasRenderer`.
- [ ] 6.4 Unit tests (`libs/attachment-canvas/src/components/McpAppCanvasRenderer/tests/`): tool-call forwarding via `onCallTool`, rejection relayed as tool error (not renderer error), `sandbox.permissions` assertion, loading/error state transitions.

## 7. Stage trigger UI (mcp-app-trigger)

- [x] 7.1 **Superseded, removed**: no stage-merge upsert needed — there is no `mcp_app` field on `Stage` to merge. Instead, `apps/chat-api/src/toolsets/mcp-app.service.ts`'s `listAppTools`/`GET /api/v1/toolsets/mcp-apps/tools` and `apps/chat/src/hooks/conversation/useMcpAppTools.ts` discover UI-capable tools directly from Core's `tools/list`, and `apps/chat-api/src/conversations/utils/apply-chunk.server.ts` / `apps/chat/src/utils/apply-chunk.ts` merge `custom_content.state` (wholesale) for tool-call correlation — see `design.md` D5 (third revision)/D8.
- [x] 7.2 **Revised twice**: the trigger button lives directly in the message body's `afterContent` (`ConversationMessageItem.tsx`), below the stages block, as a default-size `PrimaryButton` — not in `MessageActions` (rejected on review) and not on `StageItem`. `MessageActionsProps`/`MessageActions.tsx`, `StageItem`/`StagesPanel`/`CollapsedGroup` carry no MCP-Apps-related field.
- [x] 7.3 Added `apps/chat/src/server-api/mcp-apps.ts` — `listMcpAppTools(deploymentId, kind)`, `fetchMcpAppResourceHtml(toolsetId, resourceUri)` (GET, resolves to response text), and `callMcpAppTool` wrapping the generated toolset MCP-app-tool-call client method via the shared `post()` helper (for CSRF).
- [x] 7.4 Added `apps/chat/src/hooks/attachment/useMcpAppSandboxUrl.ts` reading `mcpAppSandboxUrl` from `AppConfigContext` (mirrors `useCustomVisualizers`'s pattern).
- [x] 7.5 Added `apps/chat/src/hooks/attachment/useOpenMcpAppCanvas.ts` implementing the fetch/open/error flow (no-op when `mcpAppSandboxUrl` is unavailable; builds `html`+`sandboxUrl`+`toolInput`/`toolResult` seed for `McpAppCanvasContent`), mirroring `useOpenAttachmentCanvas`'s close-other-panels-first + loading-state pattern. Signature takes `McpAppToolRef`, not `Stage`.
- [x] 7.6 **Revised**: `openMcpAppCanvas(match: McpAppToolRef, canvasKey?, toolCall?)` is passed as `onOpenApp` to `ConversationMessageItem.tsx`, which calls it for `findMcpAppForMessage(msg, mcpAppTools)`'s result (`apps/chat/src/utils/mcp-app.ts`) seeded with `resolveMcpAppToolCallSeed(msg, match.toolName)`; `apps/chat/src/hooks/attachment/useAutoOpenMcpAppCanvas.ts` calls it directly for `findLastMcpAppMessage`'s result, guarded by a ref keyed on `mcpAppCanvasKey(messageIndex)` — see `design.md` D5, third revision.
- [x] 7.7 Added `AttachmentCanvasI18nKeys.OpenAppLabel` (`"Open App"`) and `AttachmentCanvasI18nKeys.McpAppTitle` (`"MCP App"`) to `apps/chat/src/constants/translation-keys.ts` and `en.json`.
- [ ] 7.8 Unit tests: `useMcpAppTools` discovery (empty/populated), `findMcpAppForMessage` (real-call match, fallback, non-assistant), `resolveMcpAppToolCallSeed` (matched pair, absent state), `ConversationMessageItem`'s Open-App button rendering (present/absent), `useAutoOpenMcpAppCanvas` (fires once per new message, picks the last message when multiple qualify), `useOpenMcpAppCanvas` success/failure/no-sandbox-configured paths.

## 8. Verification

- [ ] 8.1 `npm exec nx test chat-api`, `npm exec nx lint chat-api`, `npm exec nx build chat-api`.
- [ ] 8.2 `npm exec nx test mcp-app-sandbox`, `npm exec nx lint mcp-app-sandbox`, `npm exec nx build mcp-app-sandbox`.
- [ ] 8.3 `npm exec nx test attachment-canvas`, `npm exec nx lint attachment-canvas` (and `conversation-stages` equivalents).
- [ ] 8.4 `npm exec nx test chat`, `npm exec nx lint chat` for the updated app-level hook/wiring.
- [ ] 8.5 Manual run: deploy `apps/mcp-app-sandbox` on a distinct local origin (e.g. a different port), configure `MCP_APP_SANDBOX_URL`/`MCP_APP_SANDBOX_ALLOWED_HOST_ORIGINS`, and exercise the "Open canvas" action and auto-open behavior end-to-end against whatever DIAL Core surface step 1 confirmed (or a stubbed response if DIAL Core support is still pending), checking both light/dark theme and an RTL locale.
- [ ] 8.6 Run the `code-review-and-quality` skill's five-axis review before merge.
