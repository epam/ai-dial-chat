## MODIFIED Requirements

### Requirement: Host-agnostic usage-dashboard library

The system SHALL provide a buildable React library `libs/usage-dashboard`
(package `@epam/ai-dial-usage-dashboard`, Nx tag `type:ui`), scaffolded via an Nx generator and
matching the inferred-target structure used by `libs/settings-panel` (no hand-written
`project.json`; `package.json` carries `"nx": { "tags": ["type:ui"] }`; build/test come from the
`@nx/vite` and `@nx/vitest` inferred plugins via `vite.config.mts`). The library SHALL import only
`react`, `react-dom`, `@epam/ai-dial-ui-kit`, `@epam/ai-dial-chat-shared`, and
`@tabler/icons-react` as peer/runtime dependencies.

The library SHALL NOT depend on `@epam/ai-dial-chat-api-client` in any form. It SHALL NOT appear in
`package.json` (`dependencies`, `peerDependencies`, or `optionalDependencies`), in a
`tsconfig.lib.json` project reference, or in a `vite.config.mts` resolve/test alias. The narrow
generated-client exceptions recorded in AGENTS.md §Library isolation cover `libs/chat-api-client` and
`libs/chat-hooks` only; they do not extend to this presentational package.

The library SHALL render already-normalized display models supplied by its host. All interpretation
of DIAL Core responses — generated DTO field selection, the unlimited sentinel
(`total >= 2 ** 53`), status thresholds, currency and number formatting, deployment-type filtering,
locale and icon resolution, and reset-time formatting — SHALL happen in host-owned adapters outside
this library. The host passes the results in through `UsageLimitCardData`, `ModelLimitRow`,
`ModelLimitPeriodStatuses`, and the components' label props; in AI DIAL Chat those adapters live in
`apps/chat/src/utils/` (see the `usage-model-limits` and `usage-data-hook` capabilities).

The library SHALL NOT import any `server-api/*` wrapper, any app
context/hook/feature-flag/env/routing/storage/analytics module, or `react-i18next`. Every
user-visible string SHALL arrive as a prop; no component SHALL accept a translate callback, a
locale, a timezone, or a raw timestamp.

#### Scenario: Module boundary lint passes
- **WHEN** `npm exec nx lint usage-dashboard` runs
- **THEN** `@nx/enforce-module-boundaries` reports no violations, confirming the library depends
  only on `chat-shared`-tier, UI-kit, and `@tabler/icons-react` packages

#### Scenario: No generated-client, server-api, or i18n imports
- **WHEN** the library's source is inspected
- **THEN** no file imports `@epam/ai-dial-chat-api-client` or any of its subpaths,
  `apps/chat/src/server-api/*`, or `react-i18next`/`i18next`

#### Scenario: Manifest and build configuration carry no client edge
- **WHEN** `libs/usage-dashboard/package.json`, `tsconfig.lib.json`, and `vite.config.mts` are
  inspected
- **THEN** none of them names `@epam/ai-dial-chat-api-client` as a dependency, a peer, a project
  reference, or an alias

## ADDED Requirements

### Requirement: Generated-client imports are mechanically prevented from returning

The repository SHALL enforce the library's generated-client boundary with checks that fail a build
or test run, rather than relying on review. The enforcement SHALL be scoped to this boundary and
SHALL reuse existing repository conventions; it SHALL NOT introduce a new repository-wide
architecture-rule framework, tag hierarchy, or dependency-analysis layer.

Two checks SHALL be in place:

1. **Source and barrel.** `libs/usage-dashboard/eslint.config.mjs` SHALL declare a project-scoped
   `no-restricted-imports` rule rejecting `@epam/ai-dial-chat-api-client` and its subpaths, so a
   direct import or a re-export through `src/index.ts` fails `npm exec nx lint usage-dashboard`.
   The existing `@nx/dependency-checks` configuration in that file SHALL continue to fail an import
   the manifest does not declare, covering the same boundary from the manifest side.
2. **Emitted artifacts and real installation.** A packed-consumer check SHALL scan the library's
   built `dist/**/*.js` and `dist/**/*.d.ts` for the `@epam/ai-dial-chat-api-client` specifier and
   for re-exported generated DTO type names, and SHALL install the packed tarball into a dependency
   tree isolated from the workspace's own `node_modules` and `@epam/source` aliases, containing only
   the library's documented peers and deliberately **not** the generated client. It SHALL follow the
   shape of the existing `tools/attachment-canvas-consumer-fixture` and
   `tools/reusable-workflows-consumer-fixture` projects and reuse
   `libs/chat-hooks/e2e-fixtures/harness.mjs`, because an in-checkout fixture would let an
   "uninstalled" peer resolve from the workspace root and pass for the wrong reason.

#### Scenario: A reintroduced source import fails lint
- **WHEN** a file under `libs/usage-dashboard/src/**` imports a value or type from
  `@epam/ai-dial-chat-api-client`
