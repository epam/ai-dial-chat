## Context

`libs/usage-dashboard` ships two kinds of code behind one barrel. Its components
(`UsageLimitCard`, `UsageLimitCardGroup`, `ModelLimitsSection` and their children) are genuinely
host-agnostic: they consume `UsageLimitCardData`, `ModelLimitRow` and `ModelLimitPeriodStatuses`,
which carry only preformatted labels, normalized percentages and status enums. Its two `src/utils/`
modules are not: they read DIAL Core DTO field names, apply the `2 ** 53` unlimited sentinel, and
filter on the runtime `DeploymentItemDtoTypeEnum.Model`.

The runtime enum import is what makes this structural rather than cosmetic. A type-only import could
be erased at build time; a runtime one cannot, so `@epam/ai-dial-chat-api-client` sits in the
package's `dependencies` and follows the package into any host's install.

Current state, verified against `a942c4d64`:

- `libs/usage-dashboard/src/utils/map-usage-data-to-dashboard.ts` — `mapUsageDataToDashboard`,
  `USAGE_DATA_I18N_KEYS`, `ResetTimeDisplayLike`, `FormatResetTime`.
- `libs/usage-dashboard/src/utils/map-user-usage-to-model-limits.ts` —
  `mapUserUsageToModelLimits`, `mapOverallCostLimitsToPeriodStatuses`,
  `USAGE_MODEL_LIMITS_I18N_KEYS`.
- The only in-repo consumer is `apps/chat/src/pages/SettingsPage/UsageTab/UsageTab.tsx` (lines 4-9,
  99, 213, 225) plus `.../UsageTab/tests/UsageTab.spec.tsx`.
- The library's *component* tests import no DTO; only the two `src/utils/tests/*.spec.ts` files do.
- `package.json:24` (`dependencies`), `tsconfig.lib.json` (`../chat-api-client/tsconfig.lib.json`
  reference) and `vite.config.mts:52-55` (test-only alias) are the three configuration edges.

Constraints:

- AGENTS.md §Library isolation forbids generated-client knowledge in hand-authored libs; the two
  exceptions (`libs/chat-api-client`, the narrow `libs/chat-hooks` transport contract) do not reach a
  presentational package.
- `.claude/rules/libs.md` governs manifest metadata, `dependencies` vs `peerDependencies`, the
  `exports`/`styles.css` contract and README shape; `npm run validate:docs` enforces several of them
  including the `dial-*` class table in both directions.
- `.claude/rules/docs.md` requires the README, `docs/architecture.md` and the regenerated
  `docs/host-install-matrix.md` to change in the *same* commit as the export/dependency change.
- Three capability specs currently mandate the placement being removed, so the specs must move with
  the code or the change would ship a documented contradiction.

## Goals / Non-Goals

**Goals:**

- `libs/usage-dashboard` consumes normalized display models only — no generated DTO, no runtime
  client enum, no DIAL Core sentinel or field name — in source, in the barrel, and in emitted JS and
  declarations.
- `apps/chat` owns BFF interpretation for Usage, in a cohesive adapter location beside the other
  edge utilities the Usage screen already uses.
- Zero user-visible change on the Usage screen.
- The four affected capability specs state the new ownership without dropping a behavioural rule.
- A cheap, narrow check makes the coupling's return a build/test failure rather than a review catch.

**Non-Goals:**

- Changing any calculation, threshold, ordering rule, formatting, label or fetch behaviour.
- Unifying the deliberately different unlimited behaviour of the token path (`Unlimited` cell with
  `supportingLabel`) and the cost path (`Unlimited` cell showing attributed spend only).
- Moving `apps/chat/src/utils/usage-reset-time.ts`, the `useUsageData` hook, or the
  `@epam/ai-dial-chat-api-client` installation itself.
- A repository-wide architecture-rule framework, a tag hierarchy, or a general dependency-cruiser
  layer.
- Publishing the package or asserting a release history.

## Decisions

### D1 — Direct move to app adapters, not a host-neutral mapper API

The library's props already *are* the neutral boundary; a second neutral input type would duplicate
it. Keeping mappers in the lib behind a DTO-free input would push the DTO → input mapping into the
app anyway, leaving two contracts to maintain for no isolation gain. One in-repo consumer makes the
direct move cheap.

