## MODIFIED Requirements

### Requirement: `CatalogView` wires `onFetchDetails` to the new backend endpoint

`apps/chat/src/components/CatalogView/CatalogView.tsx` SHALL implement `onFetchDetails` by dispatching on the opened item's `type` to the wrapper appropriate for that entity kind. All wrappers live in `apps/chat/src/server-api` and call generated `@epam/ai-dial-chat-api-client` methods — never `fetch` directly and never a new `base.ts` helper.

**Deployment-backed items (`Model`, `Agent`, `Toolset`).** `CatalogView.tsx` SHALL call `getDeploymentDetails(id)` in `apps/chat/src/server-api/deployments.ts`, following the same pattern as the existing `getDeploymentConfiguration` wrapper, which in turn calls the generated `DeploymentsApi.getDeploymentDetails` method.

`CatalogView.tsx` SHALL convert the returned `DeploymentDetailsDto` into the appropriate `EntitySpecificDetails` variant (`apps/chat/src/types/entity-details.ts`) via `mapDeploymentDetailsDtoToEntityDetails(dto: DeploymentDetailsDto): EntitySpecificDetails`, which switches on `dto.type` — the discriminator the backend has already resolved server-side — not on the `CatalogItem`'s own `type` field. The result is then passed through the existing `mapEntityDetailsToCatalogDetails` (`apps/chat/src/utils/map-entity-details-to-catalog.ts`) to produce the core `CatalogItemTabData`.

For model catalog items only, `CatalogView.tsx` SHALL also call the existing `getDeploymentLimits(item.id)` wrapper from `apps/chat/src/server-api/deployment-limits.ts` in parallel with `getDeploymentDetails(item.id)`. The returned `DeploymentLimitsResponseDto` SHALL be converted by an app-level mapper (for example `mapDeploymentLimitsDtoToCatalogLimits`) into `CatalogItemLimits` and merged into the returned `CatalogItemTabData` as `limits`. This mapper is the only place that knows DIAL Core's limit-stat field names (`minuteTokenStats`, `dayCostStats`, etc.); `libs/catalog` receives only resolved display data and numeric progress values.

**Prompt items (`CatalogEntityType.Prompt`).** `CatalogView.tsx` SHALL branch before the deployment path and resolve the item's body through the prompts wrappers in `apps/chat/src/server-api/prompts.api.ts`: `getPublicPrompt(item.id)` when the item's source is the organisation bucket, `getPrompt(item.id)` otherwise. The result SHALL be returned as `{ promptContent: { content: dto.content } }`. A prompt MUST NOT trigger `getDeploymentDetails` or `getDeploymentLimits`, since neither endpoint accepts a prompt path.

**Skill items (`CatalogEntityType.Skill`).** `CatalogView.tsx` SHALL branch before the deployment path, parse `{ bucket, path }` out of `item.id` with `parseSkillResourceUrl` (`apps/chat/src/types/skill.ts`), and resolve the panel's data through the skills wrappers in `apps/chat/src/server-api/skills.api.ts` with `Promise.allSettled`:

- `downloadSkillFile(bucket, path, 'SKILL.md')` — read as text, size-capped, mapped to `{ promptContent: { content } }`;
- `listSkillFiles(bucket, path, { recursive: true })` — mapped to an `overview` section carrying author, last-updated, file count, and one row per file.

Each result is independently optional: either may be omitted when its request fails, and both failing resolves `undefined`. An `item.id` that `parseSkillResourceUrl` rejects SHALL resolve `undefined` with no request issued. A skill MUST NOT trigger `getDeploymentDetails` or `getDeploymentLimits`, since neither endpoint accepts a skill resource URL.

The `onFetchDetails` callback SHALL be wrapped in `useCallback` (dependencies: app-level adapter inputs such as `isAdmin` and `t`) to satisfy the design's memoisation requirement and avoid re-triggering `Catalog`'s fetch effect on unrelated `CatalogView` re-renders.

If a details server-api call rejects (network error or a mapped HTTP exception surfaced by the base client), `onFetchDetails` SHALL catch the error, resolve `undefined`, and log nothing beyond what the shared API client already logs — it MUST NOT throw out of the callback and break the details panel. If the model limits call rejects, the details result SHALL still be returned without `limits`; a limits-specific failure MUST NOT hide Overview/Pricing/API data. For a prompt, resolving `undefined` leaves the panel showing the `promptContent` the list mapper already seeded, so a failed refresh degrades to slightly stale content rather than an empty tab. For a skill, a partial failure returns whichever half succeeded rather than discarding both.

#### Scenario: Successful detail fetch renders structured tabs

