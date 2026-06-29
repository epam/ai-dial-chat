## 1. Backend — DTO and service method

- [x] 1.1 Create `apps/chat-api/src/conversations/dto/watch-conversation.dto.ts` with `WatchConversationBodyDto` (`path` string validated with `@IsString()` and `@Matches` allowlist regex)
- [x] 1.2 Add `watchConversation(conversationPath, token, bucket)` method to `ConversationService` that resolves the DIAL Core resource URL (`files/{bucket}/{subPath}`) via `resolveConversationLocation`, calls `this.client.subscribeToResources(...)`, and returns the response body as a `ReadableStream`
- [x] 1.3 Verify the DIAL Core resource URL format (`files/` prefix) against a live instance and adjust if needed; log subscribed URL at `debug` level

## 2. Backend — Controller action

- [x] 2.1 Add `@Post('watch')` action to `ConversationController` with `@Throttle`, `@ApiOperation`, and `@ApiResponse` decorators; pipe the SSE stream to `Response` with the same keepalive loop as `streamCompletion`
- [x] 2.2 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api` — fix any failures

## 3. OpenAPI client regeneration

- [x] 3.1 Run `npm run openapi` to regenerate `@epam/chat-api-client` with the new `watchConversation` operation
- [x] 3.2 Run `npm run openapi:check` and `npm exec nx build chat-api-client` — confirm no drift or build errors

## 4. Frontend — API wrapper

- [x] 4.1 Add `watchConversation(conversationPath)` to `apps/chat/src/server-api/conversations.api.ts` using the generated `conversationsApi.watchConversationRaw(...)` to obtain the raw `Response` with a `ReadableStream` body; accept an `AbortSignal` parameter

## 5. Frontend — Replace polling with SSE in ConversationsContext

- [x] 5.1 Rewrite `watchForDisplayNameUpdate` in `ConversationsContext.tsx`: open the SSE watch via `watchConversation`, read the stream with a `TextDecoder` + line-split loop (same pattern as `chat-stream.api.ts`), call `getConversation` on each `UPDATE` event, and close on `llmNamingDone: true` or name change
- [x] 5.2 Add `DISPLAY_NAME_WATCH_TIMEOUT_MS = 120_000` constant and wire an `AbortController` that aborts after that duration; cancel on cleanup
- [x] 5.3 Remove `DISPLAY_NAME_POLL_INTERVAL_MS`, `DISPLAY_NAME_POLL_MAX_ATTEMPTS`, and the recursive `poll()` function
- [x] 5.4 Run `npm exec nx lint chat` and `npm exec nx build chat` — fix any type or lint errors

## 6. Verification

- [x] 6.1 Run `npm exec nx test chat-api` — all tests green
- [ ] 6.2 Start both servers (`npm run start:all`) and create a new conversation with LLM naming enabled — confirm the title updates without polling GETs in the network tab
- [ ] 6.3 Navigate to an old conversation (no `llmNamingDone`) and confirm no repeated GET /conversations calls appear in the network tab
- [ ] 6.4 Navigate away mid-watch and confirm the SSE connection is closed (network tab shows request cancelled)
