## 1. BFF: fix the outbound DIAL Core contract

- [x] 1.1 In `apps/chat-api/src/rate/dto/rate-message.dto.ts`, widen `rate` from `MessageRating` to `MessageRating | null`, update `@IsIn` to `[1, -1, null]`, mark `@ApiProperty({ nullable: true, ... })`, and rewrite the field's description to state the confirmed DIAL Core contract (`RateRequest { responseId, rate: boolean }`) instead of the unverified "adds this value to the like count" claim.
- [x] 1.2 In `apps/chat-api/src/rate/rate.service.ts`, build the outbound Core body as `{ responseId: dto.responseId, rate: dto.rate === MessageRating.Like }` — drop `modelId` and `conversationId` from the JSON body (keep `modelId` for the URL path segment and `conversationId` for the `X-CONVERSATION-ID` header, both unchanged).
- [x] 1.3 Update `apps/chat-api/src/rate/rate.controller.ts` Swagger `@ApiOperation`/`@ApiProperty` text if it references the old body shape.
- [x] 1.4 Update `apps/chat-api/src/rate/tests/rate.service.spec.ts`: replace the "sends the correct JSON body with numeric rate for like" and "sends numeric rate -1 for dislike" tests with assertions on the new boolean body (`{ responseId, rate: true }` for Like, `{ responseId, rate: false }` for Dislike), assert `conversationId`/`modelId` are absent from the JSON body, and add a case for `rate: null` → `{ responseId, rate: false }`. Keep the URL, header (`X-CONVERSATION-ID`, `X-JOB-TITLE`), and error-mapping tests as-is.
- [x] 1.5 Update `apps/chat-api/src/rate/tests/rate.controller.spec.ts`: add a case that `rate: null` is accepted (200/204 via the mocked service) and that `rate: 0` (or any value outside `{1, -1, null}`) still returns 400.

## 2. Shared hook: always call the rate API, including on clear

- [x] 2.1 In `libs/chat-hooks/src/conversation/useConversationHandlers/useConversationHandlers.ts`, remove the `if (rating != null) { ... } else { ...only persist... }` branch in `handleRateMessage`. Always call `rateApi.rateMessage({ rateMessageDto: { conversationId, responseId, modelId, rate: rating, ...(comment ? { comment } : {}) } })` (rating may be `null`), then persist on success and revert on failure — reusing the existing `responseId` guard (still required, since Core's `RateRequest` needs it) and the existing `revert`/`persist` helpers.
- [x] 2.2 Update `libs/chat-hooks/src/conversation/useConversationHandlers/tests/useConversationHandlers.spec.ts`: replace the "saves without calling rateMessage when toggling the rating off" test with a test asserting `rateMessage` IS called with `rate: null` before the conversation is saved, for both a previously-Like and a previously-Dislike message. Add a failure-path test: when the clear API call rejects, `message.rating` is restored to its previous value and `saveConversation` is not called.

## 3. Frontend: OpenAPI regeneration (no manual edits)

- [x] 3.1 Run `npm run openapi` to regenerate `libs/chat-api-client/openapi.json` and `libs/chat-api-client/src/generated/**` from the updated `RateMessageDto` (nullable `rate`).
- [x] 3.2 Run `npm run openapi:check` and build/lint `chat-api-client` to confirm the generated client is in sync and type-checks.
- [x] 3.3 Confirm no frontend call site needs a manual type assertion now that `rate` is nullable (`apps/chat/src/pages/Conversation/Conversation.tsx`, `build-message-actions.ts`) — they already pass `MessageRating | null` through, so this should be a no-op check, not a code change.

## 4. Specs and docs

- [x] 4.1 Run `openspec sync` (or the `opsx:sync` skill) once implementation is verified, to fold this change's delta into `openspec/specs/message-rating/spec.md`.
- [x] 4.2 Grep `docs/` for any doc describing the `/rate` endpoint's outbound body shape (none identified during exploration, but re-check `docs/technical-requirements.md` and `apps/chat-api/README.md`) and update if found.

## 5. Verification

- [x] 5.1 `npm run test:file -- apps/chat-api/src/rate/tests/rate.service.spec.ts`
- [x] 5.2 `npm run test:file -- apps/chat-api/src/rate/tests/rate.controller.spec.ts`
- [x] 5.3 `npm run test:file -- libs/chat-hooks/src/conversation/useConversationHandlers/tests/useConversationHandlers.spec.ts`
- [x] 5.4 `npm run verify:changed` (ran as `lint:affected` + `test:changed` separately — `typecheck:affected` fails on 250 pre-existing errors in `@epam/chat-api`, confirmed via `git stash` to exist on the unmodified baseline and unrelated to this change; none are under `src/rate/`)
- [x] 5.5 `npm run verify:full` (ran as its 3 constituent steps — `typecheck:full:quiet` fails on the same pre-existing `@epam/chat-api` baseline errors as 5.4 (confirmed unrelated via `git stash`); `lint:check:quiet` has one pre-existing unrelated failure in `@epam/ai-dial-catalog` (a `featuredChipStyle` prettier issue, untouched by this change); `test:full:quiet` passes cleanly)
