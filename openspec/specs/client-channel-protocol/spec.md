# client-channel-protocol Specification

## Purpose
TBD - created by archiving change interactive-toolset-login-chat. Update Purpose after archive.
## Requirements

### Requirement: BFF proxies DIAL Core client-channel subscribe as an SSE relay

The backend SHALL expose `POST /api/v1/client-channel/subscribe` (NestJS domain `apps/chat-api/src/client-channel/`, `ClientChannelController`, `@Controller({ path: 'client-channel', version: '1' })`). The endpoint SHALL call `@epam/ai-dial-typescript-sdk`'s `subscribeClientChannel` using the bearer access token from the caller's encrypted BFF session (never a value supplied by the browser), and SHALL relay the upstream `text/event-stream` response body to the browser without buffering it in memory. The response SHALL echo the `X-DIAL-CLIENT-CHANNEL-ID` header returned by Core. If the browser already holds a channel id (reconnect), the frontend SHALL send it as a request header and the backend SHALL forward it to Core unchanged so Core can attempt to resume the same channel. The relayed SSE body MAY carry RPC events of different `method` values (e.g. `toolset/signin`, `external-service/signin`) — the backend SHALL relay every event body-for-body without inspecting or filtering on `method`; method-specific handling is entirely a frontend concern.

The handler SHALL register its `res.on('close', ...)` listener, and construct the `AbortController` whose signal is passed to `ClientChannelService.subscribe`, before making that call — i.e. before the first `await` of upstream setup — so a browser disconnect that happens while the upstream subscribe call is still in flight aborts that call immediately instead of being observed only once the call resolves. The `dial_chat_sse_active{kind="client_channel"}` gauge contribution (see `observability-telemetry`) SHALL start before this call and be released exactly once when the handler settles, unchanged by this requirement.

While relaying, the handler SHALL respect `res.write()`'s return value: when it returns `false`, the handler SHALL stop issuing further upstream reads until the response emits `'drain'`, bounded by the response closing, the upstream stream erroring, or an internal drain timeout (`SSE_DRAIN_TIMEOUT_MS`, 5000ms) — whichever happens first. If the drain timeout elapses without a `'drain'` event, the handler SHALL treat the connection as stalled: cancel the upstream reader and end the response, identical to a client disconnect.

Request: no body. Optional request header `X-DIAL-CLIENT-CHANNEL-ID` (reconnect case).
Response: `200 text/event-stream`, response header `X-DIAL-CLIENT-CHANNEL-ID`, SSE body of `RpcRequest` events framed as `data: <json>\n\n`.
Generated-client impact: this endpoint is **not** exposed through the generated `@epam/chat-api-client` (SSE streaming is a documented generator gap, matching the existing `chat-stream.api.ts` precedent); the frontend calls it with a raw `fetch` in a new `apps/chat/src/server-api/client-channel.ts` adapter, same pattern as `streamCompletion`.

#### Scenario: Fresh subscribe returns a new channel id
- **WHEN** the frontend calls `POST /api/v1/client-channel/subscribe` with no `X-DIAL-CLIENT-CHANNEL-ID` header
- **THEN** the backend opens a new upstream Core subscription and streams back `200 text/event-stream` with a fresh `X-DIAL-CLIENT-CHANNEL-ID` response header

#### Scenario: Reconnect forwards the existing channel id
- **WHEN** the frontend calls subscribe with an `X-DIAL-CLIENT-CHANNEL-ID` header from a previous session
- **THEN** the backend forwards that header value to Core's subscribe call unchanged

#### Scenario: Browser disconnects mid-stream
- **WHEN** the browser closes the connection to `/api/v1/client-channel/subscribe` while events are streaming
- **THEN** the backend aborts the upstream Core reader/fetch and releases any associated resources within the same request lifecycle, without waiting for a subsequent request to clean it up

#### Scenario: Browser disconnects while the upstream subscribe call is still pending
- **WHEN** the browser closes the connection to `/api/v1/client-channel/subscribe` before the upstream `subscribeClientChannel` call has resolved
- **THEN** the backend's `AbortController` is aborted immediately (not only after the call eventually resolves), the pending `subscribeClientChannel` fetch is cancelled, and no reader, response headers, or keepalive work is started for the now-closed connection

