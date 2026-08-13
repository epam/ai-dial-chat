## Context

The backend half of skills is finished. `apps/chat-api/src/skills/` proxies ten DIAL Core skill operations, `openspec/specs/skills-bff-api/spec.md` specifies them, and `apps/chat/src/server-api/skills.api.ts` already wraps every one of them against the generated `@epam/ai-dial-chat-api-client`. `libs/catalog` has carried `CatalogEntityType.Skill` — with its colour, tab label, and canonical tab position — since the enum was written.

What is missing is the adapter layer in `apps/chat`: something that calls `listSkills`, turns the response into `CatalogItem`s, and hands them to `CatalogView`. This design covers that adapter and the smallest set of supporting changes it forces (a details-panel branch, a feature flag, a favourites section).

The relevant constraints:

- **A skill has no description and no version.** `SkillMetadataItemDto` (`apps/chat-api/src/skills/dto/skill-metadata.dto.ts:10-48`) carries `name`, `path`, `url`, `bucket`, `nodeType`, `parentPath`, `permissions`, `etag`, `author`, `createdAt`, `updatedAt` — nothing human-readable beyond the name. Descriptive text lives inside the skill's required `SKILL.md` manifest (`SKILL_MANIFEST_FILE`, `apps/chat-api/src/skills/utils/skill-path.util.ts`), which is a file read, not a metadata read.
- **The listing is bucket-scoped and paginated.** `GET /api/v1/skills` requires an explicit `bucket` query parameter and returns `{ bucket, path, items, nextToken }`. There is no "list everything I can see" endpoint and no shared-with-me endpoint.
- **The listing mixes folders and skills.** `nodeType` is `folder` (a grouping folder) or `item` (a skill).
- **`libs/catalog` must stay host-agnostic** (AGENTS.md §Library isolation). Bucket names, endpoints, DTOs, and feature flags stay in `apps/chat`.

This change also sits directly on top of `add-prompt-catalog-entity-type`, which is in progress on the same branch: `CatalogItemPromptContent`, `CatalogDetailsTab.Content`, `isDownloadVisible`, and the `prompts.installed` user-config section all come from it.

## Goals / Non-Goals

**Goals:**

- A Skills tab in the catalog listing every skill in the caller's own bucket and in the organisation bucket, with the catalog's existing search, sort, filter, folder grouping, favourites, and view modes working on it unchanged.
- A details panel for a skill showing its manifest text and its file inventory.
- One switch (`OverlayFeature.Skills`) that removes the whole feature.
- Correct favourite persistence for a starred skill.
- Explicit loading, empty, and error states for every new surface.

**Non-Goals:**

- Any skill mutation — upload, delete, file upload/delete, grouping-folder create/delete. Those wrappers stay uncalled.
- Whole-skill ZIP download from the UI.
- Shared-with-me skills (no endpoint exists), skill publishing, skill sharing.
- A skill editor route, a Create → Skill option, or "use in chat" for a skill.
- A dedicated Files tab component in `libs/catalog`.

## Decisions

### D1 — Two bucket listings, independently fault-tolerant

`SkillsProvider` issues two listings on mount: the caller's own bucket (`user.bucket` from `UserContext`) and the organisation bucket (the literal `public`, the same segment `apps/chat/src/utils/toolsets.ts:453` and `apps/chat/src/utils/map-deployment-to-catalog-item.ts:93` already use). Both go through `Promise.allSettled`, exactly as `PromptsContext` does for personal vs. public prompts, so an organisation-bucket outage cannot hide the caller's own skills and vice versa. `isLoading` reaches `false` regardless of either outcome.

*Alternative rejected:* a single personal-bucket listing. A catalog that shows only the caller's own skills is a partial answer to "which skills exist", and the organisation listing costs one fault-tolerant request.

*Alternative rejected:* a new aggregate backend endpoint that merges buckets server-side. That is a second backend surface to avoid one client-side request; the existing endpoint already answers the question.

If `user.bucket` is absent or empty (`UserProfile.bucket` is optional — "empty string when the bucket has not been resolved yet"), the personal listing is skipped rather than issued with an empty bucket, and the provider stays in its loading state until the profile resolves.

### D2 — `recursive: true` plus bounded `nextToken` following

Each listing is issued with `recursive: true` so nested grouping folders are flattened in one pass, and with an explicit `limit`. `nextToken` is followed in a bounded loop (`SKILL_LISTING_MAX_PAGES`, initially 10) so a pathological bucket cannot spin the client forever. When the cap is hit, the loop stops, the items collected so far are used, and the truncation is logged — silently pretending the listing was complete is worse than an incomplete list plus a log line.

*Alternative rejected:* non-recursive listing with lazy per-folder expansion. The catalog's folder column is a flat label path, not an expandable tree; it needs every item up front to build tabs, search, and sort.

### D3 — `id` is the full `skills/{bucket}/{path}` resource URL

