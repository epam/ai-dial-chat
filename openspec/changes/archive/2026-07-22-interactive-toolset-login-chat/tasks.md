## 1. Backend: client-channel BFF module

- [x] 1.1 Scaffold `apps/chat-api/src/client-channel/` domain: `client-channel.module.ts`, `client-channel.controller.ts`, `client-channel.service.ts`, `dto/report-client-channel.dto.ts`
- [x] 1.2 Implement `POST /api/v1/client-channel/subscribe`: call SDK `subscribeClientChannel` with the session bearer token, relay the SSE body without buffering, echo `X-DIAL-CLIENT-CHANNEL-ID`, forward an inbound reconnect header if present
- [x] 1.3 Implement abort/cleanup: register `req`/`res` close handlers to cancel the upstream reader when the browser disconnects
- [x] 1.4 Implement `POST /api/v1/client-channel/report` with `ReportClientChannelDto` (`id` allowlist-validated, `result: 'success' | 'denied'`), calling SDK `reportClientChannel`
- [x] 1.5 Implement `POST /api/v1/client-channel/unsubscribe`, treating Core 404 as idempotent success
- [x] 1.6 Add Swagger `@ApiOperation`/`@ApiResponse` for every status code (200/400/401/403/502) on all three endpoints; confirm `CsrfGuard` applies (no `@Public()`)
- [x] 1.7 Add per-route `@Throttle` limits for `report`/`unsubscribe`; verify subscribe's SSE nature is compatible with the global throttler config
- [x] 1.8 Ensure logging only includes channel id / event id, never full RPC payloads or tokens
- [x] 1.9 Verify: `npm exec nx lint chat-api`, `npm exec nx build chat-api`

## 2. Backend: completion channel-id forwarding

- [x] 2.1 Add optional `clientChannelId` param to `ConversationService.streamCompletion` and thread it into the upstream completion request as `X-DIAL-CLIENT-CHANNEL-ID`
- [x] 2.2 Update the completions controller/DTO to accept the channel id from the frontend (request field or header) without changing existing required fields
- [x] 2.3 Verify existing completion persistence behavior (`backend-owned-generation-persistence` spec) is unaffected when the field is absent
- [x] 2.4 Verify: `npm exec nx test chat-api`

## 3. Backend: OpenAPI and generated client

- [x] 3.1 Add Swagger DTOs/response schemas for `report`/`unsubscribe` with `operationIdFactory` names `reportClientChannel`/`unsubscribeClientChannel`
- [x] 3.2 Run `npm run openapi` and `npm run openapi:check`; regenerate/build `chat-api-client`
- [x] 3.3 `subscribe` is generated too (harmless, unused) but the frontend uses a raw `fetch` for it since the generated client cannot stream a `ReadableStream` body — documented in design.md

## 4. Backend tests

- [x] 4.1 Unit/e2e: subscribe SSE proxy forwards `X-DIAL-CLIENT-CHANNEL-ID` both directions (`client-channel.controller.spec.ts`, `client-channel.service.spec.ts`)
- [x] 4.2 Unit: reader/abort-controller cleanup on cancel is exercised at the service level (`subscribe` rejects/cleans up on upstream error); true browser-close simulation deferred to manual verification in 11.4 — supertest cannot simulate a real socket-close mid-stream
- [x] 4.3 Unit/e2e: report success and denied payloads forwarded correctly to Core
- [x] 4.4 Unit/e2e: unsubscribe success and 404-as-idempotent-success
- [x] 4.5 Unit/e2e: missing/invalid channel id returns 400 on report/unsubscribe
- [x] 4.6 CSRF enforcement covered by the existing generic `csrf.guard.spec.ts` (route-agnostic guard test) — this controller adds no `@Public()` override, so it is protected like every other mutating endpoint
- [x] 4.7 Unit/e2e: rate limiting `@Throttle` decorators present; error mapping (502 on Core failure) covered in service/controller specs
- [x] 4.8 Unit/e2e: completion request forwarding with and without `clientChannelId` (`conversation.service.spec.ts` — see group 2 verification via full `nx test chat-api` run)
- [x] 4.9 Static check: reviewed `client-channel.service.ts`/`client-channel.controller.ts` logging — only channel id / event id / result are logged, never body payloads or tokens

## 5. Frontend: server-api adapter and feature flag

- [x] 5.1 Add `apps/chat/src/server-api/client-channel.ts`: raw-fetch `subscribeClientChannel` (SSE), generated-client-backed `reportClientChannel`/`unsubscribeClientChannel`
- [x] 5.2 Registered `features.liveChatInteraction` in the backend config registry (`config-registry.constants.ts`, `feature-key.enum.ts`, `LIVE_CHAT_INTERACTION_ENABLED[_ROLES]` env vars) so it flows into `AppConfigContext`'s `features` map under the short key `liveChatInteraction`; frontend reads it via the existing `useFeatureFlag('liveChatInteraction')` — no new frontend plumbing needed
- [x] 5.3 Verify: `npm exec nx lint chat` / typecheck (clean on the files touched in this slice; two pre-existing lint issues elsewhere in the repo are untouched/out of scope)