#### Scenario: Upstream Core connection fails
- **WHEN** the upstream `subscribeClientChannel` call to Core fails or the upstream stream errors
- **THEN** the backend closes the response stream to the browser so the frontend's `EventSource`/`fetch` reader observes the failure and can apply its own reconnect policy

#### Scenario: Stream carries a mix of event methods
- **WHEN** the relayed SSE body contains both a `toolset/signin` frame and an `external-service/signin` frame for the same channel
- **THEN** the backend relays both frames unmodified and in order, leaving method-based dispatch entirely to the frontend

#### Scenario: A slow browser applies backpressure
- **WHEN** `res.write()` on the relayed response returns `false` because the browser is not reading fast enough
- **THEN** the backend stops reading further bytes from the upstream Core stream until the response drains, an error occurs, the response closes, or `SSE_DRAIN_TIMEOUT_MS` elapses

#### Scenario: A stalled browser connection is closed after the drain timeout
- **WHEN** `res.write()` returns `false` and no `'drain'` event, close, or upstream error occurs within `SSE_DRAIN_TIMEOUT_MS`
- **THEN** the backend cancels the upstream reader and ends the response, the same as it would for an explicit client disconnect

### Requirement: BFF proxies report and unsubscribe operations

The backend SHALL expose `POST /api/v1/client-channel/report` and `POST /api/v1/client-channel/unsubscribe`, both requiring a valid channel id and both applying the standard global `CsrfGuard` (no `@Public()` exemption).

