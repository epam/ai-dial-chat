## 1. Fix conversation.service.ts call sites

- [ ] 1.1 Re-grep `conversation.service.ts` for current line numbers of every `{ data?: unknown; error?: unknown }` / `{ error?: unknown }` destructuring (line numbers shift once earlier edits land) before editing
- [ ] 1.2 `createConversation` (saveConversation call): capture `response`, pass `{ ...(error ?? {}), status: response.status }` to `handleDialSdkError`
- [ ] 1.3 `getStoredConversation`: capture `response`; on error, call `handleDialSdkError({ ...(error ?? {}), status: response.status }, 'conversations.getStoredConversation', this.logger)` directly instead of `throw error ?? new Error('Conversation not found')`
- [ ] 1.4 `deleteConversation`: capture `response` in both the non-catch branch and confirm the `catch` branch (real thrown exceptions) is left as-is; pass real status in the non-catch branch
- [ ] 1.5 `preserveLlmDisplayName`'s inner `saveConversation` call (~line 455-468): confirm out of scope (non-fatal, logs only) and leave unchanged — add a one-line comment noting it's intentionally non-fatal if not already clear
- [ ] 1.6 `duplicateConversation`: fix both the read (`getConversation`) and write (`saveConversation`) sub-calls (~lines 497-513, 549-570)
- [ ] 1.7 `getConversationMetadata`: fix (~lines 814-830)
- [ ] 1.8 `saveConversation`: fix (~lines 856-870)
- [ ] 1.9 Grep for any remaining `handleDialSdkError` call site in `conversation.service.ts` fed by a destructure that discards `response`, and fix it too (e.g. ~line 1073, ~line 1209 region) — the line numbers above are from investigation and may not be exhaustive
- [ ] 1.10 Confirm error-body spread ordering is `{ ...(error ?? {}), status: response.status }` (status last) everywhere, per design.md's "status must win" decision

## 2. Fix bucket.service.ts

- [ ] 2.1 `getUserBucket`: capture `response`, pass `{ ...(error ?? {}), status: response.status }` to `handleDialSdkError`

## 3. Tests

- [ ] 3.1 Add/extend `conversation.service.spec.ts` tests: for `deleteConversation`, `getConversation` (via `getStoredConversation`), `duplicateConversation`, `renameConversation`, `getConversationMetadata`, `saveConversation`, and `createConversation`, assert that a mocked SDK response with `error` set and `response.status` = 404 throws `NotFoundException` (not `BadGatewayException`), and similarly for 403/409 where meaningful
- [ ] 3.2 Add/extend `bucket.service.spec.ts` (or equivalent) with the same status-fidelity assertion for `getUserBucket`
- [ ] 3.3 Add a regression test replicating the exact live bug report: `deleteConversation` on a path DIAL Core reports 404 for must throw `NotFoundException`

## 4. Frontend impact check

- [ ] 4.1 Grep `apps/chat/src/server-api` and any conversation-related hooks for status-502-specific branching on the affected operations (delete/create/get/duplicate/rename conversation, bucket resolution); if found, update or flag for a follow-up since the status they'll now receive is correct but different from today

## 5. Verification

- [ ] 5.1 Run `npm exec nx test chat-api`
- [ ] 5.2 Run `npm exec nx lint chat-api`
- [ ] 5.3 Manually reproduce the original bug report (delete an already-deleted/nonexistent conversation) against a local DIAL Core or mock and confirm the API now returns 404, not 502
