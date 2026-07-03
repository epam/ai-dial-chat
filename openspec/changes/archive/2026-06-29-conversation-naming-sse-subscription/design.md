## Context

LLM conversation naming runs fire-and-forget after the first user+assistant exchange and saves `{ name, llmNamingDone: true }` back to DIAL Core. The frontend currently detects completion by polling `GET /api/v1/conversations/:path` every 2 seconds up to 25 times (50 s). Polling fires for every conversation that lacks `llmNamingDone: true` — old conversations (pre-feature), naming-disabled deployments, and re-sends in existing chats — generating up to 25 redundant GETs per navigation.

DIAL Core exposes `POST /v1/ops/resource/subscribe` (SSE) that emits `{ url, action, timestamp }` events whenever a resource is created, updated, or deleted. The naming service's in-place save triggers an `UPDATE` event on the conversation file URL. Switching to this mechanism eliminates all wasted requests and makes title updates appear as soon as naming completes.

The chat-api already has an SSE proxy pattern (`POST /api/v1/conversations/completions`) that reads a `ReadableStream` from the DIAL SDK and writes raw bytes to the Express `Response`. The watch endpoint reuses the same keepalive+pipe approach. The frontend also already reads SSE with `fetch` + `ReadableStream` (see `chat-stream.api.ts`).

## Goals / Non-Goals

**Goals:**
- Replace all polling in `watchForDisplayNameUpdate` with a single SSE connection per naming watch.
- Add `POST /api/v1/conversations/watch` as a thin BFF proxy to DIAL Core subscriptions.
- Keep the watch connection open only as long as needed: close on `llmNamingDone: true`, component unmount, or a safe timeout ceiling.
- Follow existing patterns: SSE keepalive in the backend, `AbortController` + cancelled flag in the frontend.

**Non-Goals:**
- General-purpose resource subscription API (this endpoint is scoped to conversation naming).
- Replacing other polling or push patterns in the codebase.
- Any change to the backend naming logic (`ConversationNamingService`, `llmNamingDone` persistence).
- Retry / reconnect logic beyond a single `AbortController` teardown.

## Decisions

### Decision 1: SSE proxy via raw `res.write()`, not NestJS `@Sse()` decorator

**Chosen:** Raw `@Post() async watchConversation(@Res() res: Response)` with `res.setHeader('Content-Type', 'text/event-stream')` and `res.write()` — identical to the existing `streamCompletion` action.

**Alternative:** NestJS `@Sse()` with `Observable<MessageEvent>`. Rejected because `@Sse()` only supports `GET`, but `subscribeToResources` is `POST`. Keeping the pattern consistent with `streamCompletion` also avoids pulling in `rxjs`.

---

### Decision 2: DIAL Core resource URL format

DIAL Core subscription URLs use the `files/` scheme even for conversations (conversations are stored as files internally). The full URL for a conversation at `{bucket}/{subPath}` is:

```
files/{bucket}/{subPath}
```

The backend builds this from the authenticated session `bucket` and the `conversationPath` (subPath without bucket) extracted via `resolveConversationLocation`, the same helper already used by `getConversation` and `saveConversation`.

This is treated as a risk (see Risks) since the exact URL format is inferred from DIAL Core behaviour, not the open API spec. A startup integration test or log inspection should verify the format before shipping.

---

### Decision 3: Frontend reads raw SSE bytes via `fetch` + `ReadableStream`

**Chosen:** The same line-splitting decoder loop already in `chat-stream.api.ts`. Each `data:` line is parsed as JSON `{ url, action }`. An `UPDATE` event triggers a single `getConversation` call.

**Alternative:** `EventSource`. Rejected because `EventSource` only supports `GET`, and the watch endpoint is `POST` (body carries the conversation path).

---

### Decision 4: Single `getConversation` on UPDATE, then check `llmNamingDone`

On every `UPDATE` event the frontend calls `getConversation` once and inspects the response. The watch closes only when `llmNamingDone === true` or the name differs from `previousName`. This is resilient to intermediate saves (e.g., the user edits settings) that generate `UPDATE` events before naming completes.

---

### Decision 5: 120 s hard timeout on the SSE connection

The connection is aborted after 120 seconds even if no qualifying event arrives. This prevents dangling connections when DIAL Core is offline, naming fails silently, or the feature is disabled (no `UPDATE` will ever carry `llmNamingDone: true`). 120 s is generous enough for slow LLM calls; the backend SSE keepalive (15 s) keeps the connection alive through proxy idle timeouts.

The existing `DISPLAY_NAME_POLL_MAX_ATTEMPTS × DISPLAY_NAME_POLL_INTERVAL_MS = 50 s` cap is replaced by this timeout. The previous 50 s bound was too short for slow models; 120 s is a better ceiling.

---

### Decision 6: New endpoint registered in the generated API client

Per project convention, new BFF endpoints are exposed through `@epam/chat-api-client` (OpenAPI-generated). The watch endpoint is added to the Swagger spec with `@ApiResponse({ status: 200, description: 'SSE stream' })`. After `npm run openapi` the frontend calls it via the generated client, not raw `fetch`.

The generated client wraps the call in a standard Promise, but the underlying `Response.body` (a `ReadableStream`) is used directly — the same exception already made for `streamCompletion`.

---

### Authorization

The watch endpoint is guarded by the standard `SessionGuard` (same as all other `/api/v1/conversations/*` routes). The backend uses the authenticated session's `at` token to call DIAL Core. No additional role checks are needed beyond authentication.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| DIAL Core resource URL format for conversations is undocumented (`files/` vs `conversations/`) | Verify against a live DIAL Core instance during development; log the subscribed URL at `debug` level |
| SSE connections held open by clients that never receive a naming event (old conversations) | 120 s hard timeout closes them; no server-side connection leak |
| DIAL Core may not emit UPDATE events when `saveConversation` is called during naming | Fallback: if SSE closes without a qualifying event the title stays message-derived (same UX as today when naming times out) |
| One extra `getConversation` GET per UPDATE event (before naming is done) | Typical conversations receive only 1–2 UPDATE events before naming completes; still far fewer than 25 polling GETs |
| `subscribeToResources` SDK method returns a `Response`; if the SDK wraps the body it may not expose a raw `ReadableStream` | Inspect SDK source at implementation time; fall back to raw `fetch` with `getBearerAuthHeaders` if needed |

## Migration Plan

1. Deploy backend with the new `POST /api/v1/conversations/watch` endpoint alongside the unchanged polling frontend.
2. Regenerate `@epam/chat-api-client` (`npm run openapi`).
3. Deploy frontend with polling replaced by SSE subscription.
4. No rollback coordination needed — the backend endpoint is additive; the old polling code path is simply deleted.

## Open Questions

1. **Exact DIAL Core resource URL format**: Is it `files/{bucket}/{subPath}` or another scheme? Needs live verification.
2. **SDK `subscribeToResources` return type**: Does it expose `Response.body` as a `ReadableStream` directly, or does the SDK materialise the whole body? If the latter, raw `fetch` must be used for the proxy layer.
