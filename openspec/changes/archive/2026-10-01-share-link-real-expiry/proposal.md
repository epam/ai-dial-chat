## Why

The share popover always says "This link is active for 3 days." The number comes from a hardcoded BFF constant, `SHARE_LINK_EXPIRES_IN_DAYS = 3` ([share-invitation.service.ts:45](../../../apps/chat-api/src/share/invitation/share-invitation.service.ts#L45), returned at `:311`). DIAL Core is what actually expires the link, and its TTL can be set per role (`Role.share[<key>].invitation_ttl`, `ShareResourceLimit` in `@epam/ai-dial-typescript-sdk`). On any deployment or role whose TTL is not 3 days, users see the wrong expiry for conversations, catalog items and prompts. Changing the TTL should only take a DIAL Core config change, not a chat code change and redeploy (GitHub issue #9234).

## Problem

- `POST /v1/ops/resource/share/create` (`shareResource`) returns only `{ invitationLink }`. Logging the raw response at `LOG_LEVEL=debug` showed that neither the body nor the headers carry an expiry.
- The `Invitation` schema returned by `GET /v1/invitations/{id}` without `accept=true` does carry `createdAt` and `expireAt` (SDK `components['schemas']['Invitation']`). The BFF already makes this non-accepting "peek" call in `acceptInvitation` ([share-invitation.service.ts:342](../../../apps/chat-api/src/share/invitation/share-invitation.service.ts#L342)).

## What Changes

- **BFF (`apps/chat-api/src/share`)**: after `shareResource` succeeds, `createShareLink` takes the invitation id from `invitationLink`, reusing the parsing `buildInvitationUrl` already does at `:78`. It then calls `dialClient.client.getInvitation(invitationId)` **without** `accept`, and derives `expiresInDays` from the invitation's `expireAt`. `SHARE_LINK_EXPIRES_IN_DAYS` is removed.
- **Best-effort peek**: if the peek throws, returns an error, has no usable `expireAt`, or has an `expireAt` that has already passed, the BFF logs a `WARN`, still returns the link, and **omits** `expiresInDays`. It does not fall back to 3, because that fallback is exactly the wrong number this change removes.
- **Contract**: `ShareLinkResponseDto.expiresInDays` becomes optional (`required: false` in Swagger). OpenAPI is regenerated, and so is `libs/chat-api-client`. No field is added and no environment variable is introduced.
- **Libs**: `ShareLinkData.expiresInDays` in `libs/share` becomes optional, and the `ShareLinkData` row in its README is updated. `useShareLink` in `libs/chat-hooks` passes the value through unchanged ([useShareLink.ts:77](../../../libs/chat-hooks/src/useShareLink/useShareLink.ts#L77)).
- **App**: no UI change. Both `SharePopoverContainer` (`:79`) and `ShareConversationPopoverContainer` (`:53`) already pass `expiryNote: undefined` when `expiresInDays` is null, and `SharePopover` renders the note only when it is defined ([SharePopover.tsx:304](../../../libs/share/src/components/SharePopover/SharePopover.tsx#L304)).

Model: the existing non-accepting peek in `acceptInvitation` (same SDK call, same `getBearerAuthHeaders(accessToken)`). The best-effort, warn-and-degrade handling follows `getApplicationRelatedResourceUrls` in the same service.

## Capabilities

### New Capabilities

- `share-link-expiry`: how `POST /api/v1/share` gets `expiresInDays` from the DIAL Core invitation, how it degrades when the expiry is unknown, and how the optional value flows through `ShareLinkData` and `useShareLink` to the popover's expiry note.

### Modified Capabilities

- `prompts-share-api`: the "Personal prompts are shareable via the existing share endpoint" requirement documents the response as `"expiresInDays": 3` with the field always present. It changes to describe `expiresInDays` as optional and read from DIAL Core.

## Non-goals

- Pluralizing `share.expiryNote` ("1 days"). This is a follow-up.
- React StrictMode double-invoking `useShareLink`'s effect in dev, which creates two invitations per popover open. Production is not affected.
- Showing an exact time or a countdown. The unit stays whole days.
- Reading or exposing `Role.share[...].invitation_ttl`. The chat reads the invitation's own `expireAt`, so the meaning of the role key and the unit of the TTL do not matter to it.

## Alternatives considered

- **Keep a constant and make it an env var.** Rejected. Any env var can still drift from the DIAL Core role config, and the issue asks for config changes to live only in DIAL Core.
- **Read `invitation_ttl` from the role/limits config.** Rejected. It needs extra config endpoints and role resolution, and it would still be a guess about the invitation that was actually created. `expireAt` is the authoritative value.
- **Peek the invitation (chosen).** It costs one extra DIAL Core round trip per link creation. That is the only option that reports what DIAL Core will actually enforce.

## Acceptance criteria

- With a non-default `invitation_ttl` configured in DIAL Core, the popover shows an expiry that matches the invitation's `expireAt`, for conversations, catalog items and prompts.
- No chat code hardcodes the expiry: `SHARE_LINK_EXPIRES_IN_DAYS` is gone, and no fallback number replaces it.
- When the expiry cannot be determined, the link is still returned and shown, and no expiry note is rendered.
- The peek never sends `accept`. A unit test asserts this.
- OpenAPI (`libs/chat-api-client/openapi.json`), the generated client model, `ShareLinkData`, and the `libs/share` README all agree that `expiresInDays` is optional. `npm run openapi:check` and `npm run validate:docs` both pass.

## Impact

- **Code**: `apps/chat-api/src/share/invitation/share-invitation.service.ts` (plus its spec), `apps/chat-api/src/share/dto/share-link-response.dto.ts`, `libs/chat-api-client` (regenerated), `libs/share/src/models/share-link-data.ts`, `libs/share/README.md`, and test fixtures in `libs/chat-hooks` and the two app popover containers.
- **API**: `ShareLinkResponseDto.expiresInDays` changes from required to optional. This is a widening change for consumers. Consumers in this repo already null-check the field. An external consumer of the generated client that assumed the field is always present would get a type error and would need the same null-check.
- **Performance**: one extra `GET /v1/invitations/{id}` per share-link creation, on the same path that already makes a `shareResource` call.
- **Shared libs**: `libs/share` and `libs/chat-hooks` only get a type relaxation. No host knowledge enters either lib: the number is resolved in the BFF and arrives as a plain optional field, and the translated note is still built by the app containers with `t()`.
- **i18n**: no new strings. The existing `share.expiryNote` is reused.
- **RTL / a11y**: none. The rendered markup is unchanged.
- **Rollback**: revert the commit. The old constant comes back, and making the field required again is safe because every reader already handles a value being present.
