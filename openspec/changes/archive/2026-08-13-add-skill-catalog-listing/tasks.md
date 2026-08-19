## 1. Backend: skill favourites section and endpoint

- [x] 1.1 Add `skills: { installed: string[] }` to `UserConfig` / `UserConfigDto` in `apps/chat-api/src/user-config/dto/user-config.dto.ts`, seed it in both default-config factories, and bump `CURRENT_CONFIG_VERSION` from `4` to `5`
- [x] 1.2 Extend `migrateConfig` to fill `skills: { installed: [] }` for older documents and to drop non-string entries, reusing the existing installed-entries filter
- [x] 1.3 Create `apps/chat-api/src/user-config/dto/update-installed-skill.dto.ts` with `id` (`@IsString`, `@MinLength(1)`, `@MaxLength(2048)`, allowlist `@Matches` for `skills/{bucket}/{path}`) and `isInstalled` (`@IsBoolean`), both with `@ApiProperty`; put the pattern and its message in a shared skills constant so the frontend parser and the DTO agree
- [x] 1.4 Add `updateInstalledSkill(id, isInstalled, accessToken, bucket)` to `UserConfigService`, mirroring `updateInstalledPrompt`
- [x] 1.5 Add `PATCH /api/v1/user-config/skills` to `UserConfigController` with `operationId: 'updateInstalledSkill'`, `@HttpCode(204)`, `@ApiBody`, and `@ApiResponse` entries for 204 / 400 / 401
- [x] 1.6 Add unit tests: default config shape, migration from v4, non-string filtering, favourite/unfavourite round trip, malformed-id rejection (including a `files/…` path and a `..` traversal), and unauthenticated access
- [x] 1.7 Run `npm exec nx test chat-api`, `npm exec nx lint chat-api`, then `npm run openapi && npm run openapi:check`, format `openapi.json` with Prettier, and rebuild `chat-api-client`

## 2. Feature flag and lib change

- [x] 2.1 Add `Skills = 'skills'` to `OverlayFeature` in `libs/chat-overlay/src/protocol/overlay-protocol.ts` with a JSDoc line, and update the overlay protocol tests that assert the enum's membership
- [x] 2.2 Replace the `item.type === CatalogEntityType.Prompt` check in `libs/catalog/src/components/Details/DetailsPanel.tsx` with a module-level `CONTENT_FIRST_ENTITY_TYPES` set containing `Prompt` and `Skill`, keeping the unconditional `Content` tab and the `About`-omitting behaviour for both
- [x] 2.3 Add `DetailsPanel` tests: Skill omits `About` and opens on `Content`; Skill keeps `Content` before details resolve; Prompt behaviour unchanged; `Model`/`Agent`/`Toolset` still lead with `About`
- [x] 2.4 Run `npm exec nx test catalog`, `npm exec nx test chat-overlay`, and lint both

## 3. App adapter: types, context, mapper

- [x] 3.1 Create `apps/chat/src/types/skill.ts` with the `SkillSource` string enum and `parseSkillResourceUrl`, plus `SKILL_LISTING_MAX_PAGES`, the listing page size, `SKILL_MANIFEST_FILE`, and `SKILL_MANIFEST_MAX_BYTES` constants
- [x] 3.2 Unit-test `parseSkillResourceUrl` for a well-formed URL, a wrong prefix, an empty bucket, and an empty path
- [x] 3.3 Create `apps/chat/src/context/SkillsContext.tsx`: `SkillsProvider` + `useSkills` guard hook, personal and `public` bucket listings via `Promise.allSettled`, `recursive: true`, bounded `nextToken` paging with the truncation warning, folder filtering, `useMemo`'d value, `useCallback` refetches, cancelled-flag effect, and the `OverlayFeature.Skills` short-circuit
- [x] 3.4 Skip the personal listing when `user.bucket` is absent or empty, keeping `isLoading` true until the profile settles
- [x] 3.5 Unit-test `SkillsContext`: both listings resolve; each side failing independently; both failing; multi-page collection; page-cap truncation warning; folder entries filtered; feature disabled issues no request; hook throws outside the provider
- [x] 3.6 Create `apps/chat/src/utils/map-skill-to-catalog-item.ts` implementing the field table and the `[source label, ...parentPath segments]` folder derivation with `safeDecodeURIComponent`
- [x] 3.7 Unit-test the mapper: personal vs. organisation ownership flags, favourite state from the passed set, empty description/version, nested folder path, root-level skill, percent-encoded segment
- [x] 3.8 Mount `SkillsProvider` in `apps/chat/src/app/app.tsx` inside the authenticated tree alongside `PromptsProvider`

## 4. Favourites wiring