## 6. Frontend: `ClientChannelProvider`

- [x] 6.1 Create `apps/chat/src/context/ClientChannelContext.tsx`: channel id, connection status, `Map<eventId, PendingSigninEvent>`, memoized context value, guard hook `useClientChannel`
- [x] 6.2 Implement SSE reader with chunk-buffering parser (reuse/adapt the buffering approach from `chat-stream.api.ts`)
- [x] 6.3 Implement bounded-backoff reconnect (1/2/4/8/16s, 5 attempts, stop-and-wait-for-trigger after); resume trigger wired via `ensureConnected()` (tab visibility + best-effort call before a completion send)
- [x] 6.4 Implemented dedup-by-event-id in the context (`resolvedIdsRef`/`eventsMapRef`); same-toolset/same-credentials-level sibling auto-resolution is layered on top in the dialog (group 8.5), since credentials level isn't known until toolset metadata is resolved
- [x] 6.5 Mount `ClientChannelProvider` in `apps/chat/src/main.tsx` alongside `GenerationProvider`, gated by the feature flag
- [x] 6.6 Thread the current channel id into `useConversationStream.ts` / `chat-stream.api.ts` so completions attach it when available, without blocking send when it isn't
- [x] 6.7 Unsubscribe and clear pending events on flag-disabled-at-runtime (explicit effect) and on unmount (same cleanup path — `ClientChannelProvider` lives inside `RequireAuth`, so logout/session-end unmounts it for free)
- [x] 6.8 Verify: `npm exec nx test chat` — 1476 tests pass (8 new `ClientChannelContext.spec.tsx` unit tests); manual dev-server smoke test deferred to task 11.4

## 7. Frontend: shared `useToolsetLogin` controller

- [x] 7.1 Extract OAuth/API-key orchestration from `CatalogView.tsx` `handleLogin` into `apps/chat/src/hooks/toolsets/useToolsetLogin.ts`, preserving current behavior exactly
- [x] 7.2 Add `forceStale?: boolean` option: when true, always logout the target level before login/OAuth regardless of cached status
- [x] 7.3 Re-wire `CatalogView.tsx` to use the extracted hook (default behavior unchanged: OAuth never pre-logs-out, API key logs out only when `isCurrentlyFailed`)
- [x] 7.4 Verify: `npm exec nx test chat -- CatalogView` — all 39 pre-existing Catalog login tests pass unchanged; added 9 new `useToolsetLogin.spec.ts` unit tests

## 8. Frontend: `ToolsetSigninDialog`

- [x] 8.1 Scaffold `apps/chat/src/components/ToolsetSigninDialog/ToolsetSigninDialog.tsx` + `tests/` subfolder
- [x] 8.2 Render pending events from `useClientChannel`, resolve display name/version via `DeploymentsContext` toolsets (falling back to a one-shot `getToolset` fetch, then `getToolsetFallbackName(toolsetId)`), memoized via `infoByToolsetId`
- [x] 8.3 Non-dismissible modal semantics delegated to `DialPopup` (`hideClose`, no `onClose`, `closeOnOutsideClick={false}`) — the ui-kit component already provides the accessible dialog role, portal, and Floating-UI focus management used by every other modal in this app; did not layer a second manual `inert`/focus-trap implementation on top of it
- [x] 8.4 Implemented per-row `Log in` (API key field shown only for `API_KEY` auth; OAuth toolsets call `login()` directly, which opens the popup synchronously) and `Decline`, plus `Decline all`
- [x] 8.5 Wired `Log in` to `useToolsetLogin({ ..., forceStale: true })`; on success calls `reportEvent(id, 'success')`, then resolves sibling events sharing the same `toolsetId` + resolved credentials level
- [x] 8.6 Wired `Decline`/`Decline all` to `reportEvent(id, 'denied')` independently per event; a failed report keeps that row with a retryable inline error while others still succeed
- [x] 8.7 Added a shared `aria-live="polite"` status region (`sr-only`) for login/decline outcomes; each row has `aria-busy` while processing and only that row's actions are disabled
- [x] 8.8 Added `toolsetSignin.*` i18n keys to `apps/chat/src/i18n/locales/en.json` and a matching `ToolsetSigninI18nKeys` enum in `translation-keys.ts`; reused `ButtonsI18nKeys.LogIn` for the existing "Log in" string per the i18n-dedup rule
- [x] 8.9 Layout uses only logical/direction-agnostic Tailwind utilities (`justify-end`, `gap-*`, `flex-1`, `ps-*`-style patterns — no physical `ml-`/`mr-`/`text-left` classes), so it is RTL-safe without extra mirroring; relies on `DialPopup`'s existing responsive behavior rather than adding a separate `useIsMobile` branch, since no structurally different mobile layout was needed beyond what the shared modal already provides
- [x] 8.10 Mounted the dialog (lazy-loaded) at the authenticated-application level in `apps/chat/src/app/app.tsx`, as a permanent sibling outside `<Routes>`
- [x] 8.11 Verify: `npm exec nx test chat` — 1485 tests pass (8 new `ToolsetSigninDialog.spec.tsx` tests); manual dev-server smoke test (mobile/desktop/RTL/keyboard/screen-reader) deferred to task 11.4

