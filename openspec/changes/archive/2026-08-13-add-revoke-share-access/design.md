## Context

Sharing in this app is a three-step flow against DIAL Core: the owner creates an invitation link (`shareResource`), a recipient accepts it (`getInvitation?accept=true`), and the recipient can later drop their own grant (`discardSharedResources`). All three already exist in `apps/chat-api/src/share/share.service.ts`. The fourth Core operation, `revokeSharedResources`, is unused — `discardShared`'s JSDoc calls it out as deliberately out of scope (`share.service.ts:407`).

Constraints that shape this design:

- **Core's revoke is all-or-nothing.** `components['schemas']['RevokeResourcesRequest']` is `{ resources?: SharedResource[] }` — no subject, user, or role field. There is no way to revoke one recipient's access, so the UI must not imply per-person control.
- **Core returns no body on success.** `revokeSharedResources` 200 is declared `content?: never`, unlike `discardSharedResources`. The BFF must synthesize its own `{ success: true }` response.
- **Nothing in the app knows whether a resource currently has recipients.** `sharedWithMe` is derived from `getSharedResources({ with: 'me' })` in the listing services (`apps/chat-api/src/common/utils/resource-ownership.ts:50`); the mirror-image `with: 'others'` call is never made, so no list DTO carries a "shared by me" signal.
- **The catalog details panel confirms in-place.** Per the `catalog-details-confirmation-subview` capability, `DetailsPanel` replaces its content with a confirmation sub-view; it does not use `ConfirmationPopup`. The conversation panel, by contrast, does use `ConfirmationPopup` for its row actions. Each surface follows the pattern already established there.
- **`libs/catalog` must stay host-agnostic** (AGENTS.md §Library isolation): no endpoint paths, no generated client, no notifications.

## Goals / Non-Goals

**Goals:**

- Let a resource owner revoke every outstanding share grant on one of their catalog entities or conversations, in one action, from the surface where they manage that resource.
- Make the consequence unmistakable before the call fires: everyone loses access, existing links stop working, and it cannot be undone without re-sharing.
- Reuse the discard endpoint's validation, error-mapping, throttling, and cache-invalidation shape verbatim, so the two share mutations stay symmetric and reviewable side by side.
- Keep all host knowledge (endpoint, client, notifications, refetching) in `apps/chat`.

**Non-Goals:**

- Per-recipient revocation — Core cannot express it.
- Listing who currently has access. Deferred; noted as an open question below.
- Revoking file shares. `apps/chat-api/src/files/` owns a separate discard-shared endpoint for the file manager; it is untouched here.
- Invalidating already-issued invitation *links* that were never accepted. `revokeSharedResources` operates on granted access; Core's link lifecycle is its own concern and is not modelled here.
- Any change to `libs/conversation-panel`.

## Decisions

### 1. A separate `POST /api/v1/share/revoke` endpoint, not a mode flag on `/share/discard`

Discard is a recipient operation on *the caller's own* grant; revoke is an owner operation on *everyone else's*. They differ in who may call them, which Core operation runs, and which failure modes are meaningful. A shared endpoint with a `mode` discriminator would produce one generated client method whose name describes neither, and one Swagger error table that has to document both. Separate handler names (`discardSharedCatalogItem`, `revokeSharedAccess`) map to separate generated methods, which is the whole point of `operationIdFactory`.

*Alternative rejected:* `PATCH /api/v1/share` with a body-level operation — same generated-client naming problem, plus REST-shaped ambiguity for two genuinely different side effects.

### 2. No pre-flight "is it actually shared?" check

`discardShared` performs a `getSharedResources({ with: 'me' })` read *before* calling Core, because Core answers `200` for a resource that was never shared with the caller and the spec requires that silent no-op to surface as `403`. Revoke does not inherit that requirement: an owner revoking a resource nobody holds has got exactly the outcome they asked for — nobody has access. Adding a `with: 'others'` pre-flight would buy a distinction the user does not care about, at the cost of an extra Core round trip on every revoke.

