# Surface skills in the catalog: read-only listing and details

## Why

`apps/chat-api` ships a complete skills domain — listing, file listing, download, upload, delete, and grouping folders — specified in `openspec/specs/skills-bff-api/spec.md` and implemented across `apps/chat-api/src/skills/`. The frontend already has typed wrappers for every one of those endpoints in `apps/chat/src/server-api/skills.api.ts:12-146`, `skillsApi` is registered in `apps/chat/src/server-api/api-client.ts:185`, and `CatalogEntityType.Skill` has existed in `libs/catalog/src/types/entity-type.ts:5` with its entity colour, tab label, and canonical tab position since the type was introduced.

Nothing calls any of it. There is no `SkillsContext`, no `mapSkillToCatalogItem`, and no `Skill` branch in `CatalogView.tsx:229-290`, so `buildCatalogTabs` never sees a skill item and the Skills tab never renders. A user has no way to see which skills exist in their bucket, and a fully built, fully tested backend plus its frontend API layer are dead weight.

## What Changes

- **`apps/chat`: `SkillsContext` / `useSkills`** — a provider mounted near the app root that reads the caller's own skills from `listSkills({ bucket: user.bucket, recursive: true })` and organisation skills from the `public` bucket, following the `PromptsContext` pattern (`Promise.allSettled` so one bucket's outage cannot hide the other, `useMemo`'d value, guard hook that throws outside the provider, cancelled-flag fetch). Grouping folders (`nodeType: 'folder'`) are dropped from the item list; their path segments become catalog folder labels instead.
- **`apps/chat`: `mapSkillToCatalogItem`** — maps a `SkillMetadataItemDto` to a `CatalogItem` with `type: CatalogEntityType.Skill`, the skill's `skills/{bucket}/{path}` resource URL as `id`, `Personal`/`Public` as the leading folder segment, `updatedAt` as `lastUsed`, and no version (skill metadata carries none).
- **`apps/chat`: skills merged into `CatalogView`'s item list**, gated on a new `OverlayFeature.Skills` key exactly as prompts and toolsets are gated today. Search, sort, filter, the tab bar, and the list-view Folder column all pick the type up with no per-type branching.
- **`apps/chat`: a Skill branch in `onFetchDetails`** — on opening a skill's details panel, `listSkillFiles` (recursive) and `downloadSkillFile(…, 'SKILL.md')` resolve in parallel into a Content tab carrying the manifest text and an Overview tab carrying author, last-updated, file count, and the file list. A missing or unreadable `SKILL.md` degrades to Overview alone rather than failing the panel.
- **`libs/catalog`: `Skill` joins `Prompt` as a content-first entity type** in `DetailsPanel.tsx:382-405`. Skill metadata carries no description, so an About tab for a skill would always be empty; the panel opens on Content instead. This replaces the single `isPrompt` check with a shared set — no host knowledge enters the lib.
- **`apps/chat` + `apps/chat-api`: skill favourites.** A `skills.installed` section on the user config plus `PATCH /api/v1/user-config/skills`, mirroring `prompts.installed`. This is a correctness requirement, not a nice-to-have: `resolveFavoriteEntityType` (`apps/chat/src/utils/favorites.ts:9-24`) falls through to `FavoriteEntityType.Deployment` for any unmapped type, so without its own section a starred skill would write its path into `deployments.installed` and corrupt deployment favourites.
- **`libs/chat-overlay`: one new `OverlayFeature.Skills` member** in `protocol/overlay-protocol.ts`, so the whole feature can be switched off without removing code.
- **`apps/chat`: read-only action policy for skills.** `isPrimaryActionVisible`, `isPublishVisible`, `isShareVisible`, and `isDownloadVisible` all return `false` for a Skill item, and no Skill entry is added to the Create dropdown. Every skill is `isEditable: false`.
- **i18n**: roughly ten new keys (`catalog.tabSkills`, the Skill details section and spec labels, the skill list-load error notification), each declared in `apps/chat/src/constants/translation-keys.ts` and `en.json`.
- **Non-breaking.** `OverlayFeature.Skills` is an additive enum member, the lib change swaps one equality check for a set membership check, and the user-config addition is a new optional section that `migrateConfig` fills on read.

### Non-goals

- **No skill mutations.** Upload, file upload, delete, file delete, and grouping-folder create/delete stay uncalled. `skills.api.ts` keeps exposing them; nothing in this change invokes them, and no editor route is added.
- **No skill download action.** `downloadSkill` (whole-skill ZIP) stays uncalled from the UI; `downloadSkillFile` is used only to read `SKILL.md` for the details panel.
- **No shared-with-me skills.** The skills domain exposes no shared-listing endpoint the way files does with `listSharedByMe`, so a skill shared by another user cannot be enumerated. Only the caller's own bucket and the organisation bucket are listed.
- **No skill publishing or sharing.** No `CatalogEntityType.Skill` support is added to `publish.service.ts` or the share link DTO.
- **No "use in chat" for a skill.** Skills are not a runtime a conversation can target; the primary action stays hidden.

### Alternatives considered