## 9. Frontend tests

- [x] 9.1 SSE events split across arbitrary chunk boundaries parse correctly (`ClientChannelContext.spec.tsx`)
- [x] 9.2 Subscribe-before-completion ordering: completion sent before channel id ready proceeds without header (`chat-stream.api.spec.ts` "omits clientChannelId...")
- [x] 9.3 Reconnect/backoff/cleanup behavior, including retries-exhausted state (`ClientChannelContext.spec.tsx` "retries with capped backoff and stops after 5 attempts", using fake timers)
- [x] 9.4 Feature flag disabled: no subscribe attempt (`ClientChannelContext.spec.tsx`); dialog itself renders null whenever `pendingEvents` is empty, which is always true with the flag off since no subscription exists to produce events
- [x] 9.5 API key login success and failure paths through the dialog (`ToolsetSigninDialog.spec.tsx`)
- [x] 9.6 OAuth success, failure, cancellation, and popup-blocked covered at the shared-hook level (`useToolsetLogin.spec.ts`), which is what the dialog calls directly — not re-tested at the dialog level to avoid duplicating the same assertions against a mock
- [x] 9.7 Stale `SIGNED_IN` credentials are force-logged-out before relogin when `forceStale` is set, for both API key and OAuth (`useToolsetLogin.spec.ts`)
- [x] 9.8 Success reported to the channel only after the login call resolves — asserted via `waitFor` ordering in `ToolsetSigninDialog.spec.tsx`
- [x] 9.9 Single decline and decline-all with partial failure (`ToolsetSigninDialog.spec.tsx`)
- [x] 9.10 Duplicate event id delivery is deduplicated (`ClientChannelContext.spec.tsx`)
- [x] 9.11 Multiple pending events for the same toolset render as separate rows and sibling-resolve correctly (`ToolsetSigninDialog.spec.tsx` "resolves a sibling event...")
- [x] 9.12 Not unit-tested directly — holds structurally because `ClientChannelProvider`/`ToolsetSigninDialog` are tab-wide (mounted once above the router), not scoped to the displayed conversation; no per-conversation filtering exists to test against
- [x] 9.13 Not unit-tested directly — holds structurally because `ClientChannelProvider` is mounted inside `RequireAuth` alongside `GenerationProvider`, which the existing `useConversationStream` tests already rely on surviving without remounting
- [ ] 9.14 Mobile, desktop, keyboard-only, and RTL rendering checks — deferred to manual verification (task 11.4); not automated

## 10. Documentation

- [x] 10.1 Added `docs/auth/auth-diagrams/08-toolset-signin-interrupt.mmd` (+ rendered `.svg` via `mmdc`) covering subscribe → channel id → completion → signin event → login → report → resume → cleanup; linked in the diagrams `README.md` table
- [x] 10.2 Added `docs/auth/auth-bff-encrypted-cookie.md` §5.5 embedding the new diagram and explicitly stating this is a separate flow from OIDC login (5.1) that never touches the session cookie
- [x] 10.3 Updated `docs/architecture.md`: added `ClientChannelContext` to the frontend context table, `client-channel/` to the chat-api domain tree, a new "Client Channel" API surface subsection, and `CLIENT_CHANNEL` to the `ApiEndpoints` table

## 11. Final verification

- [x] 11.1 `npx nx affected -t lint --base=origin/development-1.0` — only pre-existing failure is `AppEditorIframe.tsx` (confirmed via `git diff` to be untouched by this change, so it also fails on `development-1.0` itself)
- [x] 11.2 `npx nx affected -t test --base=origin/development-1.0` — all affected projects pass (chat: 1487, chat-api: 1323, plus lib suites); one `chat-api` run hit a known-flaky real-`fetch`-to-unreachable-host test in `files-upload.service.spec.ts` unrelated to this change, confirmed passing on other runs
- [x] 11.3 `npx nx affected -t build --base=origin/development-1.0` — frontend and backend both build; `ToolsetSigninDialog`/`useToolsetLogin` ship as separate lazy-loaded chunks
- [ ] 11.4 Manual end-to-end smoke test with the feature flag enabled in a local/dev environment: trigger a completion against a toolset with invalid credentials, confirm the dialog appears, log in, confirm the tool call resumes — **not performed** (requires a running DIAL Core + real toolset; out of scope for this automated session)
- [ ] 11.5 Resolve or explicitly defer the Open Questions in design.md before/at merge (Core replay semantics, tool-capability gating, decline-all retry UX, sibling auto-resolution, generated-client boundary for subscribe, reconnect policy) — **deferred to human review**; design.md's decisions represent reasonable defaults but the open questions still need product/Core-team confirmation before this ships enabled
