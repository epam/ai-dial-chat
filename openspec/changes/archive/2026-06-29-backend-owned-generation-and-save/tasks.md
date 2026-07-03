## 1. Backend — DTO changes (apps/chat-api)

- [x] 1.1 Add `CompletionMode` enum (`Append | ContinueLastUser | Regenerate | Edit`) to `apps/chat-api/src/conversations/dto/send-completion.dto.ts`
- [x] 1.2 Add `@IsString() @IsNotEmpty() generationId: string`, `@IsEnum(CompletionMode) mode: CompletionMode`, `@IsOptional() @IsInt() @Min(0) messageIndex?: number` to `SendCompletionDto`; keep existing `path`, `message`, `model`, `custom_content`; mark `message` as `@IsOptional()`
- [x] 1.3 Create `apps/chat-api/src/conversations/dto/stop-completion.dto.ts` with `StopCompletionDto` (`generationId: string`, `path: string`; both `@IsString() @IsNotEmpty()`)
- [x] 1.4 Run `npm exec nx run chat-api:build` — no errors

## 2. Backend — Generation registry (apps/chat-api)

- [x] 2.1 Create `apps/chat-api/src/conversations/conversation-generation.service.ts` exporting `ConversationGenerationService` with `register(sessionId, path, generationId): AbortController` (throws `ConflictException` on duplicate active entry), `abort(sessionId, path, generationId): boolean`, `complete(sessionId, path, generationId): void`, `error(sessionId, path, generationId): void`
- [x] 2.2 Key format: `` `${sessionId}::${path}` `` — one active generation per session+path; `generationId` is stored in the entry for validation on stop
- [x] 2.3 Add stale-entry eviction in `register`: remove entries where `startedAt` is older than 30 minutes
- [x] 2.4 Register `ConversationGenerationService` as a provider in `ConversationsModule` (`apps/chat-api/src/conversations/conversations.module.ts`)
- [x] 2.5 Run `npm exec nx run chat-api:build` — no errors

## 3. Backend — Server-side chunk assembler (apps/chat-api)

- [x] 3.1 Create `apps/chat-api/src/conversations/utils/apply-chunk.server.ts` exporting `applyChunkToMessage(message: ConversationMessageDto, chunk: unknown): ConversationMessageDto`
- [x] 3.2 Support `delta.content` (string concatenation), `delta.custom_content.attachments` (accumulate), `delta.custom_content.stages` (merge by index, concatenate `name` and `content`), `delta.custom_content.annotations` (merge by index, concatenate `title` and body), `delta.custom_content.form_schema` (replace last wins), `chunk.id` or `delta.responseId` (set on message if field present)
- [x] 3.3 No imports from `apps/chat`; no side effects; pure function
- [x] 3.4 Write unit tests at `apps/chat-api/src/conversations/utils/apply-chunk.server.spec.ts` covering: text concatenation, attachments accumulation, stages merge, annotations merge, form_schema replacement, responseId assignment
- [x] 3.5 Run `npm exec nx run chat-api:test` — all new tests pass

## 4. Backend — Conversation history builder (apps/chat-api)

- [x] 4.1 Create `apps/chat-api/src/conversations/utils/conversation-history-builder.ts` exporting `buildConversationHistory(mode: CompletionMode, conversation: ConversationResponseDto, message: string | undefined, messageIndex: number | undefined, customContent: MessageCustomContentDto | undefined): { conversation: ConversationResponseDto; assistantMessageIndex: number }`
- [x] 4.2 `Append`: append user message (new UUID, current ISO timestamp) + empty assistant placeholder at end
- [x] 4.3 `ContinueLastUser`: if last message is already `role: 'user'`, append only empty assistant placeholder; otherwise same as Append
- [x] 4.4 `Regenerate`: require `messageIndex`; truncate `messages` to `messageIndex` (exclusive); append empty assistant placeholder; user message at `messageIndex - 1` is unchanged
- [x] 4.5 `Edit`: require `messageIndex`; truncate `messages` to `messageIndex` (exclusive); append new user message (replacing old content) + empty assistant placeholder
- [x] 4.6 Empty assistant placeholder: `{ id: uuid(), role: 'assistant', content: '', timestamp: isoNow() }`
- [x] 4.7 Write unit tests at `apps/chat-api/src/conversations/utils/conversation-history-builder.spec.ts` covering all four modes plus edge cases (no messages, messageIndex out of range)
- [x] 4.8 Run `npm exec nx run chat-api:test` — all new tests pass

