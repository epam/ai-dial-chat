Verification uses `npm run test:file -- <workspace-relative-path>` for the
red/green loop and `npm run verify:changed` per slice. `design.md` labels the
findings F1–F5 and the decisions D1–D4; tasks reference them by number.

## 1. Backend: return an id the catalog can match

- [x] 1.1 Add `toPublicItemId` to `apps/chat-api/src/share/utils/share-resource.util.ts`, directly below `toShareResourceUrl`, decoding per path segment for prompt ids only and passing every other kind through (F1, F2, D1, D2).
- [x] 1.2 Apply it to the `itemId` returned by `ShareInvitationService.acceptInvitation`, leaving the raw upstream url in use for the peek/accept calls and `resolveSharedItemSummary` (D3).
- [x] 1.3 State the decoded-prompt behaviour in `AcceptInvitationResponseDto.itemId`'s Swagger description.
- [x] 1.4 Cover it in `apps/chat-api/src/share/invitation/tests/share-invitation.service.spec.ts`: an invitation whose resource url is `prompts/owner-bucket/Work/tone%20of%20voice` returns `prompts/owner-bucket/Work/tone of voice`. Verify: `npm run test:file -- apps/chat-api/src/share/invitation/tests/share-invitation.service.spec.ts`

## 2. Frontend: put the granted prompt in the list before redirecting

- [x] 2.1 Add `usePrompts().refetchPrompts` to `SharedInvitationPage`'s post-accept `Promise.all`, with a comment recording why no merge exists for prompts (F4, F5, D4).
- [x] 2.2 Extend `apps/chat/src/pages/SharedInvitation/tests/SharedInvitation.spec.tsx` with a prompt case asserting the prompts refetch ran and the redirect carries the decoded id, and mock `PromptsContext` in the existing suite.
- [x] 2.3 Mock `PromptsContext` in `apps/chat/src/pages/ConversationSharedInvitation/tests/ConversationSharedInvitation.spec.tsx`, which renders the same page component. Verify: `npm run test:file -- apps/chat/src/pages/SharedInvitation/tests/SharedInvitation.spec.tsx apps/chat/src/pages/ConversationSharedInvitation/tests/ConversationSharedInvitation.spec.tsx`

## 3. Contract and verification

- [x] 3.1 Regenerate the API contract for the description change: `npm run openapi`, `npm run openapi:check`, then build and lint `chat-api-client`.
- [x] 3.2 `npm run verify:changed` (typecheck, lint, affected tests) and `npm run validate:docs`.
- [ ] 3.3 Manual check against a live environment: user A shares a prompt whose name contains a space, user B opens the link and lands on the catalog with that prompt's details panel open (acceptance criterion 3). Not performed in this session — no environment available.
