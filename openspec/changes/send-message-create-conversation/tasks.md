## 1. Shared Types (libs/chat-shared)

- [x] 1.1 Create `libs/chat-shared/src/models/chat.ts` — declare `Message` (`id`, `role`, `content`, `timestamp`) and `Conversation` (`id`, `messages`, `createdAt`) interfaces
- [x] 1.2 Add `export * from './models/chat.js';` to `libs/chat-shared/src/index.ts`
- [x] 1.3 Remove the duplicate `Message` type from `apps/chat/src/types/index.ts` and import it from `@epam/chat-shared`

## 2. Backend — conversations domain

- [x] 2.1 Create `apps/chat-api/src/conversations/dto/create-conversation.dto.ts` — `CreateConversationDto` with `firstMessage: string`, decorated with `@IsString()`, `@MinLength(1)`, `@MaxLength(4000)`, and `@ApiProperty`
- [x] 2.2 Create `apps/chat-api/src/conversations/conversation.service.ts` — `@Injectable()` `ConversationService` with `private readonly logger = new Logger(ConversationService.name)`, in-memory `Map<string, Conversation>`, and `createConversation(firstMessage: string): Conversation` that generates UUID via `crypto.randomUUID()`, builds a `Conversation`, stores it, and returns it
- [x] 2.3 Create `apps/chat-api/src/conversations/conversation.controller.ts` — `@Controller({ path: 'conversations', version: '1' })`, `@ApiTags('conversations')`, `POST /` handler decorated with `@Post()`, `@HttpCode(201)`, `@Throttle({ default: { limit: 20, ttl: 60000 } })`, and full `@ApiOperation` / `@ApiResponse` for 201, 400, 500
- [x] 2.4 Create `apps/chat-api/src/conversations/conversation.module.ts` — declares `ConversationController` and `ConversationService`
- [x] 2.5 Register `ConversationsModule` in the `imports` array of `apps/chat-api/src/app/app.module.ts`

## 3. Backend — tests

- [x] 3.1 Create `apps/chat-api/src/conversations/tests/conversation.service.spec.ts` — unit tests: `createConversation` returns a `Conversation` with a UUID-format `id`, correct `firstMessage` content, and ISO-8601 `createdAt`
- [x] 3.2 Create `apps/chat-api/src/conversations/tests/conversation.controller.integration.spec.ts` — supertest integration tests covering: 201 with valid body, 400 with empty `firstMessage`, 400 with missing body; follow `chat/tests/chat.controller.integration.spec.ts` pattern

## 4. Frontend — API helper

- [x] 4.1 Create `apps/chat/src/server-api/conversations.api.ts` — export `createConversation(firstMessage: string): Promise<Conversation>` using the `post<Conversation>` helper from `base.ts` targeting `/api/v1/conversations`

## 5. Frontend — ConversationContext

- [x] 5.1 Create `apps/chat/src/context/ConversationContext.tsx` with `createContext<ConversationContextValue | undefined>(undefined)`, following the `ThemeContext.tsx` pattern
- [x] 5.2 Implement `ConversationProvider` with internal `Map<string, Conversation>` state
- [x] 5.3 Implement `async createConversation(firstMessage: string): Promise<string>` — calls `createConversation` from `conversations.api.ts`, stores the returned `Conversation` in state, returns the server-assigned `id`
- [x] 5.4 Implement `sendMessage(conversationId: string, message: string): void` — appends a user `Message` and a simulated assistant response (500 ms delay) to the conversation in state; wrap in `useCallback`
- [x] 5.5 Wrap the context value in `useMemo`
- [x] 5.6 Export `useConversation` consumer hook that throws `'useConversation must be used within a ConversationProvider'` when used outside the provider
- [x] 5.7 Add `<ConversationProvider>` to `apps/chat/src/main.tsx` alongside `UserProvider` and `ThemeProvider`

## 6. Frontend — ConversationPage component

- [x] 6.1 Create `apps/chat/src/components/ConversationPage/ConversationPage.tsx` — reads `:conversationId` via `useParams<{ conversationId: string }>()`, retrieves the matching `Conversation` from `useConversation`
- [x] 6.2 Render the message log with `role="log"` and `aria-live="polite"` when a conversation is found; render a "conversation not found" message with `role="alert"` for unknown IDs
- [x] 6.3 Wire the `<ConversationInput>` send callback to call `sendMessage(conversationId, message)` from context (handler named `handleSend`)
- [x] 6.4 Wrap the component in `React.memo`; export as named export `ConversationPage`

## 7. Frontend — Routing

- [x] 7.1 In `apps/chat/src/app/app.tsx`, add a lazy-loaded import for `ConversationPage`: `React.lazy(() => import('@/components/ConversationPage/ConversationPage').then(m => ({ default: m.ConversationPage })))`
- [x] 7.2 Add `<Route path="/conversations/:conversationId" element={<Suspense fallback={...}><ConversationPage /></Suspense>} />` alongside the existing routes
- [x] 7.3 In `ConversationRoute`, wire `handleSend` to `await createConversation(message)` from `useConversation`, then call `useNavigate()('/conversations/<id>')`
- [x] 7.4 Remove local message state from `ConversationRoute` / `app.tsx` (previously managed on `/`)

## 8. Frontend — tests

- [x] 8.1 Create `apps/chat/src/context/tests/ConversationContext.spec.tsx` — test: `createConversation` stores the conversation returned by the mocked API; `sendMessage` appends messages; `useConversation` throws outside provider
- [x] 8.2 Create `apps/chat/src/components/ConversationPage/tests/ConversationPage.spec.tsx` — test: known conversation ID renders message log (`role="log"`); unknown ID renders not-found alert (`role="alert"`); send input calls `sendMessage`
