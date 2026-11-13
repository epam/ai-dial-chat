## Context

DIAL Core now sends three optional, unvalidated strings on every model: `provider`, `deprecation_date` and `end_of_service` (epam/ai-dial-core#2276). `@epam/ai-dial-typescript-sdk@0.3.0-dev.3` types them on `ModelData`. This branch already pins that version in `apps/chat-api/package.json`, and `chat-api` typechecks and lints against it without other changes.

Two BFF surfaces serve models to the UI and to Models Garden:

- `GET /api/v1/deployments/{deployment}/details`. `buildModelDetails` in `apps/chat-api/src/deployments/details/deployments-details.service.ts` maps the typed `getModel` result field by field into `ModelDetailsDto`. Today `catalogProperties` goes through `mapCatalogProperties`, the allowlist that applications and toolsets also use.
- `GET /api/v1/model-catalog` and `GET /api/v1/model-catalog/{modelName}`. `toCatalogEntry` in `apps/chat-api/src/models/catalog/model-catalog.service.ts` copies the keys in `MODEL_CATALOG_ENTRY_FIELDS` and projects `catalog_properties` through `mapCatalogProperties`.

On the frontend, `mapModelDetailsDto` (`libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts`) turns `DeploymentDetailsDto` into `ModelSpecification`, and `mapModelDetails` turns that into `OverviewSection` rows with `EntityDetailsLabels`. `apps/chat` already translates every label through `buildEntityDetailsLabels` (`apps/chat/src/utils/map-deployment-to-catalog-item.ts`). The `catalog-item-details-fetch` spec still says no i18n keys exist and that the app passes nothing. That text is stale, and this change corrects it.

The user decided that `catalog_properties.provider` is **removed**, not kept as a fallback, and removed from the shared allowlist and DTO for every entity type, "as if it had never existed", with no new DTO.

## Goals / Non-Goals

**Goals:**

- Expose `provider`, `deprecationDate` and `endOfService` on model details, and `provider`, `deprecation_date` and `end_of_service` on both catalog routes, with no cast.
- Make the top-level `provider` the only provider source for models, in the runtime and in the generated types.
- Show Provider, Deprecation date and End of service in the catalog model Overview, translated, and only when present.

**Non-Goals:**

- Deprecation warnings, badges, sorting or blocking.
- `lifecycle_status`, routers, and lifecycle fields for applications or toolsets.
- A provider replacement for applications and toolsets.
- Validating or normalising the date strings.
- A non-prerelease SDK pin (follow-up).

## Decisions

### 1. Pin `@epam/ai-dial-typescript-sdk@0.3.0-dev.3` exactly

epam/ai-dial-typescript-sdk#67 closed on 2026-11-13. The fields first ship in `0.3.0-dev.3` (dist-tag `development`), while `latest` is still `0.2.0`. An exact pin follows the existing `"0.2.0"` style, and `.claude/rules/libs.md` warns that a caret on a prerelease can resolve to another prerelease. The `0.2.0` → `0.3.0-dev.3` diff also adds routers, aliases, system import and admin-consent endpoints, and it reshapes some admin manifest unions and query parameters that `chat-api` does not use. `typecheck` passing is the evidence for that. The SDK is a `chat-api` dependency only, so no lib manifest and no `docs/host-install-matrix.md` row changes.

_Alternative:_ wait for `0.3.0`. Rejected, because it blocks the issue on a release with no date. A follow-up task moves the pin when `0.3.0` is published.

### 2. Read the new fields from the typed SDK shape

`buildModelDetails` sets `provider: raw.provider`, `deprecationDate: raw.deprecation_date` and `endOfService: raw.end_of_service`, next to `lifecycleStatus: raw.lifecycle_status`. Like the existing typed fields, the values are copied without `getString`. Core types them as strings, and the defensive readers exist for payload keys the SDK does not declare, which no longer applies here. `undefined` drops out of the JSON body, so "omit when absent" needs no extra code.

### 3. Remove `provider` from the shared catalog-properties allowlist and DTO

`mapCatalogProperties` (`apps/chat-api/src/deployments/utils/deployment-mapper.util.ts`) stops reading `provider`, and `ModelCatalogPropertiesDto` (`apps/chat-api/src/deployments/dto/deployment-details.dto.ts`) stops declaring it. The allowlist now has four fields. Both are shared by the model, application and toolset branches of `/deployments/details` and by the model catalog, so every surface changes at once and no new type or mapper is added.

The generated `ModelCatalogPropertiesDto` then has no `provider`. A consumer that still reads it gets a compile error instead of a silent `undefined`. This is the intended signal, and the proposal records it as BREAKING.

_Alternatives:_

- A model-only `mapModelCatalogProperties` and `ModelCatalogPropertiesWithoutProviderDto`, keeping `provider` for applications and toolsets. It was implemented first, then rejected by the user ("no new DTO") and reverted.
- Keep the type and stop filling `provider` for models only. Rejected, because the type would advertise a field that never arrives.

### 4. The model catalog copies the three fields through `MODEL_CATALOG_ENTRY_FIELDS`

`DialModelDto` declares `provider`, `deprecation_date` and `end_of_service` as `@ApiPropertyOptional` strings with descriptions and examples. `MODEL_CATALOG_ENTRY_FIELDS` lists all three, so `PickType` and the runtime copy pick them up together. `toCatalogEntry` keeps `mapCatalogProperties`, which no longer yields `provider`. The `MODEL_CATALOG_ENTRY_FIELDS` doc comment still holds ("copied as Core sends them"), because the new fields are copied that way.

`GET /api/v1/models` and `GET /api/v1/models/{modelName}` keep forwarding Core's object as is (`ModelsService`, `result.data as unknown as DialModelDto`). Their runtime body therefore already carries the new fields, and it keeps `catalog_properties.provider`. Only their Swagger schema gains the three fields. Stripping `catalog_properties.provider` on `/models` as well would turn a documentation-only change into a runtime change to a route the issue does not name, so `/models` stays a pass-through.

### 5. Frontend: one mapper, two labels, the existing date formatter

- `ModelSpecification` gains `deprecationDate?` and `endOfService?`. `mapModelDetailsDto` reads `provider`, `deprecationDate` and `endOfService` from `dto.modelDetails`, and adds all three to `hasSpecification`.
- `AgentSpecification` and `ToolsetSpecification` lose `provider`. `mapApplicationDetailsDto`, `mapToolsetDetailsDto`, `mapAgentDetails` and `mapToolsetDetails` stop reading it and stop rendering the Provider row. The `provider` label remains, because only the model Overview uses it.
- `mapModelDetails` adds two rows after Release date, both through `formatCatalogDate`. That is the local-calendar `YYYY-MM-DD` parser already used for Knowledge cutoff date, and it falls back to the raw string.
- `EntityDetailsLabels` and `DEFAULT_ENTITY_DETAILS_LABELS` gain `deprecationDate: 'Deprecation date'` and `endOfService: 'End of service'`. `buildEntityDetailsLabels` fills them from `CatalogI18nKeys.EntityDetailsDeprecationDate` / `EntityDetailsEndOfService`, and `en.json` gets the keys under `catalog.entityDetails`.

The issue says "`libs/catalog` shows …" and "dates formatted by the host". The code disagrees. The Overview rows and labels are produced in `chat-hooks`, and `libs/catalog` renders whatever `OverviewSection`s it gets. Dates are already formatted in `chat-hooks` by `formatCatalogDate`, which uses the browser's `toLocaleDateString()`. This change follows the code: `libs/catalog` is unchanged, and the dates use the same formatter as their neighbour rows. Moving date formatting to the host would be a separate change covering Release date and Knowledge cutoff date too.

Lib isolation: `chat-hooks` already imports the generated `DeploymentDetailsDto` type under the `AGENTS.md` exception, and the change adds no endpoint path, i18n, locale setting or host state to it. Labels arrive as `EntityDetailsLabels`, and data arrives as the fetched DTO.

### 6. Caching is unchanged

The details response rides on `deployments:details:<userSub>:<deployment>` (60 s), the catalog on its own instance cache (see the `model-catalog` spec), and `/models` on `models:list:<sub>` / `models:single:<sub>:<name>`. None of the keys, TTLs or invalidation events change. Within one TTL a cached entry may lack the new fields after a Core update, which is acceptable for display data.

## Authorization

No new endpoint is added. The three routes keep their current guards: the session-protected details route, and the session-protected catalog routes that call Core with `MODEL_CATALOG_API_KEY`. The new fields are display metadata that Core exposes to anyone who can see the model.

## Risks / Trade-offs

- **Models that set only `catalog_properties.provider` lose the Provider row** (details and Models Garden) → This is the accepted cost of removal. The PR description and the `apps/chat-api/README.md` note tell operators to move to Core's `provider`.
- **Applications and toolsets lose their Provider row with no replacement** → This was accepted by the user ("as if it never existed"). Core has no top-level provider for them.
- **Models Garden breaks at compile time on `catalogProperties.provider`** → This is intended. The PR names the migration (read the top-level `provider`).
- **A prerelease SDK pin** → The pin is exact and the diff is checked by `typecheck`. A follow-up moves it to `0.3.0`.
- **Unvalidated dates** → A non-ISO value is shown verbatim, the same as Knowledge cutoff date. Nothing makes a decision based on the value.
- **`/models` and `/model-catalog` disagree on `catalog_properties.provider`** → `/models` is a documented pass-through, and its spec scenario says so explicitly.

## Migration Plan

1. Land the change. Regenerate the client in the same commit.
2. Operators set `provider` (and the dates) on their model configs in Core. `catalog_properties.provider` can then be deleted from any Core config. The BFF ignores it either way.
3. Rollback: revert the commit, regenerate the client, and pin the SDK back to `0.2.0`.

## Open Questions

None. The `catalog_properties.provider` question was settled by the user: removal everywhere, with no new DTO.