- **WHEN** a user opens a model's details panel and `getDeploymentDetails` resolves a `DeploymentDetailsDto` with `type: 'model'` and populated `modelDetails`
- **THEN** `CatalogView` maps it to `{ type: 'MODEL', data: ModelEntityDetails }` and then to `CatalogItemTabData`, and the panel renders the Overview/Pricing/API tabs with that data

#### Scenario: Model limits fetch renders Limits tab

- **WHEN** a user opens a model's details panel and `getDeploymentLimits` resolves a `DeploymentLimitsResponseDto` with at least one usable stats field
- **THEN** `CatalogView` maps the response into `CatalogItemLimits`, returns it as `details.limits`, and the panel renders the `Limits` tab

#### Scenario: Model limits fetch failure does not hide other details

- **WHEN** `getDeploymentDetails` resolves successfully but `getDeploymentLimits` rejects
- **THEN** `onFetchDetails` resolves the mapped detail tabs without `limits`, and the panel still renders any available Overview/Pricing/API tabs

#### Scenario: Unlimited limit stats

- **WHEN** DIAL Core returns an effectively-unlimited `total` value (for example Java `Long.MAX_VALUE` rounded in JSON/JavaScript)
- **THEN** the app-level mapper marks the row as unlimited, formats the visible value as `Unlimited`, preserves the numeric `used`/`total` for progress rendering, and still includes the row in the `Limits` tab

#### Scenario: Toolset detail fetch renders the Tools tab

- **WHEN** a user opens a toolset's details panel and `getDeploymentDetails` resolves `type: 'toolset'` with populated `toolsetDetails`
- **THEN** `CatalogView` maps it to `{ type: 'TOOLSET', data: ToolsetEntityDetails }`, and the panel's Overview tab reflects the toolset's `authSettings.authenticationType`

#### Scenario: Backend error does not crash the panel

- **WHEN** `getDeploymentDetails` rejects (e.g. mapped 502/503/404 from the backend)
- **THEN** `onFetchDetails` resolves `undefined`, and the panel falls back to `item.details` or hides the dependent tabs, without throwing

#### Scenario: Applications and toolset-created catalog items both dispatch through the same wrapper

- **WHEN** the opened item's `type` is `CatalogEntityType.Model`, `CatalogEntityType.Agent`, or `CatalogEntityType.Toolset`
- **AND** the additional `getDeploymentLimits(item.id)` call is made only for `CatalogEntityType.Model`
- **THEN** `onFetchDetails` calls the same `getDeploymentDetails(item.id)` wrapper regardless of type, and only the DTO → `EntitySpecificDetails` mapping branches on type

#### Scenario: Personal prompt detail fetch renders the Content tab

- **WHEN** a user opens a personal prompt's details panel
- **THEN** `onFetchDetails` calls `getPrompt(item.id)` and resolves `{ promptContent: { content } }`, and the panel renders the `Content` tab with the prompt's body

#### Scenario: Organisation prompt detail fetch uses the public wrapper

- **WHEN** a user opens the details panel for a prompt from the organisation bucket
- **THEN** `onFetchDetails` calls `getPublicPrompt(item.id)` and no personal-prompt request is dispatched

#### Scenario: Prompt fetch never reaches the deployment endpoints

- **WHEN** the opened item's `type` is `CatalogEntityType.Prompt`
- **THEN** neither `getDeploymentDetails` nor `getDeploymentLimits` is called

#### Scenario: Prompt fetch failure degrades to seeded content

- **WHEN** `getPrompt` rejects and the list mapper had already seeded `details.promptContent`
- **THEN** `onFetchDetails` resolves `undefined`, the panel keeps rendering the seeded body, and nothing throws

#### Scenario: Skill detail fetch renders Content and Overview

- **WHEN** a user opens a skill's details panel and both `downloadSkillFile('SKILL.md')` and `listSkillFiles` resolve
- **THEN** `onFetchDetails` resolves `{ promptContent: { content }, overview }` and the panel renders the manifest text and the file inventory

#### Scenario: Skill fetch never reaches the deployment endpoints

- **WHEN** the opened item's `type` is `CatalogEntityType.Skill`
- **THEN** neither `getDeploymentDetails` nor `getDeploymentLimits` is called

#### Scenario: Skill partial failure returns the half that succeeded

- **WHEN** `downloadSkillFile` rejects with a 404 and `listSkillFiles` resolves
- **THEN** `onFetchDetails` resolves an `overview` with no `promptContent`, and nothing throws

#### Scenario: Unparseable skill id issues no request

- **WHEN** a skill item's `id` is not a well-formed `skills/{bucket}/{path}` URL
- **THEN** `onFetchDetails` resolves `undefined` without calling any skills wrapper
