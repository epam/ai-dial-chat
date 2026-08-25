## 1. Library comparison-table contract and rendering

Slicing strategy: vertical. First migrate the host-agnostic table contract/rendering as a complete,
tested library slice; then migrate the app mapper and Usage integration end to end; finally update
documentation/localization and run affected verification. Each slice must compile and be verified
before widening scope.

- [x] 1.1 In `libs/usage-dashboard/src/models/model-limits-props.ts` and
  `libs/usage-dashboard/src/index.ts`, add/export `ModelLimitPeriodCell`, replace
  `ModelLimitRow.cost/tokens/requests` with `last24Hours/last7Days/last30Days`, update fixed-column
  labels and `ModelLimitsSectionProps`, and remove the supported `ModelLimitsPeriod`, `period`, and
  `onPeriodChange` contract.
- [x] 1.2 Refactor
  `libs/usage-dashboard/src/components/ModelLimitsSection/ModelLimitsSection.tsx` to remove
  `SegmentedControl` and render the fixed Item / Last 24 hours / Last 7 days / Last 30 days / Status
  header while preserving heading/count and internal empty state.
- [x] 1.3 Refactor
  `libs/usage-dashboard/src/components/ModelLimitsSection/ModelLimitsRow.tsx` and
  `libs/usage-dashboard/src/components/ModelLimitsSection/MetricCell.tsx` (or a narrowly named
  period-cell component beside them) so each period cell renders labelled Tokens progress/state and
  Cost value/state, while Status renders only the host-provided aggregate.
- [x] 1.4 Update
  `libs/usage-dashboard/src/components/ModelLimitsSection/ModelLimitsSection.module.scss` and
  Tailwind classes to use mobile-first stacked rows and a shared five-track `desktop:` grid; use only
  logical directional properties/classes, preserve long-value handling, keep all mobile touch/read
  targets usable, and prevent page-level overflow at 360px.
- [x] 1.5 Update
  `libs/usage-dashboard/src/components/ModelLimitsSection/tests/ModelLimitsSection.spec.tsx` with
  role/label/text assertions for exact fixed headers, three simultaneous period cells, Tokens + Cost
  grouping, finite/unlimited/unavailable rendering, uncapped accessible progress values, row Status,
  zero-row empty state, semantic reading order, and absence of the period selector/Requests.
- [x] 1.6 Verify slice 1 with `npm exec nx test usage-dashboard`,
  `npm exec nx lint usage-dashboard`, and `npm exec nx typecheck usage-dashboard`.

## 2. App mapper and Usage integration

- [x] 2.1 Refactor `apps/chat/src/utils/map-user-usage-to-model-limits.ts` to remove its
  `ModelLimitsPeriod` argument and create fixed day/week/month `ModelLimitPeriodCell` values in one
  pass, reusing existing usable-stat checks, unlimited classification, token/cost formatting, locale
  enrichment, and extensionless relative TypeScript imports.
- [x] 2.2 In the same mapper, replace selected-period filtering with the all-displayed-period
  predicate (any usable non-zero day/week/month Cost or Tokens stat) and aggregate row Status from
  the three token cells only using `LimitReached > RunningLow > WithinLimits`, then NoLimit and
  Unavailable fallbacks.
- [x] 2.3 Update `apps/chat/src/utils/tests/map-user-usage-to-model-limits.spec.ts` to cover field
  pairing for all three windows, no minute/hour/request influence, non-zero usage in any period,
  cost-only row inclusion, all-empty exclusion, missing/malformed stats, over-limit values, and the
  complete cross-period Status precedence/fallback matrix.
- [x] 2.4 Update `apps/chat/src/pages/SettingsPage/UsageTab/UsageTab.tsx` to remove local period state
  and selector props, memoize the fixed comparison rows from existing dependencies, and pass reused
  localized period/Item/Status/Tokens/Cost/state labels without altering cards, loading, errors,
  feature gating, or data fetching.
