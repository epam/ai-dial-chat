# Tasks: add-like-dislike-api

## 1. Shared type — extend Message

- [x] 1.1 Add numeric `MessageRating` enum (`Like = 1`, `Dislike = -1`) and `rating?: MessageRating` field with JSDoc to `Message` interface in `libs/chat-shared/src/models/chat.ts`
- [x] 1.2 Run `npm exec nx typecheck chat-shared` — no errors

## 2. Backend — rate domain

- [x] 2.1 Create `apps/chat-api/src/rate/dto/rate-message.dto.ts` with `RateMessageDto` (`conversationId`, `responseId`, `modelId`, numeric `rate: MessageRating`, optional `comment`) using `class-validator` decorators and Swagger metadata
- [x] 2.2 Create `apps/chat-api/src/rate/rate.service.ts` extending `AppService`; implement `rateMessage(dto, accessToken)` — calls `POST ${baseUrl}/v1/{modelId}/rate` with bearer headers; throws typed HTTP exception on non-2xx
- [x] 2.3 Create `apps/chat-api/src/rate/rate.controller.ts` — `@Controller({ path: 'rate', version: '1' })`, `@Post()` returning `@HttpCode(204)`; apply `@Throttle({ default: { limit: 30, ttl: 60000 } })` and `@ApiTags('rate')`
- [x] 2.4 Create `apps/chat-api/src/rate/rate.module.ts` registering controller and service
- [x] 2.5 Add `RateModule` to imports in `apps/chat-api/src/app/app.module.ts`
- [x] 2.6 Run `npm exec nx typecheck chat-api` — no errors
- [x] 2.7 Run `npm exec nx lint chat-api` — no errors

## 3. Backend — tests

- [x] 3.1 Create `apps/chat-api/src/rate/tests/rate.service.spec.ts` — unit tests: correct URL, correct body, correct headers forwarded to DIAL Core; non-2xx propagated as NestJS HTTP exception
- [x] 3.2 Create `apps/chat-api/src/rate/tests/rate.controller.spec.ts` — integration test (supertest): valid body → 204; missing required field → 400; invalid `rate` value → 400
- [x] 3.3 Run `npm exec nx test chat-api` — all tests pass

## 4. OpenAPI and generated client

- [x] 4.1 Add `rate` tag to `apps/chat-api/src/openapi/openapi.config.ts`
- [x] 4.2 Run `npm run openapi` so `/api/v1/rate`, `RateMessageDto`, and `RateApi.rateMessage` are generated in `libs/chat-api-client`
- [x] 4.3 Run `npm run openapi:check` — no endpoint-level `any`
- [x] 4.4 Run `npm exec nx build chat-api-client -- --skip-nx-cache`
- [x] 4.5 Run `npm exec nx lint chat-api-client`

## 5. Frontend API wrapper

- [x] 5.1 Add `rateApi = new RateApi(config)` singleton to `apps/chat/src/server-api/api-client.ts`
- [x] 5.2 Create `apps/chat/src/server-api/rate.api.ts` — export `rateMessage(body: RateMessageDto)` that delegates to `rateApi.rateMessage({ rateMessageDto: body })`
- [x] 5.3 Ensure `apps/chat/src/server-api/base.ts` does not grow a `RATE` endpoint entry for this business endpoint
- [x] 5.4 Create `apps/chat/src/server-api/tests/rate.api.spec.ts` — unit test: `rateMessage` delegates to generated `RateApi` with the correct body
- [x] 5.5 Run `npm exec nx typecheck chat` — no errors

## 6. UI — active rating state in MessageActions

- [x] 6.1 Add `activeRating?: MessageRating` prop (with JSDoc) to `MessageActionsProps` in `libs/conversation-messages/src/models/MessageActions.ts`
- [x] 6.2 Update `MessageActions` in `libs/conversation-messages/src/components/Message/MessageActions.tsx` to: accept `activeRating`; pass a highlight `className` (e.g. `text-accent`) to the Like button when `activeRating === MessageRating.Like` and to the Dislike button when `activeRating === MessageRating.Dislike`
- [x] 6.3 Add / update tests in `libs/conversation-messages/src/components/Message/tests/MessageActions.spec.tsx` (or co-located spec): Like button active state; Dislike button active state; no active state when `activeRating` is undefined
- [x] 6.4 Run `npm exec nx typecheck conversation-messages` — no errors
- [x] 6.5 Run `npm exec nx test conversation-messages` — all tests pass

## 7. Wiring — ConversationView and ConversationPage

- [x] 7.1 Update `MessageActionHandlers` in `apps/chat/src/components/ConversationView/buildMessageActions.ts` — add `onRate?: (messageId: string, rating: MessageRating | null) => void`; wire `onLike` / `onDislike` with toggle logic; pass `activeRating: msg.rating` for assistant messages
- [x] 7.2 Add `onRateMessage?: (messageId: string, rating: MessageRating | null) => void` to `Props` in `apps/chat/src/components/ConversationView/ConversationView.tsx`; pass it to `buildMessageActions`
- [x] 7.3 Implement `handleRateMessage` in `apps/chat/src/pages/Conversation/Conversation.tsx`: optimistic local state update → call generated-client-backed `rateMessage` → save conversation → revert on API/save error; skip API call when `rating === null` (toggle off)
- [x] 7.4 Pass `onRateMessage={handleRateMessage}` to `<ConversationView>` in `Conversation.tsx`
- [x] 7.5 Run `npm exec nx typecheck chat` — no errors
- [x] 7.6 Run `npm exec nx lint chat` — no errors
- [x] 7.7 Run `npm exec nx test chat` — all tests pass