*Rejected:* neutral mapper API (adds surface, moves nothing); type-only imports with copied DTO
interfaces or inlined backend strings (nominal isolation, explicitly out of bounds per the
proposal); a compatibility wrapper left in the lib (preserves the exact coupling being removed).

### D2 — Adapters live in `apps/chat/src/utils/`, flat, beside their collaborators

New files: `apps/chat/src/utils/map-usage-data-to-dashboard.ts` and
`apps/chat/src/utils/map-user-usage-to-model-limits.ts`; tests in `apps/chat/src/utils/tests/`.

This matches the established app convention — `map-deployment-to-catalog-item.ts`,
`map-scheduled-task-dto.ts`, `map-scheduled-task-run-dto.ts` all sit flat in `utils/` with specs in
`utils/tests/` — and puts the adapters directly beside the three edge utilities they compose with:
`usage-reset-time.ts`, `icon-path.ts` (`resolveCatalogIconUrl`) and `locale.ts`
(`resolveLocalizedText`). Cohesion here comes from adjacency to collaborators, not from a new folder.

*Rejected:* a `utils/usage/` subfolder — `utils/app/` shows subfolders are permitted, but it would
separate the adapters from `usage-reset-time.ts`, which stays put (D6), producing *less* cohesion
than the flat layout. *Rejected:* co-locating inside `pages/SettingsPage/UsageTab/` — the rules keep
adapters out of the component folder, and `utils/` is where the app's other `map-*` adapters live.

### D3 — The moved code keeps its algorithms verbatim; only callback plumbing collapses

Every helper (`isUsableStats`, `getStatus`/`getMetricStatus`, `getOverallCostStatus`,
`isFiniteLimitStatus`, `buildResetFields`, `buildFiniteMetricCell`, `buildCostMetricCell`,
`buildPeriodCell`, `getRowStatus`, `hasUsageAcrossDisplayedPeriods`), both `Intl.NumberFormat`
instances, `PERIOD_FIELD_MAPPINGS`, `OVERALL_COST_PERIODS`, `UNLIMITED_TOTAL_THRESHOLD` and
`RUNNING_LOW_THRESHOLD_PERCENT` move unchanged.

Three signature simplifications follow from the app now being the only caller, and change no
behaviour:

- `FormatResetTime` / `ResetTimeDisplayLike` are dropped in favour of the app's existing
  `ResetTimeDisplay` and a `(resetsAt: string | undefined) => ResetTimeDisplay | undefined`
  signature from `apps/chat/src/utils/usage-reset-time.ts`. The two shapes are field-for-field
  identical — `ResetTimeDisplayLike` existed only so the lib would not import an app type, a reason
  that disappears with the move.
- `USAGE_DATA_I18N_KEYS` and `USAGE_MODEL_LIMITS_I18N_KEYS` are replaced by the app's existing
  `UsageI18nKeys` enum in `apps/chat/src/constants/translation-keys.ts`, which already declares every
  key path both consts carry (verified: all 9 + 13 keys present). Keeping duplicate consts app-side
  would create two sources of truth for the same strings. The `t` calls and emitted key strings are
  byte-identical.
- The `t: Translate` parameter stays, rather than the adapters calling `useTranslation` themselves:
  the adapters remain pure functions behind `UsageTab`'s `useMemo`, which is what keeps the memo
  dependency arrays meaningful.

`resolveIconUrl` / `resolveDisplayName` stay as parameters. Importing `resolveCatalogIconUrl` and
`resolveLocalizedText` directly inside the adapter would be legal app-side, but the call sites are
already wired and unit tests inject stubs through them; keeping the parameters preserves both
without churn.

### D4 — `UsageTab.tsx` changes imports only

`mapUsageDataToDashboard`, `mapUserUsageToModelLimits`, `mapOverallCostLimitsToPeriodStatuses` come
from `../../../utils/...`; `ModelLimitsSection`, `UsageLimitCardGroup` (and any type) keep coming
from `@epam/ai-dial-usage-dashboard`. The `useCallback` on `formatResetTime`, all four `useMemo`
dependency arrays, `resetBoundariesMs`, the boundary timer with its `MAX_TIMEOUT_MS` clamp, the
`visibilitychange` re-check, the `refreshToken` fetch cycle, the `usageError` notification effect and
the `isLoading` gate are untouched. No new context, hook, state or effect. Loading, empty and error
states are exactly the ones already specified: a full-tab `Spinner` while loading, the section's
internal empty state at zero rows, and one localized `UsageI18nKeys.FullLoadError` notification per
failed fetch cycle.

