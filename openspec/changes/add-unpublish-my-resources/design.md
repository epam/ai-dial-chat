## Context

Publishing is already wired end to end. `apps/chat-api/src/publish/publish.service.ts` (catalog entities) and `apps/chat-api/src/conversations/conversation-publish.service.ts` (conversations) both proxy DIAL Core's Publication API through `DialClientService`, hold no state of their own, and share the target-path helpers in `apps/chat-api/src/publish/publish-target.util.ts`. On the frontend, `libs/publish-panel` owns the folder picker / access rules / history list, `libs/catalog`'s `DetailsPanel` hosts the catalog publish sub-view, and `PublishConversationPanelContainer` hosts the conversation one.

Nothing reverses any of it. DIAL Core's Publication API models removal as a *publication* whose resources carry `action: 'DELETE'` — the same `createPublication` call, the same `PENDING → APPROVED/REJECTED` lifecycle, the same admin in the loop. Core's separate `deletePublication` operation is unrelated: it takes a `ResourceLink` and discards a publication *request*, which is a different feature (cancelling something still pending) with a different UI.

Constraints inherited from the existing publish work:

- `apps/chat-api` has no database. Core is the sole source of truth; the services only cache reads (`withCachedDialRequest`, 60 s).
- Core has no per-resource publication filter. `getPublications` is called with the bucket-wide scope `publications/{bucket}/` and filtered client-side on `resources[].sourceUrl`.
- `libs/*` may not know REST paths, `entityType` enums, or generated DTOs (AGENTS.md §Library isolation). Everything the lib learns about publish state arrives as props and callbacks from `apps/chat`.
- `entity-operation-notifications` already reserved the unpublish slot and explicitly deferred implementing it.

## Goals / Non-Goals

**Goals:**

- Let the owner of a published catalog entity or conversation submit a removal request for a specific folder, from the same menus they published from.
- Reuse the existing publish plumbing wholesale — the same Core call, the same `targetUrl` derivation, the same error mapping, the same cache keys, the same confirmation sub-view.
- Be honest about approval: every string, notification, and spec scenario describes a *request*, not a completed removal.
- Keep `libs/catalog` and `libs/publish-panel` free of any knowledge that unpublish is an HTTP call, let alone which one.

**Non-Goals:**

- Unpublishing from several folders in one action.
- Cancelling a still-`PENDING` publish request (Core `deletePublication`).
- Files, folders, or any resource kind with no publish UI today.
- Any admin-facing approval, review, or publication-queue UI.
- Showing publication status (`PENDING`/`APPROVED`/`REJECTED`) anywhere in the UI. Publish history stays a flat list of folders, as it is today.

## Decisions

### D1 — Unpublish is `createPublication` with a `DELETE` resource, not `deletePublication`

Core's `PublicationResourceAction` is `'ADD' | 'DELETE' | 'ADD_IF_ABSENT'`. Removing an already-published copy means submitting a new publication whose single resource is `{ action: 'DELETE', targetUrl }`. `deletePublication` was considered and rejected: it takes a `ResourceLink` pointing at a publication request and removes that request, which neither touches an approved published copy nor matches what a user means by "unpublish this from Organization/Data Science".

Consequence that shapes the whole change: unpublish inherits publish's approval lifecycle. It returns a `PENDING` publication, so no UI may claim the resource is gone. Copy is `unpublish requested` throughout, mirroring the existing `publishRequested` operation rather than the `Unpublished` copy that `entity-operation-notifications` sketched.

**Alternative considered:** optimistically treat the request as completed, since some Core deployments auto-approve. Rejected — the UI would assert an outcome it cannot observe, and the failure mode (resource still public after a "successfully unpublished" toast) is exactly the kind of thing a user does not re-check.

### D2 — `sourceUrl` is sent alongside `targetUrl`, and the request body carries `folderPath`, not a raw `targetUrl`

The client sends the same `folderPath` it sends when publishing (`"Organization/Data Science"`); the service derives `targetUrl` server-side with the very same helpers publish uses. Accepting a client-supplied `targetUrl` was rejected: it would let a caller name an arbitrary path under `public/`, moving an authorization-relevant string out of the server's control for no benefit — the client has nothing to say about it that the server cannot derive.

Core's `PublicationResource` allows `sourceUrl` to be omitted for a `DELETE` action, but it is sent anyway. It costs nothing, and it keeps the DELETE publication's resource shape identical to the ADD one, which is what makes the extracted helper in D3 possible.

### D3 — The published-`targetUrl` derivation is extracted into `publish-target.util.ts`

