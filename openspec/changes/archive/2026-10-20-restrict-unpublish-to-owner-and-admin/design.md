## Context

Catalog Unpublish acts on the **public copy** (`{type}/public/{folder}/{name}`), not on the author's source item (#8691). Today:

- `useCatalogPublishing.isUnpublishVisible` offers it on every public copy when `isAdmin || hasPublishWriteAccess(folder)`. `hasPublishWriteAccess` (`usePublishFolders`) only excludes folders containing the restricted segment, so in practice every user sees it.
- `useCatalogPublishing.getPublishHistory` synthesises the copy's single folder from its id without a request (Core's publication list is matched by source url and scoped to the caller's bucket, so it cannot find a public copy).
- `PublishService.unpublish` sends a `DELETE` publication for whatever the caller asks. `catalog-unpublish-api` says explicitly that no local ownership check is made. DIAL Core queues it as `PENDING` without checking that the caller published the copy, so the admin queue fills with requests from unrelated users.
- Admin status is already a chat-side concept: `AuthController.computeIsAdmin` (private) matches the provider's `adminRoles` (`ADMIN_ROLE_NAMES`) against the session's roles claim and reports it via `GET /api/v1/auth/me` → `user.isAdmin` in the app.

The only durable evidence of "who published this copy" is DIAL Core's publication records: the publisher's bucket (`publications/{bucket}/`) holds the `APPROVED` `ADD` publication whose resource `targetUrl` is the copy. `resolvePublicationsForSource` already reads those records (list + one `getPublication` per approved candidate) and already knows how an approved `DELETE` cancels an older `ADD` of the same folder + `targetUrl` (#8445, #9172).

## Goals / Non-Goals

**Goals:**
- Backend rejects unpublish requests from callers who are neither administrators nor the copy's publisher (403, before Core is called).
- UI offers Unpublish only to those same callers, using the backend's answer rather than a second, divergent rule.
- One definition of "administrator" shared by `/auth/me` and the unpublish check.

**Non-Goals:**
- Team/group ownership, ownership transfer, cancelling a pending request, Admin Panel changes.
- Conversation unpublish (already scoped to the session bucket).
- Any change to `libs/catalog`'s public API.

## Decisions

### D1. Ownership = the bucket that holds the live `ADD` publication of the copy

`canUnpublish(user, entityType, entityId)` in `PublishService`:

```
isAdmin(user)                                  → true   (no Core call)
getResourceBucket(entityId) === user.bucket    → true   (own resource; no Core call)
cached unpublish-access:{bucket}:{type}:{id}   → cached value
otherwise:
  list publications/{bucket}/ → resolve APPROVED candidates (existing fetchPublication)
  publishesCopy(resolved, entityId)            → cache 60 s, return
```

`publishesCopy(publications, copyUrl)` (new, `publication.util.ts`) returns `true` when some publishing resource's decoded `targetUrl` equals the decoded `copyUrl` and no `APPROVED` `DELETE` with the same folder key + `targetUrl` key, created at or after that `ADD`, exists. It reuses `toPublishedCopyKey`, `toPublicationTime`, `isApprovedRemoval` and the same "undateable removal wins" ordering already pinned for `resolvePublicationsForSource`, so the two cannot disagree on whether a copy is live.

`resolvePublicationsForSource` itself is **not** reused: it filters by `sourceUrl`, and for a public copy we do not know the author's source url — the match must be by `targetUrl`. Only its candidate-fetch loop is shared: it is extracted from `resolvePublicationsForSource` into the exported `resolvePublicationDetails` in `publication.util.ts`, and `PublishService` splits the list call into a private `listPublications` used by both `listSourcePublications` (history, unpublish target) and the new `listResolvedPublications` (ownership).

*Alternatives:* `displayAuthor`/`author` name match — rejected, free text. A Core-side owner field on the public resource — not available in the SDK's resource metadata today; would be the better source if Core adds it (Open Question 1).

### D2. Admin rule extracted to `AdminRoleService` in `auth/`

Move `computeIsAdmin` verbatim into `apps/chat-api/src/auth/admin-role.service.ts` (`@Injectable`, depends on `ProviderRegistryService`), add it to `AuthModule.providers` and `exports`. `AuthController` injects it; `PublishModule` imports `AuthModule` (precedent: `AppConfigModule` already does). Behaviour of `/auth/me` is unchanged and its existing tests stay green.

*Alternative:* duplicate the 15 lines in `publish/` — rejected; the issue's "admin behaviour matches the decision" criterion is only meaningful if both read one rule.

### D3. Enforce in `PublishService.unpublish`, not a guard

The check needs the parsed `entityId`, the session bucket, Core access, and the cache — all already in the service. A Nest guard would re-parse params and duplicate DI. `unpublish()` gains a `user: SessionUser` parameter (controller passes `req.user`) and calls `canUnpublish` first; a `false` throws `ForbiddenException('You can only unpublish resources you published')`, logged at `warn` with entity type/id only.

Fail closed: if the publication list cannot be read, the mapped exception propagates (502) — never "assume owner". This differs deliberately from `findPublishedTargetUrl`, which swallows errors because it only *refines* the target.

### D4. New read endpoint `GET …/unpublish-access` rather than overloading history

`GET /api/v1/catalog/{entityType}/{entityId}/unpublish-access` → `UnpublishAccessDto { canUnpublish: boolean }`, `operationId: getCatalogUnpublishAccess`. A negative answer is `200 { canUnpublish: false }`, not 403: the caller asked a question, and a 403 would trip `usePublishErrorNotification`-style handling and log noise for the common case.

Authorization of the endpoint itself: any authenticated session (global `SessionGuard`); it reveals only whether *the caller* may unpublish, never who the owner is.

*Alternatives:* add `canUnpublish` to publish-history entries — rejected, history is matched by source url and never called for public copies. Add it to every catalog list item — rejected for cost (D1 needs N `getPublication` reads per bucket).

### D5. Frontend: feed the answer through the existing async `getPublishHistory` channel

`libs/catalog` already gates Unpublish on "history resolved with ≥ 1 folder" AND `isUnpublishVisible(item)`. The app adapter (`useCatalogPublishing`) therefore:

- `isUnpublishVisible(item)` → `isPublicCatalogEntityId(item.id) && toPublishEntityType(item.type) != null` (drops `hasPublishWriteAccess`; `isAdmin` no longer needed here).
- `getPublishHistory(item)` for a public copy → `isAdmin ? [synth] : (await getCatalogUnpublishAccess(type, id)).canUnpublish ? [synth] : []`. Errors propagate (panel hides + retries).

`useCatalogPublishing` gains no new param — `isAdmin` is already passed; `hasPublishWriteAccess` remains a param only if still used elsewhere in the hook (it is not after this change, so it is removed from `UseCatalogPublishingParams` and from the `CatalogView` call; `CatalogView` still passes it to `DetailsPanel` for the publish panel).

The wrapper `getCatalogUnpublishAccess` is added to `createPublishApiClient` in `libs/chat-hooks/src/catalog/create-publish-api.ts` — inside the `chat-hooks` generated-client exception (operation signature + thin call, the client instance is injected) — and re-exported from `apps/chat/src/server-api/publish.api.ts`. `libs/catalog` sees only the callbacks.

*Alternative:* make `isUnpublishVisible` async in `libs/catalog` — rejected, public API change for no gain.

### D6. Caching

Key `unpublish-access:{bucket}:{entityType}:{entityId}`, TTL 60 s (same as publish history), read and written directly on the existing `CACHE_MANAGER`. `withCachedDialRequest` is not used for two reasons: it treats a falsy cached value as a miss, so the entry is stored as an object (`{ canUnpublish }`); and it maps a thrown network error to 503, where this check must answer 502. Only the Core-backed publisher check is cached. No event invalidation: ownership changes only when an admin approves a publication in Core, which `chat-api` does not observe. A successful unpublish does not change ownership (the request is pending), so it does not invalidate this key. The `POST` reuses the cached answer: a stale `true` for ≤ 60 s after an approved removal lets the request reach Core, which rejects a `DELETE` of a missing target; a stale `false` delays a brand-new publisher by ≤ 60 s.

## Risks / Trade-offs

- [Cost per uncached check: 1 list + N detail reads for a bucket with many approved publications] → same profile as publish history today, batched by `PUBLICATION_DETAIL_CONCURRENCY`, cached 60 s; admins and own-bucket ids skip it.
- [An unreadable individual publication can hide the owner's only `ADD` → false 403] → logged at `warn` by the existing `fetchPublication`; fail-closed is the safer error for an authorization check; the owner can retry.
- [Every public-copy details open now triggers one lookup for non-admins] → lazy, cached; the panel already prefetches when `isUnpublishVisible === true`.
- [Manage trigger may flash for non-owners while the lookup is outstanding] → existing lib behaviour for an outstanding lookup; acceptable, documented in the spec.
- [Ownership tied to the publishing bucket: a teammate who did not press Publish cannot request removal] → explicit decision; admins remain the escape hatch.
- [Behavioural break for API consumers relying on open unpublish] → intended by the issue; documented as BREAKING in the proposal.

## Migration Plan

No data migration. Deploy backend and frontend together (the frontend calls the new operation; the old frontend against the new backend just gets 403 for non-owners, surfaced by the existing error notification). Rollback = revert the change and regenerate the OpenAPI client.

## Open Questions

1. Does DIAL Core expose an owner/author on the public resource's metadata that could replace the publication scan? If yes, D1 can switch to it without changing any contract.
2. Should owners be able to withdraw a pending unpublish request? Out of scope here; would need Core's publication-delete API.
