## Context

The deployments endpoint (`GET /api/v1/deployments`) returns the merged list of models and applications that powers the Catalog UI. Operators want to flag specific models as "featured" so the frontend can render them with elevated prominence (badge, dedicated section). The feature flag must be purely operator-controlled via environment configuration — no database, no admin UI.

Current state: `FEATURED_MODEL_IDS` does not exist; `DeploymentItemDto` has no `isFeatured` field. The frontend `CatalogView` already uses `useDeployments()` and `mapDeploymentToCatalogItem`, which already maps `isFeatured: deployment.isFeatured ?? false` to `CatalogItem`.

## Goals / Non-Goals

**Goals:**
- Add `FEATURED_MODEL_IDS` optional env var, parsed and validated via `EnvironmentVariables`
- Expose `isFeatured?: boolean` on `DeploymentItemDto` in the API response
- Mark items at mapping time in `DeploymentsService` using a parsed set of IDs
- Matching is exact, case-sensitive, against the item's `id` field

**Non-Goals:**
- Wildcard or regex matching of model IDs
- Featured ordering / sorting (the existing sort-by-displayName rule is unchanged)
- Per-user or role-based featured overrides
- New catalog endpoint on the frontend

## Decisions

### Decision 1: Parse `FEATURED_MODEL_IDS` as a `Set<string>` at startup, not per-request

`FEATURED_MODEL_IDS` is a static env var — it does not change without a restart. Parsing the comma-separated string and trimming whitespace once at startup (in `EnvironmentVariables` via a `@Transform`) and storing it as `string[]` keeps the hot path in `DeploymentsService` O(1) with a `Set` lookup.

**Alternative considered**: Parse on every request. Rejected — wasteful string splitting with no benefit.

### Decision 2: Store as `string[]` in `EnvironmentVariables`, convert to `Set` in service

`class-validator` validates `string[]` cleanly. `DeploymentsService` converts to `Set<string>` once in the constructor, keeping validation logic in one place.

### Decision 3: `isFeatured` is `?: boolean` in the DTO, always emitted as `true` or `false`

`Set.has()` always returns a boolean, so the field is never `undefined` in practice even though the DTO declares it optional. This avoids a breaking change to the DTO class signature while ensuring frontend consumers always receive a boolean value.

### Decision 4: Match only against `id`, not `displayName`

IDs are stable; display names can be localised or changed. The env var description says "IDs" — in DIAL Core these are the stable string values in the `id` field.

### Decision 5: Stamp in `DeploymentsService`, not in a new service

The feature is a one-line addition to the existing `mapToDeploymentItem` helper inside `DeploymentsService`. Introducing a separate service for a single `Set.has` call would be over-engineering.

### Decision 6: Frontend uses existing `useDeployments()` pipeline

`CatalogView` already consumes `DeploymentItemDto[]` via `useDeployments()` and passes items through `mapDeploymentToCatalogItem`, which already handles `isFeatured`. No new endpoint, context, or mapper is needed on the frontend.

## Risks / Trade-offs

- **Stale featured list on env change**: If `FEATURED_MODEL_IDS` is updated, the service must restart. → Mitigation: documented in `.env.example` and `README.md`; consistent with all other env-driven config.
- **Case-sensitivity**: A mismatch between the env value and the actual DIAL Core model `id` casing silently produces `isFeatured: false`. → Mitigation: spec includes a scenario; operators must copy IDs exactly.

## Migration Plan

1. Add `FEATURED_MODEL_IDS` to `EnvironmentVariables` with `@IsOptional() @Transform(...)` to produce `string[]`.
2. In `DeploymentsService`, build `Set<string>` from `configService.get('FEATURED_MODEL_IDS') ?? []` in the constructor.
3. Add `isFeatured?: boolean` to `DeploymentItemDto` with `@ApiPropertyOptional` and set it via `featuredIds.has(raw.id)` in `mapToDeploymentItem`.
4. Rollback: remove `FEATURED_MODEL_IDS` from env — all items revert to `isFeatured: false` with no code change required.
