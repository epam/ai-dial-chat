## Architecture

### Current state

```
Frontend                        Backend                         DIAL Core
handleSend()
  createMessagePair()           POST /completions
  optimistic setState()    ───► streamCompletion()         ───► SSE stream
  startStream()
    onChunk → applyChunk()  ◄── SSE chunks forwarded        ◄── chunks
    onComplete
      saveConversation()    ───► PUT /conversations
      getConversation()     ◄── conversation
    onError / handleStop
      saveConversation()    ───►
```

**Problem**: `saveConversation` is called with whatever `conversationRef` contains at the time `onComplete` fires. If the user navigated away, `conversationRef` may point to a different conversation, or React state has been torn down and rebuilt for a new conversation page.

### Target state

```
Frontend                        Backend                         DIAL Core
GenerationContext (app level)
  startGeneration(genId, path)

  POST /completions             ConversationGenerationService
  {generationId, mode, ...} ──► registry.register(sid+path+genId)
                                ConversationService.streamCompletion()
                                  history = buildHistory(mode)
                                  saveConversation(start state)  ──► DIAL Core
                                  dialStream = DIAL Core SSE     ◄── stream
  onChunk (guard: genId match) ◄── forward chunks + assemble
                                  on [DONE]:
                                    saveConversation(final)      ──► DIAL Core
                                  on client-close:
                                    abortUpstream()
                                    saveConversation(partial)    ──► DIAL Core

  on complete: getConversation() ──► GET /conversations/:path
               setState(server)  ◄── conversation
```

### Backend components

#### `ConversationGenerationService`

Location: `apps/chat-api/src/conversations/conversation-generation.service.ts`

```typescript
interface GenerationEntry {
  abortController: AbortController;
  status: 'active' | 'stopped' | 'done' | 'error';
  startedAt: number;
}

type RegistryKey = string; // `${sessionId}::${path}::${generationId}`
```

Responsibilities:
- `register(sessionId, path, generationId): AbortController` — throws `ConflictException` if an active entry already exists for `sessionId + path`.
- `abort(sessionId, path, generationId): boolean` — sets status `stopped`, calls `abortController.abort()`.
- `complete(sessionId, path, generationId)` — marks `done`, removes from registry.
- `error(sessionId, path, generationId)` — marks `error`, removes from registry.
- No persistence: pod restart clears registry; in-progress generation is lost (acceptable in this scope).
- Stale-entry cleanup: entries older than 30 min (configurable) are evicted on each `register` call to prevent memory leak.

#### `ConversationHistoryBuilder`

Location: `apps/chat-api/src/conversations/utils/conversation-history-builder.ts`

Builds the initial conversation state for each mode:

| Mode | Behaviour |
|------|-----------|
| `Append` | Fetch conversation; append user message + empty assistant placeholder |
| `ContinueLastUser` | Fetch conversation; if last message is already a user message, append only empty assistant placeholder; otherwise same as `Append` |
| `Regenerate` | Fetch conversation; truncate history at `messageIndex` (exclusive); append empty assistant placeholder at that index |
| `Edit` | Fetch conversation; truncate history at `messageIndex` (inclusive); replace user message at `messageIndex` with new content; append empty assistant placeholder |

Returns: `{ conversation: ConversationResponseDto, assistantMessageIndex: number }`.

#### Server-side chunk assembler

Location: `apps/chat-api/src/conversations/utils/apply-chunk.server.ts`

Pure function — no imports from `apps/chat`:

```typescript
applyChunkToMessage(
  message: ConversationMessageDto,
  chunk: DialSseChunk,
): ConversationMessageDto
```

Handles same fields as frontend `apply-chunk.ts`:
- `delta.content` → concatenate `message.content`
- `delta.custom_content.attachments` → accumulate array
- `delta.custom_content.stages` → merge by index (concatenate `name` and `content`)
- `delta.custom_content.annotations` → merge by index (concatenate `title` and body `quote`)
- `delta.custom_content.form_schema` → replace (last wins)
- `chunk.id` or `delta.responseId` → set `message.responseId` (if field exists on DTO)

#### `ConversationService.streamCompletion` (refactored)

New signature:
```typescript
async streamCompletion(
  conversationPath: string,
  token: string,
  bucket: string,
  generationId: string,
  mode: CompletionMode,
  message: string | undefined,
  messageIndex: number | undefined,
  model: string,
  customContent: MessageCustomContentDto | undefined,
  sessionId: string,
  res: Response,
): Promise<void>
```

Flow:
1. `registry.register(sessionId, conversationPath, generationId)` — 409 if already active.
2. `historyBuilder.build(mode, ...)` → `{ conversation, assistantMessageIndex }`.
3. `saveConversation(conversationPath, conversation)` — persist start state.
4. Open DIAL Core SSE stream via `sendChatCompletionRequest`.
5. Loop over reader chunks:
   - Write raw bytes to `res` (forward to frontend).
   - Parse SSE line → call `applyChunkToMessage(assistantMsg, chunk)`.
6. On reader `done` (`[DONE]`):
   - `conversation.messages[assistantMessageIndex] = finalAssistantMsg`.
   - `saveConversation(...)` — persist final state.
   - `registry.complete(...)`.
   - End SSE response.
7. On `AbortError` (either upstream DIAL abort or client disconnect):
   - If `registry.status === 'stopped'` → `wasStoppedByUser = true`.
   - Else → `hasStreamError = true` (client closed).
   - `conversation.messages[assistantMessageIndex] = partialMsg`.
   - `saveConversation(...)` — best-effort, non-throwing.
   - `registry.error(...)`.
