## MODIFIED Requirements

### Requirement: Host-agnostic usage-dashboard library

The system SHALL provide a buildable React library `libs/usage-dashboard`
(package `@epam/ai-dial-usage-dashboard`, Nx tag `type:ui`), scaffolded via an Nx generator and
matching the inferred-target structure used by `libs/settings-panel` (no hand-written
`project.json`; `package.json` carries `"nx": { "tags": ["type:ui"] }`; build/test come from the
`@nx/vite` and `@nx/vitest` inferred plugins via `vite.config.mts`). The library SHALL import only
`react`, `react-dom`, `@epam/ai-dial-ui-kit`, `@epam/ai-dial-chat-shared`, and
`@tabler/icons-react` as peer/runtime dependencies — the last for its own internal empty-state icon
(a generic, host-agnostic glyph chosen by the library itself, not supplied by the host), matching
the same peer already declared by `@epam/ai-dial-scheduled-tasks` for its equivalent empty state. It
SHALL NOT import `@epam/ai-dial-chat-api-client`, any `server-api/*` wrapper, any app
context/hook/feature-flag/env/routing/storage/analytics module, or `react-i18next`.

#### Scenario: Module boundary lint passes
- **WHEN** `npm exec nx lint usage-dashboard` runs
- **THEN** `@nx/enforce-module-boundaries` reports no violations, confirming the library depends
  only on `chat-shared`-tier, UI-kit, and `@tabler/icons-react` packages

#### Scenario: No generated-client or i18n imports
- **WHEN** the library's source is inspected
- **THEN** no file imports `@epam/ai-dial-chat-api-client`, `apps/chat/src/server-api/*`, or
  `react-i18next`/`i18next`

---

### Requirement: ModelLimitsSection public API

The library SHALL export from `src/index.ts`, in addition to its existing `UsageLimitCardGroup`/
`UsageLimitCard` surface: the component `ModelLimitsSection`; the string enums `ModelLimitStatus`
(`WithinLimits = 'within-limits'`, `RunningLow = 'running-low'`, `LimitReached = 'limit-reached'`,
`NoLimit = 'no-limit'`, `Unavailable = 'unavailable'`), `ModelLimitsPeriod`
(`LastMinute = 'last-minute'`, `LastHour = 'last-hour'`, `Last24Hours = 'last-24-hours'`,
`Last7Days = 'last-7-days'`, `Last30Days = 'last-30-days'`), and
`ModelLimitMetricKind` (`Finite = 'finite'`, `Unlimited = 'unlimited'`, `Unavailable = 'unavailable'`);
and the types `ModelLimitMetricCell`, `ModelLimitRow`, `ModelLimitsLabels`, `ModelLimitsColors`,
`ModelLimitsTypography`, `ModelLimitsStyles`, `ModelLimitsSectionProps`.

`ModelLimitMetricCell` SHALL carry a `kind: ModelLimitMetricKind` discriminant
plus already-formatted, normalized fields: `usedLabel?: string` (finite/unlimited), `totalLabel?:
string` (finite only), `usedPercent?: number` (finite only, not pre-clamped), `status?:
ModelLimitStatus` (finite only — `WithinLimits`/`RunningLow`/`LimitReached`), and `ariaLabel: string`
(always present, describing the cell's full accessible text regardless of kind). The library SHALL
treat `usedPercent` as opaque, used only to drive the progress bar's `value`/`aria-valuetext`, and
SHALL NOT recompute it, detect the unlimited sentinel, or derive `status` itself.

`ModelLimitRow` SHALL carry: `id: string`, `name: string`, `version?: string`, `avatarSrc?: string`,
`cost: ModelLimitMetricCell`, `tokens: ModelLimitMetricCell`, `requests: ModelLimitMetricCell`, and
`status: ModelLimitStatus` (the host-derived overall row status, including `NoLimit`/`Unavailable`).

`ModelLimitsLabels` SHALL additionally carry `emptyStateLabel: string` — the message rendered in
place of the table body when `rows` is empty.

`ModelLimitsSectionProps` SHALL accept: `rows: ModelLimitRow[]` (in display order), `period:
ModelLimitsPeriod`, `onPeriodChange: (period: ModelLimitsPeriod) => void`, `labels:
ModelLimitsLabels`, an optional `styles?: ModelLimitsStyles`, and an optional
`emptyStateIconSize?: number` (pixel size of the internal empty-state icon; defaults to `48`).

#### Scenario: Section exports are available
- **WHEN** a consumer imports from `@epam/ai-dial-usage-dashboard`
- **THEN** `ModelLimitsSection`, `ModelLimitStatus`, `ModelLimitsPeriod`, `ModelLimitMetricKind`,
  `ModelLimitMetricCell`, `ModelLimitRow`, `ModelLimitsLabels`, `ModelLimitsColors`,
  `ModelLimitsTypography`, `ModelLimitsStyles`, and `ModelLimitsSectionProps` are all importable

#### Scenario: Multiple rows rendered in order
- **WHEN** `ModelLimitsSection` is rendered with a `rows` array of two or more entries
- **THEN** it renders one row per entry, in array order, each showing its own avatar, name,
  version, and Cost/Tokens/Requests/Status cells

#### Scenario: Empty rows renders the section shell with a visible empty-state message, selector still usable
- **WHEN** `ModelLimitsSection` is rendered with an empty `rows` array
- **THEN** it still renders the heading (with a count of `0`) and the period selector — fully
  interactive, so the user can pick a different period — and renders `labels.emptyStateLabel` with
  an icon in place of the column headers and data rows, rather than rendering blank space or
  omitting the section

#### Scenario: Changing the period from an empty result still calls back
- **WHEN** `ModelLimitsSection` is rendered with an empty `rows` array and the user selects a
  different period from the still-visible selector
- **THEN** `onPeriodChange` is called with the newly selected `ModelLimitsPeriod`, exactly as it
  would be if `rows` were non-empty
