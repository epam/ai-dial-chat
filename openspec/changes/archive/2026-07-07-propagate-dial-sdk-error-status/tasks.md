## 1. Fix conversation.service.ts call sites

- [x] 1.1 Re-grep `conversation.service.ts` for current line numbers of every `{ data?: unknown; error?: unknown }` / `{ error?: unknown }` destructuring (line numbers shift once earlier edits land) before editing
- [x] 1.2 `createConversation` (saveConversation call): capture `response`, pass `{ ...(error ?? {}), status: response.status }` to `handleDialSdkError`
- [x] 1.3 `getStoredConversation`: capture `response`; on error, call `handleDialSdkError({ ...(error ?? {}), status: response.status }, 'conversations.getStoredConversation', this.logger)` directly instead of `throw error ?? new Error('Conversation not found')`
- [x] 1.4 `deleteConversation`: capture `response` in both the non-catch branch and confirm the `catch` branch (real thrown exceptions) is left as-is; pass real status in the non-catch branch
- [x] 1.5 `preserveLlmDisplayName`'s inner `saveConversation` call (~line 455-468): confirm out of scope (non-fatal, logs only) and leave unchanged — add a one-line comment noting it's intentionally non-fatal if not already clear
- [x] 1.6 `duplicateConversation`: fix both the read (`getConversation`) and write (`saveConversation`) sub-calls (~lines 497-513, 549-570)
- [x] 1.7 `getConversationMetadata`: fix (~lines 814-830)
- [x] 1.8 `saveConversation`: fix (~lines 856-870)
- [x] 1.9 Grep for any remaining `handleDialSdkError` call site in `conversation.service.ts` fed by a destructure that discards `response`, and fix it too (e.g. ~line 1073, ~line 1209 region) — the line numbers above are from investigation and may not be exhaustive
- [x] 1.10 Confirm error-body spread ordering is `{ ...(error ?? {}), status: response.status }` (status last) everywhere, per design.md's "status must win" decision

## 2. Fix bucket.service.ts

- [x] 2.1 `getUserBucket`: capture `response`, pass `{ ...(error ?? {}), status: response.status }` to `handleDialSdkError`

## 3. Tests

- [x] 3.1 Add/extend `conversation.service.spec.ts` tests: for `deleteConversation`, `getConversation` (via `getStoredConversation`), `duplicateConversation`, `renameConversation`, `getConversationMetadata`, `saveConversation`, and `createConversation`, assert that a mocked SDK response with `error` set and `response.status` = 404 throws `NotFoundException` (not `BadGatewayException`), and similarly for 403/409 where meaningful
- [x] 3.2 Add/extend `bucket.service.spec.ts` (or equivalent) with the same status-fidelity assertion for `getUserBucket`
- [x] 3.3 Add a regression test replicating the exact live bug report: `deleteConversation` on a path DIAL Core reports 404 for must throw `NotFoundException`

## 4. Frontend impact check

- [x] 4.1 Grep `apps/chat/src/server-api` and any conversation-related hooks for status-502-specific branching on the affected operations (delete/create/get/duplicate/rename conversation, bucket resolution); if found, update or flag for a follow-up since the status they'll now receive is correct but different from today — found `isConversationNotFoundError` in `apps/chat/src/server-api/api-error.ts` treating `502` as "not found" (an unused-in-production workaround for this exact bug); removed the `502` branch since it is now incorrect (a real `502` no longer implies "not found") and updated its spec

## 5. Reusable helper + wider adoption

- [x] 5.1 Give `handleDialSdkError` an optional 4th `response?: { status: number }` parameter in `apps/chat-api/src/common/dial/dial-error.mapper.ts` and merge it with the error body internally (status always wins), so callers pass `handleDialSdkError(error, context, logger, response)` directly instead of hand-rolling `{ ...(error ?? {}), status: response.status }` or calling a separate helper
- [x] 5.2 Migrate `conversation.service.ts` and `bucket.service.ts` (this change's own fixes) to the new 4th-parameter form
- [x] 5.3 Migrate the previously-"already correct" SDK-shaped call sites too: `files.service.ts` (8 call sites), `user-config.service.ts` (`writeConfig`)
- [x] 5.4 Fix a latent version of the same bug found during migration: `chat.service.ts` and `transcription.service.ts` used `result.error ?? { status: result.response.status }`, which only attached `status` when `error` was falsy — any truthy SDK error body without its own `status` field still fell through to `BadGatewayException`. Both now pass `result.response` as the 4th argument unconditionally
- [x] 5.5 Leave `rate.service.ts` untouched — it uses a raw `fetch` call (not the SDK client) and already attaches `status` to a thrown `Error` correctly; it is not SDK-shaped despite being named in proposal.md's original "already correct" list
- [x] 5.6 Add/extend regression tests for the newly-migrated files: `chat.service.spec.ts`, new `transcription.service.spec.ts`, new `bucket.service.spec.ts`, and `dial-error.mapper.spec.ts` (direct coverage of the 4th parameter) — assert `NotFoundException`/`ForbiddenException`/`ConflictException` for a `response.status` with an error body that carries no `status` field, and that a status on the error body doesn't win over `response.status`

## 6. Verification

- [x] 6.1 Run `npm exec nx test chat-api`
- [x] 6.2 Run `npm exec nx lint chat-api`
- [x] 6.3 Run `npm exec nx build chat-api`
- [ ] 6.4 Manually reproduce the original bug report (delete an already-deleted/nonexistent conversation) against a local DIAL Core or mock and confirm the API now returns 404, not 502
