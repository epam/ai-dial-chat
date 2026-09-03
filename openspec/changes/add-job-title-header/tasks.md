## 1. Session claim capture

- [x] 1.1 Add `job_title` to `ALLOWED_CLAIM_KEYS` in `apps/chat-api/src/auth/auth.controller.ts` (`callback()`)
- [x] 1.2 Add `JOB_TITLE_CLAIM` constant and `getJobTitleClaim(claims)` helper to `apps/chat-api/src/auth/session/session.types.ts`, tolerant of a missing/undefined `claims` object
- [x] 1.3 Confirm `apps/chat-api/src/auth/strategies/header-token.strategy.ts` needs no change (unfiltered claims already include any `job_title` present on the bearer JWT)

## 2. Header helper

- [x] 2.1 Add `JOB_TITLE_HEADER = 'X-JOB-TITLE'` and `buildJobTitleHeaders(jobTitle)` to `apps/chat-api/src/common/utils/header-value.ts`, reusing `encodeHeaderValue` and mirroring `buildConversationIdHeaders`'s omit-when-absent behavior

## 3. Chat completion (streaming)

- [x] 3.1 Thread an optional `jobTitle` parameter from `ConversationController.streamCompletion` through `ConversationService.streamCompletion` (bound pass-through, no change needed) to `ConversationStreamingService.streamCompletion`
- [x] 3.2 Add `X-JOB-TITLE` to the Chat Completions request headers in `ConversationStreamingService.relayModelCompletion`
- [x] 3.3 Add `X-JOB-TITLE` to the Responses API request headers in `ResponsesAdapter.stream`
- [x] 3.4 Add the same `jobTitle` parameter and header to `ChatCompletionsAdapter.stream`/`relay` for consistency, even though it is not yet the live call site

## 4. Models list / default-model

- [x] 4.1 Thread an optional `jobTitle` parameter from `DeploymentsController.listDeployments` through `DeploymentsService.listDeployments` (bound pass-through) to `DeploymentsListingService.listDeployments`
- [x] 4.2 Add `X-JOB-TITLE` to the DIAL Core `listDeployments` request headers, without adding job title to the existing cache key

## 5. Rate

- [x] 5.1 Thread an optional `jobTitle` parameter from `RateController.rateMessage` to `RateService.rateMessage`
- [x] 5.2 Add `X-JOB-TITLE` alongside the existing `X-CONVERSATION-ID` header in `RateService.rateMessage`

## 6. Transcribe

- [x] 6.1 Thread an optional `jobTitle` parameter from `TranscriptionController.transcribeAudio` to `TranscriptionService.transcribeAudio`
- [x] 6.2 Add `X-JOB-TITLE` to the DIAL Core transcription request headers

## 7. Tests and verification

- [x] 7.1 Update `rate.controller.spec.ts` call-argument assertion for the new trailing `jobTitle` parameter
- [x] 7.2 Update `deployments.controller.spec.ts` and `deployments.controller.integration.spec.ts` call-argument assertions for the new trailing `jobTitle` parameter
- [x] 7.3 Run `npm exec nx run chat-api:build`
- [x] 7.4 Run `npm exec nx run chat-api:lint`
- [x] 7.5 Run `npm exec nx run chat-api:test` (full suite)
- [x] 7.6 Run `npm run validate:docs` and confirm no new failures are introduced by this change (pre-existing unrelated failure noted, not caused by this change)
