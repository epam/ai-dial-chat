## MODIFIED Requirements

### Requirement: POST /api/v1/conversations/watch proxies DIAL Core resource subscription as SSE

The backend SHALL expose a versioned endpoint:

| Field | Value |
|---|---|
| Method | `POST` |
| Path | `/api/v1/conversations/watch` |
| Auth | `SessionGuard` (same as all `/api/v1/conversations/*` routes) |
| Rate limit | `@Throttle({ default: { limit: 20, ttl: 60000 } })` |
| Content-Type response | `text/event-stream` |

**Request body (`WatchConversationBodyDto`):**

```json
{ "path": "deploymentId__ConvName" }
```

`path` is the conversation sub-path (bucket-stripped), validated with `@IsString()` and `@Matches(/^[^./\\][^./\\]*([/][^./\\][^./\\]*)*$/)` allowlist regex.

**SSE event format** (each event forwarded verbatim from DIAL Core):

```
data: {"url":"files/bucket/deploymentId__ConvName","action":"UPDATE","timestamp":1719000000000}

```

The backend SHALL:

1. Build the DIAL Core resource URL as `files/{bucket}/{subPath}` where `bucket` is the session bucket and `subPath` is derived from `path` via `resolveConversationLocation`.
2. Construct an `AbortController` and register `res.on('close', ...)` before calling `ConversationService.watchConversation` (before the first `await` of upstream setup), so a browser disconnect during that call aborts it immediately rather than being observed only after it resolves.
3. Call `this.client.subscribeToResources({ body: { resources: [{ url }] }, headers: getBearerAuthHeaders(at), signal })`, passing the controller's `AbortSignal` through `ConversationService.watchConversation` and `ConversationStreamingService.watchConversation` to the DIAL Core SDK call.
4. Set response headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, then flush.
5. Pipe the DIAL Core SSE `ReadableStream` body to the Express `Response` using the same reader loop as `streamCompletion`, respecting `res.write()`'s backpressure return value: while it returns `false`, stop issuing further upstream reads until `'drain'`, the response closing, an upstream error, or `SSE_DRAIN_TIMEOUT_MS` (5000ms) elapses — whichever happens first. If the timeout elapses first, treat the connection as stalled and close it the same way as an explicit disconnect.
6. Send a keepalive comment (`: keepalive\n\n`) every 15 seconds while the connection is open.
7. Close the response when the DIAL Core stream ends, the client disconnects, or the connection is treated as stalled per the backpressure timeout above.

Swagger SHALL document this endpoint with `@ApiOperation`, `@ApiResponse` for 200, 400, 401, and 502.

**OpenAPI operationId:** `watchConversation`
**Generated client method:** `conversationsApi.watchConversation({ watchConversationBodyDto: { path } })`
The frontend uses the `Raw` variant to access `Response.body` as a `ReadableStream`.

No i18n keys, no RTL impact, no caching, no analytics events for this endpoint.

#### Scenario: Watch endpoint opens SSE stream to DIAL Core

- **WHEN** an authenticated client sends `POST /api/v1/conversations/watch` with `{ "path": "gpt-4o__Chat" }`
- **THEN** the response is `200 text/event-stream` and the server proxies DIAL Core resource events for `files/{bucket}/gpt-4o__Chat` to the client

#### Scenario: Invalid path is rejected

- **WHEN** `POST /api/v1/conversations/watch` is sent with `path` containing `..` or an empty string
- **THEN** the response is `400 Bad Request`

#### Scenario: Unauthenticated request is rejected

- **WHEN** `POST /api/v1/conversations/watch` is sent without a valid session cookie
- **THEN** the response is `401 Unauthorized`

#### Scenario: Client disconnect closes the DIAL Core subscription

- **WHEN** the browser closes the SSE connection (component unmount or AbortController)
- **THEN** the server's reader loop exits and the DIAL Core subscription stream is cancelled

#### Scenario: Client disconnects while the upstream subscribe call is still pending

- **WHEN** the browser closes the connection to `/api/v1/conversations/watch` before `subscribeToResources` has resolved
- **THEN** the backend's `AbortController` is aborted immediately, the pending `subscribeToResources` call is cancelled via the propagated `AbortSignal`, and no reader, response headers, or keepalive timer is started for the now-closed connection

#### Scenario: A slow browser applies backpressure

- **WHEN** `res.write()` on the relayed response returns `false` because the browser is not reading fast enough
- **THEN** the backend stops reading further bytes from the upstream Core stream until the response drains, an error occurs, the response closes, or `SSE_DRAIN_TIMEOUT_MS` elapses

#### Scenario: A stalled browser connection is closed after the drain timeout

- **WHEN** `res.write()` returns `false` and no `'drain'` event, close, or upstream error occurs within `SSE_DRAIN_TIMEOUT_MS`
- **THEN** the backend cancels the upstream reader and keepalive timer and ends the response, the same as it would for an explicit client disconnect