Today the expression `${prefix}/${publicTargetFolder}${getResourceName(sourceUrl)}` is written out twice — once in `publish.service.ts`, once in `conversation-publish.service.ts`. Unpublish needs the identical string; if it drifts by one character the DELETE resource silently targets nothing and Core rejects it (or worse, accepts a no-op). A single `getPublishedTargetUrl(resourceTypePrefix, folderPath, resourceName)` is added to `publish-target.util.ts` and all four call sites (2 publish, 2 unpublish) go through it.

`targetUrl` is reconstructed rather than read back from the publish-history `Publication.resources[].targetUrl`. Reading it back would be more faithful, but the history endpoint currently projects publications down to `{ folderPath, version, publishedAt, publishedBy }` and does not carry `targetUrl` through to the client — widening that DTO would push a Core-internal path string into the frontend for no user-visible purpose. Reconstruction is safe precisely because it is the same function that produced the string, and it is unit-tested with the folder paths that stress it (spaces, non-ASCII, root).

### D4 — Visibility is derived from publish history, and history failure hides the action

`Unpublish` appears only when publish history for the item resolves to at least one entry. This is not a nicety — without a folder there is no request to build. Three states:

| History state | Menu entry |
|---|---|
| Not yet loaded | withheld |
| Resolved, ≥1 entry | shown |
| Resolved, 0 entries | hidden |
| Failed | hidden |

This deliberately differs from the "Revoke access" precedent in `Header.tsx`, where an unresolved recipient count still shows the action (`RecipientsCountStatus.Unknown`) so a transient failure never removes the only way to revoke. Revoke needs no data from that lookup — only a count for the label. Unpublish needs the folder itself, so showing it on a failed lookup would produce an entry that cannot do anything. The trade-off is recorded under Risks.

### D5 — Catalog: the confirmation sub-view gains a folder choice; conversations get a popup

`libs/catalog`'s `DetailsConfirmationKind` gains `Unpublish`, resolved through the existing `confirmationContent` switch with `DetailsConfirmationVariant.Danger` (other people lose access to the published copy and the owner must re-publish to restore it — the same reasoning that made `RevokeAccess` danger, and for the same reason it is not framed as a deletion: the source resource survives untouched).

The one structural change: a confirmation body may now contain an interactive control. When the item has exactly one published folder, the body is static copy naming that folder and the confirm button is enabled immediately. When it has several, the body renders them as a single-select radio list and confirm stays disabled until one is chosen. `ConfirmationView` therefore accepts an optional `children`/`content` slot rendered under the message, and the panel owns the selection state — no new component and no new sub-view mode.

Conversations have no details panel, so their entry uses `ConfirmationPopup`, which the conversation panel already uses for its other destructive row actions. Multi-folder selection lives in the popup body the same way.

**Alternative considered:** per-row `Unpublish` buttons in `PublishHistoryList`, which would handle multi-folder without any selection UI. Rejected as the primary entry point — it buries an action a user looks for in the Manage menu inside a flow named "Publish" — but it remains a clean follow-up, and the folder-selection state added here is what a later per-row action would replace, not fight.

### D6 — Conversation publish history is switched on