## 5. Backend — Refactor `ConversationService.streamCompletion` (apps/chat-api)

- [x] 5.1 Update method signature to accept `generationId: string`, `mode: CompletionMode`, `messageIndex: number | undefined`, `sessionId: string`, `res: Response` (inject `Response` from NestJS `@Res()`)
- [x] 5.2 Call `generationService.register(sessionId, path, generationId)` at start; propagate `ConflictException` (409) on duplicate
- [x] 5.3 Call `historyBuilder.buildConversationHistory(...)` to get initial conversation state and `assistantMessageIndex`
- [x] 5.4 Call `saveConversation(path, conversation)` to persist start state (user msg + assistant placeholder); log warning on save failure but continue
- [x] 5.5 Open DIAL Core SSE stream via `sendChatCompletionRequest`; pass the `AbortController.signal` from `generationService.register` result
- [x] 5.6 In the read loop: forward raw bytes to `res`; parse each SSE line; call `applyChunkToMessage(assistantMsg, parsedChunk)` to accumulate
- [x] 5.7 On `[DONE]`: update `conversation.messages[assistantMessageIndex]` with final assembled message; call `saveConversation(path, finalConversation)`; call `generationService.complete(...)`; end SSE response
- [x] 5.8 On `AbortError`: if `generationService` status is `stopped` â†’ set `wasStoppedByUser: true` on partial message; else set `hasStreamError: true`; call `saveConversation` (best-effort, non-throwing); call `generationService.error(...)`
- [x] 5.9 On other errors: set `hasStreamError: true` on partial message; best-effort save; `generationService.error(...)`; end SSE response with error event
- [x] 5.10 Remove the existing `return result.response.body` pattern — the method now writes directly to `res` and returns `Promise<void>`
- [x] 5.11 Inject `ConversationGenerationService` into `ConversationService` constructor

## 6. Backend — Stop endpoint (apps/chat-api)

- [x] 6.1 Add `stopCompletion(@Body() dto: StopCompletionDto, @SessionId() sessionId: string, @Res() res: Response)` handler to `ConversationController` at `POST /completions/stop` (version `1`)
- [x] 6.2 Add `@ApiOperation`, `@ApiResponse({ status: 204 })`, `@ApiResponse({ status: 404 })`, `@ApiResponse({ status: 409 })` decorators
- [x] 6.3 Implement: call `generationService.abort(sessionId, dto.path, dto.generationId)`; return 204 on success; throw `NotFoundException` if not found
- [x] 6.4 Run `npm exec nx run chat-api:lint` and `npm exec nx run chat-api:build` — no errors

## 7. Backend — Controller wiring (apps/chat-api)

- [x] 7.1 Update `ConversationController.streamCompletion` to extract `sessionId` from session and pass it along with `generationId`, `mode`, `messageIndex` to `ConversationService.streamCompletion`
- [x] 7.2 Change handler return type to `Promise<void>` (controller now receives `@Res() res: Response` and the service writes directly)
- [x] 7.3 Remove SSE header setup from controller — move it into `ConversationService.streamCompletion` (or a shared helper) so the service controls response lifecycle
- [x] 7.4 Run `npm exec nx run chat-api:build` — no errors

## 8. Backend — OpenAPI regeneration

- [x] 8.1 Run `npm run openapi` to regenerate the OpenAPI spec from the updated backend
- [x] 8.2 Run `npm run openapi:check` — no drift
- [x] 8.3 Run `npm exec nx run chat-api-client:build` — no errors

## 9. Frontend — `GenerationContext` (apps/chat)

- [x] 9.1 Create `apps/chat/src/context/GenerationContext.tsx` with `GenerationContext`, `GenerationProvider`, and `useGeneration` hook
- [x] 9.2 `GenerationEntry`: `{ generationId: string; path: string; abortController: AbortController; status: 'active' | 'done' | 'error' }`
- [x] 9.3 `startGeneration(path, generationId): AbortController` — creates `AbortController`, stores entry keyed by `path`, returns controller
- [x] 9.4 `stopGeneration(path, generationId): void` — calls `abortController.abort()` locally (does NOT call backend; caller is responsible for calling `stopCompletion` API)
- [x] 9.5 `completeGeneration(path, generationId): void` — marks status `done`
- [x] 9.6 `getGeneration(path): GenerationEntry | undefined`
- [x] 9.7 Mount `<GenerationProvider>` in `apps/chat/src/main.tsx` above `UserConfigProvider`
- [x] 9.8 Run `npm exec nx run chat:build` — no errors

## 10. Frontend — `chat-stream.api.ts` changes (apps/chat)

