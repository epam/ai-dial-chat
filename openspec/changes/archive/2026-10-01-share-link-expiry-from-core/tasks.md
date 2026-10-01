Slicing strategy: **contract-first, single vertical slice**. The BFF and the DTO contract change together; the generated client and the lib type follow from the regenerated OpenAPI; the frontend containers need no change. The implementation landed before this change was written (issue #9234), so completed items are checked with the verification that was actually run.

## 1. BFF: read the expiry from the DIAL Core invitation

- [x] 1.1 In `apps/chat-api/src/share/invitation/share-invitation.service.ts`, extract `parseInvitationId(invitationLink)` from `buildInvitationUrl`, and make `buildInvitationUrl` take the parsed id.
- [x] 1.2 Add `getInvitationExpiresInDays(accessToken, invitationId)`. It calls `dialClient.client.getInvitation(invitationId, { headers })` without `accept`, returns `ceil((expireAt - Date.now()) / MS_PER_DAY)`, and returns `undefined` with a `logger.warn` on an error response, a throw, a missing `expireAt`, or a non-positive result. It debug-logs `expireAt` on success.
- [x] 1.3 Remove `SHARE_LINK_EXPIRES_IN_DAYS` and the temporary status/headers debug logging, and wire `expiresInDays` from the peek into `createShareLink`'s return value.
- [x] 1.4 Unit tests in `apps/chat-api/src/share/invitation/tests/share-invitation.service.spec.ts`: days derived from `expireAt`; partial day rounds up; the peek is a single call with the bearer header and no `accept`; the link is still returned without `expiresInDays` on an error response, a missing `expireAt`, a past expiry, or a thrown peek.

  Verification: `npm run test:file -- apps/chat-api/src/share/invitation/tests/share-invitation.service.spec.ts apps/chat-api/src/share/tests/share.controller.spec.ts` (passed).

## 2. Contract: optional `expiresInDays`

- [x] 2.1 `apps/chat-api/src/share/dto/share-link-response.dto.ts`: switch `expiresInDays` to `@ApiPropertyOptional` with a description of where the value comes from, typed `expiresInDays?: number`.
- [x] 2.2 Run `npm run openapi` and `npm run openapi:check`. The regenerated `libs/chat-api-client/openapi.json` drops `expiresInDays` from `required`, and the generated model types it `expiresInDays?: number` (both passed; generated files not hand-edited).
- [x] 2.3 Build and lint `chat-api-client`: `npm exec nx build chat-api-client` and `npm exec nx lint chat-api-client`.

## 3. Lib type and docs

- [x] 3.1 `libs/share/src/models/share-link-data.ts`: `expiresInDays?: number`. Architecture guard: the lib still receives only the resolved number and has no DIAL Core, `/api` path, generated-client, env or app-context knowledge.
- [x] 3.2 `libs/share/README.md`: update the `ShareLinkData` shape row.
- [x] 3.3 Confirm that `libs/chat-hooks/src/useShareLink/useShareLink.ts`, `apps/chat/src/components/SharePopoverContainer/SharePopoverContainer.tsx` and `apps/chat/src/components/ShareConversationPopoverContainer/ShareConversationPopoverContainer.tsx` need no change: they pass the value through and guard on `!= null`.

  Verification: `npm run test:file -- libs/chat-hooks/src/useShareLink/tests/useShareLink.spec.ts libs/share/src/components/SharePopover/tests/SharePopover.spec.tsx apps/chat/src/components/SharePopoverContainer/tests/SharePopoverContainer.spec.tsx apps/chat/src/components/ShareConversationPopoverContainer/tests/ShareConversationPopoverContainer.spec.tsx` (passed); `npm run validate:docs` (passed).

## 4. Close-out

- [x] 4.1 `npm run verify:changed` for the completed slice. Typecheck, lint and tests are green for `chat-api`, `chat-hooks`, `share`, `chat-api-client` and `chat`. The remaining failures are outside this change: `@epam/ai-dial-celebrations` dependency-checks lint on unrelated in-progress work, an order-dependent `app-config.service.spec.ts` case, and `useSkillFileSystemPicker.spec.ts`.
- [x] 4.2 `npm run verify:full` as the final gate (signed off after the author's own verification). The pre-existing `getScheduledTaskRun` type errors in `apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.service.spec.ts` are unrelated to this change; if they block the gate, fix them separately.

## 5. Follow-ups (out of scope, not tracked by this change)

- Pluralize `share.expiryNote` in `apps/chat/src/i18n/locales/en.json` ("1 days"), or switch to an absolute "active until …" date.
- Decide whether `useShareLink` should avoid creating a second invitation under React StrictMode's double-invoked effect in dev.
