## Why

Opening a shared skill's details shows **Author** and **Last updated** only on the
very first open after accepting the invitation, and loses both after a page
reload ([#8875](https://github.com/epam/ai-dial-chat/issues/8875)). The reason is
that skill provenance is read out of the catalog listing rather than fetched for
the skill itself:

- `GET /api/v1/skills/catalog` returns the shared skill **without** `author` and
  `updatedAt` — before and after invitation acceptance. The shared branch maps
  `getSharedResources` summaries
  ([skills-listing.service.ts:126-171](../../../apps/chat-api/src/skills/listing/skills-listing.service.ts#L126-L171)).
- The invitation response's `sharedSkill` **does** carry both, because
  `SkillsLookupService.resolveSkillItem` resolves the individual resource via
  DIAL Core `listSkillMetadata`
  ([skills-lookup.service.ts:76-104](../../../apps/chat-api/src/skills/lookup/skills-lookup.service.ts#L76-L104)).
- `SharedInvitationPage` merges that richer entry into `SkillsContext` after the
  catalog refresh ([SharedInvitation.tsx:52-72](../../../apps/chat/src/pages/SharedInvitation/SharedInvitation.tsx#L52-L72)),
  so the first details open finds the fields in memory.
- `buildSkillOverview` reads provenance from that in-memory listing entry only
  ([map-skill-to-catalog-item.ts](../../../libs/chat-hooks/src/catalog/map-skill-to-catalog-item.ts)),
  and `useSkillItemDetails` looks the entry up by URL
  ([useSkillItemDetails.ts:123](../../../libs/chat-hooks/src/catalog/useSkillItemDetails.ts#L123)).
- Any listing replacement discards it: both the initial load and `refetch` in
  `useSkillsState` overwrite `sharedWithMe` wholesale
  ([useSkillsState.ts:52-95](../../../libs/chat-hooks/src/skill/useSkillsState/useSkillsState.ts#L52-L95)).

So today the Overview's provenance depends on invitation-supplied data held in
memory, and normal catalog loading never restores it. The fix is to make the
details panel fetch the skill's own authoritative metadata when it opens.

Observation-accuracy notes carried into the design:

- The acceptance sequence is correctly ordered (catalog refresh completes before
  `mergeSharedSkill`); this is **not** a confirmed race.
- The raw `getSharedResources` payload was not captured, so no defect in DIAL
  Core is claimed. The confirmed inconsistency is between the BFF's catalog
  response and its invitation response.
- The file-listing response does carry `author`/`updatedAt` on `SKILL.md`, but
  those are file-level fields and MUST NOT be substituted for the skill
  resource's own metadata.

## What Changes

- **New BFF endpoint** `GET /api/v1/skills/metadata?bucket&path` (`operationId:
  getSkillMetadata`) returning one `SkillMetadataItemDto` for a single skill
  resource. `GET /api/v1/skills` cannot serve this: its
  `SkillListResponseDto` is built from `data.items`
  ([skills-listing.service.ts:47-57](../../../apps/chat-api/src/skills/listing/skills-listing.service.ts#L47-L57)),
  so an item path yields `items: []` and the requested resource's own `author`
  and `updatedAt` are never in the response — even though the underlying Core
  operation returns them.
- The endpoint resolves metadata through the existing DIAL SDK
  `listSkillMetadata` call, reusing the `SkillsLookupService` resolution shape
  **without** its invitation-specific permission grant: fetching provenance
  never confers ownership or WRITE.
- **Generated client + app adapter**: regenerate `@epam/ai-dial-chat-api-client`
  and add a `getSkillMetadata` wrapper in
  [skills.api.ts](../../../apps/chat/src/server-api/skills.api.ts).
- **`SkillDetailsApi` port gains `getSkillMetadata`**, so the injected operation
  stays a narrow typed callback and `libs/chat-hooks` keeps no HTTP path or
  client configuration.
- **`useSkillItemDetails` fetches metadata as a third parallel request** next to
  the manifest download and the file listing, and `buildSkillOverview` builds
  Author / Last updated from that response. The catalog listing entry may still
  seed the initial render but is no longer the sole source.
- **Both detail surfaces follow one contract** — the Catalog page (via
  `useCatalogItemDetails`) and the chat-route panel (via
  `useSkillDetailsPanelData`) share `useSkillItemDetails`, so neither gets
  duplicate logic.
- **Stale-response guard tightened**: `libs/catalog`'s `Catalog` tracks the
  in-flight details request by a monotonic request token instead of comparing
  only `item.id`
  ([Catalog.tsx:246-268](../../../libs/catalog/src/components/Catalog/Catalog.tsx#L246-L268)),
  so closing and reopening the *same* skill cannot let the earlier response land.
  `useSkillDetailsPanelData`'s effect gets the equivalent treatment.
- **Explicit failure semantics**: metadata, manifest, and file inventory settle
  independently; a metadata failure does not discard successfully loaded
  content, and "metadata unavailable" is distinguished from "authoritative
  metadata legitimately omits author/updatedAt".
- No catalog-wide metadata enrichment, no per-skill request during catalog
  loading, no persistent browser storage, and no new metadata cache.

Not breaking: the new endpoint is additive, `SkillMetadataItemDto` is unchanged,
and no existing response contract changes.

## Capabilities

### New Capabilities

_None._ The change extends existing capabilities rather than introducing one.

### Modified Capabilities

- `skills-bff-api`: adds the single-skill metadata endpoint (`GET
  /api/v1/skills/metadata`, `getSkillMetadata`) with its DTO, validation, error
  mapping, and ownership/permission rules, and records why the existing
  `GET /api/v1/skills` listing cannot serve this need.
- `skill-details-panel`: the skill details resolution becomes three parallel
  requests instead of two; the Overview's Author and Last updated rows source
  from the authoritative metadata response; independent degradation rules for
  the metadata half; reopen-fetches-fresh and no-request-loop guarantees.
- `chat-hooks-catalog-orchestration`: the `CatalogDetailsApi` / `SkillDetailsApi`
  injected port gains the `getSkillMetadata` operation, kept host-agnostic.
- `catalog-item-details-fetch`: the details-fetch race guard is keyed on a
  per-request token, so a late response for a closed-and-reopened item can never
  overwrite the active request's result.

The chat-route panel is covered by the `skill-details-panel` delta rather than a
separate `skill-input-attachment` delta, because `skill-input-attachment`
already specifies that the panel reuses the shared skill details resolution
instead of a duplicate.

## Impact

**Backend (`apps/chat-api`)**

- `skills/skills.controller.ts` — new thin `@Get('metadata')` handler with full
  Swagger annotations.
- `skills/lookup/skills-lookup.service.ts` — a provenance-only resolution path
  alongside the existing invitation path (no `grantedPermissions` shortcut).
- `skills/skills.service.ts`, `skills/skills.module.ts` — facade wiring.
- `skills/dto/skill-resource-query.dto.ts` — reuse for `bucket`/`path`
  validation; a response DTO for the single item.
- Conventions per `apps/chat-api/AGENTS.md`. `apps/chat-api` currently declares
  no `ThrottlerModule` and no skills endpoint carries `@Throttle`, so the new
  endpoint adds none either.

**API contract**

- `libs/chat-api-client/openapi.json` regenerated (`npm run openapi`,
  `npm run openapi:check`), `chat-api-client` built and linted, and the
  `skillsApi` singleton in `apps/chat/src/server-api/api-client.ts` reused.

**Frontend (`apps/chat`)**

- `server-api/skills.api.ts` — `getSkillMetadata` wrapper.
- `hooks/useCatalogItems/useCatalogItems.ts` and
  `components/SkillSelector/SkillDetailsPanelContainer.tsx` — pass the new
  operation into the shared API adapter object.

**Libraries**

- `libs/chat-hooks` — `catalog/useSkillItemDetails.ts` (third request + port
  entry), `catalog/map-skill-to-catalog-item.ts` (`buildSkillOverview` source),
  `catalog/useSkillDetailsPanelData/useSkillDetailsPanelData.ts` (request
  identity). Library isolation holds: the endpoint path, client instance, auth,
  and CSRF all stay in `apps/chat/src/server-api`; the lib receives one narrow
  typed callback on `SkillDetailsApi`, exactly as `downloadSkillFile` and
  `listSkillFiles` arrive today.
- `libs/catalog` — `components/Catalog/Catalog.tsx` request-token guard only.

**i18n**

No new user-visible strings: `catalog.details.skill.author` and
`catalog.details.skill.updated` already exist. No RTL work — the Overview rows
already use logical properties and their layout is unchanged.

**Docs**

`apps/chat-api/README.md` / `docs/architecture.md` only if the endpoint
inventory they list needs the new route; `npm run validate:docs` decides.

**Rollback**

Revert the change. The endpoint is additive and unreferenced once the frontend
revert lands, so there is no data migration and no persisted state to undo;
behavior returns to today's listing-sourced provenance.

## Acceptance criteria

1. Opening a shared skill's details issues a request for that skill's own
   authoritative metadata.
2. When the response carries `author` and `updatedAt`, the Overview's Details
   section shows both.
3. This holds after invitation acceptance, on repeated reopening, and after a
   full page reload, with no reliance on previously merged invitation data.
4. Reopening a skill requests fresh metadata; unrelated rerenders (a favorite
   toggle, a listing refresh) trigger no metadata request loop.
5. The Catalog page and the chat-route panel follow the same metadata-loading
   contract.
6. A late response — including one for the same skill closed and reopened — can
   never overwrite the active details request's result.
7. Authoritative metadata that legitimately omits `author` renders no author row
   (no placeholder, nothing derived from `SKILL.md`, the sender, the current
   user, or the current time); a failed metadata request is distinguishable and
   does not discard a successfully loaded manifest or file inventory.
8. Personal and organisation skills, READ/WRITE permissions, ownership flags,
   and existing content/file-preview behavior are unchanged.
9. Catalog loading issues no per-skill metadata requests.

## Alternatives considered

| Option | Verdict |
| --- | --- |
| **On-demand per-skill metadata on details open** (chosen) | One extra request only when a user actually opens a panel; always authoritative; no cache to invalidate. |
| Enrich `GET /api/v1/skills/catalog` with per-skill metadata | Rejected — N extra Core round-trips on every catalog load for data most rows never display; directly contradicts acceptance criterion 9. |
| Keep the invitation-merged entry alive across refetches | Rejected — treats symptom, not cause; still empty after a reload, and makes `useSkillsState` hold privileged state whose staleness has no bound. |
| Read `author`/`updatedAt` off `SKILL.md` in the file listing | Rejected — file-level fields are not the skill resource's metadata; would silently show wrong provenance. |
| Persist provenance in browser storage | Rejected — explicitly out of scope; unbounded staleness, no invalidation event. |
