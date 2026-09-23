## MODIFIED Requirements

### Requirement: Library isolation between apps/chat and libs
`useUsageData` SHALL live in `libs/chat-hooks` and SHALL NOT import `apps/chat/src/server-api/*`,
any app context, routing, auth/session/cookies, environment variables, feature flags, or
`react-i18next`. It accepts `getUserUsage: () => Promise<UserLimitStatsResponseDto>` as a parameter
so all DIAL Core wiring stays in the app. The app passes `getUserUsage` from
`apps/chat/src/server-api/user-limits.ts` and the generated `UserLimitStatsResponseDto` type from
`@epam/ai-dial-chat-api-client` without modification. This hook's contract is unchanged by the
adapter relocation described below.

All DTO interpretation — generated field selection, the unlimited-sentinel check
(`total >= 2 ** 53`), status-threshold derivation, currency and compact-number formatting, the
`DeploymentItemDtoTypeEnum.Model` filter, and the deployment join — SHALL live in the adapters
`map-usage-data-to-dashboard.ts` and `map-user-usage-to-model-limits.ts` under
`libs/chat-hooks/src/usage/`, exported from `@epam/ai-dial-chat-hooks`'s `./utils` entry point — the
narrow, explicitly justified location recorded in AGENTS.md §Library isolation. It SHALL NOT live in
`libs/usage-dashboard` or any other hand-authored library outside that recorded exception. The
`Usage` tab component imports those adapters from `@epam/ai-dial-chat-hooks` and imports
`UsageLimitCardGroup` / `ModelLimitsSection` and their normalized display types from
`@epam/ai-dial-usage-dashboard`, passing app-owned callbacks (`resolveCatalogIconUrl`,
`resolveLocalizedText`, `formatUsageResetTime`) into the adapters so host-specific URL construction,
locale resolution, and date/time formatting stay at the application edge.

`libs/usage-dashboard` SHALL NOT declare or import `@epam/ai-dial-chat-api-client` in source, barrel,
`package.json`, `tsconfig.lib.json`, or `vite.config.mts`, and SHALL NOT import any `server-api/*`
wrapper or app context/hook/feature-flag/env/routing/storage/analytics module. It renders the
normalized cards, rows, and period statuses it is given (see the `usage-dashboard-lib` capability).

#### Scenario: Static analysis passes module boundary lint
- **WHEN** `npm exec nx lint chat`, `npm exec nx lint chat-hooks`, and `npm exec nx lint usage-dashboard` run
- **THEN** `@nx/enforce-module-boundaries` reports no violations introduced by `useUsageData`, the
  `Usage` tab component, or the usage adapters, and the project-scoped
  `no-restricted-imports` rule in `libs/usage-dashboard/eslint.config.mjs` reports no restricted
  generated-client import

#### Scenario: Usage adapters live inside their recorded exception
- **WHEN** the repository is searched for the usage DTO mappers
- **THEN** they exist only under `libs/chat-hooks/src/usage/`, and no hand-authored library outside
  `libs/chat-hooks` and `libs/chat-api-client` exports a function taking
  `UserLimitStatsResponseDto`, `DeploymentLimitsResponseDto`, `LimitStatsDto`, or
  `DeploymentItemDto`

#### Scenario: useUsageData behaviour is unaffected by the relocation
- **WHEN** the Usage tab mounts, refetches on a `refreshToken` bump, and unmounts
- **THEN** the hook's fetch lifecycle, stale-request handling, `isLoading`/`usageError` outputs, and
  subscription lifetimes are the same as before the adapters moved, with no fetch added or removed

> Non-requirement edit applied with this delta: the capability's `## Purpose` paragraph in
> `openspec/specs/usage-data-hook/spec.md` states that "all data-fetching and DTO interpretation
> stays in `apps/chat`." It is updated to say DTO interpretation lives in `libs/chat-hooks`
> (data-fetching via `useUsageData` remains as described), matching the requirement above, so the
> spec does not contradict itself after archiving.
