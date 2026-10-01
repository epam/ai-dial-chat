Slicing strategy: **risk-first, then contract**. Slice 1 proves the BFF can read and derive the real expiry, which carries all of the behavioural risk. Slice 2 widens the contract through the generator. Slice 3 aligns the libs, app fixtures and docs with the optional field. Every slice can be verified on its own. The DTO field becomes optional in slice 1 (task 1.4), because the omission path cannot type-check against a required field. Slice 2 regenerates the client from that DTO.

## 1. BFF: derive expiry from the DIAL Core invitation

- [x] 1.1 Add a pure `deriveExpiresInDays(invitation: Pick<Invitation, 'createdAt' | 'expireAt'>, nowMs: number): number | undefined` to `apps/chat-api/src/share/utils/share-resource.util.ts`. Use `const` arrow syntax and the SDK `components['schemas']['Invitation']` type. Reference time = `max(createdAt, nowMs)` when `createdAt` is finite, otherwise `nowMs`. Return `Math.ceil((expireAt - reference) / 86_400_000)`, or `undefined` when `expireAt` is not finite or the delta is `≤ 0` (design D3).
  - Verification: `npm run test:file -- apps/chat-api/src/share/utils/tests/share-resource.util.spec.ts`
- [x] 1.2 Unit-test `deriveExpiresInDays` in `apps/chat-api/src/share/utils/tests/share-resource.util.spec.ts`. Cover: exact 7-day TTL → 7; 36 h → 2; BFF clock 5 s behind `createdAt` with a 3-day TTL → 3 (not 4); BFF clock ahead of `createdAt` → remaining days; missing `createdAt` falls back to `now`; missing or non-finite `expireAt` → `undefined`; `expireAt ≤ reference` → `undefined`; `expireAt` in seconds (~1.8e9) → `undefined`.
  - Verification: `npm run test:file -- apps/chat-api/src/share/utils/tests/share-resource.util.spec.ts`
- [x] 1.3 In `apps/chat-api/src/share/invitation/share-invitation.service.ts`, extract a private `extractInvitationId(invitationLink)` from `buildInvitationUrl`. It keeps the same `BadGatewayException` on an empty id. Change `buildInvitationUrl` to take the extracted id (design D2).
  - Verification: `npm run test:file -- apps/chat-api/src/share/invitation/tests/share-invitation.service.spec.ts` (existing URL-building tests still pass)
- [x] 1.4 In `apps/chat-api/src/share/dto/share-link-response.dto.ts`, change the field to `expiresInDays?: number` with `@ApiProperty({ required: false, description: 'Days until the DIAL Core invitation expires, rounded up. Omitted when DIAL Core does not report a usable expiry.', example: 3 })`.
  - Verification: `npm exec nx run chat-api:typecheck`
- [x] 1.5 In `createShareLink`, after the empty-link check, extract the id. Then add a private best-effort `peekInvitationExpiry(accessToken, invitationId): Promise<number | undefined>` that calls `this.dialClient.client.getInvitation(invitationId, { headers: getBearerAuthHeaders(accessToken) })` with **no** `params`. It catches a throw, treats `error` or a missing `data` as unknown, logs `this.logger.warn` with the invitation id and `response?.status` only, and otherwise returns `deriveExpiresInDays(data, Date.now())`, warning when that is `undefined`. Remove `SHARE_LINK_EXPIRES_IN_DAYS` and its comment block. Build the response with `...(expiresInDays != null && { expiresInDays })` so the key is omitted when unknown (design D4). Replace the removed comment with a short block comment explaining why the expiry is peeked.
  - Verification: `npm run test:file -- apps/chat-api/src/share/invitation/tests/share-invitation.service.spec.ts`
- [x] 1.6 Update `apps/chat-api/src/share/invitation/tests/share-invitation.service.spec.ts`:
  - make `makeService`'s default `getInvitation` mock return an invitation with `createdAt`/`expireAt`;
  - change the "maps a successful DIAL Core response" test so it expects the derived days, using a fixed clock or a mocked `Date.now`;
  - add "derives expiresInDays from the invitation's expireAt";
  - add "never sends accept when peeking the created invitation", asserting `getInvitation` is called once with `('abc123', { headers })` and no `params`;
  - add "returns the link without expiresInDays when the peek rejects";
  - add "… when the peek returns an upstream error" (asserting the warn includes the status);
  - add "… when expireAt is missing";
  - add "… when expireAt is already past";
  - add "does not peek when shareResource fails";
  - add "does not peek when DIAL Core returns an invalid invitation link".
  - Verification: `npm run test:file -- apps/chat-api/src/share/invitation/tests/share-invitation.service.spec.ts`