- [x] 2.5 Update `apps/chat/src/pages/SettingsPage/UsageTab/tests/UsageTab.spec.tsx` to assert the
  fixed normalized rows/labels contract, absence of period callbacks, unchanged aggregate cards and
  loading/error behavior, and section rendering for zero rows.
- [x] 2.6 Verify slice 2 with the focused app mapper and UsageTab tests through the existing `chat`
  Nx test target, followed by `npm exec nx lint chat` and `npm exec nx typecheck chat`.

## 3. Localization, RTL, library isolation, and public documentation

- [x] 3.1 Audit `apps/chat/src/constants/translation-keys.ts` and
  `apps/chat/src/i18n/locales/en.json`: reuse the existing Last 24 hours / Last 7 days / Last 30 days
  / Tokens / Cost labels, remove selector/minute/hour/Requests keys only if `rg` proves them unused,
  and add no new key unless implementation exposes an otherwise-unlabelled user-visible string.
- [x] 3.2 Perform the dedicated RTL/responsive code check across
  `libs/usage-dashboard/src/components/ModelLimitsSection/**`: base styles are mobile-first,
  desktop overrides use only `desktop:`, directional layout uses logical properties, no
  `window.innerWidth` or duplicate breakpoint subtree is introduced, and no directional icon needs
  mirroring; cover stable DOM semantics in component tests.
- [x] 3.3 Enforce the `libs/*` architecture guard by verifying `libs/usage-dashboard/src/**` contains
  no `/api` path, generated-client/server-api/app-context import, auth/session/cookie/env/feature
  flag, route/navigation, storage, analytics/telemetry/logging client, deployment-provider/tenant,
  SDK, platform bridge, locale resolver, currency formatter, DTO field name, or status threshold;
  all such host knowledge must remain normalized through app-provided rows and labels.
- [x] 3.4 Update `libs/usage-dashboard/README.md` to document the fixed comparison contract and a
  type-accurate `ModelLimitsSection` example containing all three period cells, Tokens + Cost, and
  Status; remove selector/Requests documentation and update the exported-type list.
- [x] 3.5 Run `npm run validate:docs` after the README/public API update.

## 4. Final verification

- [x] 4.1 Run `npm exec nx affected --target=lint --base=origin/development`,
  `npm exec nx affected --target=typecheck --base=origin/development`, and
  `npm exec nx affected --target=test --base=origin/development`; resolve only regressions caused by
  this change and record unrelated findings as follow-ups rather than drive-by edits.
- [x] 4.2 Apply the follow-up compact Cost treatment so every period shows only the formatted amount
  (or unavailable state), with no visible Cost sublabel, total/No limit text, or Cost progress bar;
  keep non-visual accessible context, update component tests/README/specs, then review the final diff
  for the five-column contract, worst-token Status, no selector/Requests, and no API/card changes.
- [x] 4.3 Vertically center every desktop row cell's content while preserving existing horizontal
  alignment, mobile stacking, and full-width token progress tracks; update responsive specs, README,
  and component tests, then rerun library verification and strict OpenSpec validation.
- [x] 4.4 Reduce period-cell height by placing the token amount/state and value-only Cost on one
  baseline row above the full-width token progress bar for all metric kinds; preserve accessible
  Cost context, RTL/mobile behavior, and vertical row centering, update specs/README/tests, then
  rerun library verification and strict OpenSpec validation.
- [x] 4.5 Apply the final visual contract: rename the section to `Model tokens limits`; move the
  attributed Cost value plus localized `spent` caption below token progress; replace unlimited
  model-token supporting text with `Follows cost limit` when the matching top-level Cost limit is
  finite; derive accessible period-header warning/reached indicators and every row's worst Status
  from the same top-level day/week/month Cost limits plus model-token limits; update normalized lib
  props, app mapper/i18n, README/specs/tests, verify RTL/mobile semantics and library isolation, then
  rerun focused Nx checks, docs validation, affected checks, and strict OpenSpec validation.
