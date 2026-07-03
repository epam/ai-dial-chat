# Spec: conversation-watch-sse

## Purpose

BFF endpoint and frontend integration that lets the browser subscribe to DIAL Core resource-update events for a single conversation, enabling the LLM naming detection to be push-based instead of polled.

## Requirements

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
2. Call `this.client.subscribeToResources({ body: { resources: [{ url }] }, headers: getBearerAuthHeaders(at) })`.
3. Set response headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, then flush.
4. Pipe the DIAL Core SSE `ReadableStream` body to the Express `Response` using the same reader loop as `streamCompletion`.
5. Send a keepalive comment (`: keepalive\n\n`) every 15 seconds while the connection is open.
6. Close the response when the DIAL Core stream ends or the client disconnects.

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

---

### Requirement: Frontend subscribes to conversation watch and replaces polling

`watchForDisplayNameUpdate` in `ConversationsContext` SHALL:

1. Call `conversationsApi.watchConversationRaw({ watchConversationBodyDto: { path } })` (generated client Raw variant) to get the `Response`.
2. Read the SSE body via `response.body.getReader()` and a `TextDecoder`, splitting on `\n`.
3. On each `data:` line: parse JSON `{ url, action, timestamp }`.
4. On an `UPDATE` action for the subscribed URL: call `getConversation(conversationPath)` once.
5. If `result.llmNamingDone === true` or `result.name?.trim() !== previousName.trim()`: call `updateConversationTitle`, `onUpdated(result.name)`, `silentRefreshConversations()`, then close the connection.
6. On any other action or a `data:` line that does not match: continue reading.
7. Abort the connection after `DISPLAY_NAME_WATCH_TIMEOUT_MS = 120_000` using an `AbortController` passed to the fetch.
8. Cancel the connection when the returned cleanup function is called (component unmount).
9. If the SSE stream ends unexpectedly before a qualifying event (e.g. server-side close): exit the read loop and complete silently — the title stays message-derived. Reconnect on network interruption is **out of scope**.

The frontend SHALL NOT poll `getConversation` on an interval. Constants `DISPLAY_NAME_POLL_INTERVAL_MS` and `DISPLAY_NAME_POLL_MAX_ATTEMPTS` SHALL be removed.

State ownership: `watchForDisplayNameUpdate` remains a method on `ConversationsContext`, unchanged contract (`(conversationId, previousName, onUpdated) => () => void`).

No new i18n keys. No RTL impact. No analytics events. No memoisation changes beyond the existing `useCallback`.

#### Scenario: Name update via SSE triggers title refresh

- **WHEN** DIAL Core emits an `UPDATE` event for the watched conversation and the subsequent `getConversation` returns `llmNamingDone: true`
- **THEN** `updateConversationTitle` is called with the new name, `onUpdated` fires, and the SSE connection is closed

#### Scenario: Non-UPDATE events are ignored

- **WHEN** a `CREATE` or `DELETE` event arrives on the SSE stream
- **THEN** the frontend continues reading without calling `getConversation`

#### Scenario: Timeout closes the connection

- **WHEN** 120 seconds elapse without a qualifying UPDATE event
- **THEN** the AbortController aborts the fetch and the cleanup completes silently

#### Scenario: Component unmount cancels the watch

- **WHEN** the `Conversation` page unmounts while a watch is open
- **THEN** the cleanup function aborts the SSE fetch and no further state updates occur
