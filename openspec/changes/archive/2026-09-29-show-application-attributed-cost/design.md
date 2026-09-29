## Context

DIAL Core #2032 records, for every ancestor in a call chain, the cost its descendants incurred (`{name}/aggregated-costs`), and merges it into the same `*CostStats.used` fields the usage/limits APIs already return. `GET /v1/user/{usage,limits}` enumerate applications only when asked with `deploymentTypes=…application`. SDK #49 types that parameter; it first ships in `@epam/ai-dial-typescript-sdk@0.2.0-dev.11` (`latest` is still `0.1.2`; we pin `0.1.1`).

Current state in this repo:

- BFF: `UserLimitsController` ([user-limits.controller.ts](../../../apps/chat-api/src/deployments/user-limits.controller.ts)) takes no query; `DeploymentsDetailsService.getUserLimits/getUserUsage(accessToken)` call the SDK with headers only. The closest query-DTO precedent is `DeploymentsQueryDto` ([deployments-query.dto.ts](../../../apps/chat-api/src/deployments/dto/deployments-query.dto.ts)), which comma-splits `interface_type`.
- Frontend: `getUserUsage` ([user-limits.ts:4](../../../apps/chat/src/server-api/user-limits.ts)) is a module-level constant passed to `useUsageData` in [UsageTab.tsx:56](../../../apps/chat/src/pages/SettingsPage/UsageTab/UsageTab.tsx).
- Adapter: `mapUserUsageToModelLimits` ([map-user-usage-to-model-limits.ts](../../../libs/chat-hooks/src/usage/map-user-usage-to-model-limits.ts)) joins against `Model` items by raw id.
- Lib: `ModelLimitsRow` renders the section-wide `labels.modelTypeLabel`; `PeriodCell`'s private `CostValue` renders `usedLabel` only and ignores `supportingLabel` (only `MetricCell`'s Unlimited branch, used for Tokens, renders it).

Verified upstream behaviour that shapes the design (Core `development@9a52fd6d`):

- `LimitController#getDeploymentTypes`: `Set.of(getParam("deploymentTypes", "model").split(","))` — single-value read.
- Core/SDK OpenAPI declares the param as a bare `type: array` → openapi-fetch (SDK) and our generated `chat-api-client` (`runtime.ts` `querystringSingleKey`) both emit repeated keys.
- `RateLimiter#getLimitStats` (the `/v1/deployments/{name}/limits` path) sums the **global** `costs` record and `{name}/aggregated-costs`. Suspected double count for routers — out of scope here, verified and reported separately.

## Goals / Non-Goals

**Goals:**

- Settings → Usage shows every application (router) the user used this period as a named, iconed row with its attributed cost, labelled as an agent and annotated as including the models it called.
- The BFF exposes `deploymentTypes` faithfully and survives the Core/SDK serialization mismatch.
- No change to the top cards, period headers, model rows, or the conversation-input popover.

**Non-Goals:**

