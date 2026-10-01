## Why

The share popover always says "This link is active for 3 days." The number comes from a hardcoded BFF constant (`SHARE_LINK_EXPIRES_IN_DAYS = 3`), not from DIAL Core. DIAL Core is what actually expires the invitation, and it lets the TTL be configured per role (`Role.share[<key>].invitation_ttl`). On any deployment with a different TTL, the chat shows users the wrong expiry (issue #9234).

## Problem

- DIAL Core's `shareResource` response carries only `{ invitationLink }`. This was confirmed by debug-logging the raw status, headers and body: there is no expiry in either the body or the headers.
- The invitation does carry `expireAt`. The non-accepting `GET /v1/invitations/{id}` peek returns the `Invitation` schema (`createdAt`, `expireAt`, …). The BFF already makes this peek in `acceptInvitation` (`apps/chat-api/src/share/invitation/share-invitation.service.ts:392`).

## What Changes

- `POST /api/v1/share` reads the expiry from the created invitation's `expireAt` with the same non-accepting `getInvitation` peek, and derives `expiresInDays` from it (whole days, rounded up).
- The hardcoded `SHARE_LINK_EXPIRES_IN_DAYS` constant is removed.
- `ShareLinkResponseDto.expiresInDays` becomes **optional**. When the peek fails, returns no `expireAt`, or returns an expiry already in the past, the share link is still returned and `expiresInDays` is omitted. A warning is logged, and the BFF does not fall back to a guessed default.
- `ShareLinkData.expiresInDays` in `@epam/ai-dial-share` becomes optional to match.
- No new environment variable and no new response field.

## Non-goals

- Pluralizing `share.expiryNote` ("1 days"), or showing an absolute "active until …" date.
- Changing the TTL itself. That stays DIAL Core configuration.
- Deduplicating the second share request that React StrictMode's double-invoked effect causes in dev (`useShareLink`). It is dev-only.

## Alternatives considered

- **Environment variable mirroring DIAL Core's TTL.** Rejected: it would have to be kept in sync by hand, it cannot express per-role TTLs, and the user explicitly asked to avoid a new variable.
- **Add an `expiresAt` field and deprecate `expiresInDays`.** Rejected for now: it would change the generated client, `useShareLink`, `ShareLinkData` and both popover containers. Keeping `expiresInDays` limits the change to the BFF plus one optional flag.
- **Fall back to 3 days when the peek fails.** Rejected: it would reintroduce the constant and show a value that may be wrong. Omitting the note is honest, and the containers already handle a missing value.

## Capabilities

### New Capabilities

- `share-link-expiry`: How `POST /api/v1/share` determines the `expiresInDays` it reports. It is read from the DIAL Core invitation's `expireAt` with a non-accepting peek, rounded up to whole days, and omitted when DIAL Core does not report a usable expiry. Link creation never fails because of the expiry.

### Modified Capabilities

- `prompts-share-api`: The `ShareLinkResponseDto` example and the 201 scenarios currently require `expiresInDays` with the literal `3`. They now treat `expiresInDays` as present only when DIAL Core reports an expiry.

## Impact

- **BFF:** `apps/chat-api/src/share/invitation/share-invitation.service.ts` (new `parseInvitationId` and `getInvitationExpiresInDays`, constant removed) and `apps/chat-api/src/share/dto/share-link-response.dto.ts` (`@ApiPropertyOptional`).
- **API contract:** `expiresInDays` is dropped from `ShareLinkResponseDto.required` in `libs/chat-api-client/openapi.json`. The regenerated client model has `expiresInDays?: number`. The change is additive for readers, because no caller was ever guaranteed a value other than 3.
- **Libs:** `libs/share/src/models/share-link-data.ts` and its README row. The lib still receives only resolved data; DIAL Core knowledge stays in the BFF. `useShareLink` (`libs/chat-hooks/src/useShareLink/useShareLink.ts:77`) passes the value through unchanged.
- **App:** none. `SharePopoverContainer.tsx:79` and `ShareConversationPopoverContainer.tsx:53` already render `expiryNote` only when `expiresInDays != null`, and `SharePopover` hides the note when the label is absent (`libs/share/src/components/SharePopover/SharePopover.tsx:304`).
- **Performance:** one extra DIAL Core round-trip per share-link creation, which happens only when the popover opens.
- **i18n:** no new strings.
- **Rollback:** revert the change. The constant returns and `expiresInDays` becomes required again. There is no data migration.

## Acceptance criteria

- With a non-default `invitation_ttl` in DIAL Core, the popover shows the number of days matching the invitation's `expireAt`, for conversations, catalog items and prompts.
- When the expiry cannot be determined, the link is still shown and no expiry note is rendered.
- The expiry peek never sends `accept`.
- `npm run openapi:check` and `npm run validate:docs` pass.