- [x] 10.1 Extend `StreamCompletionOptions` / request type to include `generationId: string`, `mode: CompletionMode`, optional `messageIndex?: number`
- [x] 10.2 Add `import { CompletionMode } from '@epam/chat-api-client'` (from regenerated client) or define enum locally until client is updated
- [x] 10.3 Add `stopCompletion(dto: { generationId: string; path: string }): Promise<void>` function calling `POST /api/v1/conversations/completions/stop`
- [x] 10.4 Run `npm exec nx run chat:build` — no errors

## 11. Frontend — `useConversationStream.ts` changes (apps/chat)

- [x] 11.1 Accept `generationId` as parameter on `startStream`
- [x] 11.2 In `onChunk`: add guard — `if (activeGenerationId !== generationId) return` before applying chunk to state
- [x] 11.3 In `onComplete`: **remove** `saveConversation(...)` call; **add** `getConversation(path)` followed by `setConversation(serverConversation)` to sync from backend
- [x] 11.4 In `onError`: **remove** `saveConversation(...)` call; keep error flag/UI state only
- [x] 11.5 In `handleStop`: call `stopCompletion({ generationId, path })` API instead of aborting locally and calling `saveConversation`; after API call completes, do `getConversation` reload
- [x] 11.6 Obtain `AbortController` from `GenerationContext.startGeneration` instead of `new AbortController()` in the hook
- [x] 11.7 On stream complete/error/stop: call `GenerationContext.completeGeneration` or `stopGeneration` as appropriate
- [x] 11.8 Run `npm exec nx run chat:build` — no errors

## 12. Frontend — `useConversationHandlers.ts` changes (apps/chat)

- [x] 12.1 In `handleSend`: generate `crypto.randomUUID()` as `generationId`; pass `mode: CompletionMode.Append` to `startStream`
- [x] 12.2 In `handleRegenerate` (or equivalent): pass `mode: CompletionMode.Regenerate` + `messageIndex` to `startStream`
- [x] 12.3 In `handleEditMessage`: pass `mode: CompletionMode.Edit` + `messageIndex` to `startStream`
- [x] 12.4 For auto-stream on conversation create (when the conversation already ends with a user message): pass `mode: CompletionMode.ContinueLastUser`
- [x] 12.5 Kept optimistic insert — frontend inserts user+assistant placeholder for immediate UX; backend rebuilds history from mode+messageIndex and saves its own authoritative copy; frontend reloads from server on complete, reconciling state.
- [x] 12.6 Run `npm exec nx run chat:build` — no errors

## 13. Backend — Integration tests (apps/chat-api)

- [x] 13.1 Write integration test: `POST /api/v1/conversations/completions` with valid `generationId` + `mode: append` â†’ returns SSE stream; conversation is saved with assistant message on mock `[DONE]`
- [x] 13.2 Write integration test: duplicate request for same path returns 409
- [x] 13.3 Write integration test: `POST /api/v1/conversations/completions/stop` stops active generation â†’ returns 204; conversation saved with `wasStoppedByUser: true`
- [x] 13.4 Write integration test: `POST /api/v1/conversations/completions/stop` with unknown `generationId` â†’ 404
- [x] 13.5 Run `npm exec nx run chat-api:test` — all pass

## 14. Frontend — Unit tests (apps/chat)

- [x] 14.1 Test `useConversationStream`: verify `saveConversation` is NOT called on `onComplete`
- [x] 14.2 Test `useConversationStream`: verify `getConversation` IS called on `onComplete`
- [x] 14.3 Test `useConversationStream`: verify chunk with mismatched `generationId` does not update conversation state
- [x] 14.4 Test `GenerationContext`: `startGeneration` returns AbortController; navigation between conversations does not abort controller
- [x] 14.5 Run `npm exec nx run chat:test` — all pass

## 15. Final verification

- [x] 15.1 Run `npm exec nx run chat-api:lint && npm exec nx run chat-api:build` — no errors
- [x] 15.2 Run `npm exec nx run chat:lint && npm exec nx run chat:build` — no errors
- [x] 15.3 Run `npm exec nx run chat-api-client:build` — no errors (no contract changes since last openapi run)
- [x] 15.4 Start dev server; send a message; navigate to another conversation while generating; navigate back — confirm the response lands in the correct conversation
- [x] 15.5 Start dev server; send a message; click Stop — confirm partial assistant message with `wasStoppedByUser: true` is visible and conversation is saved correctly
- [x] 15.6 Verify regenerate and edit flows work with correct modes