Ownership itself is **not** checked in the BFF either — Core rejects a non-owner's revoke, and that rejection maps to `403` through the existing `mapDialHttpStatus`. Re-deriving ownership locally would duplicate authorization logic that the platform already owns.

*Alternative rejected:* return `{ success: true, revokedCount: n }` from a pre-flight count, so the UI could say "no one had access". Rejected — an extra request and an extra response field for a cosmetic message.

### 3. Gate the UI on the actual recipient count — REVISED

**Original decision (superseded):** gate on ownership alone, because deriving a `sharedByMe` signal would need an extra `getSharedResources({ with: 'others' })` call per resource type on every list request.

**Revised after review.** The cost argument was overstated. The extra call is:

- **once per resource type per list request**, not per item — one response carries the caller's entire shared-with-others set, keyed by url;
- **parallel** with the `with: 'me'` call already made at the same site, so it adds an upstream request but almost no wall-clock;
- **behind the same 30s per-user list cache**, so it lands once per cache miss.

That is cheap enough to buy a materially better UI, so the flag is now derived. `getSharedResources({ with: 'others', includeUserInfo: true })` returns each resource with a `sharedWith: ShareMetadata[]`, and its length becomes `recipientsCount` on the list DTOs. The action hides at `0`.

**Three-valued, not boolean.** `recipientsCount` is a positive number, `0`, or absent. Absent means the upstream call failed — and in that case the action stays **visible**. Hiding it would let a transient DIAL Core error silently remove the owner's only way to revoke, which is a worse failure than showing an action that turns out to be a no-op.

**Known gap: unaccepted invitations.** `ShareMetadata` carries `acceptedAt`, so the list reflects users who *accepted*. An issued-but-unopened share link therefore reads as `0` and hides the action — leaving a live link the owner cannot revoke from the UI. This is a real hole, accepted deliberately for now, and it is the same unknown as Open Question 2 (does revoke even invalidate unaccepted links?). Resolving that question determines whether the gate needs an escape hatch.

### 4. `Danger` variant, and the panel stays open on success

Revoke is the first confirmation kind that is destructive-for-others yet leaves the item in the caller's own catalog. That splits the two axes the existing spec conflated:

| Kind | Variant | On success |
|---|---|---|
| `Delete` | `Danger` | panel closes (item gone) |
| `Unshare` | `Info` | panel closes (item gone from *my* list) |
| `Logout` | `Info` | panel stays open |
| **`RevokeAccess`** | **`Danger`** | **panel stays open** |

`DetailsPanel.handleConfirm` currently branches `Logout` out first and lumps `Delete`/`Unshare` into a close-the-panel path. It becomes an explicit "does this kind remove the item from the caller's view?" decision, so the fourth combination is representable instead of accidental.

### 5. Conversation surface uses `ConfirmationPopup`, not an in-place sub-view

`ConversationPanelView` already confirms owner-delete and unshare with `ConfirmationPopup` bound to a `pending*Id` state triple (`pendingUnshareId` / `isUnsharing` / `unshareError`, `ConversationPanelView.tsx:198`). Revoke gets its own parallel triple rather than sharing state with either existing flow — sharing would couple three independent dialogs' loading and error states.

Unlike unshare, a successful revoke does **not** remove the conversation from the owner's list and does **not** navigate away: the owner keeps their own conversation. It calls `refreshConversations()` only so any share-derived indicator re-resolves.

### 6. `revokeSharedAccess` returns `{ success: true }`

Core sends an empty 200. Mirroring `DiscardSharedCatalogItemResponseDto { success: boolean }` gives the generated client a typed response and keeps the two share mutations' frontend wrappers identical in shape. A bare `204` would be defensible but would make `ShareApi`'s two mutations gratuitously asymmetric.

### 7. Cache invalidation mirrors discard