8. On other errors: same as (7) with `hasStreamError = true`.

#### Stop endpoint

```
POST /api/v1/conversations/completions/stop
Body: StopCompletionDto { generationId: string; path: string }
```

1. Extract `sessionId` from session cookie.
2. `registry.abort(sessionId, path, generationId)` — returns 404 if not found.
3. Returns 204. The stream loop in `streamCompletion` catches the `AbortError` and saves partial.

### DTO changes

#### `SendCompletionDto` (extended)

```typescript
export enum CompletionMode {
  Append = 'append',
  ContinueLastUser = 'continue_last_user',
  Regenerate = 'regenerate',
  Edit = 'edit',
}

class SendCompletionDto {
  @IsString() @IsNotEmpty() generationId: string;
  @IsString() @IsNotEmpty() path: string;
  @IsString() @IsNotEmpty() model: string;
  @IsEnum(CompletionMode) mode: CompletionMode;
  @IsOptional() @IsString() message?: string;
  @IsOptional() @IsInt() @Min(0) messageIndex?: number;
  @IsOptional() @ValidateNested() @Type(() => MessageCustomContentDto)
  custom_content?: MessageCustomContentDto;
}
```

#### `StopCompletionDto` (new)

```typescript
class StopCompletionDto {
  @IsString() @IsNotEmpty() generationId: string;
  @IsString() @IsNotEmpty() path: string;
}
```

### Frontend components

#### `GenerationContext`

Location: `apps/chat/src/context/GenerationContext.tsx`

```typescript
interface GenerationEntry {
  generationId: string;
  path: string;
  abortController: AbortController;
  status: 'active' | 'done' | 'error';
}

interface GenerationContextValue {
  startGeneration(path: string, generationId: string): AbortController;
  stopGeneration(path: string, generationId: string): void;
  getGeneration(path: string): GenerationEntry | undefined;
}
```

- Mounted at app level (above `<Outlet>` / router children).
- `startGeneration` creates an `AbortController`, stores the entry, and returns the controller.
- `stopGeneration` calls `abortController.abort()` on the local side (the actual stop call to backend is separate via `stopCompletion()` API).
- Navigation between conversations does NOT call `stopGeneration`. The stream keeps running.

#### `useConversationStream` (modified)

Changes:
- Receives `generationId` as parameter on `startStream`.
- `onChunk`: guard — skip if `generationId` doesn't match current subscription.
- `onComplete`: **remove** `saveConversation(...)`; call `getConversation(path)` then `setConversation(serverConversation)`.
- `onError`: **remove** `saveConversation(...)`; mark local UI error state only.
- `handleStop`: calls `stopCompletion({ generationId, path })` API; does not call `saveConversation`.
- SSE `AbortController` is obtained from `GenerationContext.startGeneration` (not a local `useRef`).

#### `chat-stream.api.ts` (modified)

```typescript
export interface StreamCompletionRequest {
  path: string;
  model: string;
  generationId: string;
  mode: CompletionMode;
  message?: string;
  messageIndex?: number;
  customContent?: MessageCustomContent;
}
```

Add `stopCompletion(dto: { generationId: string; path: string }): Promise<void>` calling `POST /api/v1/conversations/completions/stop`.

#### `handleSend` / `handleStop` / `handleRegenerate` / `handleEditMessage`

- `handleSend`: generate `crypto.randomUUID()` as `generationId`, pass `mode: CompletionMode.Append`.
- `handleRegenerate`: `mode: CompletionMode.Regenerate`, `messageIndex` of the target assistant message.
- `handleEditMessage`: `mode: CompletionMode.Edit`, `messageIndex` of the user message.
- `handleStop`: call `stopCompletion(generationId, path)` via API; remove local `saveConversation` call.
- All: pass `generationId` from `GenerationContext` or generate new one.

### Optimistic UI during navigation

When a user navigates away from a conversation that has an active stream:
- The conversation page unmounts; React state for that conversation is gone.
- `GenerationContext` still holds the `AbortController` and `generationId`.
- Chunks continue arriving but `onChunk` has no subscriber (hook is unmounted) — they are silently dropped by the frontend (backend still assembles them server-side).
- When the user navigates back:
  - The conversation page mounts and calls `getConversation(path)`.
  - If generation is still active, the server returns the current partial state (or still-in-progress placeholder).
  - If generation finished while away, the server returns the fully saved final state.
- No cross-conversation contamination is possible because the backend writes to the specific `path` it received at stream start.

### Error handling summary

| Scenario | Backend action | Frontend state |
|----------|---------------|----------------|
| `[DONE]` from DIAL Core | save final, registry.complete | getConversation reload |
| User clicks Stop | registry.abort → AbortError in loop → save `wasStoppedByUser: true` partial | stopCompletion API call; reload conversation |
| Client closes tab | SSE disconnect → AbortError → save `hasStreamError: true` partial | — (tab is closed) |
| DIAL Core error in stream | catch → save `hasStreamError: true` partial | onError → show error state |
| Duplicate generation (same path) | 409 ConflictException | show error, do not start stream |

### Verification steps per slice

```sh
npm exec nx test  chat-api          # after each backend slice
npm exec nx lint  chat-api
npm exec nx build chat-api
npm run openapi && npm run openapi:check  # after DTO changes
npm exec nx build chat-api-client
npm exec nx test  chat              # after each frontend slice
npm exec nx lint  chat
npm exec nx build chat
```
