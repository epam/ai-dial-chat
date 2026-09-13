## MODIFIED Requirements

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
