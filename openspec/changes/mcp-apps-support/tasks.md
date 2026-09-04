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
- [ ] 3.2 Add `McpAppCanvasContent` to the `AttachmentCanvasContent` union in `libs/attachment-canvas/src/models/attachment-canvas.ts` — including `toolInput?: Record<string, unknown>`, `toolResult?: CallToolResult`, and `hostContext?: McpUiHostContext` fields (imported from `@modelcontextprotocol/ext-apps/app-bridge`); update `isDownloadable` in `libs/attachment-canvas/src/utils/download.ts` to return `false` for it; add `@modelcontextprotocol/ext-apps` as a peer dependency of `libs/attachment-canvas/package.json`.
- [x] 3.3 **Revised**: no `Stage` field added — DIAL Core doesn't attach a UI resource reference per-stage. Instead, added `MessageState`/`ToolStateMessage`/`ToolCallRequest` to `libs/chat-shared/src/models/chat.ts` (`Message.custom_content.state.tool_messages`, orchestrator-specific, wire-verbatim) for real tool-call correlation; UI-capable tools are discovered per-deployment via `tools/list` (`McpAppToolRef` in `apps/chat/src/hooks/conversation/useMcpAppTools.ts`) — see `design.md` D5 (third revision) and D8.

## 4. `chat-api` proxy endpoints (mcp-app-proxy-api)

- [ ] 4.1 Add `McpAppToolCallRequestDto`, `McpAppToolCallResponseDto` under `apps/chat-api/src/toolsets/dto/` with `class-validator`/`@ApiProperty` decorators per spec. (No `McpAppResourceDto` — the GET endpoint is a raw passthrough, not a JSON DTO.)
- [ ] 4.2 Implement `GET /api/v1/toolsets/{toolsetId}/mcp-app-resource` in the `toolsets` domain as a raw-passthrough proxy of DIAL Core's `GET /v1/deployments/{toolsetId}/mcp/resources?uri=...`: forward `Content-Type`/`Content-Security-Policy`/`X-Content-Type-Options` and body unchanged, wrap with `withCachedDialRequest` (`mcp-apps:resource:${toolsetId}:${resourceUri}`, 30000ms TTL, caching body+`Content-Type`).
- [ ] 4.3 Implement `POST /api/v1/toolsets/{toolsetId}/mcp-app-tool-call`: validate `toolName` against the session's exposed tools (403 on mismatch), forward as a `tools/call` JSON-RPC request through Core's existing generic MCP proxy, selecting the correct prefix via `McpAppToolCallRequestDto.kind` (`toolset` → `/v1/toolset/{id}/mcp`, `application` → `/v1/deployments/{id}/mcp`), unwrap `result`/map JSON-RPC `error` to `502`, add per-route `@Throttle`.
- [x] 4.4 Add `mcpAppSandboxUrl`, `mcpAppTheme`, and `mcpAppUserAgent` client-config keys (`apps/chat-api/src/app-config`): `MCP_APP_SANDBOX_URL`, `MCP_APP_THEME`, and `MCP_APP_USER_AGENT` env vars in `EnvironmentVariables`; `CONFIG_DEFINITIONS` entries for `mcpApps.sandboxUrl`, `mcpApps.theme`, and `mcpApps.userAgent`; `ClientConfigResponseDto.config` gains `mcpAppSandboxUrl` (`string | null`), `mcpAppTheme` (`'light' | 'dark' | null`), and `mcpAppUserAgent` (`string | null`), all defaulting `null`; `AppConfigContext` gains all three with `?? null` fallbacks. **Done.**
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
- [ ] 6.2 Create `libs/attachment-canvas/src/components/McpAppCanvasRenderer/McpAppCanvasRenderer.tsx`: render `@mcp-ui/client`'s `AppRenderer` with `html={content.html}`, `sandbox={{ url: new URL(content.sandboxUrl) }}`, `toolName={content.toolName}`, `hostContext={content.hostContext}`, `onCallTool` wired to `content.onToolCall`, loading/error states driven by `AppRenderer`'s own callbacks per spec.
- [ ] 6.3 Extend `AttachmentCanvas.tsx`'s content-type switch with the `McpApp` branch rendering `McpAppCanvasRenderer`.
- [ ] 6.4 Unit tests (`libs/attachment-canvas/src/components/McpAppCanvasRenderer/tests/`): tool-call forwarding via `onCallTool`, rejection relayed as tool error (not renderer error), `sandbox.permissions` assertion, loading/error state transitions.

## 7. Stage trigger UI (mcp-app-trigger)