- [x] 1.7 Slice check: `npm run verify:changed`

## 2. Contract: make `expiresInDays` optional via OpenAPI

- [x] 2.1 In `apps/chat-api/src/share/tests/share.controller.spec.ts`, add a case asserting that the controller passes through a service result without `expiresInDays` unchanged. Keep the existing `expiresInDays: 3` fixture for the present case.
  - Verification: `npm run test:file -- apps/chat-api/src/share/tests/share.controller.spec.ts`
- [x] 2.2 Regenerate the client: run `npm run openapi`, then `npm run openapi:check`. Confirm that `libs/chat-api-client/openapi.json`'s `ShareLinkResponseDto.required` is `["url", "access"]` and that the generated model has `expiresInDays?: number`. Do not hand-edit anything under `libs/chat-api-client/src/generated`.
  - Verification: `npm run openapi:check`; `npm exec nx run-many -t build,lint -p chat-api-client`
- [x] 2.3 Slice check: `npm run verify:changed`. No `apps/chat/src/server-api` wrapper change is expected, because the operation and method name are unchanged. Confirm with `npm exec nx run chat:typecheck`.

## 3. Libs, app fixtures and docs

- [x] 3.1 In `libs/share/src/models/share-link-data.ts`, make the field `expiresInDays?: number`. Update its JSDoc to say "omitted when the host cannot determine the expiry". Architecture guard: the lib gains no DIAL Core, endpoint, TTL or i18n knowledge; it is only a type relaxation.
  - Verification: `npm exec nx run share:typecheck`
- [x] 3.2 In `libs/share/README.md`, update the `ShareLinkData` line to `{ url: string; expiresInDays?: number; access: ShareLinkAccess[] }` and add a short note that the popover's `expiryNote` should be left `undefined` when the value is absent.
  - Verification: `npm run validate:docs`
- [x] 3.3 In `libs/chat-hooks/src/useShareLink/tests/useShareLink.spec.ts`, add "leaves expiresInDays undefined when the response omits it" and keep a present-value case. `useShareLink.ts` needs no source change (it already assigns `response.expiresInDays`). Architecture guard: the hook still only receives a configured client and adds no default.
  - Verification: `npm run test:file -- libs/chat-hooks/src/useShareLink/tests/useShareLink.spec.ts`
- [x] 3.4 In `apps/chat/src/components/SharePopoverContainer/tests/SharePopoverContainer.spec.tsx` and `apps/chat/src/components/ShareConversationPopoverContainer/tests/ShareConversationPopoverContainer.spec.tsx`, add "passes no expiry note when the share link has no expiresInDays" (asserting `labels.expiryNote` is `undefined`) and "builds the expiry note from the expiresInDays reported by DIAL Core" (asserting `t(ShareI18nKeys.ExpiryNote, { days: 7 })`). These specs mock `SharePopover` and `t`, so the rendered-text check lives in `libs/share/src/components/SharePopover/tests/SharePopover.spec.tsx` ("renders the link without an expiry note when expiryNote is undefined"). No container source change is expected.
  - Verification: `npm run test:file -- apps/chat/src/components/SharePopoverContainer/tests/SharePopoverContainer.spec.tsx` and `npm run test:file -- apps/chat/src/components/ShareConversationPopoverContainer/tests/ShareConversationPopoverContainer.spec.tsx`
- [x] 3.5 Confirm that no source still hardcodes the expiry: `grep -rn "SHARE_LINK_EXPIRES_IN_DAYS" apps libs` returns nothing outside `dist`/`out-tsc`.
  - Verification: the grep result
- [x] 3.6 Slice check: `npm run verify:changed`, then `npm run validate:docs`

## 4. Close-out

- [x] 4.1 Run `npm run verify:full` once.
- [ ] 4.2 Follow-up, out of scope: file or track issues for `share.expiryNote` pluralization ("1 days") and the dev-only StrictMode double-invitation in `useShareLink`. Do not fix them in this change.