`PublishConversationPanelContainer` currently hardcodes `const [history] = useState<PublishHistoryEntry[]>([])` behind a comment citing a Core `503` (GH #7897). The backend endpoint (`GET /api/v1/conversations/publish-history`) exists and is implemented identically to the catalog one, which does work — the `503` was an environment/Core-wiring symptom, not a missing implementation. This change fetches it for real, because the unpublish entry has no other source for the folder list.

Two things follow.

**The already-published callout stops being dead code, and the code and the spec disagree about what it should do.** `PublishConversationPanelContainer` passes `allowReplace={false}`, and `derivePublishState` turns that plus a matching history entry into a `ReplaceWarning` callout with submit **disabled**; the container even translates a dedicated `ConversationPublishI18nKeys.AlreadyPublishedWarning` string for it, and `PublishDerivationInput.allowReplace`'s own doc says conversations "have no update/replace semantics — publishing again to the same folder is not supported". But `conversation-publish-flow`'s "Submit always creates a publish request and is not blocked by publication history" requirement says the opposite: history is informational and never blocks. Neither side was observable while history was hardcoded empty.

This change resolves it in favour of the code: an already-published folder shows the callout and blocks re-submission. Three artefacts (the prop, its doc, the translated string) were written deliberately for that behaviour, versus one requirement sentence written when the branch was known unreachable — and a second publish of an unversioned conversation to the same folder produces a duplicate public copy, which is the thing `allowReplace: false` exists to prevent. The `conversation-publish-flow` delta records the requirement being replaced, so the reversal is explicit rather than a silent side effect of turning history on.

**The fetch must degrade.** History is loaded lazily when the row's action menu opens (the same trigger `Header.tsx` uses for its recipient-count lookup), never on list render, so a broken history endpoint costs one request per menu open and hides one menu entry — it does not slow down or break the conversation list.

### D7 — Notification copy: a new `UnpublishRequested` operation

`EntityOperation` gains `UnpublishRequested`, and the `(entity, operation)` copy map gains one complete sentence per publishable entity, per the "one sentence per pair, never composed at runtime" rule in `entity-operation-notifications`:

> **Title:** `<Entity> unpublish requested`
> **Body:** `Unpublish request for <entity> "{{name}}" was submitted for folder "{{folder}}". It will be removed once an admin approves it.`

The `Unpublished` copy that spec reserved is dropped rather than kept alongside: nothing raises it, and an unused map entry is exactly what that spec's own requirement told us not to leave behind. Errors reuse `usePublishErrorNotification`, which already maps the Core status codes this endpoint can return.

### D8 — Authorization

Both endpoints require an authenticated session (the existing global session guard) — no additional role. Write access to the target folder is enforced by DIAL Core when `createPublication` runs; a Core `403` maps to `ForbiddenException` through `mapDialHttpStatus`, exactly as publish does. The backend does not attempt to verify ownership of the published copy locally: it has no store to check against, and duplicating Core's check would create a second, drifting answer.

Throttling matches the publish endpoints' write profile (`@Throttle({ default: { limit: 10, ttl: 60000 } })`).

### D9 — Cache invalidation

A successful unpublish request deletes the same history cache key the corresponding publish endpoint deletes (`publish-history:{entityType}:{entityId}` / `conversation-publish-history:{sourceUrl}`). Note what this does and does not achieve: the pending DELETE publication *is* returned by `getPublications`, and the history projection filters on `resources[].sourceUrl`, which the DELETE resource carries (D2). So after an unpublish request the folder does not vanish from history — it may appear twice. The history projection therefore drops resources whose `action` is `DELETE` when building the folder list, so a folder with a pending removal still reads as published, which is accurate until an admin approves.

## Risks / Trade-offs

- **A failing publish-history call silently hides Unpublish (D4)** → The action is absent, not broken, and no error is shown for a menu entry the user may not have been looking for. Mitigated by the lazy per-menu-open fetch (a retry is one menu close/open away) and by the 60 s cache making a transient failure short-lived. Accepted deliberately: an entry that cannot construct a request is worse than an absent one.
- **Reconstructed `targetUrl` could drift from what publish actually sent (D3)** → Both go through one helper, and the helper is unit-tested against the exact strings in the existing publish specs (root folder, spaces, percent-encoding, nested skill grouping folders).
- **Users will read "unpublish requested" as "done"** → The notification body states the approval step explicitly, and the folder keeps showing in publish history until approval (D9) rather than optimistically disappearing.
- **Turning conversation publish history on may re-expose the GH #7897 `503`** → The call is lazy and its failure path is already specified (hide the entry, show the history error state in the publish panel). If Core in a given deployment genuinely cannot serve it, the conversation unpublish entry never appears there — degraded, not broken. This is the one part of the change whose behaviour depends on a Core deployment detail, and it should be verified against a live Core before the slice is called done.
- **Skills published from a grouping folder share a leaf name in `public/`** → Pre-existing collision risk recorded as an open question in `catalog-publish-api`; unpublish inherits it verbatim, since it targets the same reconstructed path. Not resolved here.

## Migration Plan

No data migration — neither service persists anything. Deployment order matters only in that `apps/chat-api` must ship before or with `apps/chat`: the frontend calls a generated client method that 404s against an older backend. Rollback is a plain revert; a `PENDING` DELETE publication already submitted to Core stays in Core's queue and is resolved by an admin there, independently of which version of this app is deployed.

## Open Questions

- Should a folder with an already-pending removal request be shown differently (e.g. disabled in the selection list) rather than being selectable a second time? Doing so needs publication `status` and `action` surfaced through the history DTO, which D9 deliberately avoids. Submitting a duplicate request is harmless — Core queues a second identical DELETE — so this is deferred until there is evidence users hit it.
- Does the conversation publish-history endpoint work against the current Core deployment (GH #7897)? D6 assumes yes; the answer decides whether conversation unpublish is usable on day one or only after a Core-side fix.