- [x] 7.1 **Superseded, removed**: no stage-merge upsert needed — there is no `mcp_app` field on `Stage` to merge. Instead, `apps/chat-api/src/toolsets/mcp-app.service.ts`'s `listAppTools`/`GET /api/v1/toolsets/mcp-apps/tools` and `apps/chat/src/hooks/conversation/useMcpAppTools.ts` discover UI-capable tools directly from Core's `tools/list`, and `apps/chat-api/src/conversations/utils/apply-chunk.server.ts` / `apps/chat/src/utils/apply-chunk.ts` merge `custom_content.state` (wholesale) for tool-call correlation — see `design.md` D5 (third revision)/D8.
- [x] 7.2 **Revised twice**: the trigger button lives directly in the message body's `afterContent` (`ConversationMessageItem.tsx`), below the stages block, as a default-size `PrimaryButton` — not in `MessageActions` (rejected on review) and not on `StageItem`. `MessageActionsProps`/`MessageActions.tsx`, `StageItem`/`StagesPanel`/`CollapsedGroup` carry no MCP-Apps-related field.
- [x] 7.3 Added `apps/chat/src/server-api/mcp-apps.ts` — `listMcpAppTools(deploymentId, kind)`, `fetchMcpAppResourceHtml(toolsetId, resourceUri)` (GET, resolves to response text), and `callMcpAppTool` passing `toolsetId`, `toolName`, `args`, and `kind` (forwarded to `McpAppToolCallRequestDto.kind` so `chat-api` can route `tools/list`/`tools/call` to the correct Core MCP proxy prefix).
- [x] 7.4 Added `apps/chat/src/hooks/attachment/useMcpAppSandboxUrl.ts` reading `mcpAppSandboxUrl` from `AppConfigContext` (mirrors `useCustomVisualizers`'s pattern).
- [x] 7.5 Added `apps/chat/src/hooks/attachment/useOpenMcpAppCanvas.ts` implementing the fetch/open/error flow (no-op when `mcpAppSandboxUrl` is unavailable; builds `html`+`sandboxUrl`+`toolInput`/`toolResult` seed for `McpAppCanvasContent`), mirroring `useOpenAttachmentCanvas`'s close-other-panels-first + loading-state pattern. Signature takes `McpAppToolRef`, not `Stage`.
- [x] 7.9 Populate `hostContext` in `McpAppCanvasContent` inside `useOpenMcpAppCanvas`: reads `mcpAppTheme` and `mcpAppUserAgent` from `AppConfigContext.config` and `currentTheme` from `ThemeContext`; builds `McpUiHostContext` with `theme: mcpAppTheme ?? currentTheme`, `locale: i18n.language`, `timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone`, `userAgent: mcpAppUserAgent ?? 'ai-dial-chat'` (admin-configurable via `MCP_APP_USER_AGENT`), `platform: 'web'`, `displayMode: 'inline'`, and `styles.variables` from `getComputedStyle(document.documentElement)` for all 71 `McpUiStyleVariableKey` names (empty values omitted). **Done.** Open: CSS variable aliases in the app's global stylesheet mapped from EPAM UI Kit design tokens so `styles.variables` carries real theme values (prerequisite for `styles.variables` to be non-empty in practice).
- [x] 7.6 **Revised**: `openMcpAppCanvas(match: McpAppToolRef, canvasKey?, toolCall?)` is passed as `onOpenApp` to `ConversationMessageItem.tsx`, which calls it for `findMcpAppForMessage(msg, mcpAppTools)`'s result (`apps/chat/src/utils/mcp-app.ts`) seeded with `resolveMcpAppToolCallSeed(msg, match.toolName)`; `apps/chat/src/hooks/attachment/useAutoOpenMcpAppCanvas.ts` calls it directly for `findLastMcpAppMessage`'s result, guarded by a ref keyed on `mcpAppCanvasKey(messageIndex)` — see `design.md` D5, third revision.
- [x] 7.7 Added `AttachmentCanvasI18nKeys.OpenAppLabel` (`"Open App"`) and `AttachmentCanvasI18nKeys.McpAppTitle` (`"MCP App"`) to `apps/chat/src/constants/translation-keys.ts` and `en.json`.
- [ ] 7.8 Unit tests: `useMcpAppTools` discovery (empty/populated), `findMcpAppForMessage` (real-call match, fallback, non-assistant), `resolveMcpAppToolCallSeed` (matched pair, absent state), `ConversationMessageItem`'s Open-App button rendering (present/absent), `useAutoOpenMcpAppCanvas` (fires once per new message, picks the last message when multiple qualify), `useOpenMcpAppCanvas` success/failure/no-sandbox-configured paths.

## 9. Follow-up: reliable tool-discovery contract from DIAL Core (mcp-app-discovery-contract)

Both current tool-discovery paths in `useMcpAppTools` are workarounds, not a proper contract:

- **Direct discovery** requires an admin to explicitly set `features.mcp: true` on the deployment in DIAL Core config. A quick app that is itself the MCP server (e.g. "NT AWS Explore") will never be discovered unless this flag is set.
- **Indirect discovery** prefix-matches tool-call names against the `displayName` of toolsets in the catalog. This is a convention, not a spec: it breaks if the orchestrator does not name delegated tool calls `{toolsetDisplayName}_{toolName}`, if the prefix contains underscores, or if the application is its own MCP server (no separate toolset to match against).

**Confirmed failure case**: "NT AWS Explore" — a quick app whose tools (`NT_AWS_Explore_search_amazon`, `NT_AWS_Explore_present_amazon_products`) are prefixed with the application's own name, not a separate toolset. `availableToolsets` is empty, `features.mcp` is unset, so neither path fires. Canvas never opens.

**Immediate workaround**: set `features.mcp: true` on the deployment in Core config; direct discovery then works via the `application` kind path.

**Required long-term fix (Core-side)**:

- [ ] 9.1 Investigate/propose a Core-side contract that lets the host enumerate MCP-Apps-capable tools for any deployment without requiring explicit `features.mcp` config or name-prefix inference. Candidate approaches:
  - A deployment-agnostic flag or field in `DeploymentItemDto`/`ApplicationDetailsDto` that signals MCP capability without admin configuration.
  - Core returning `_meta.ui.resourceUri` in a deployment-metadata endpoint rather than only via `tools/list` (which today requires a live MCP session, not just catalog metadata).
  - Core enriching `tools/list` responses for quick apps to include the delegated toolsets' tool metadata, so the application's own `tools/list` already contains `_meta.ui.resourceUri`-bearing entries.
- [ ] 9.2 Once Core ships the contract, remove the prefix-guessing path from `useMcpAppTools` and replace both paths with a single reliable lookup. Remove the debug logging added during investigation (`useMcpAppTools.ts` effect log, `listMcpAppTools` log).
- [ ] 9.3 Update `design.md` D9 to replace the current workaround description with the final contract.

## 10. Follow-up: remove the live tool-result re-call workaround once Core preserves `structuredContent` (mcp-app-lossy-tool-result)

- [x] 10.1 Added `apps/chat/src/utils/mcp-app.ts`'s `resolveMcpAppToolResult(match, seed)`: when `match.kind === 'application'`, re-calls the tool live via `callMcpAppTool` (the same `chat-api` `mcp-app-tool-call` endpoint used for the mounted app's own `onToolCall`) with the seed's real `toolInput`, and uses that live `CallToolResult` in place of `resolveMcpAppToolCallSeed`'s lossy plain-text reconstruction. Falls back to `seed?.toolResult` on failure or when there's no input to replay. Wired into `useOpenMcpAppCanvas.ts` in place of the direct `toolCall?.toolResult` seed. See `design.md` D10.
- [x] 10.2 Raised `apps/chat-api/src/toolsets/mcp-app.service.ts`'s `TOOL_CALL_TIMEOUT_MS` from 30s to 60s — a real re-call against a live deployment took ~38s and was intermittently hitting the old timeout (503 `TimeoutError`).
- [ ] 10.3 This is a **temporary workaround**, not a fix — it doubles tool invocations (and their side effects/cost) for every `kind === 'application'` MCP App canvas open, and depends on the deployment still having a live, callable MCP session outside the original conversation turn. Remove `resolveMcpAppToolResult`'s live-call branch (collapsing back to plain `resolveMcpAppToolCallSeed`) once DIAL Core's orchestrator preserves the tool's real `structuredContent` in `custom_content.state` (the D8 gap it patches over).
- [ ] 10.4 Not yet extended to `match.kind === 'toolset'` (direct toolset deployments, or D9's indirect name-guessed matches) — re-calling on a guessed match risks the wrong tool or a duplicate non-idempotent side effect. Revisit only if toolset-kind MCP Apps are confirmed to need seeded structured results too, and only once indirect-match confidence improves (see item 9).

## 11. Inline preview by default; canvas is manual-expand-only (D5 fourth revision / D11)

- [x] 11.1 Deleted `useAutoOpenMcpAppCanvas.ts` and its only call site (`ConversationView.tsx`) — the canvas no longer opens itself for any message. Deleted `findLastMcpAppMessage` from `apps/chat/src/utils/mcp-app.ts` (its only caller).
- [x] 11.2 Added `libs/attachment-canvas`'s `McpAppCanvasRenderer`/`McpAppCanvasRendererProps` to the lib's public `index.ts` (previously internal-only, used only by `AttachmentCanvasBody`) so the app layer can mount the same renderer outside the canvas.
- [x] 11.3 Added `apps/chat/src/hooks/attachment/useMcpAppHostContext.ts`, extracted from `useOpenMcpAppCanvas`, parameterized by `displayMode: 'inline' | 'fullscreen'` so the canvas and the inline preview each get the host context value that matches their real presentation.
- [x] 11.4 Added `apps/chat/src/hooks/attachment/useMcpAppInlinePreview.ts` and `apps/chat/src/components/ConversationView/McpAppInlinePreview/McpAppInlinePreview.tsx`: fetches the resource HTML and resolves the tool result independently of `AttachmentCanvas`'s panel state, renders a fixed-height (360px) inline box in the message body via `McpAppCanvasRenderer`, with an overlaid `IconArrowsMaximize` button that calls the existing `onOpenApp`/`useOpenMcpAppCanvas` to expand into the full canvas.
- [x] 11.5 `ConversationMessageItem.tsx`: replaced the "Open App" `PrimaryButton` with `McpAppInlinePreview` for the not-opened-in-canvas branch; kept the "Opened in Canvas" placeholder for when the user has expanded it. Removed the now-unused `openCanvasLabel` prop and `AttachmentCanvasI18nKeys.OpenAppLabel` translation key.
- [x] 11.6 Resolved by item 12 below: `useMcpAppResponseCache` deduplicates the fetch/live-tool-recall between the inline preview and the canvas.

## 12. Per-conversation response cache, reload action, canvas fills its container, live resize reporting (D12)

- [x] 12.1 Added `apps/chat/src/hooks/attachment/useMcpAppResponseCache.ts`: one `Map<mcpAppCanvasKey, {html, toolResult}>` per open conversation. `ConversationView` creates one instance (`useMcpAppResponseCache(conversation.id)`) and shares it with `useOpenMcpAppCanvas` and, via a new required `mcpAppCache` prop on `ConversationMessageItem`, `McpAppInlinePreview`/`useMcpAppInlinePreview` — resolves item 11.6.
- [x] 12.2 Added a reload action: `McpAppInlinePreview`'s header gained a second (`IconRefresh`) button next to the expand button, calling `useMcpAppInlinePreview`'s new `reload()`. `libs/attachment-canvas`'s `McpAppCanvasContent` gained an optional `onReload` callback and `AttachmentCanvasLabels` gained `mcpAppReloadLabel`; `AttachmentCanvas.tsx` shows a matching header action when both are present. `useOpenMcpAppCanvas` wires `onReload` to invalidate the cache entry and re-run itself with a new `forceReload` fourth argument. New shared `ButtonsI18nKeys.Reload` translation key used by both reload buttons.
- [x] 12.3 Fixed the canvas rendering the app at a fixed, undersized `736×600` (confirmed via user report): `McpAppCanvasRenderer` now forces its mounted iframe to `100%`/`100%` via a CSS `!important` rule (`.fullscreenFrame`) whenever `content.hostContext.displayMode === 'fullscreen'` — canvas-only; the inline preview is intentionally unaffected and keeps sizing to the app's own reported content size.
- [x] 12.4 Added live resize reporting: `McpAppCanvasRenderer` watches its own root with a `ResizeObserver` and merges the live pixel size into `hostContext.containerDimensions` before it reaches `AppRenderer`, which already calls the AppBridge's `setHostContext` on every `hostContext` change — sending a real `ui/notifications/host-context-changed` message. Confirmed this notification was never sent before (`containerDimensions` was never populated).

- [ ] 8.1 `npm exec nx test chat-api`, `npm exec nx lint chat-api`, `npm exec nx build chat-api`.
- [ ] 8.2 `npm exec nx test mcp-app-sandbox`, `npm exec nx lint mcp-app-sandbox`, `npm exec nx build mcp-app-sandbox`.
- [ ] 8.3 `npm exec nx test attachment-canvas`, `npm exec nx lint attachment-canvas` (and `conversation-stages` equivalents).
- [ ] 8.4 `npm exec nx test chat`, `npm exec nx lint chat` for the updated app-level hook/wiring.
- [ ] 8.5 Manual run: deploy `apps/mcp-app-sandbox` on a distinct local origin (e.g. a different port), configure `MCP_APP_SANDBOX_URL`/`MCP_APP_SANDBOX_ALLOWED_HOST_ORIGINS`, and exercise the "Open canvas" action and auto-open behavior end-to-end against whatever DIAL Core surface step 1 confirmed (or a stubbed response if DIAL Core support is still pending), checking both light/dark theme and an RTL locale.
- [ ] 8.6 Run the `code-review-and-quality` skill's five-axis review before merge.
