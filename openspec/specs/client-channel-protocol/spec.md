# client-channel-protocol Specification

## Purpose
TBD - created by archiving change interactive-toolset-login-chat. Update Purpose after archive.
## Requirements

### Requirement: BFF proxies DIAL Core client-channel subscribe as an SSE relay

The backend SHALL expose `POST /api/v1/client-channel/subscribe` (NestJS domain `apps/chat-api/src/client-channel/`, `ClientChannelController`, `@Controller({ path: 'client-channel', version: '1' })`). The endpoint SHALL call `@epam/ai-dial-typescript-sdk`'s `subscribeClientChannel` using the bearer access token from the caller's encrypted BFF session (never a value supplied by the browser), and SHALL relay the upstream `text/event-stream` response body to the browser without buffering it in memory. The response SHALL echo the `X-DIAL-CLIENT-CHANNEL-ID` header returned by Core. If the browser already holds a channel id (reconnect), the frontend SHALL send it as a request header and the backend SHALL forward it to Core unchanged so Core can attempt to resume the same channel. The relayed SSE body MAY carry RPC events of different `method` values (e.g. `toolset/signin`, `external-service/signin`) — the backend SHALL relay every event body-for-body without inspecting or filtering on `method`; method-specific handling is entirely a frontend concern.

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

#### Scenario: Upstream Core connection fails
- **WHEN** the upstream `subscribeClientChannel` call to Core fails or the upstream stream errors
- **THEN** the backend closes the response stream to the browser so the frontend's `EventSource`/`fetch` reader observes the failure and can apply its own reconnect policy

#### Scenario: Stream carries a mix of event methods
- **WHEN** the relayed SSE body contains both a `toolset/signin` frame and an `external-service/signin` frame for the same channel
- **THEN** the backend relays both frames unmodified and in order, leaving method-based dispatch entirely to the frontend

### Requirement: BFF proxies report and unsubscribe operations

The backend SHALL expose `POST /api/v1/client-channel/report` and `POST /api/v1/client-channel/unsubscribe`, both requiring a valid channel id and both applying the standard global `CsrfGuard` (no `@Public()` exemption).

`POST /api/v1/client-channel/report`:
- Request header: `X-DIAL-CLIENT-CHANNEL-ID` (required).
- Request body (`ReportClientChannelDto`): `{ "id": string, "result": "success" | "denied" }` — validated with `class-validator`: `id` allowlisted to a safe opaque-id character set, `result` restricted to the enum.
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

#### Scenario: Unsubscribe on a channel Core has already dropped
- **WHEN** `POST /api/v1/client-channel/unsubscribe` targets a channel id Core responds to with 404
- **THEN** the backend returns `200` to the frontend (idempotent)

#### Scenario: CSRF token required
- **WHEN** any of the three client-channel endpoints is called without a valid `X-CSRF-Token` header
- **THEN** the backend returns `403` via the existing global `CsrfGuard`, identical to other mutating endpoints

### Requirement: Channel id propagates into the completion request

`ConversationStreamingService.streamCompletion` (invoked via the `ConversationService` facade, which keeps the identical signature) SHALL accept an optional `clientChannelId` parameter. When the frontend's completion request includes a current channel id, `POST /api/conversations/completions` SHALL accept it (request field or header, backend-defined) and the backend SHALL forward it as the `X-DIAL-CLIENT-CHANNEL-ID` header on the upstream completion call to Core so Core can correlate a `toolset/signin` event to that specific tool invocation. This SHALL be additive and SHALL NOT change any existing documented completion persistence behavior.

#### Scenario: Completion sent with a known channel id
- **WHEN** the frontend has an active channel id at the time it calls `streamCompletion`
- **THEN** the upstream completion request to Core includes `X-DIAL-CLIENT-CHANNEL-ID` set to that id

#### Scenario: Completion sent before a channel id is available
- **WHEN** the frontend has not yet received a channel id (subscription still connecting or the feature flag is off)
- **THEN** the completion request proceeds without the header, and behaves exactly as it does today

### Requirement: `liveChatInteraction` feature flag gates the mechanism

The mechanism SHALL be gated by a feature flag key `liveChatInteraction`, read via the existing `AppConfigContext`/`useFeatureFlag` mechanism (server-supplied `features` map). When the flag is `false` or not yet `Ready`, the frontend SHALL NOT attempt to subscribe to the client channel and SHALL NOT attach a channel id to completion requests.

In addition, the frontend SHALL only hold an open client-channel subscription while the current route is a streaming-capable page — `ROUTES.Conversations` (`/conversations` and any sub-path, e.g. a specific `/conversations/<id>`) or `ROUTES.AppsEditor` (`/apps-editor`) — matching `useConversationStream`'s two call sites (`Conversation` and `AppPreviewChat`). `ROUTES.Root` (`/`, the pre-conversation composer/empty state rendered by `ConversationRoute`) SHALL NOT count as streaming-capable: it creates a new conversation via a plain REST call and navigates to `/conversations/<id>` before any stream can exist, so it never itself hosts a live stream. `ClientChannelProvider` SHALL derive this route condition using `react-router`'s `useMatch`, since the provider is mounted inside `BrowserRouter`. The connect/reconnect/visibility-resume logic SHALL require both the flag being enabled AND the route condition; leaving a streaming-capable route while the channel is open SHALL disconnect it (unsubscribe from Core, clear pending events) the same way disabling the flag does today, and returning to a streaming-capable route (flag still enabled) SHALL reconnect it.

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

### Requirement: No secrets logged in client-channel handling

Backend and frontend code handling client-channel operations SHALL NOT log full RPC request/response payloads. Logging SHALL be limited to operation name, channel id (only after allowlist validation), and event id. API keys, OAuth codes, and access tokens SHALL never appear in client-channel-related log lines, matching the existing `loginToolset`/`logoutToolset` logging discipline.

#### Scenario: Report call is logged without payload contents
- **WHEN** the backend logs a `report` call at debug level
- **THEN** the log line includes the channel id and event id but not the full RPC response body