- **THEN** `npm exec nx lint usage-dashboard` fails, naming the restricted import

#### Scenario: A leak through the barrel or an emitted declaration fails the artifact scan
- **WHEN** the library is built and its `dist` JavaScript or `.d.ts` output references
  `@epam/ai-dial-chat-api-client` or re-exports a generated DTO type name
- **THEN** the packed-consumer check fails and names the offending emitted file

#### Scenario: A consumer installs and renders without the generated client
- **WHEN** the packed tarball is installed into an isolated tree holding only the documented peers
  (`react`, `@epam/ai-dial-chat-shared`, `@epam/ai-dial-ui-kit`, and their own required peers), with
  no `@epam/ai-dial-chat-api-client` and no workspace alias
- **THEN** the consumer typechecks, bundles, imports `./styles.css`, and renders
  `UsageLimitCardGroup` and `ModelLimitsSection` from normalized fixture data

## REMOVED Requirements

### Requirement: mapUsageDataToDashboard utility

**Reason**: The utility interprets `UserLimitStatsResponseDto` and `LimitStatsDto` from
`@epam/ai-dial-chat-api-client` and applies the DIAL Core unlimited sentinel, which is host-owned
knowledge under AGENTS.md §Library isolation. The requirement is not deleted as behaviour: every
mapping, omission, sentinel, threshold and reset-field rule it defined is restated against the
app-owned adapter in the `usage-data-hook` delta of this change.

**Migration**: **BREAKING.** `mapUsageDataToDashboard` and `USAGE_DATA_I18N_KEYS` are removed from
`@epam/ai-dial-usage-dashboard`'s public API, along with the types `FormatResetTime` and
`ResetTimeDisplayLike` that existed only to serve them. No compatibility wrapper is kept, because a
DTO-bound wrapper would preserve the coupling this change removes. AI DIAL Chat's replacement is
`apps/chat/src/utils/map-usage-data-to-dashboard.ts`, which is the reference implementation for any
other host: copy it into the host's own edge code, substitute the host's own translation-key source
for `USAGE_DATA_I18N_KEYS` and its own reset-time display type for `ResetTimeDisplayLike`, and keep
passing the resulting `UsageLimitCardData[]` to `UsageLimitCardGroup`'s unchanged `cards` prop. A
host that only renders cards from data it already normalizes is unaffected.

### Requirement: mapUserUsageToModelLimits utility

**Reason**: The utility imports four generated DTOs plus the **runtime** value
`DeploymentItemDtoTypeEnum`, which is what forces `@epam/ai-dial-chat-api-client` into the
library's `dependencies` and therefore into every host's install. Its behavioural rules —
period-to-field mapping, the `usage.deployments` join, model-only enrichment, row ordering,
exclusion of rows without positive usage, and cell classification — are already owned by the
`usage-model-limits` capability and remain in force there against the app-owned adapter.

**Migration**: **BREAKING.** `mapUserUsageToModelLimits` and `USAGE_MODEL_LIMITS_I18N_KEYS` are
removed from the public API. AI DIAL Chat's replacement is
`apps/chat/src/utils/map-user-usage-to-model-limits.ts`. A host copies that adapter, supplies its own
translation keys and its own `resolveIconUrl` / `resolveDisplayName` equivalents, and keeps passing
the resulting `ModelLimitRow[]` to `ModelLimitsSection`'s unchanged `rows` prop. `ModelLimitRow`,
`ModelLimitPeriodCell`, `ModelLimitMetricCell`, `ModelLimitMetricKind` and `ModelLimitStatus` remain
exported.

### Requirement: mapOverallCostLimitsToPeriodStatuses utility

**Reason**: Same coupling — it reads the top-level `dayCostStats` / `weekCostStats` /
`monthCostStats` fields of `UserLimitStatsResponseDto` and applies the unlimited sentinel and
status thresholds. Its behavioural rules are restated against the app-owned adapter in the
`usage-model-limits` delta of this change.

**Migration**: **BREAKING.** `mapOverallCostLimitsToPeriodStatuses` is removed from the public API.
AI DIAL Chat's replacement lives in `apps/chat/src/utils/map-user-usage-to-model-limits.ts`
alongside the row adapter, since the two share the period-status derivation. A host copies it and
keeps passing the resulting `ModelLimitPeriodStatuses` to `ModelLimitsSection`'s unchanged
`periodStatuses` prop. `ModelLimitPeriodStatus` and `ModelLimitPeriodStatuses` remain exported.

> Non-requirement edit applied with these deltas: the capability's `## Purpose` paragraph and the
> `**Utilities**` section preamble in `openspec/specs/usage-dashboard-lib/spec.md` both state that
> the library exports three DTO-interpreting transform utilities. Both are updated to describe a
> render-only library, so the spec does not contradict the requirements above after archiving.
