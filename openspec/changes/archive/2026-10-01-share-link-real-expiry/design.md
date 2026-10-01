## Context

`ShareInvitationService.createShareLink` (`apps/chat-api/src/share/invitation/share-invitation.service.ts:237`) calls DIAL Core's `shareResource` and gets back only `{ invitationLink }`. It then returns `expiresInDays: SHARE_LINK_EXPIRES_IN_DAYS` (= 3, `:45`). DIAL Core enforces a TTL that can be configured per role, so the number shown can be wrong.

The SDK's `Invitation` schema has `createdAt?: number` and `expireAt?: number`, and the non-accepting `getInvitation` peek already exists in `acceptInvitation` (`:342`). Downstream, the two app containers and `SharePopover` already tolerate a missing value (`SharePopoverContainer.tsx:79`, `ShareConversationPopoverContainer.tsx:53`, `SharePopover.tsx:304`). The hard part is therefore the BFF and the contract, not the UI.

Backend conventions are in `apps/chat-api/AGENTS.md`: use the SDK through `DialClientService`, a class `Logger`, and typed exceptions. Lib boundaries follow AGENTS.md §Library isolation and `.claude/rules/libs.md`.

## Goals / Non-Goals

**Goals:**

- `expiresInDays` matches the moment DIAL Core starts rejecting the link.
- Changing the TTL only requires a DIAL Core config change.
- The share link never fails because the expiry could not be read.

**Non-Goals:**

- `share.expiryNote` pluralization.
- The dev-only StrictMode double invitation.
- Finer-grained expiry display.
- Reading role TTL config.

## Decisions

### D1. Peek the invitation after `shareResource`

`createShareLink` peeks with `getInvitation(invitationId)` (no `accept`) once `invitationLink` is validated.

- **Considered alternatives:** an env var, which can still drift from DIAL Core, and reading `Role.share[].invitation_ttl`, which needs extra config calls and role resolution and is still only a proxy for the real invitation. Both were rejected.
- **Cost:** one DIAL Core round trip per link, sequential after `shareResource`. It cannot run in parallel because it needs the id.

### D2. One id-extraction helper shared by URL building and the peek

`buildInvitationUrl` (`:78`) already parses `new URL(invitationLink, appOrigin).pathname` and takes the last segment. Move that into a private `extractInvitationId(invitationLink)`, which throws the same `BadGatewayException` on an empty id. Both `buildInvitationUrl` and the peek use it, so they can never disagree about which invitation they address.

Order: extract the id first, so a malformed link still fails with `502` before any peek, as it does today. Then peek, then build the URL.

### D3. Clock reference = `max(createdAt, now)`, rounding = `ceil`

The issue's formula is `ceil((expireAt - now) / 1 day)`. Applied literally, a BFF clock that runs *behind* DIAL Core by more than the request latency gives `expireAt - now` slightly above a whole number of days, and `ceil` would show 4 for a 3-day TTL. Using DIAL Core's own `createdAt` as a floor for the reference removes that error, because `expireAt - createdAt` is the exact TTL. Keeping `now` in the `max` means a BFF clock running *ahead* of DIAL Core still reports remaining time rather than the full TTL.

`ceil` was chosen over `floor` and `round` because a 36-hour TTL should not read "1 day" when the link actually lasts longer than that. A link with less than a day left shows 1. The resulting "1 days" wording is the known pluralization follow-up.

Implemented as a pure, exported helper, for example `deriveExpiresInDays(invitation, nowMs): number | undefined`, in `apps/chat-api/src/share/utils/share-resource.util.ts` next to the other share utilities. It returns `undefined` when `expireAt` is not a finite number or the delta is `≤ 0`. Keeping it pure lets it be unit-tested with fixed clocks, without faking timers in the service spec.

### D4. Best-effort: omit, never default

Peek failures do not propagate. The service catches a throw, treats an SDK `error` or empty `data` as unknown, logs `WARN` (invitation id plus `response.status` when present), and returns the link without `expiresInDays`. This follows `getApplicationRelatedResourceUrls` in the same service (warn and degrade on a best-effort pre-read). We deliberately do not use `handleDialFetchError` or `mapDialHttpStatus` here, because those throw.

A default of 3 was rejected because it reintroduces exactly the wrong number this change removes.

The return object omits the key rather than setting it to `undefined`, so tests can assert `not.toHaveProperty('expiresInDays')` and the JSON body has no key at all. Use `...(expiresInDays != null && { expiresInDays })`, or build the object conditionally.

### D5. Contract widening via the generator only

`ShareLinkResponseDto.expiresInDays?: number` with `@ApiProperty({ required: false })`, then `npm run openapi`. `libs/chat-api-client` is regenerated and never hand-edited. In `libs/share`, `ShareLinkData.expiresInDays?: number` and the README row change to match. `useShareLink` already assigns `response.expiresInDays` directly, so its source does not change; only its test fixtures gain an omitted-value case.

Lib isolation holds:

- The BFF resolves the number.
- The libs see a plain optional field.
- The app containers keep owning `t()` and the expiry note string.

## Risks / Trade-offs

- **[`expireAt` might not be epoch ms]** (an open question in the issue). If DIAL Core returned seconds, `expireAt` (~1.8e9) would be far below `now` in ms (~1.8e12). The `≤ 0` guard then omits the value instead of showing nonsense. Mitigation: the safe degradation is built in. Before archiving, confirm the unit against a real DIAL Core by logging one peek at `debug`.
- **[The sharer might not be allowed to GET their own invitation]** Assumed allowed, because the issue's findings and the existing peek in `acceptInvitation` use the same call. If DIAL Core returns 403 or 404 for the author, D4 omits the note and the link still works. Verify manually in the acceptance check.
- **[Extra latency]** One sequential call per popover open, bounded by the SDK's default timeout. Acceptable for a user-initiated, low-frequency action. If the peek hangs, the response waits for that timeout before omitting the value. We accept this rather than adding a custom timeout.
- **[External generated-client consumers]** A required field becoming optional is a type-level break for anyone who assumed it is present. Mitigation: there are no in-repo consumers left without a null-check, and the change is called out in the proposal's Impact section.
- **[Logging]** The invitation body contains `author` and resource urls. Only the id and status are logged at `WARN`. The existing `debug` lines stay as they are.

## Migration Plan

There is no data migration. Deploy the BFF and frontend together as usual. Order does not matter: an old frontend already handles a missing field, and a new frontend handles a present one.

Rollback: revert the commit. The constant returns and the field becomes required again, which every reader still handles.

## Open Questions

- Confirm that `expireAt` and `createdAt` are epoch milliseconds (see Risks; the design is safe either way).
- The meaning of the `Role.share` key and the unit of `invitation_ttl`. These are informational only, because the chat reads `expireAt`.
