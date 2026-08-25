## 1. Generation transport

- [x] 1.1 In `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`, pass the loaded `startConversation.id` into both generation branches and add `X-CONVERSATION-ID` to the live Chat Completions SDK call; keep the browser completion DTO and endpoint unchanged.
- [x] 1.2 In `apps/chat-api/src/conversations/generation/chat-completions.adapter.ts` and `apps/chat-api/src/conversations/generation/responses.adapter.ts`, accept the resolved conversation id and add the same outbound header so both adapter contracts remain aligned.
- [x] 1.3 In `apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts`, assert the exact persisted conversation id is forwarded for both Chat Completions and Responses API requests.

## 2. Rating transport

- [x] 2.1 In `apps/chat-api/src/rate/rate.service.ts`, add `X-CONVERSATION-ID: dto.conversationId` to the existing DIAL Core rating request without changing `RateMessageDto`, Swagger, the generated client, authentication, throttling, caching, or error mapping.
- [x] 2.2 In `apps/chat-api/src/rate/tests/rate.service.spec.ts`, assert the rating request forwards the exact DTO conversation id in the header.

## 3. Documentation and verification

- [x] 3.1 Update `docs/responses-api-integration.md` to document the restored BFF-to-DIAL-Core header for both generation transports.
- [x] 3.2 Run focused verification with `npm exec nx test @epam/chat-api -- src/conversations/streaming/tests/conversation-streaming.service.spec.ts src/rate/tests/rate.service.spec.ts` (31/31 tests passed).
- [x] 3.3 Run project verification with `npm exec nx test @epam/chat-api` (2675/2675 tests passed), `npm exec nx lint @epam/chat-api` (0 errors; 2 unrelated warnings), `npm exec nx build @epam/chat-api`, and `npm run validate:docs`.
- [x] 3.4 Run `npm exec nx typecheck @epam/chat-api -- --force` and confirm it reports only existing errors outside the files changed by this change; no changed file appears in the error set.