On success, invalidate `DeploymentsService.invalidateListCache(userSub)` and `ToolsetsService.invalidateListCache(userSub)` — same unconditional pair as `discardShared` and `acceptInvitation`. This is for the **caller's** cached lists; recipients' caches live under their own `userSub` keys and are not reachable from here, so a recipient can keep seeing a revoked item in a cached list for up to the 30s TTL. That is a pre-existing property of the per-user list cache, not something this change introduces, and the next uncached read corrects it.

### 8. Lib boundary

`libs/catalog` receives only: an `onRevokeShare?: (item: CatalogItem) => void | Promise<void>` request callback, `texts.revokeShareLabel` / `revokeShareConfirmTitle` / `revokeShareConfirmMessage` / `revokeShareConfirmConsequences` / `revokingShareStatusLabel` with English defaults, and the new enum member. It learns nothing about `/api/v1/share/revoke`, `@epam/ai-dial-chat-api-client`, notifications, or refetching — all of which stay in `CatalogView`, exactly as `onUnshare`/`handleUnshare` are wired today (`CatalogView.tsx:679`).

## Risks / Trade-offs

- **The action appears on resources that were never shared** → Confirmation copy is phrased conditionally ("Anyone you shared this with will lose access"), and the operation is an upstream no-op. Accepted deliberately (Decision 3); revisit if Core exposes share counts on list responses.
- **Owner cannot see who is affected before confirming** → Consequence bullets state the blast radius explicitly. A recipient-list view is the natural follow-up (Open Questions).
- **Irreversible for recipients** → Two-step interaction (menu entry requests, confirmation commits), `Danger` palette, and an explicit "they will need a new invitation" bullet. No undo is offered because Core has no un-revoke; re-sharing means issuing a new link.
- **Recipients' cached lists lag by up to 30s** → Inherent to per-user list caching (Decision 7). Access is enforced by Core on every read, so a stale list entry cannot yield stale *data* — the item fails to open.
- **Confusion between "Delete", "Revoke access", and "Remove from My List"** → All three never render together: Delete + Revoke access are owner-only (`isMyApp`), Remove from My List is recipient-only (`sharedWithMe`), and the two are mutually exclusive per item. Distinct labels, distinct confirmation copy.
- **Enum widening breaks exhaustive switches** → `DetailsConfirmationKind` is consumed in `DetailsPanel`'s `confirmationContent` switch, which has a `default` arm; TypeScript will not error, so the new case is added explicitly and covered by a test asserting the sub-view renders for the new kind.

## Migration Plan

Contract-first, then vertical slices — the generated client sits between the two sides, so the OpenAPI contract lands before the UI can call it:

1. Backend DTO + service + controller + Swagger annotations; `npm run openapi` and `npm run openapi:check`; build and lint `chat-api-client`.
2. `apps/chat/src/server-api/share.api.ts` wrapper + i18n keys.
3. `libs/catalog` enum member, props, texts, Header entry, DetailsPanel confirmation content and the removes-item-from-view branch; `CatalogView` wiring.
4. `ConversationPanelView` action + popup.

Each slice verified with `npm exec nx lint|test <project>`, closing with `npm exec nx affected --target=<t> --base=origin/development-1.0`.

**Rollback:** revert the commit. No migration, no persisted state, no changed existing contract; regenerating the client after the revert drops the generated method. Because slice 1 is additive and unreferenced until slice 2, the backend can also ship alone without user-visible effect.

## Open Questions

- Should the confirmation show the current recipient list (`getSharedResources({ with: 'others', includeUserInfo: true })`)? Deferred to keep this change to one Core operation; it would turn a static confirmation into one with loading/empty/error states. **Assumption for now: no.**
- Does DIAL Core invalidate outstanding, not-yet-accepted invitation links when access is revoked, or only granted access? The Core schema does not say. The confirmation copy avoids claiming anything about pending links; if links survive revocation, that is a follow-up worth documenting.
- Should revoking be offered in the Share popover as well as the Manage menu? Out of scope for this change per the chosen entry point; a popover control could be added later without changing the endpoint.
