## MODIFIED Requirements

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