1. **Wait for a dedicated aggregate skills endpoint that resolves the manifest server-side.** Rejected: the listing endpoint exists today and is specified; adding a second backend surface to avoid one extra `downloadSkillFile` call per opened details panel is a larger change than the one it saves.
2. **Show the skill's description in the card by reading `SKILL.md` for every listed skill.** Rejected: that is one request per skill on catalog load. Cards show name and folder; the manifest is read lazily, only when a details panel opens.
3. **Add a dedicated Files tab to `libs/catalog`.** Rejected for this change: the file list fits an Overview section with no new lib component, and a Files tab is only worth its surface once file-level actions (open, download, delete) exist — which are non-goals here.
4. **Skip the `skills.installed` user-config section and hide the star for skills.** Rejected: the lib no longer exposes an `isFavoriteVisible` predicate (the prompt change removed it), so suppressing the star would mean re-adding a lib prop to work around a missing backend section rather than adding the section.
5. **List only the caller's own bucket.** Rejected: a catalog that omits organisation-wide skills is a partial answer to "which skills exist". The organisation listing is fault-tolerant, so if DIAL Core rejects a `public` skills bucket the Public folder is simply empty.

### Dependency to flag

This change builds directly on `add-prompt-catalog-entity-type`, which is in progress on this branch and not yet archived. It relies on that change's `CatalogItemPromptContent` / `CatalogDetailsTab.Content` model, the `isDownloadVisible` predicate on `CatalogProps`, and the `prompts.installed` user-config precedent. All three already exist in the working tree; none is invented here.

## Capabilities

### New Capabilities

- `skills-catalog-context`: `SkillsContext` / `useSkills` — ownership of personal and organisation skill listings, grouping-folder filtering, loading and error state, refetch, provider placement, and the throw-outside-provider guard.
- `skill-catalog-item-mapping`: `mapSkillToCatalogItem` — the `SkillMetadataItemDto` → `CatalogItem` contract, including id, folder derivation from the grouping-folder path, ownership flags, favourite state, and the absent-version/absent-description handling.
- `skill-catalog-listing`: the `OverlayFeature.Skills` gate, skills merged into `CatalogView`'s item list, the Skills tab, and the read-only action policy that keeps every mutating and runtime action hidden for a Skill item.
- `skill-details-panel`: the Skill branch of `onFetchDetails` — parallel `listSkillFiles` + `SKILL.md` read, the Content and Overview tab data it produces, partial-failure degradation, and `Skill` joining `Prompt` as a content-first type in `libs/catalog`'s tab derivation.
- `skill-favorites`: the `skills.installed` user-config section, `PATCH /api/v1/user-config/skills`, and the frontend wiring that folds skill resource URLs into the one `favoriteIds` set.

### Modified Capabilities

- `catalog-item-details-fetch`: the type-dispatched `onFetchDetails` path gains a Skill branch that resolves through the skills endpoints instead of the deployment-details endpoint.

The `OverlayFeature.Skills` enum member and the favourites section are specified inside `skill-catalog-listing` and `skill-favorites` respectively, mirroring how `add-prompt-catalog-entity-type` kept its own `OverlayFeature.Prompts` and `prompts.installed` additions inside its feature capabilities rather than deltaing `chat-overlay-protocol` and `catalog-favorites-persistence`.

## Impact

**Libraries**

- `libs/catalog`: `components/Details/DetailsPanel.tsx` (content-first type set) and its spec. No REST path, generated client, DTO, bucket name, or feature flag enters the lib — every skill-specific decision arrives through the existing `items` / `isPrimaryActionVisible` / `isPublishVisible` / `isShareVisible` / `isDownloadVisible` / `onFetchDetails` props on `CatalogProps`. `SkillsContext`, `mapSkillToCatalogItem`, and `CatalogView` are the adapters.
- `libs/chat-overlay`: one new `OverlayFeature` member in `protocol/overlay-protocol.ts`, which is part of the published overlay protocol.

**Application (`apps/chat`)**

- New: `context/SkillsContext.tsx`, `utils/map-skill-to-catalog-item.ts`, `types/skill.ts` (the `SkillSource` enum and the skill-resource URL helpers).
- Modified: `components/CatalogView/CatalogView.tsx`, `context/FavoriteApplicationsContext.tsx`, `utils/favorites.ts`, `server-api/user-config.api.ts`, `app/app.tsx` (provider mount), `constants/translation-keys.ts`, `i18n/locales/en.json`.

**Backend (`apps/chat-api`)**

- `user-config/`: `dto/user-config.dto.ts` (the `skills` section, `createDefaultUserConfig`, config version bump), a new `dto/update-installed-skill.dto.ts`, `user-config.service.ts`, `user-config.controller.ts`.
- `libs/chat-api-client`: regenerated from the updated swagger; `npm run openapi && npm run openapi:check` must stay green.

**i18n**

- ~10 new user-visible strings. Generic action labels reuse existing `ButtonsI18nKeys` members rather than adding duplicates.

**Testing**

- Vitest units for `mapSkillToCatalogItem`, `SkillsContext`, and the skill details-fetch branch; `CatalogView.spec.tsx` extended for the Skills tab, the feature gate, and the hidden-action policy; `chat-api` unit tests for the new user-config section and endpoint.