`POST /api/v1/client-channel/report`:
- Request header: `X-DIAL-CLIENT-CHANNEL-ID` (required).
- Request body (`ReportClientChannelDto`): `{ "id": string, "result": "success" | "denied" }` — validated with `class-validator`: `id` allowlisted to a safe opaque-id character set (letters, digits, dashes, underscores, dots, `%`, and slashes — the `%` is required because a `toolset/signin`/`external-service/signin` event's `id` is a percent-encoded resource path, e.g. an application name containing spaces), `result` restricted to the enum.
- Response: `200 {}` on success.
- Error codes: `400` invalid/missing channel id or malformed body; `401` no valid BFF session; `502` if Core rejects or errors on the report call.

`POST /api/v1/client-channel/unsubscribe`:
- Request header: `X-DIAL-CLIENT-CHANNEL-ID` (required).
- Response: `200 {}` on success; treats Core's 404 (channel already gone) as idempotent success, mirroring the existing `logoutToolset` 404-as-success precedent.

Generated-client impact: both endpoints SHALL be exposed through the generated `@epam/chat-api-client` (non-streaming JSON request/response) with `operationIdFactory` names `reportClientChannel` / `unsubscribeClientChannel`; the frontend calls them through thin wrappers in `apps/chat/src/server-api/client-channel.ts`, following the same pattern as `apps/chat/src/server-api/toolsets.ts`.

#### Scenario: Report success
- **WHEN** the frontend posts `{ id: "<eventId>", result: "success" }` with a valid channel id
- **THEN** the backend forwards the RPC response to Core via `reportClientChannel` and returns `200`

#### Scenario: Report with missing channel id header
- **WHEN** `POST /api/v1/client-channel/report` is called without `X-DIAL-CLIENT-CHANNEL-ID`
- **THEN** the backend returns `400` and does not call Core

#### Scenario: Report with invalid characters in channel id
- **WHEN** the `X-DIAL-CLIENT-CHANNEL-ID` header value fails the allowlist validation
- **THEN** the backend returns `400` without forwarding the value to Core or writing it to logs verbatim

#### Scenario: Report with a percent-encoded event id
- **WHEN** the frontend posts `{ id: "applications/<bucket>/My%20App__1.0/1", result: "denied" }` — an `id` containing `%` from percent-encoded path segments
- **THEN** the `id` allowlist accepts it and the backend forwards the report to Core

#### Scenario: Unsubscribe on a channel Core has already dropped
- **WHEN** `POST /api/v1/client-channel/unsubscribe` targets a channel id Core responds to with 404
- **THEN** the backend returns `200` to the frontend (idempotent)

#### Scenario: CSRF token required
- **WHEN** any of the three client-channel endpoints is called without a valid `X-CSRF-Token` header
- **THEN** the backend returns `403` via the existing global `CsrfGuard`, identical to other mutating endpoints

### Requirement: Channel id propagates into the completion request

`ConversationStreamingService.streamCompletion` (invoked via the `ConversationService` facade, which keeps the identical signature) SHALL accept an optional `clientChannelId` parameter. When the frontend's completion request includes a current channel id, `POST /api/conversations/completions` SHALL accept it (request field or header, backend-defined) and the backend SHALL forward it as the `X-DIAL-CLIENT-CHANNEL-ID` header on the upstream completion call to Core so Core can correlate a `toolset/signin` event to that specific tool invocation. This SHALL be additive and SHALL NOT change any existing documented completion persistence behavior.

Since the subscribe request is asynchronous, the frontend's `useConversationStream.startStream` SHALL NOT read the channel id synchronously and give up if it is not yet set — it SHALL await `ConversationStreamChannel.waitForChannel()`, which resolves with the channel id once an in-flight subscribe completes or with `null` after a bounded timeout, so a completion sent immediately after mounting a streaming-capable page can still carry the id once the subscription catches up.

#### Scenario: Completion sent with a known channel id
- **WHEN** the frontend has an active channel id at the time it calls `streamCompletion`
- **THEN** the upstream completion request to Core includes `X-DIAL-CLIENT-CHANNEL-ID` set to that id

#### Scenario: Completion sent while the subscribe round trip is still in flight
- **WHEN** the frontend calls `streamCompletion` before its client-channel subscribe request has resolved (e.g. the first message sent right after mounting a streaming-capable page)
- **THEN** the frontend awaits the in-flight subscription, bounded by a short timeout, and attaches the resulting channel id to the completion if it resolves in time

#### Scenario: Completion sent while the feature flag is off or the wait times out
- **WHEN** the feature flag is off, or the subscribe attempt does not resolve within the bounded wait
- **THEN** the completion request proceeds without the header, and behaves exactly as it does today

#### Scenario: QuickApps preview attaches the channel id like the main conversation page
- **WHEN** a completion is started from the QuickApps preview (`AppPreviewChat`, mounted under `/apps-editor`) against a toolset-backed app whose tool requires sign-in
- **THEN** `AppPreviewChat`'s own `useConversationStream` call supplies the same `ConversationStreamChannel` (`channelId`/`ensureConnected`/`waitForChannel` from `useClientChannel`) that `Conversation` supplies, so the completion carries `X-DIAL-CLIENT-CHANNEL-ID` and Core's `toolset/signin` event reaches `SigninInterruptDialog` instead of the stage only surfacing a stream error

### Requirement: `liveChatInteraction` feature flag gates the mechanism

The mechanism SHALL be gated by a feature flag key `liveChatInteraction`, read via the existing `AppConfigContext`/`useFeatureFlag` mechanism (server-supplied `features` map). When the flag is `false` or not yet `Ready`, the frontend SHALL NOT attempt to subscribe to the client channel and SHALL NOT attach a channel id to completion requests.

In addition, the frontend SHALL only hold an open client-channel subscription while the current route is a streaming-capable page — `ROUTES.Conversations` (`/conversations` and any sub-path, e.g. a specific `/conversations/<id>`) or `ROUTES.AppsEditor` (`/apps-editor`) — matching `useConversationStream`'s two call sites (`Conversation` and `AppPreviewChat`). `ROUTES.Root` (`/`, the pre-conversation composer/empty state rendered by `ConversationRoute`) SHALL NOT count as streaming-capable: it creates a new conversation via a plain REST call and navigates to `/conversations/<id>` before any stream can exist, so it never itself hosts a live stream. `ClientChannelProvider` SHALL derive this route condition using `react-router`'s `useMatch`, since the provider is mounted inside `BrowserRouter`. The connect/reconnect/visibility-resume logic SHALL require both the flag being enabled AND the route condition; leaving a streaming-capable route while the channel is open SHALL disconnect it (unsubscribe from Core, clear pending events) the same way disabling the flag does today, and returning to a streaming-capable route (flag still enabled) SHALL reconnect it.

The active flag/route condition SHALL be available to `ensureConnected`/`waitForChannel` synchronously as of the render that computes it, not only after `ClientChannelProvider`'s own effect commits. Syncing the underlying ref inside a `useEffect` leaves a one-commit window, on the render that first makes a page streaming-capable, where a *child* page's own mount effect (e.g. `Conversation` auto-starting its first completion, which React runs before an ancestor provider's effect in the same commit) observes a stale "inactive" value and gives up without attempting to connect or wait.

#### Scenario: A newly streaming-capable page's own mount effect needs the channel immediately
- **WHEN** navigation makes the current route streaming-capable (e.g. a brand-new conversation created from `/` navigates to `/conversations/<id>`) and, in that same render, the page's own mount effect immediately calls `ensureConnected`/`waitForChannel`
- **THEN** the active flag already reflects the new route for that call — it does not read a stale value left over from the previous route

The backend SHALL also enforce the flag server-side (defense in depth, so a restricted or fully-disabled user cannot bypass the frontend gate by calling the API directly): `POST /api/v1/client-channel/subscribe` and `POST /api/v1/client-channel/report` SHALL apply the existing `FeatureGuard`/`@RequireFeature(FeatureKey.LiveChatInteraction)` mechanism and return `403` when the flag resolves to `false` for the caller (including role-restricted denials via `LIVE_CHAT_INTERACTION_ENABLED_ROLES`). `POST /api/v1/client-channel/unsubscribe` SHALL NOT be gated by the flag, so a client that already holds an open channel can always tear it down (e.g. the flag flips off mid-session, the user's role no longer qualifies, or the user navigates off a streaming-capable route) regardless of the flag's current value for that user.

#### Scenario: Flag disabled

- **WHEN** `liveChatInteraction` resolves to `false`
- **THEN** no subscribe request is made and completions carry no channel id

#### Scenario: Flag flips to disabled while a channel is active

- **WHEN** the flag becomes `false` after a channel was already subscribed
- **THEN** the frontend calls unsubscribe for the active channel and clears any pending signin events from the dialog state

#### Scenario: Backend rejects subscribe for a user the flag resolves false for

- **WHEN** a caller with a valid session calls `POST /api/v1/client-channel/subscribe` while `liveChatInteraction` resolves to `false` for that user (globally disabled or excluded by `LIVE_CHAT_INTERACTION_ENABLED_ROLES`)
- **THEN** the backend returns `403` without contacting DIAL Core

#### Scenario: Backend rejects report for a user the flag resolves false for

- **WHEN** a caller calls `POST /api/v1/client-channel/report` while the flag resolves to `false` for that user
- **THEN** the backend returns `403` without forwarding the report to DIAL Core

#### Scenario: Unsubscribe is never blocked by the flag

- **WHEN** a caller calls `POST /api/v1/client-channel/unsubscribe` while the flag resolves to `false` for that user
- **THEN** the backend still processes the unsubscribe normally

#### Scenario: Flag enabled but user is on a non-streaming-capable page

- **WHEN** `liveChatInteraction` resolves to `true` but the current route is not `/conversations/*` or `/apps-editor` (e.g. `/`, `/catalog`, `/files`, `/toolset-editor`, `/scheduled-tasks`, `/custom-app-editor`)
- **THEN** the frontend does not open a client-channel subscription

#### Scenario: Flag enabled but user is on the pre-conversation home page

- **WHEN** `liveChatInteraction` resolves to `true` and the current route is bare `/` (no conversation selected yet)
- **THEN** the frontend does not open a client-channel subscription, since `/` never itself hosts a live stream

#### Scenario: Navigating from the conversation page to a non-streaming-capable page disconnects the channel

- **WHEN** the flag is enabled, a channel is currently open, and the user navigates from `/conversations` to `/files`
- **THEN** the frontend calls unsubscribe for the active channel, clears the channel id and any pending signin events, and does not attempt to reconnect while on `/files`

#### Scenario: Navigating back to a streaming-capable page reconnects

- **WHEN** the flag is enabled and the user navigates from a non-streaming-capable page back to `/conversations` or `/apps-editor`
- **THEN** the frontend opens a new client-channel subscription, same as the existing flag-enabled mount behavior

#### Scenario: Navigating between conversations keeps the channel open

- **WHEN** the user navigates from `/conversations` to a different conversation still under `/conversations/*`
- **THEN** the existing client-channel subscription is not torn down or reconnected

### Requirement: The channel disconnects after a short idle period once nothing is generating

In addition to the existing route-scoped connect/disconnect lifecycle (mount on a streaming-capable route, disconnect on route-leave/flag-disable/unmount), `ClientChannelProvider` (`apps/chat/src/context/ClientChannelContext.tsx`) SHALL also disconnect the active client-channel subscription after a short idle grace period once no generation is active anywhere in the app, so an open subscription is not held for the entire time a user remains on a streaming-capable route without actually streaming anything.

`useConversationStream` (`libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts`)'s `ConversationStreamChannel` capability interface SHALL expose an optional `notifyGenerationSettled?: () => void` callback, invoked once from both the `onComplete` and `onError` cleanup paths of `startStream`, after the existing generation-ending cleanup (mirroring the existing `overlay?.notifyGenerationStart?.()`/`overlay?.notifyGenerationEnd?.()` pattern already in that function). `GenerationContext` (`apps/chat/src/context/GenerationContext.tsx`) SHALL expose `hasActiveGeneration(): boolean`, true iff any entry in its registry currently has status `Active`.

On `notifyGenerationSettled()`, `ClientChannelProvider` SHALL:
- Do nothing if `hasActiveGeneration()` is `true` (another conversation, in this same browser tab, is still streaming).
- Otherwise schedule a disconnect after an idle grace delay of 1000ms, canceling any previously scheduled idle-disconnect timer first.

`ensureConnected()` (already called at the start of every completion) SHALL cancel any pending idle-disconnect timer as its first step, so a new completion started within the grace window keeps the existing channel instead of tearing it down and reopening it.

This mechanism is scoped to generations tracked by this browser tab's own `GenerationContext` instance; it has no visibility into generations happening in a different tab or window.

#### Scenario: Idle disconnect after the only active generation completes

- **GIVEN** a client-channel subscription is open and exactly one generation is active
- **WHEN** that generation completes (or errors) and no other generation is active
- **THEN** the channel remains open for 1000ms, then disconnects (unsubscribes from Core, clears the channel id)

#### Scenario: A new completion within the grace window cancels the pending disconnect

- **GIVEN** a generation has just completed and an idle-disconnect has been scheduled
- **WHEN** a new completion starts (calling `ensureConnected()`) before the 1000ms grace window elapses
- **THEN** the pending disconnect is canceled and the existing channel subscription is kept, with no unsubscribe/resubscribe round trip

#### Scenario: Another active generation suppresses the idle disconnect

- **GIVEN** two conversations are generating (e.g. the user navigated from a still-streaming conversation to a different one and started a second completion there)
- **WHEN** one of the two generations completes
- **THEN** no disconnect is scheduled, since `hasActiveGeneration()` still reports `true` for the other one

#### Scenario: A completion started after an idle disconnect reconnects transparently

- **GIVEN** the channel was disconnected after an idle period
- **WHEN** the user sends a new completion
- **THEN** `ensureConnected()` opens a fresh subscription the same way it does on initial mount, and `waitForChannel`'s existing bounded wait covers the round trip before the completion's channel id is needed

### Requirement: No secrets logged in client-channel handling

Backend and frontend code handling client-channel operations SHALL NOT log full RPC request/response payloads. Logging SHALL be limited to operation name, channel id (only after allowlist validation), and event id. API keys, OAuth codes, and access tokens SHALL never appear in client-channel-related log lines, matching the existing `loginToolset`/`logoutToolset` logging discipline.

#### Scenario: Report call is logged without payload contents
- **WHEN** the backend logs a `report` call at debug level
- **THEN** the log line includes the channel id and event id but not the full RPC response body
