# Design

## Context

See `proposal.md` for the bug and the live evidence. Constraints that shape the fix:

- `apps/chat-api` has no storage; publish history is derived on every read from Core's publication records (`getPublications` list, then `getPublication` per `APPROVED` candidate) in `PublishService.getPublishHistory` and `resolvePublicationsForSource` (`apps/chat-api/src/publish/publication.util.ts`).
- Core keeps the original `ADD` as `APPROVED` forever, so an approved removal has to cancel it at read time. #8445 added that cancellation, keyed by target folder, but only for a removal that `removesSource(publication, entitySourceUrl)` recognises.
- Catalog Unpublish acts on the public copy, so its `DELETE` carries the public path as both `sourceUrl` and `targetUrl` (`PublishService.unpublish` derives `sourceUrl` from the `entityId` it is given, and `targetUrl` through `getPublishedTargetUrl`). The original `ADD` carries the personal path as `sourceUrl` and the same public path as `targetUrl`.
- The `catalog-unpublish-api` spec example shows a personal-path `sourceUrl`, while the frontend sends the public id. That is an existing spec/code disagreement; this change records it here and does not rewrite the unpublish spec.

## Goals / Non-Goals

**Goals:**

- An approved removal of a published copy cancels the `ADD` that created that copy, regardless of whether the removal was submitted from the public copy or from the personal item.
- No change to when a removal cancels (approved only, not newer than the `ADD`, asymmetric fallback for an undateable timestamp).

**Non-Goals:**

- Changing what `unpublish` sends to Core, the DTOs, the OpenAPI document, or any frontend code.
- Detecting a removal filed by another account (it sits in that account's bucket, which history does not read).
- Checking that the public copy still exists in Core.

## Decisions

### 1. Pair a removal with its `ADD` by target folder + `targetUrl`

Today the cancellation map is keyed by target folder alone and filled only from removals whose resource matches the entity's `sourceUrl`. The new rule fills it from **every approved removal in the resolved set**, keyed by `(target folder, targetUrl)`, and looks an `ADD` up by its own `(target folder, targetUrl)`.

- `PublicationResourceLike` gains `targetUrl?: string`. A helper returns the `targetUrl` of an `ADD` resource that publishes the entity (via the existing `findPublishingResource`), and another returns the `targetUrl`s of a publication's `DELETE` resources.
- Both sides are normalized with `safeDecodeURIComponent` and the existing folder-key normalization, so a percent-encoded `targetUrl` on one side and plain text on the other still match (same tolerance `isSameResourceUrl` already gives `sourceUrl`).
- The timestamp comparison, the `+Infinity` / `0` fallbacks and the warning for an undateable approved removal are reused unchanged; only the map key changes.

Why `targetUrl`: it is the only field `publish` and `unpublish` both derive through `getPublishedTargetUrl`, and a live Core returns it for both actions. `sourceUrl` cannot work because the two operations are issued against different ids.

Alternatives considered:

- **Send the personal `sourceUrl` on unpublish.** Rejected: a public id has no link back to the author's bucket and chat-api has nothing to store one in.
- **Verify the public copy exists on each history read.** Rejected for this change: an extra Core call per listed folder and new 403/timeout paths for a P3 bug. It would also cover a removal filed by another account, so it stays the documented follow-up.
- **Replace the `sourceUrl`-based pairing outright.** Rejected: a removal whose `sourceUrl` is the entity's own id (older publications, and any fixture or Core behaviour that echoes the personal path) keeps working, so both pairings stay and the new one is additive.

### 2. Keep the legacy `sourceUrl` pairing alongside the new one

A removal cancels an `ADD` when either (a) it removes the entity's own `sourceUrl` in the same folder (existing behaviour, folder-wide) or (b) it targets the same `(folder, targetUrl)` as the `ADD`. The existing `publication.util.spec.ts` cases cover (a) and stay unmodified, which is the regression guard for the unchanged rules.

### 3. No contract or cache change

`GET /api/v1/catalog/{entityType}/{entityId}/publish-history` keeps its shape, operationId and DTO, so there is no OpenAPI regeneration and no generated-client impact. The history cache key `publish-history:{entityType}:{entityId}` (TTL 60 s) is unchanged; it is cleared when unpublish is submitted, but the approval happens later in Core, so a read within 60 s of the approval can still serve the previous result. The issue's 15-minute persistence was not a cache effect.

## Risks / Trade-offs

- [Toolset and application `targetUrl` shapes differ: a toolset `ADD` is stored by Core without the `__version` suffix, an application one with it] → The removal's `targetUrl` comes from the public copy's own path, so it should equal what Core stored on the `ADD`. Only the prompt case was observed live; the unit tests cover prompt, application and toolset shapes, and the legacy pairing still applies if a shape ever fails to match.
- [A removal whose `targetUrl` is missing or malformed would cancel nothing] → Same outcome as today for that record (the folder stays listed); no new failure mode, and the legacy pairing is untouched.
- [Pairing by `targetUrl` could cancel an `ADD` it should not] → An equal folder and `targetUrl` identify the same published resource, and a removal that is not newer than the `ADD` cancels nothing, so a re-publish survives. A different name in the same folder, or the same name in another folder, does not match.
- [A removal filed by another account stays invisible] → Out of scope; documented in the spec delta and in the proposal as a follow-up.

## Migration Plan

No data migration. History is derived on read, so the fix takes effect for already-approved removals as soon as chat-api is deployed. Rollback is reverting the commit; the 60 s cache clears itself.