### D5 — Boundary enforcement: two narrow checks, both from existing conventions

1. **Source/barrel** — a per-project override in `libs/usage-dashboard/eslint.config.mjs` adding
   `no-restricted-imports` for `@epam/ai-dial-chat-api-client` (and its subpaths). The root
   `eslint.config.mjs:92-103` already uses `no-restricted-imports` with a pattern list, so this is
   the established mechanism, applied at one project. Once the manifest entry is gone,
   `@nx/dependency-checks` (already configured in that file) independently fails an undeclared
   import, so the two overlap by design: lint catches the import, dep-checks catches the manifest
   drift.
2. **Emitted artifacts + real install** — a `tools/usage-dashboard-consumer-fixture` Nx project
   following `tools/attachment-canvas-consumer-fixture`'s exact shape (`pack-lib` → `build` →
   `verify`, with `test` as an `nx:noop` depending on `verify`) and reusing
   `libs/chat-hooks/e2e-fixtures/harness.mjs` (`createFixtureDir`, `createFixtureDependencyResolver`,
   `npmInstallFixture`, `typecheckFixture`, `bundleFixture`) the way
   `tools/reusable-workflows-consumer-fixture` does. It scans `dist/**/*.js` and `dist/**/*.d.ts`
   for the `@epam/ai-dial-chat-api-client` specifier and for the DTO type names, then installs the
   packed tarball into an isolated temp tree with only the documented peers — deliberately **not**
   the generated client — and renders `UsageLimitCardGroup` + `ModelLimitsSection` from normalized
   fixture data plus `./styles.css`.

The harness's isolated-temp-dir install is the point: as its own doc comment records, a fixture
nested in the checkout would let an "uninstalled" peer resolve from the workspace root and pass for
the wrong reason.

*Rejected:* a repository-wide dependency-cruiser or Nx tag hierarchy — out of scope, and the
proposal explicitly bars building a new framework for one boundary. *Rejected:* relying on
`@nx/enforce-module-boundaries` alone — its current config is a `sourceTag: '*' →
onlyDependOnLibsWithTags: ['*']` wildcard that permits this import.

### D6 — `usage-reset-time.ts` stays where it is

It is already app-owned and already correct. Its path is named in `docs/architecture.md` and quoted
verbatim in the `usage-period-reset-times` spec's formatter contract. Moving it would be doc and spec
churn with no isolation gain. The adapters import `ResetTimeDisplay` from it.

### D7 — Test ownership follows responsibility

`map-usage-data-to-dashboard.spec.ts` (324 lines) and `map-user-usage-to-model-limits.spec.ts`
(638 lines) move to `apps/chat/src/utils/tests/` with their DTO fixtures, which are legitimate
app-side. Characterization gaps are closed **before** the move, in place, so the added cases are
proven against the current implementation and then re-run unchanged against the moved one. The
library's remaining tests (`components/**/tests/*.spec.tsx`) already use normalized fixtures and need
no change beyond confirming that.

Invariants to have pinned before the move (added only where a suite does not already cover them):
UTC day/week/month ordering and omission of periods with unusable stats; the `total >= 2 ** 53`
sentinel including exactly `2 ** 53`; zero-total → 100%; negative/non-finite → unavailable, never
zero-usage; unclamped `usedPercent` above 100; the 75/100 thresholds at their boundaries; the
`getRowStatus` precedence of finite token/cost statuses over the `NoLimit` fallback and the rule that
sentinel cost cells alone never promote an all-unavailable-tokens row; row order from
`Object.keys(usage.deployments)` with `deploymentItems` as enrichment only; model-only filtering via
`DeploymentItemDtoTypeEnum.Model`; fallback identity (`item.id`, then the raw key); duplicate
metadata behaviour; exclusion of rows with no positive usage in any displayed period; the reset trio
present-or-all-absent rule; and the divergent token-vs-cost unlimited outputs, asserted as they are
rather than reconciled.

### D8 — Public API removal is recorded as breaking; no wrapper, no version claim