- Working around the suspected per-deployment-limits double count in `UsageLimitsControl`.
- Direct vs. aggregated split, per-application cost limits, routes/toolsets/interceptors.
- A `getUserLimits()` frontend wrapper (spec'd previously, never implemented, no consumer).

## Decisions

### D1 — Comma-join at the SDK call site

`DeploymentsDetailsService` builds `deploymentTypes?.length ? { query: { deploymentTypes: [...new Set(types)].join(',') } } : undefined` and passes it as `params`. The SDK types the value as an array, so one cast is needed; it carries a block comment citing `LimitController#getDeploymentTypes`.

- *Alt: pass the array through* — openapi-fetch sends repeated keys; Core reads only the first. Rejected: silent data loss.
- *Alt: per-request `querySerializer: { array: { style: 'form', explode: false } }`* — openapi-fetch supports it, but the SDK's `SDKOperationInit` (`Omit<SDKRequestInit,'body'|'params'>`) does not type it, so it needs a cast too, and relies on the SDK spreading `init` into `client.GET` unchanged — an implementation detail. Rejected.
- *Alt: global `querySerializer` on the shared SDK client in `AppService`* — changes serialization for every DIAL call. Rejected: blast radius.
- A joined string is also what a future Core spec fix (`explode: false`) would emit, so this stays correct if upstream is fixed; the cast can then be removed.

### D2 — DTO accepts both input forms; default kinds come from env

`UserStatsQueryDto` follows `DeploymentsQueryDto`: `@Transform` accepting `string` (split, trim, drop empty) and `string[]` (flatten each through the same split), then `@IsOptional @IsArray @IsEnum(DeploymentType, { each: true })`. The generated `chat-api-client` sends repeated keys, so the array branch is exercised by our own frontend. Controllers stay thin: `@Query() query: UserStatsQueryDto` → `deploymentsService.getUserUsage(at, query.deploymentTypes)`.

Omitted/empty → `DeploymentsDetailsService` resolves `requested?.length ? requested : configService.get('USER_USAGE_DEPLOYMENT_TYPES', { infer: true })`, so the fallback lives in one place for both endpoints. `USER_USAGE_DEPLOYMENT_TYPES` is a new optional `EnvironmentVariables` field: the same comma-split `@Transform` as `ADMIN_ROLE_NAMES`, `@IsEnum(DeploymentType, { each: true })`, class default `[Model, Application]` — an invalid value fails boot (see `apps/chat-api/AGENTS.md` env rules). `DeploymentType` lives in `apps/chat-api/src/deployments/dto/deployment-type.ts` and is imported by both the query DTO and `environment.config.ts` (the file imports nothing, so no cycle; it also holds the shared `normalizeDeploymentTypesInput` used by both; `CspMode` is the precedent for an enum-typed env var).

*Alt: frontend passes `[model, application]`, BFF forwards verbatim* — the originally planned shape; rejected by user decision: the kinds shown are an operator choice, changeable per deployment without a frontend build (`=model` restores the pre-#2032 view). *Alt: no default, Core's `model` governs* — would leave applications invisible unless every caller opts in. `@ApiPropertyOptional({ enum: DeploymentType, isArray: true, enumName: … })` is omitted so the generator keeps its per-operation inline enum convention (`ListDeploymentsInterfaceTypeEnum` precedent).

### D3 — Application-row logic lives in the `chat-hooks` adapter

Covered by AGENTS.md §Library isolation, fourth exception: the rule is driven entirely by the generated response's own shape (`DeploymentItemDto.type === Application`, Core's documented absence of token counters for apps), the adapter already has a behaviour-preserving characterization suite, and every DIAL-Core-backed host consumes it identically. Translated strings still arrive through the caller's `t`; icon/name resolution through `resolveIconUrl` / `resolveDisplayName`. No new callback is needed.

Implementation shape inside `mapUserUsageToModelLimits`:

- `itemByNormalizedId = new Map(items.filter(Model|Application).map(i => [normalizeDeploymentId(i.id), i]))`, looked up by `normalizeDeploymentId(key)`. `normalizeDeploymentId` already lives in `libs/chat-hooks` (`deployment-id.ts`), so no new import edge.
- `isApplication = item?.type === Application`. Application rows: token cells = `buildUnavailableCell(t)`; cost cells from `buildCostMetricCell`, then — if `Unlimited` — `supportingLabel = t(includesCalledModelsLabel)`; `typeLabel = t(applicationTypeLabel)`; usage filter over cost stats only.
- Model rows: untouched code path; the characterization tests must stay green without edits.

*Alt: detect applications by id prefix `applications/`* — config-defined applications have bare names (`llm-router`), so a prefix test misses them. Rejected; the item's `type` is authoritative, and an unmatched id falls back to a model row (existing behaviour).

### D4 — Presentation changes in `usage-dashboard` are two optional strings

- `ModelLimitRow.typeLabel?: string` → `ModelLimitsRow` renders `row.typeLabel || labels.modelTypeLabel`.
- `CostValue` renders `cell.supportingLabel` as a second line (same `secondaryValue` slot, `break-words`) when present and the cell is not `Unavailable`.

Both are host-preformatted strings; the lib never learns what a deployment kind is. No new style slot, no new label key in `ModelLimitsLabels`, no RTL impact (no physical classes, no icons). Accessibility: plain text in reading order after the existing sr-only `Cost:` prefix; no `aria-label` override, so the note is not hidden.

*Alt: separate "Agents" section* — rejected by product decision; would duplicate heading/count/empty-state wiring and split one `Object.keys(deployments)` order into two.

### D5 — SDK: take the prerelease now

Bump to `0.2.0-dev.11` exactly (repo pins exact SDK versions). Before wiring, diff the SDK's public `.d.ts` between `0.1.1` and `0.2.0-dev.11` for call sites the BFF uses and run the full `chat-api` suite. A follow-up task moves to the first stable `0.2.x`.

### D6 — Popover: comment-only

`UsageLimitsControl` behaviour, `costGroup` label, and the `conversation-input-usage-limits` spec stay as they are (product decision). The comment in `map-deployment-limits-to-input.ts:55-61` and the `costGroup` JSDoc are corrected to describe what Core actually returns (global spend plus this deployment's aggregated cost, against the global budget) and to point at the upstream report, so the next reader does not rely on the stale "same figures whichever deployment" claim.

### Frontend wiring

`getUserUsage` in `user-limits.ts` is unchanged — it sends no `deploymentTypes`, so the BFF env default decides; its module-level identity (required by `useUsageData`'s effect deps) is untouched. `UsageTab` needs two new label keys wired through `t` only — no new `useMemo` deps (the adapter's memo already depends on `t`). Loading/empty/error states are the existing `useUsageData` ones: application rows add no new state; an empty `deployments` still renders `emptyStateLabel`.

## Risks / Trade-offs

- **Prerelease SDK in production** → pin exact `0.2.0-dev.11`, diff the typed surface before wiring, keep a tracked follow-up to stable. Rollback: revert the bump together with D1/D2.
- **Cast on the SDK call** → one cast, commented, unit-tested on the outgoing URL (assert a single `deploymentTypes` key). Removable once Core declares `explode: false`.
- **Router cost looks like it double-counts vs. model rows** → by design; the "Includes cost of models it called" line, no row totals anywhere, and top cards read only top-level global stats.
- **Custom-app id encoding mismatch between `/user/usage` keys and `/deployments` item ids** → normalize both sides; a characterization test covers raw↔encoded in both directions. If a key still fails to match, the row degrades to its raw id (existing behaviour), not to a crash.
- **Larger Core response / slower `/user/usage`** → Core lists custom apps by name only (`listDeploymentNames`), no content parsing; one request per Usage visit as today.
- **Older Core without #2032** → it ignores unknown query params; Usage shows models only. No error path.
- **Default now includes applications for every omitting caller** → any other consumer of `/api/v1/user/{limits,usage}` gets extra entries; the frontend has no other consumer today, and `USER_USAGE_DEPLOYMENT_TYPES=model` is the operator kill switch.
- **Bad env value** → boot fails loudly (validated), never silently falls back.
- **Core later adds token counters for apps** → rows would still show `Unavailable` until the adapter rule is revisited; acceptable, and the rule is isolated in one branch.

## Migration Plan

Single PR, deployable independently of Core rollout order (older Core ignores the param). Order of slices: SDK bump → BFF DTO/forwarding + tests → OpenAPI regen → lib (`usage-dashboard`) → adapter (`chat-hooks`) → app wiring + i18n → comment fix → docs. Rollback: revert the PR; no persisted state or schema is involved.

## Open Questions

- Suspected Core double count on `/v1/deployments/{name}/limits` — verify, then file upstream (tracked outside this change).
- Core/SDK spec should declare `deploymentTypes` with `explode: false`; file alongside the above so the D1 cast can later be removed.
- Stable SDK `0.2.x` release date — drives the follow-up bump.
