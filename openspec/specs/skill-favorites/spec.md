# skill-favorites Specification

## Purpose

Defines how a skill is starred: the `skills.installed` section in the user config document and its migration, the `PATCH /api/v1/user-config/skills` toggle endpoint, and the generated-client plus frontend state wiring that keeps skill favourites out of the deployments list.

## Requirements

### Requirement: The user config carries a `skills.installed` section

`apps/chat-api/src/user-config/dto/user-config.dto.ts` SHALL gain a `skills: { installed: string[] }` section alongside the existing `toolsets`, `deployments`, and `prompts` sections. `createDefaultUserConfig` SHALL seed it as `{ installed: [] }`, the fresh-object factory used per request SHALL do the same (so arrays are never shared between requests), and `CURRENT_CONFIG_VERSION` SHALL be bumped from `4` to `5`.

`migrateConfig` SHALL fill the section with `{ installed: [] }` when reading a document that predates it, and SHALL keep the existing `getInstalledEntries`-style filtering that drops non-string entries. No migration job is required: a new-code read of an older document and an older-code read of a newer document both degrade to an empty skill favourites list.

Entries SHALL be full `skills/{bucket}/{path}` resource URLs, matching `CatalogItem.id` for a skill.

#### Scenario: Fresh config has an empty skills section

- **WHEN** a user with no stored config reads it
- **THEN** the response contains `skills: { installed: [] }` and `version: 5`

#### Scenario: Older document is migrated on read

- **WHEN** a stored config at `version: 4` with no `skills` key is read
- **THEN** `migrateConfig` returns a config with `skills: { installed: [] }` and `version: 5`, leaving every other section untouched

#### Scenario: Non-string entries are dropped

- **WHEN** a stored config's `skills.installed` contains a number alongside two strings
- **THEN** the migrated config's `skills.installed` contains exactly the two strings

---

### Requirement: `PATCH /api/v1/user-config/skills` toggles a skill favourite

A new endpoint SHALL be added to `apps/chat-api/src/user-config/user-config.controller.ts`, mirroring the existing prompts route.

- **Method / path**: `PATCH /api/v1/user-config/skills`
- **Authorization**: session-authenticated (a valid session cookie); operates only on the caller's own config document; no role requirement.
- **Rate limiting**: inherits the global throttler default; no stricter per-route `@Throttle` is needed, since the call is user-initiated one-per-click.
- **Request body** (`UpdateInstalledSkillDto`, in `apps/chat-api/src/user-config/dto/update-installed-skill.dto.ts`): a `class-validator`-validated class with `id: string` (`@IsString`, `@MinLength(1)`, `@MaxLength(2048)`, and an allowlist `@Matches` accepting `skills/{bucket}/{path}` — the same shape `parseSkillResourceUrl` accepts, so the value can never reach a path or a log line unvalidated) and `isInstalled: boolean` (`@IsBoolean`). Both fields carry `@ApiProperty` with a description and example.
- **Success response**: `204 No Content`, no body.
- **Error responses**: `400` missing or invalid body, `401` not authenticated, plus the upstream-failure statuses the service already maps.

Example request:

```http
PATCH /api/v1/user-config/skills
Content-Type: application/json

{ "id": "skills/my-bucket/analysis/revenue-skill", "isInstalled": true }
```

Example response: `204 No Content`.

Controller conventions (thin controller, `@ApiOperation` + `@ApiResponse` per status, delegation to `UserConfigService.updateInstalledSkill`, typed exceptions, `Logger` + `ConfigService`) follow `apps/chat-api/AGENTS.md` — not restated here.

#### Scenario: Favourite a skill

- **WHEN** an authenticated user PATCHes `{ id: 'skills/my-bucket/revenue-skill', isInstalled: true }`
- **THEN** the response is `204`, and a subsequent config read lists that URL in `skills.installed`

#### Scenario: Unfavourite a skill

- **WHEN** an authenticated user PATCHes the same id with `isInstalled: false`
- **THEN** the response is `204` and the URL is absent from `skills.installed`

#### Scenario: Malformed id is rejected

- **WHEN** the body's `id` is `'files/my-bucket/report.pdf'` or contains `..`
- **THEN** the response is `400` and no config write occurs

#### Scenario: Unauthenticated caller

- **WHEN** the request carries no valid session cookie
- **THEN** the response is `401`

---

### Requirement: Generated-client and frontend wiring for skill favourites

- **Generated client**: OpenAPI `operationId: 'updateInstalledSkill'`, exposed on the generated `UserConfigApi` as `updateInstalledSkill({ updateInstalledSkillDto })`. Request DTO `UpdateInstalledSkillDto`, no response DTO (204). The frontend wrapper uses the normal (non-`Raw`) generated method. `npm run openapi` and `npm run openapi:check` SHALL be run and `chat-api-client` rebuilt in the same change.
- **Frontend wrapper**: `apps/chat/src/server-api/user-config.api.ts` SHALL gain `updateInstalledSkill(id: string, isInstalled: boolean)`, shaped exactly like the existing `updateInstalledPrompt`.
- **State ownership**: `FavoriteApplicationsContext` remains the sole owner of `favoriteIds`. `FavoriteEntityType` SHALL gain `Skill = 'skill'`, and `INSTALL_BY_ENTITY_TYPE` SHALL map it to `updateInstalledSkill`. `useFavoriteApplications` SHALL seed `favoriteIds` from `config.skills.installed` in addition to the sections it already reads, so a skill's star reflects stored state on first render.
- **Catalog type mapping**: `FAVORITE_ENTITY_TYPE_BY_CATALOG_TYPE` in `apps/chat/src/utils/favorites.ts` SHALL gain `[CatalogEntityType.Skill]: FavoriteEntityType.Skill`. Without this entry the map's deployment fallback would write skill resource URLs into `deployments.installed`, corrupting an unrelated list — this entry is a correctness requirement, not a convenience.
- **i18n keys**: none. The star control and its label already exist.
- **RTL impact**: none.
- **Observability**: no new metrics.

#### Scenario: Starring a skill writes to the skills section

- **WHEN** a user stars a skill in the catalog
- **THEN** `updateInstalledSkill` is called with the skill's resource URL and `true`, and `updateInstalledDeployment` is not called

#### Scenario: Stored skill favourites seed the star state

- **WHEN** the user config's `skills.installed` contains a listed skill's resource URL
- **THEN** that skill's card and details panel render as starred on first paint

#### Scenario: Optimistic toggle rolls back on failure

- **WHEN** `updateInstalledSkill` rejects after a star toggle
- **THEN** `favoriteIds` is restored to its pre-toggle state, matching the existing favourites behaviour for every other entity type