`CatalogItem.id` for a skill is the `url` field the backend already returns. Two buckets are listed, and a bucket-relative path collides across them (`my-skill` can exist in both); the resource URL is unique, is the exact form `parseSkillResourceUrl` (`apps/chat-api/src/skills/utils/skill-path.util.ts`) accepts, and is what `SkillsLookupService.resolveSkillItem` already resolves. Every id-to-endpoint dispatch in `CatalogView` is switched on `item.type` first, so overlap with a deployment id is not a concern.

A small `apps/chat/src/types/skill.ts` module holds the `SkillSource` enum (`Personal` / `Public`) and the parse helper that splits a skill item id back into `{ bucket, path }` for the details fetch — the frontend mirror of the backend's parser.

*Alternative rejected:* bucket-relative path, as prompts use. Prompts are listed through endpoints that resolve the bucket server-side; skills are not.

### D4 — Grouping folders become catalog folder labels, not catalog items

Entries with `nodeType: 'folder'` are dropped from the item list. A skill's `folder` array is `[<source label>, ...grouping folder segments]` — `[t('Personal'), 'analysis', 'finance']` for `analysis/finance/revenue-skill` in the caller's bucket — derived from `parentPath`, matching how `mapPromptToCatalogItem` builds `[<source label>, ...folderId segments]`. Segments are `safeDecodeURIComponent`'d like prompt folders.

An empty grouping folder therefore does not appear anywhere. That is correct for a read-only listing: the catalog lists entities, and an empty folder has none.

### D5 — Skill is content-first: no About tab

`DetailsPanel.tsx:382-405` currently pushes an About tab for every type except `Prompt`, whose body already carries its description. A skill has no description at all, so an About tab for a skill would render an empty panel on open. The `isPrompt` equality check becomes membership in a `CONTENT_FIRST_ENTITY_TYPES` set containing `Prompt` and `Skill`; Content is pushed unconditionally for those types (so the opening tab never shifts as details resolve), and Overview follows when present.

This is the only change to `libs/catalog`. It introduces no host knowledge: the lib learns that two of its own enum members lead with content, nothing about buckets, endpoints, or manifests.

*Alternative rejected:* synthesise a description client-side by reading `SKILL.md` for every listed skill. That is one HTTP request per skill on catalog load.

*Alternative rejected:* leave the About tab and let it render empty. A tab that is always blank on first open is a defect, not a placeholder.

### D6 — Details fetch: parallel manifest read and file listing, degrading independently

The Skill branch of `onFetchDetails` parses `{ bucket, path }` from the item id and issues two requests through `Promise.allSettled`:

1. `downloadSkillFile(bucket, path, 'SKILL.md')` → `Response`, read with `.text()`, capped at `SKILL_MANIFEST_MAX_BYTES` (initially 256 KB) before decoding. Populates `details.promptContent.content` — the existing generic long-form-text channel on `CatalogItemTabData`, documented as "long-form text entities such as prompts", which is exactly what a manifest is.
2. `listSkillFiles(bucket, path, { recursive: true })` → an Overview section listing author, last-updated, file count, and one row per file.

Each result is optional. A skill whose manifest is missing, oversized, or unreadable still gets its Overview; a failed file listing still gets its Content. Both failing yields the panel's existing error state. The catalog's list of items is never blocked on either — a skill card renders from metadata alone.

*Alternative rejected:* a serial fetch (manifest, then files). The two are independent; serialising them doubles the panel's time-to-content for no benefit.

*Alternative rejected:* a new `CatalogItemFiles` tab model plus a Files tab component in `libs/catalog`. Worth it once file rows carry actions (open, download, delete) — all non-goals here. Until then an Overview section renders the same information with no new lib surface.

### D7 — Read-only action policy is expressed as host predicates, not lib branches

`CatalogView` already supplies `isPrimaryActionVisible`, `isPublishVisible`, `isShareVisible`, and `isDownloadVisible`. Each gains a `type !== CatalogEntityType.Skill` clause, and `mapSkillToCatalogItem` sets `isEditable: false` unconditionally. No Skill entry is added to the Create dropdown. `Header.tsx`'s built-in defaults are untouched — the host decides, which is the boundary the lib already defines.

`permissions` from DIAL Core (`READ` / `WRITE` / `SHARE`) is mapped onto the item but not acted on in this change: with every mutating action hidden, a `WRITE` permission has nothing to enable yet. It is carried so a later change can turn actions on without re-plumbing the listing.

### D8 — `OverlayFeature.Skills` gates the whole feature

One additive member in `libs/chat-overlay/src/protocol/overlay-protocol.ts`, read in `CatalogView` via `useUiFeature(OverlayFeature.Skills)` exactly as `Prompts` and `Toolsets` are. When off, no skill item enters `catalogItems`, so `buildCatalogTabs` derives no Skills tab and the catalog is byte-identical to today. The provider still mounts (it is cheap when the flag is off because `CatalogView` never reads it) — but to avoid two pointless requests per session, `SkillsProvider` itself also short-circuits its fetch when the feature is disabled.

### D9 — Skill favourites get their own user-config section

