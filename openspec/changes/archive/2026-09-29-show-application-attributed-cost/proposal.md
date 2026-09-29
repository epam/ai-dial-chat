## Why

DIAL Core ([ai-dial-core#2032](https://redirect.github.com/epam/ai-dial-core/pull/2032), merged 2026-09-28) now attributes the cost of every model call to each ancestor deployment in the call chain — most commonly an LLM-router Application — and surfaces it through `GET /v1/user/usage` and `GET /v1/user/limits` when the caller passes `deploymentTypes=model,application`. Settings → Usage today requests models only and joins rows only against `Model` items ([map-user-usage-to-model-limits.ts:427-431](../../../libs/chat-hooks/src/usage/map-user-usage-to-model-limits.ts)), so a user who talks to a router sees the models it called but never the router itself. The SDK sync ([ai-dial-typescript-sdk#49](https://redirect.github.com/epam/ai-dial-typescript-sdk/pull/49)) merged 2026-09-29 and ships in `@epam/ai-dial-typescript-sdk@0.2.0-dev.11`, so the full path is now unblocked (tracks issue #9136).

## Problem

- The BFF `GET /api/v1/user/{limits,usage}` accepts no query parameters ([user-limits.controller.ts:49-88](../../../apps/chat-api/src/deployments/user-limits.controller.ts)), and the pinned SDK `0.1.1` types their `query` as `never`.
- Core parses `deploymentTypes` with `getParam(...).split(",")`, which reads **only the first** value of a repeated key. Both the Core OpenAPI and SDK #49 declare the parameter as a bare `type: array` (default `form`/`explode: true`), so openapi-fetch inside the SDK — and our own generated `chat-api-client` ([runtime.ts:405-408](../../../libs/chat-api-client/src/generated/src/runtime.ts)) — send `?deploymentTypes=model&deploymentTypes=application`. Forwarded naively, Core silently drops `application`.
- Application rows would render their raw id (`applications/<bucket>/My App__1.0`) and a `0 / 10M` token cell, because Core writes no token counters for applications and `total` there is the role's token budget.
- The row type caption is section-wide (`labels.modelTypeLabel`, [ModelLimitsRow.tsx:120](../../../libs/usage-dashboard/src/components/ModelLimitsSection/ModelLimitsRow.tsx)), so an agent row would be labelled "Model".
- Aggregated cost double-counts by design (a router's cost equals the sum of the model rows it called); nothing on the page says so.

## What Changes

- **SDK**: bump `@epam/ai-dial-typescript-sdk` `0.1.1` → `0.2.0-dev.11` (the first published version typing `deploymentTypes`); move to the stable `0.2.x` once it is released.
- **BFF**: new string enum `DeploymentType { Model = 'model', Application = 'application' }` and a `UserStatsQueryDto` (`deploymentTypes?: DeploymentType[]`) accepting both `a,b` and repeated-key forms. `UserLimitsController.getUserLimits` / `getUserUsage` forward it; `DeploymentsDetailsService` sends it to Core as **one comma-joined value**. When the request omits it, the BFF uses the new env variable `USER_USAGE_DEPLOYMENT_TYPES` (comma-separated, default `model,application`, validated at boot). `@ApiOperation` descriptions updated; OpenAPI + `chat-api-client` regenerated.
- **Frontend server-api**: `getUserUsage()` stays as is (no `deploymentTypes`) — the kinds shown are an operator decision owned by the BFF env, not hardcoded in the frontend.
- **`libs/chat-hooks` `mapUserUsageToModelLimits`**: joins rows against `Model` **and** `Application` items (id-normalized via `normalizeDeploymentId`), renders application token cells as `Unavailable`, and gives application cost cells a host-supplied supporting label ("Includes cost of models it called"). New optional per-row type label supplied through the translate callback.
- **`libs/usage-dashboard`**: `ModelLimitRow` gains optional `typeLabel?: string`; `ModelLimitsRow` renders it, falling back to `labels.modelTypeLabel`. The period cell's `CostValue` ([PeriodCell.tsx](../../../libs/usage-dashboard/src/components/ModelLimitsSection/PeriodCell.tsx)), which today ignores `ModelLimitMetricCell.supportingLabel`, renders it as a second line. Both additive, non-breaking.
- **i18n**: new `usage.applicationTypeLabel` ("Agent") and `usage.includesCalledModelsLabel` keys in `en.json`.
- **Docs**: `libs/chat-hooks` and `libs/usage-dashboard` READMEs, BFF endpoint descriptions.
- **Conversation-input popover**: behaviour and label unchanged. Only the inaccurate comment in [map-deployment-limits-to-input.ts:55-61](../../../libs/chat-hooks/src/catalog/map-deployment-limits-to-input.ts) is corrected (see Non-goals).

## Non-goals

- Changing `UsageLimitsControl` / `GET /v1/deployments/{name}/limits` behaviour. Source reading of Core `development@9a52fd6d` suggests that endpoint now returns `used = global spend + this deployment's aggregated cost` against the global budget (a double count for routers) — contrary to the issue's "per-deployment spend" claim. That is being verified and reported to Core separately; this change does not work around it.
- A direct/aggregated split per row (Core defers a `deploymentUsed` field).
- Routes, toolsets, interceptors (not enumerated by `deploymentTypes`).
- A per-application cost limit: none exists; an app row's cost `total` is not presented as the agent's own limit.
- Changing the aggregate top cards (`mapUsageDataToDashboard`) — they read top-level global stats, unaffected by aggregation.

## Alternatives considered

1. **Separate "Agents" section** vs. **same table with per-row type** — picked the same table (product decision): additive `typeLabel` on the row, preserves `Object.keys(deployments)` order, no new section chrome/labels. A separate section would duplicate heading/count/empty-state wiring.
2. **Hide app token cells** vs. **`Unavailable`** — picked `Unavailable` (product decision): the existing `ModelLimitMetricKind.Unavailable` already renders and announces correctly; hiding would need a new cell kind in the lib contract.
3. **Serialization**: forward the array to the SDK as-is (broken — Core reads one value) vs. custom `querySerializer` on the SDK client (affects every SDK call) vs. **comma-join at the call site** — picked comma-join: narrowest blast radius, and correct under both today's Core and a future `explode: false` spec fix. The SDK's typed `('model'|'application')[]` requires a single cast at that call, which is documented in-place.
4. **Where the default lives**: hardcode `[model, application]` in the frontend wrapper vs. forward verbatim and keep Core's `model` default vs. **server env `USER_USAGE_DEPLOYMENT_TYPES` defaulting to `model,application`** — picked the env (user decision): operators can narrow it per deployment (e.g. `model` to restore the pre-#2032 view) without a frontend build, and an explicit request value still wins.

## Acceptance criteria

- With `USER_USAGE_DEPLOYMENT_TYPES` unset, `GET /api/v1/user/usage` reaches Core as `deploymentTypes=model,application`; `=model` narrows it; an invalid value fails boot.
- `GET /api/v1/user/usage?deploymentTypes=model,application` and `?deploymentTypes=model&deploymentTypes=application` both reach Core as `deploymentTypes=model,application` (asserted on the outgoing URL in a unit test); `?deploymentTypes=route` → `400`.
- `npm run openapi:check` passes; the generated client exposes `getUserUsage({ deploymentTypes })`.
- Settings → Usage shows a router the user called as a row with its display name and icon, type caption "Agent", `Unavailable` token cells, and cost cells reading "Spent $X" with "Includes cost of models it called"; model rows are unchanged.
- A custom application whose id contains spaces resolves to its display name, not its raw id.
- Top cards and period header statuses are unchanged by adding application rows.
- `npm run validate:docs`, `chat-hooks`, `usage-dashboard`, `chat`, `chat-api` test/lint pass.

## Rollback / compatibility

Behaviour change for `/api/v1/user/{limits,usage}` callers that omit `deploymentTypes`: they now get applications too (default `model,application`). No shape change, and `typeLabel` is optional. `USER_USAGE_DEPLOYMENT_TYPES=model` restores today's view without a code revert; reverting the SDK bump requires reverting the BFF forwarding in the same commit. Against a Core older than #2032, `deploymentTypes` is ignored and the view degrades to model rows.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `user-usage-limits-api`: endpoints accept an optional `deploymentTypes` query parameter forwarded to Core as a single comma-joined value; when omitted, the BFF applies the new `USER_USAGE_DEPLOYMENT_TYPES` env default (`model,application`); applications may appear in `deployments`.
- `usage-model-limits`: the join enriches from `Model` and `Application` items with id normalization; application rows get `Unavailable` token cells, a per-row "Agent" type label, and an "includes called models" cost supporting label.
- `usage-dashboard-lib`: `ModelLimitRow` gains optional `typeLabel`, rendered in place of `labels.modelTypeLabel` when present; the Cost value renders a host-supplied `supportingLabel`.

## Impact

- **Code**: `apps/chat-api/src/deployments/{user-limits.controller.ts,details/deployments-details.service.ts,dto/}`, `apps/chat-api/package.json`, `apps/chat/src/pages/SettingsPage/UsageTab/UsageTab.tsx`, `apps/chat/src/constants/translation-keys.ts`, `apps/chat/src/i18n/locales/en.json`, `libs/chat-hooks/src/usage/map-user-usage-to-model-limits.ts`, `libs/chat-hooks/src/catalog/map-deployment-limits-to-input.ts` (comment only), `libs/usage-dashboard/src/{models/model-limits-props.ts,components/ModelLimitsSection/ModelLimitsRow.tsx,components/ModelLimitsSection/PeriodCell.tsx}`.
- **Generated**: OpenAPI spec + `libs/chat-api-client`.
- **Dependencies**: `@epam/ai-dial-typescript-sdk` to a `-dev` prerelease (follow-up to stable).
- **Shared libs (scope flag)**: two libs change. Isolation holds — `chat-hooks` still receives resolvers/translate from the host and uses only the generated DTO types (second/fourth exceptions); `usage-dashboard` receives a preformatted string and knows nothing about deployment types.
- **Config**: new env variable `USER_USAGE_DEPLOYMENT_TYPES` (`EnvironmentVariables`, `apps/chat-api/README.md`, `apps/chat-api/.env.template`).
- **i18n**: two new user-visible strings.