Seven exports leave `src/index.ts`: three functions, two consts, two types. All seven appear in
`libs/usage-dashboard/README.md`, so this is a public API change irrespective of `private: true`. The
README gains a before/after host migration example: the host copies the adapter into its own edge
code (the AI DIAL Chat adapters are the reference implementation) and keeps passing the same
`cards` / `rows` / `periodStatuses` props. No deprecated re-export is kept — a DTO-bound wrapper in
the lib would defeat the change.

The manifest is `private: true` at `0.0.1` with no verified publish history in this checkout, so the
design makes no claim about which versions exist or about complete source compatibility. It records
the removal as breaking and leaves the version decision to whoever releases. "The chat app still
builds" is not evidence of external compatibility and is not offered as such.

## Risks / Trade-offs

- **A behaviour drifts silently during the move** → characterization cases are added and run *before*
  relocation (D7), then re-run after with assertions unchanged except for import/fixture paths; the
  diff for each moved function should be import lines and the `UsageI18nKeys`/`ResetTimeDisplay`
  substitutions only.
- **Swapping the i18n consts for `UsageI18nKeys` changes an emitted key** → each of the 22 key paths
  is compared literally against the const it replaces before the swap; a mismatch would surface as a
  changed `t(...)` argument in the moved specs, which assert on key identity.
- **Removing the `dependencies` entry breaks a build path not covered by tests** → `nx build
  usage-dashboard`, `nx typecheck` for the lib and the app, `nx lint usage-dashboard`, and the packed
  consumer fixture together cover source, declaration emit, manifest and install. `@nx/dependency-checks`
  flags a manifest/import mismatch in either direction.
- **The lib's vitest alias removal breaks remaining lib tests** → the `@epam/ai-dial-chat-shared`
  alias entry stays; only the `@epam/ai-dial-chat-api-client` one goes, and no remaining lib test
  imports it (verified: component specs carry no such import).
- **An external consumer we cannot see depends on the mappers** → unavoidable with a removal; the
  mitigation is documentation, not detection. The README migration section and the breaking marker
  are the deliverable. The design does not claim zero external consumers.
- **The new consumer fixture is slow or flaky in CI** → it packs and installs, like the two fixtures
  already in `tools/`. It is wired as its own Nx target with the same `test: nx:noop → verify` shape,
  so it is cacheable and fails loudly rather than intermittently; if install time becomes a problem
  the artifact scan (the cheap half) still runs independently as part of `verify`.
- **Trade-off accepted:** any future app hosting this dashboard re-implements the adapter instead of
  importing it. That is the intended cost of the boundary — and the moved code is ~600 lines of pure
  functions with a full spec suite to copy from, not a hidden algorithm.

## Migration Plan

Five slices, each independently verifiable, in order:

- **A — Characterize.** Inventory the seven exports and every consumer; reconcile the four capability
  specs; add missing characterization cases to the two mapper suites *in place* and run them green.
  Record the D8 public-API decision.
- **B — Move.** Create the two app adapters and move both spec files; migrate `UsageTab` imports.
  Run the moved suites plus `UsageTab.spec.tsx`.
- **C — Delink.** Delete `libs/usage-dashboard/src/utils/**`, prune the barrel, the `dependencies`
  entry, the `tsconfig.lib.json` reference and the vitest alias; add the eslint override. Refresh the
  lockfile with `npm install` (no upgrades). Run the lib's component and public-class tests, app/hook
  regressions, typecheck and lint.
- **D — Prove.** Build the library; scan emitted JS and `.d.ts`; add and run the consumer fixture
  against a real isolated install without the generated client.
- **E — Document and review.** README, `docs/architecture.md`, regenerated
  `docs/host-install-matrix.md`, the four delta specs applied; `npm run validate:docs`, the
  repository's final verification, and the five-axis quality review including desktop/mobile/RTL and
  a11y parity. Unrelated pre-existing failures recorded separately, not fixed here.

**Rollback:** revert the commit. The library's components, props, enums, `styles.css`, theme tokens
and `dial-*` classes are untouched throughout, so a revert restores the mappers and the manifest edge
together with nothing else to undo. No data, endpoint, or persisted state is involved.

## Open Questions

None blocking. Two decisions are recorded as assumptions rather than questions, and can be changed in
review without reshaping the plan:

- Adapters flat in `apps/chat/src/utils/` rather than a `utils/usage/` subfolder (D2).
- `UsageI18nKeys` replaces the two moved i18n-key consts rather than the consts moving verbatim (D3).
