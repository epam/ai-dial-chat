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
`libs/chat-hooks` (see the `usage-model-limits` and `usage-data-hook` capabilities), under the
narrow `chat-hooks` DIAL-Core-response-adapter exception recorded in AGENTS.md §Library isolation —
never in this presentational package itself.

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

> Non-requirement edit applied with this delta: the capability's `## Purpose` paragraph in
> `openspec/specs/usage-dashboard-lib/spec.md` names `apps/chat` as the DTO-interpretation owner. It
> is updated to name `libs/chat-hooks`, matching the requirement text above, so the spec does not
> contradict itself after archiving.