- [x] 4.1 Add `updateInstalledSkill(id, isInstalled)` to `apps/chat/src/server-api/user-config.api.ts` using the normal generated method
- [x] 4.2 Add `Skill = 'skill'` to `FavoriteEntityType` and map it to `updateInstalledSkill` in `INSTALL_BY_ENTITY_TYPE` in `apps/chat/src/context/FavoriteApplicationsContext.tsx`
- [x] 4.3 Seed `favoriteIds` from `config.skills.installed` wherever the other installed sections are read
- [x] 4.4 Add `[CatalogEntityType.Skill]: FavoriteEntityType.Skill` to `FAVORITE_ENTITY_TYPE_BY_CATALOG_TYPE` in `apps/chat/src/utils/favorites.ts`
- [x] 4.5 Unit-test that starring a skill calls `updateInstalledSkill` and never `updateInstalledDeployment`, that stored URLs seed the star state, and that a rejected toggle rolls back

## 5. i18n

- [x] 5.1 Add `catalog.tabSkills` and `catalog.skillsLoadError` to `en.json` and `CatalogI18nKeys`
- [x] 5.2 Add `catalog.details.skillSection`, `catalog.details.skillAuthor`, `catalog.details.skillUpdated`, `catalog.details.skillFileCount`, and `catalog.details.skillFile` to `en.json` and `CatalogI18nKeys`
- [x] 5.3 Confirm no duplicate English values were introduced — reuse `ButtonsI18nKeys` and the existing `FolderPersonal` / `FolderPublic` keys rather than re-declaring them

## 6. CatalogView integration

- [x] 6.1 Read `useSkills()` and `useUiFeature(OverlayFeature.Skills)` in `CatalogView`, append mapped skill items to the `catalogItems` memo behind the flag, and extend the memo's dependency array
- [x] 6.2 Fold the skills context's `isLoading` into `CatalogView`'s `isLoading`
- [x] 6.3 Pass `catalog.tabSkills` through `CatalogTitles.tabLabels` for `CatalogEntityType.Skill`
- [x] 6.4 Extend `isPrimaryActionVisible`, `isPublishVisible`, `isShareVisible`, and `isDownloadVisible` to return `false` for a Skill item, leaving `Header.tsx`'s built-in defaults untouched
- [x] 6.5 Surface a skills-listing error once through `useOperationNotification` with `catalog.skillsLoadError`, leaving the rest of the catalog rendered
- [x] 6.6 Extend `CatalogView.spec.tsx`: Skills tab appears when the flag is on and items exist; nothing appears when the flag is off; skills are excluded in selector mode; no mutating action renders for a skill (including one with a `WRITE` permission); the Create dropdown is unchanged; a listing error notifies without breaking the catalog

## 7. Skill details fetch

- [x] 7.1 Add the Skill branch to `CatalogView`'s `onFetchDetails`, before the deployment path: parse the id, and on success issue `downloadSkillFile(bucket, path, 'SKILL.md')` and `listSkillFiles(bucket, path, { recursive: true })` through `Promise.allSettled`
- [x] 7.2 Read the manifest `Response` as text with the `SKILL_MANIFEST_MAX_BYTES` cap applied before decoding, and map it to `{ promptContent: { content } }`
- [x] 7.3 Build the Overview section — author (omitted when absent), last-updated, file count, and one row per file — excluding `nodeType: 'folder'` entries from both the rows and the count
- [x] 7.4 Return each half independently, resolve `undefined` when both fail or the id is unparseable, and never throw out of the callback
- [x] 7.5 Unit-test the branch: both succeed; manifest 404 with a successful listing; oversized manifest; failed listing with a successful manifest; both fail; unparseable id issues no request; a skill never calls `getDeploymentDetails` or `getDeploymentLimits`

## 8. Verification and rollout

- [x] 8.1 Run `npm exec nx test chat`, `npm exec nx lint chat`, and `npm exec nx build chat`
- [x] 8.2 Run `npm exec nx affected --target=test --base=origin/development-1.0` and confirm the catalog, overlay, and chat-api projects are green
- [ ] 8.3 Manually verify against a running stack: Skills tab lists personal and organisation skills, folder labels match the grouping-folder structure, search and sort work on skills, the details panel opens on Content with the manifest and an Overview file list, starring persists across a reload, and turning the flag off restores today's catalog exactly
- [x] 8.4 Run the five-axis review from `./.claude/skills/code-review-and-quality/SKILL.md` over the diff, paying explicit attention to the `libs/*` isolation rule for the `DetailsPanel` change
- [ ] 8.5 Resolve design.md's open questions before merge: whether the `public` skills bucket exists in the target deployments (drop the branch if it never will), and what `SKILL_LISTING_MAX_PAGES` should ship as
