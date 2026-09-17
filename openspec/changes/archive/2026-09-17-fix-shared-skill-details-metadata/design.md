## Context

The skill details Overview reads `author` and `updatedAt` off the in-memory
catalog listing entry, not off the skill resource. `buildSkillOverview(skill,
…)` takes a `SkillMetadataItemDto | undefined` that
`useSkillItemDetails.onFetchSkillDetails` resolves with
`skills.find((candidate) => candidate.url === item.id)`
([useSkillItemDetails.ts:123](../../../libs/chat-hooks/src/catalog/useSkillItemDetails.ts#L123)).

For a shared skill that entry is sparse. `SkillsListingService.listSharedSkills`
maps `getSharedResources({ resourceTypes: ['SKILL'], with: 'me' })` summaries
([skills-listing.service.ts:126-171](../../../apps/chat-api/src/skills/listing/skills-listing.service.ts#L126-L171)),
and the confirmed runtime observation is that those summaries carry neither
field — before or after invitation acceptance. Only the invitation response's
`sharedSkill` is complete, because `SkillsLookupService.resolveSkillItem` calls
DIAL Core `listSkillMetadata` for the single resource
([skills-lookup.service.ts:76-104](../../../apps/chat-api/src/skills/lookup/skills-lookup.service.ts#L76-L104)),
and `SharedInvitationPage` merges it into `SkillsContext` after the refresh
([SharedInvitation.tsx:52-72](../../../apps/chat/src/pages/SharedInvitation/SharedInvitation.tsx#L52-L72)).
Both the initial load and `refetch` in `useSkillsState` replace `sharedWithMe`
wholesale ([useSkillsState.ts:52-95](../../../libs/chat-hooks/src/skill/useSkillsState/useSkillsState.ts#L52-L95)),
so a reload — or any refresh not followed by another merge — leaves the sparse
entry in place and the Overview loses both rows.

Constraints carried in from the investigation:

- The acceptance ordering is correct (refresh before merge); this is not a race.
  Repeated initial effect runs in development are StrictMode, not a defect.
- The raw `getSharedResources` payload was not captured, so no DIAL Core defect
  is asserted. The confirmed inconsistency is BFF-catalog vs BFF-invitation.
- `SKILL.md`'s file-level `author`/`updatedAt` in the file listing are not the
  skill resource's metadata and must never stand in for it.

Two surfaces consume skill details and both already route through
`useSkillItemDetails`: the Catalog page (`useCatalogItems` →
`useCatalogItemDetails`) and the chat-route panel
(`SkillDetailsPanelContainer` → `useSkillDetailsPanelData`).

## Goals / Non-Goals

**Goals:**

- Fetch the skill's own authoritative metadata every time a details panel opens
  — including reopening the same skill and opening after a full reload.
- Build Author and Last updated from that response.
- One contract for both detail surfaces, through the existing shared pipeline.
- Keep HTTP paths, client configuration, and auth at the application boundary;
  `libs/chat-hooks` receives one narrow typed operation.
- Preserve resource identity (shared owner buckets, encoded/nested paths) and
  leave ownership and READ/WRITE permissions exactly as they are today.
- Make stale responses unable to land on a closed or re-opened panel.
- Make metadata, manifest, and file-inventory outcomes independent.

**Non-Goals:**

- Enriching the catalog listing with per-skill metadata, or issuing any
  per-skill request during catalog loading.
- Persistent browser storage or a new metadata cache.
- Changing how invitation acceptance resolves or merges `sharedSkill`.
- Any refactor of catalog state management, sharing, or rendering beyond the
  request-identity guard.
- Debug logging (temporary diagnostics are already removed; none are added).

## Decisions

### D1 — A new single-resource BFF endpoint, because the existing listing cannot serve this

`GET /api/v1/skills/metadata?bucket=<b>&path=<p>` → `200` with one
`SkillMetadataItemDto`. `operationId: getSkillMetadata`.

`GET /api/v1/skills` is **not** reusable. `SkillsListingService.listSkills` maps
its response through `mapListing`, which reads `data.items ?? []`
([skills-listing.service.ts:47-57](../../../apps/chat-api/src/skills/listing/skills-listing.service.ts#L47-L57)).
When `path` addresses a skill item, DIAL Core returns that item's own metadata
object rather than a container with `items`, so the endpoint answers
`items: []` and the requested resource's `author`/`updatedAt` are structurally
absent from `SkillListResponseDto`. That the underlying Core operation returns
them is exactly what `SkillsLookupService` proves — the loss is in the BFF's
listing DTO, not upstream. Adding an item-shaped branch to `listSkills` would
make one operation return two different shapes for the same DTO; a separate
endpoint keeps both contracts honest.

_Alternatives:_ overload `listSkills` (rejected — polymorphic response for one
DTO); reuse `GET /api/v1/skills/files` and read `SKILL.md`'s fields (rejected —
wrong resource); enrich `/skills/catalog` (rejected in the proposal — N Core
round-trips per catalog load).

### D2 — The resolution lives in `SkillsListingService`, not `SkillsLookupService`

`SkillsLookupService` is deliberately absent from the `SkillsService` facade and
exists for `ShareService.acceptInvitation`. Its `resolveSkillItem` folds
**invitation-granted** permissions into `canEdit`
([skills-lookup.service.ts:110-118](../../../apps/chat-api/src/skills/lookup/skills-lookup.service.ts#L110-L118)),
which is correct there and wrong for a provenance read. Rather than
parameterizing that away — and risking a future caller passing the wrong flag —
the new resolution goes on `SkillsListingService`, which already owns every
`listSkillMetadata` call and is already bound on the facade. Both paths keep
sharing `mapToSkillMetadataItem` and `parseSkillResourceUrl`;
`SkillsLookupService` is untouched.

_Alternative:_ bind `SkillsLookupService` on the facade (rejected — breaks its
documented single-consumer boundary and exposes invitation permission logic to
a general endpoint).

### D3 — The endpoint returns provenance, not ownership

The response omits `isMy`, `canEdit`, and `sharedWithMe` entirely. It carries
`name`, `path`, `url`, `bucket`, `nodeType`, `parentPath`, `permissions`
(the resource's own, as Core reports them), `etag`, `author`, `createdAt`,
`updatedAt`, and `description`.

This is the structural answer to "fetching provenance must not grant ownership
or editing rights": there is no field for the frontend to mistake for an
ownership upgrade, and no invitation-derived permission can reach it. Ownership
and editability keep coming from the catalog listing, where
`listCatalogSkills` computes them per namespace. DIAL Core still enforces access
with the caller's own token, so a caller without READ gets an upstream 403
mapped by `handleDialSdkError`.

### D4 — Identity is parsed, never assumed

The endpoint takes `bucket` and `path` as separate validated query params
(reusing `SkillResourceQueryDto`'s `BUCKET_NAME_PATTERN` + `IsValidFilePath`
rules), and the frontend derives them from the catalog item's own
`skills/{bucket}/{path}` URL with the existing `parseSkillResourceUrl` — the
same parse `useSkillItemDetails` already performs for the manifest and file
requests. The caller's session bucket is never substituted, so a skill owned by
another user resolves against the owner's bucket. The path is encoded with the
existing `encodeDialResourcePath` before it reaches the SDK, matching every
other skills endpoint, so encoded and nested paths round-trip unchanged.

### D5 — Status mapping

- `200` — item resolved.
- `400` — invalid `bucket`/`path` (DTO validation), or the path resolves to a
  `nodeType: folder`: a grouping folder has no skill provenance, and answering
  `200` with folder metadata would put a folder's fields in a skill's Overview.
  This mirrors `downloadSkill`'s existing 400-for-grouping-folder rule.
- `401` / `403` — no session / upstream denial.
- `404` — Core 404, or metadata that `mapToSkillMetadataItem` cannot normalize
  (missing `bucket`/`name`/`nodeType`). Unlike `resolveSkillItem`, which returns
  `null` so the invitation flow can degrade, the endpoint raises
  `NotFoundException` — "no such skill" is the HTTP answer here.
- `502` / `503` — upstream error / unavailable, via `handleDialSdkError`.

`apps/chat-api` declares no `ThrottlerModule` today and no skills endpoint
carries `@Throttle`; the new endpoint matches its siblings and adds none.
Introducing rate limiting is a separate change.

### D6 — The lib receives a callback, not a path

`SkillDetailsApi` (in `libs/chat-hooks/src/catalog/useSkillItemDetails.ts`)
gains one member, shaped like the two already there:

```ts
getSkillMetadata(
  bucket: string,
  path: string,
  signal?: AbortSignal,
): Promise<SkillMetadataItemDto>;
```

`CatalogDetailsApi` inherits it by extension. `apps/chat/src/server-api/skills.api.ts`
implements it over the generated `skillsApi` singleton, so the URL, versioning,
CSRF, and auth stay at the app edge — identical to how `downloadSkillFile` and
`listSkillFiles` arrive today. `useCatalogItems` and
`SkillDetailsPanelContainer` add it to their `useMemo`'d adapter objects (both
already memoize, so callback identity stays stable and no effect re-fires).

This is the documented `libs/chat-hooks` exception in `AGENTS.md`: the hook may
reference the generated client's **types** (`SkillMetadataItemDto`, already
imported here) while never constructing or configuring a client.

### D7 — Three parallel requests, metadata authoritative when it succeeds

`onFetchSkillDetails` extends its existing `Promise.allSettled` to three
entries: manifest download, file listing, and `getSkillMetadata(bucket, path)`.
The result feeds `buildSkillOverview`'s skill argument.

Precedence:

| Metadata request | Overview provenance source |
| --- | --- |
| fulfilled | the response — authoritative. An absent `author` means the author row is omitted; an absent `updatedAt` leaves the updated row's value empty. |
| rejected | the catalog listing entry (`skills.find(...)`), exactly as today. |

The listing entry therefore still seeds the panel's first paint and remains the
degradation fallback, but is never the sole source — the requirement from the
proposal. The two cases are distinguished at the `allSettled` boundary, which is
what lets "legitimately no author" and "metadata unavailable" behave
differently.

Nothing is invented in either case: no placeholder, no value derived from
`SKILL.md` or another supporting file, from the current user, from the share
sender, or from the current time.

`buildSkillOverview`'s current row shape is preserved — author row conditional,
updated row always present (empty value when there is no date), file-count row
from the listing — so no rendering change is needed.

### D8 — Independent degradation

The three outcomes stay independent, extending the existing rule that manifest
and file-listing failures degrade separately:

- Metadata rejected, manifest and/or listing fulfilled → content and Overview
  render from what loaded; only the provenance rows fall back to the listing
  entry. Nothing successfully loaded is discarded.
- Metadata fulfilled, manifest rejected → `promptContent` omitted as today, the
  Overview still renders with authoritative provenance.
- Metadata fulfilled, listing rejected → today's rule stands: `overview` is
  omitted (the file count has no source), `promptContent` still renders. A
  metadata success does not resurrect an Overview the file listing could not
  build.
- All three rejected → `undefined`, as today.

`onFetchSkillDetails` never throws; a metadata rejection surfaces no
notification.

### D9 — Request identity is a monotonic token, not the item id

`Catalog`'s `fetchDetails` guards state application with
`pendingItemIdRef.current === item.id`
([Catalog.tsx:246-268](../../../libs/catalog/src/components/Catalog/Catalog.tsx#L246-L268)).
That cannot tell two requests for the *same* skill apart: closing the panel
clears the ref and reopening the same skill re-assigns the same id, so a
still-pending first response passes the guard and overwrites the second
request's result.

A `pendingRequestIdRef = useRef(0)` is added. `fetchDetails` increments it,
captures the value locally, and applies `setFetchedDetails` /
`setIsDetailsLoading` only while the captured value is still current.
`handleCloseDetails` increments it too, so an in-flight response for a closed
panel is dropped.

`pendingItemIdRef` stays, unchanged, for `retryDetailsUntil`'s between-attempt
bail-out: "is the same item still open?" is genuinely an item-identity
question, and its attempts are awaited sequentially so they never overlap.

`useSkillDetailsPanelData`'s effect gets the same treatment in its own idiom: it
already has an `isCancelled` flag keyed on `catalogItem?.id`; the cleanup
already runs on close/reopen, so a captured-token check alongside the flag
closes the same-id reopen window there. The effect keeps depending on
`catalogItem?.id` only, so a favorite toggle or a listing refresh rebuilds the
item without triggering another metadata request — the no-request-loop
guarantee.

### D10 — Generated client, not a hand-written request

`npm run openapi` regenerates `libs/chat-api-client/openapi.json` and the
client from the controller's Swagger annotations; `npm run openapi:check`
verifies it is committed. The frontend calls the generated `skillsApi`
method through the existing `api-client.ts` singleton — the plain (non-`Raw`)
method, since the response is JSON with no stream or header semantics to
preserve. No `base.ts` helper and no direct `fetch` is introduced.

## Risks / Trade-offs

- **One extra request per details open** → It is issued in parallel with two
  requests the panel already makes, so it adds no serial latency; and it is
  strictly on-demand, never during catalog loading.
- **DIAL Core may not populate `author` for older resources** → Already handled:
  the author row is conditional today and stays conditional. The change makes the
  *source* authoritative, not the data itself; if Core genuinely has no author,
  no row appears, and that is the correct outcome rather than a bug to paper over.
- **The listing fallback can still show stale provenance when the metadata
  request fails** → Accepted and deliberate: it strictly improves on today's
  behavior (that fallback *is* today's behavior), and the alternative — blanking
  rows on a transient failure — loses information for no gain.
- **A grouping-folder path returning 400 could surprise a caller** → Only the
  details panel calls this, and it always passes a skill item's own URL. The
  400 exists so folder metadata can never be rendered as a skill's provenance.
- **Two request-identity idioms (token in `libs/catalog`, token + cancelled flag
  in `chat-hooks`)** → Each matches its host's existing pattern; unifying them
  would mean refactoring `Catalog`'s event-driven fetch into an effect, which is
  out of scope.
- **`skill-details-panel` and `skills-bff-api` specs both describe this flow** →
  Deltas update both in this change, so the specs cannot disagree.

## Migration Plan

Additive and non-breaking; no data migration, no persisted state, no feature flag.

1. Backend endpoint + DTO + Swagger annotations, with tests.
2. `npm run openapi` / `npm run openapi:check`; build and lint `chat-api-client`.
3. `apps/chat/src/server-api/skills.api.ts` wrapper, with tests.
4. `libs/chat-hooks` port + three-request fetch + provenance precedence.
5. App adapters (`useCatalogItems`, `SkillDetailsPanelContainer`).
6. Request-identity guard in `libs/catalog` and `useSkillDetailsPanelData`.

Deploy order does not matter: an old frontend never calls the new endpoint, and
a new frontend against an old backend gets a `404` from the metadata request,
which D8 already degrades to today's listing-sourced provenance.

**Rollback:** revert the change. The endpoint is additive and unreferenced once
the frontend revert lands.

## Open Questions

- Does `getSharedResources` itself omit `author`/`updatedAt`, or does the BFF's
  shared mapping drop them? Unresolved, because the raw upstream payload was not
  captured. It does not gate this change — the on-demand fetch is correct either
  way — but if the fields are present upstream, a follow-up could make the
  shared catalog branch forward them, cheaply improving the first paint.
- Whether `docs/architecture.md` or `apps/chat-api/README.md` enumerate skills
  routes closely enough to need the new path listed. `npm run validate:docs`
  decides during implementation; a docs task is included either way.