`resolveFavoriteEntityType` (`apps/chat/src/utils/favorites.ts:9-24`) maps a catalog type to a user-config section and **falls through to `FavoriteEntityType.Deployment` for anything unmapped**. Adding a listable type without adding its section means a starred skill writes its resource URL into `deployments.installed`, where it will never match a deployment id — silent corruption of an unrelated list.

So `apps/chat-api/src/user-config/` gains a `skills: { installed: string[] }` section and a `PATCH /api/v1/user-config/skills` endpoint mirroring the prompts one, the config `version` is bumped, and `migrateConfig` fills the section on read of an older document (no migration job; a new-code read of an old file and an old-code read of a new file both degrade to an empty favourites list). `FavoriteEntityType` gains `Skill`, and `FAVORITE_ENTITY_TYPE_BY_CATALOG_TYPE` gains its entry.

Authorization: the endpoint is session-authenticated like every other `user-config` route, operates only on the caller's own config document, and requires no role. Backend conventions (thin controller, Swagger per status, validated DTO with an allowlist `@Matches` on the resource URL, typed exceptions, throttling) follow `apps/chat-api/AGENTS.md` — not restated here.

*Alternative rejected:* re-add an `isFavoriteVisible` predicate to `libs/catalog` to hide the star for skills. The prompt change deliberately removed that prop; re-adding a lib prop to compensate for a missing backend section inverts the dependency.

### D10 — States and accessibility

- **Loading:** the catalog's existing skeleton covers it — `CatalogView`'s `isLoading` gains `isSkillsLoading` as a third term alongside deployments and favourites.
- **Empty:** no skills ⇒ no Skills tab (`buildCatalogTabs` derives tabs from present items). Within the tab, a search with no match uses the catalog's existing empty-search state.
- **Error:** a failed listing surfaces through `useOperationNotification` with a dedicated i18n key, and leaves the rest of the catalog usable. The details panel's own error state covers a failed details fetch.
- **A11y:** the file-list Overview rows are plain label/value rows rendered by the existing Overview component, which already meets the panel's semantics. The load-failure notification goes through the existing notification surface, which already carries its live region. No new interactive control is introduced, so no new ARIA is needed beyond what the catalog provides.
- **RTL:** no new layout is authored — every surface is an existing catalog component — so there are no new physical-direction utilities to convert.

### D11 — i18n

New keys in `apps/chat/src/constants/translation-keys.ts` + `en.json`, all under the existing `catalog.*` namespace: the Skills tab label, the Personal/Public folder labels (reused from the prompt keys where the string is identical), the details section title, the author / updated / files row labels, and the listing-error notification. Generic action words reuse `ButtonsI18nKeys`.

## Risks / Trade-offs

- **DIAL Core may not serve a `public` skills bucket** → the organisation listing is issued through `Promise.allSettled` and its failure is non-fatal: the Public folder is simply absent and the personal listing is unaffected. If it turns out the bucket never exists, deleting one call removes the branch.
- **One `SKILL.md` read per opened details panel** → bounded by user action (only on open), capped in size, and cached implicitly by the panel's own details cache. It is not on the catalog's load path.
- **Bounded pagination can truncate a very large bucket** → the cap is a named constant, the truncation is logged, and the page count can be raised without a design change. Silent truncation is explicitly avoided.
- **A `SKILL.md` is arbitrary user-authored text rendered in the details panel** → it goes into the existing read-only text block, which does not execute or interpret markup. No new rendering path is introduced.
- **This change depends on `add-prompt-catalog-entity-type` landing first** → all four borrowed pieces (`CatalogItemPromptContent`, `CatalogDetailsTab.Content`, `isDownloadVisible`, `prompts.installed`) exist in the working tree already; if that change were reverted, this one would not compile, which is a loud failure rather than a silent one.
- **User-config version bump** → both directions degrade to an empty favourites list, so a rollback loses starred skills but breaks nothing.

## Migration Plan

1. Land the backend user-config section and endpoint; run `npm run openapi && npm run openapi:check` and rebuild `chat-api-client`.
2. Land `OverlayFeature.Skills` and the `libs/catalog` content-first change.
3. Land the app adapter (`types/skill.ts`, `SkillsContext`, `mapSkillToCatalogItem`) with the feature flag **off** by default.
4. Wire `CatalogView` and the details branch, still behind the flag.
5. Enable the flag.

Rollback is the flag: turning `OverlayFeature.Skills` off removes the tab, the items, and both listing requests, leaving the catalog exactly as it is today. No data is written by this change apart from favourites, which degrade to empty.

## Open Questions

1. **Does the organisation (`public`) bucket hold skills in the target deployments?** D1 is written to tolerate "no", but if the answer is a firm no everywhere, the organisation listing should be dropped rather than shipped as a permanently-empty folder.
2. **Should the file list show sizes?** `SkillMetadataItemDto` exposes no `contentLength`, so the Overview rows show name and last-updated only. Adding size would require a backend DTO field.
3. **Is `SKILL_LISTING_MAX_PAGES = 10` (with the endpoint's default `limit`) enough headroom for the largest expected bucket?** The constant is trivially raisable; the question is what value to ship.
