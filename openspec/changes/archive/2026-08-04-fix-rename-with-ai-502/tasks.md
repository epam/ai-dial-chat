## 1. Reuse the shared DIAL Core error mapper

- [x] 1.1 ~~Add a local `DialNamingRequestError`~~ — superseded: reused the existing shared `mapDialHttpStatus` / `handleDialFetchError` helpers from `apps/chat-api/src/common/dial/dial-error.mapper.ts` instead of introducing a bespoke error class.
- [x] 1.2 Update `sendNamingCompletion` in `apps/chat-api/src/conversations/conversation-naming.service.ts` to call `mapDialHttpStatus(result.response.status, context, this.logger, result.error)` when `result.error != null || !result.response.ok`, and to route thrown/rejected errors (including `AbortError` timeouts) through `handleDialFetchError(error, context, this.logger, timeoutMs)` in the surrounding catch block.

## 2. Error mapping in `generateTitle`

- [x] 2.1 ~~Throw `ForbiddenException` for 401/403 in `generateTitle`'s catch block~~ — superseded: `sendNamingCompletion` now throws the already-correctly-typed exception directly (`UnauthorizedException` for upstream 401, `ForbiddenException` for upstream 403, matching the shared mapper's codebase-wide convention), so `generateTitle` no longer needs its own catch block for this call.
- [x] 2.2 Keep existing timeout → `ServiceUnavailableException` and other-upstream-failure → `BadGatewayException` behavior unchanged (now provided by `handleDialFetchError` / `mapDialHttpStatus` rather than bespoke logic in `generateTitle`).
- [x] 2.3 ~~Elevate the failure log line with status/classification~~ — superseded: `mapDialHttpStatus` already warn-logs the upstream status and error body, and `handleDialFetchError` already error-logs thrown/timeout failures, for every call site including this one — no separate classification logging needed in `conversation-naming.service.ts`.

## 3. API documentation

- [x] 3.1 Add `@ApiResponse({ status: 403, description: '...' })` to `generateConversationTitle` in `apps/chat-api/src/conversations/conversation.controller.ts`, and update the existing `401` response description to note it now also covers DIAL Core rejecting the utility-model deployment for the calling user's token.
- [x] 3.2 Run `npm run openapi && npm run openapi:check`, then build/lint `chat-api-client` per `apps/chat-api/AGENTS.md`.

## 4. Tests

- [x] 4.1 Add a unit test in `apps/chat-api/src/conversations/tests/conversation-naming.service.spec.ts` asserting a mocked upstream 403 response causes `generateTitle` to reject with `ForbiddenException`.
- [x] 4.2 Add a unit test asserting a mocked upstream 401 response causes `generateTitle` to reject with `UnauthorizedException` (not `ForbiddenException` — matches the shared mapper's convention, see design.md).
- [x] 4.3 Add/confirm a unit test that a mocked upstream 500 response still causes `BadGatewayException` (regression guard for existing behavior) — already covered by the pre-existing "throws BadGatewayException when the upstream request fails" test.
- [x] 4.4 Confirm the existing timeout test still passes unchanged (`ServiceUnavailableException`) — pre-existing test, unaffected by this change.

## 5. Verification

- [x] 5.1 `npm exec nx test chat-api`
- [x] 5.2 `npm exec nx lint chat-api`
- [x] 5.3 `npm exec nx build chat-api`
