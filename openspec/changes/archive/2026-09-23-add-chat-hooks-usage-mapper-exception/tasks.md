**Slicing strategy: vertical.** One path through the stack — governance text,
then the two adapter files, then the consumer, then docs — each slice
independently verifiable, since the underlying algorithms are already
characterized and unchanged by this move; the risk here is import wiring and
i18n/reset-type substitution, not calculation logic.

This change edits no HTTP endpoint, DTO, or OpenAPI contract, so there are no
generated-client tasks. No new user-visible string is introduced (the two
const objects reuse existing key paths), so there is no `en.json` task. No UI
is added or restyled, so there is no RTL task.

## 1. Record the governance decision

- [x] 1.1 Add the fourth exception paragraph to `AGENTS.md` §Library isolation,
      after the existing AG-Grid (third) exception paragraph, per design.md's
      D2 wording: what the exception permits (a DIAL-Core-response-to-display
      adapter, not just transport), its three-part test (response-shape-driven,
      characterized, host-invariant), the reference case
      (`mapUsageDataToDashboard` / `mapUserUsageToModelLimits` /
      `mapOverallCostLimitsToPeriodStatuses`), and its own "does not extend
      further" closing sentence.
- [x] 1.2 Re-read `openspec/specs/usage-model-limits/spec.md`'s current
      "Library isolation for the adapter" requirement and confirm the four
      delta specs in this change correctly narrow (not delete) its "not
      relocated to another library" guarantee — it must still forbid an
      *unjustified* move into `libs/chat-shared` or a *different* untested
      adapter into `libs/chat-hooks`, per this change's own specs.

## 2. Move the adapters into `libs/chat-hooks` (slice A)

- [x] 2.1 Re-read `apps/chat/src/utils/map-usage-data-to-dashboard.ts` and
      `map-user-usage-to-model-limits.ts` from disk (the working tree from
      `isolate-usage-dashboard-domain-contracts`, not from conversation
      memory) to confirm their current, exact content before moving it.
- [x] 2.2 Create `libs/chat-hooks/src/usage/map-usage-data-to-dashboard.ts`:
      move `mapUsageDataToDashboard` and its helpers
      (`UNLIMITED_TOTAL_THRESHOLD`, `RUNNING_LOW_THRESHOLD_PERCENT`,
      `isUsableStats`, `getStatus`, `buildResetFields`, `mapStatsToCardData`)
      verbatim. Replace the `UsageI18nKeys` import with a local
      `USAGE_DATA_I18N_KEYS` const object declaring the same 8 key-path
      strings. Replace the `ResetTimeDisplay` import from
      `apps/chat/src/utils/usage-reset-time` with a locally declared
      structural `ResetTimeDisplay` interface (`resetsAtMs`, `isoValue`,
      `label`, `ariaLabel`), matching design.md D3. Import
      `UsageLimitCardData`/`UsageLimitStatus` from
      `@epam/ai-dial-usage-dashboard` as before.
- [x] 2.3 Create `libs/chat-hooks/src/usage/map-user-usage-to-model-limits.ts`:
      move `mapUserUsageToModelLimits`, `mapOverallCostLimitsToPeriodStatuses`,
      and every helper (`getMetricStatus`, `getOverallCostStatus`,
      `isFiniteLimitStatus`, `buildOverallCostPeriodStatus`, `noResetTime`,
      `buildUnavailableCell`, `buildFiniteMetricCell`, `buildCostMetricCell`,
      `buildPeriodCell`, `getFiniteCellStatuses`, `getRowStatus`,
      `hasUsageAcrossDisplayedPeriods`) verbatim, `PERIOD_FIELD_MAPPINGS` and
      `OVERALL_COST_PERIODS` included. Replace `UsageI18nKeys` with a local
      `USAGE_MODEL_LIMITS_I18N_KEYS` const declaring the same key-path
      strings (reusing `USAGE_DATA_I18N_KEYS`'s three period-description keys
      rather than duplicating them, if that keeps the two files' consts free
      of drift — otherwise declare them independently, matching the
      pre-`isolate-usage-dashboard-domain-contracts` shape). Import the
      structural `ResetTimeDisplay` type from the sibling file created in
      2.2. Import `ModelLimit*` types/enums from `@epam/ai-dial-usage-dashboard`
      as before.
- [x] 2.4 Add `@epam/ai-dial-usage-dashboard` to `libs/chat-hooks/package.json`
      under `dependencies` (not `peerDependencies` — see design.md D4), and to
      `libs/chat-hooks/tsconfig.lib.json`'s `references` if the workspace's
      TypeScript project-reference convention requires it for a new
      cross-lib type import (mirror how `libs/usage-dashboard/tsconfig.lib.json`
      referenced `chat-shared` before this lineage of changes).
- [x] 2.5 Add both new files' exports to
      `libs/chat-hooks/src/entry-points/utils.ts`, alongside
      `useUsageData`'s existing export line.
- [x] 2.6 Move `apps/chat/src/utils/tests/map-usage-data-to-dashboard.spec.ts`
      and `map-user-usage-to-model-limits.spec.ts` to
      `libs/chat-hooks/src/usage/tests/`. Change only import paths and the
      `UsageI18nKeys`/`ResetTimeDisplay` re-substitution back to the new
      local consts/type from 2.2–2.3; do not weaken, delete, or re-scope an
      assertion.
- [x] 2.7 **Architecture guard.** Re-read both new adapter files and confirm
      neither imports an app context, `react-i18next`, a UI-kit rendering
      component, `apps/chat/src/server-api/*`, environment variables, feature
      flags, or a hardcoded `/api` path — only `@epam/ai-dial-chat-api-client`
      types/runtime values and `@epam/ai-dial-usage-dashboard` types are
      imported, per the exception recorded in task 1.1.

**Verification (slice A)**

```sh
npm run test:file -- libs/chat-hooks/src/usage/tests/map-usage-data-to-dashboard.spec.ts
npm run test:file -- libs/chat-hooks/src/usage/tests/map-user-usage-to-model-limits.spec.ts
```

Both suites must be green with assertions unchanged from
`isolate-usage-dashboard-domain-contracts`'s versions, except for the
import-path and const/type re-substitution.

## 3. Update the consumer and delete the app-owned copies (slice B)

- [x] 3.1 Update `apps/chat/src/pages/SettingsPage/UsageTab/UsageTab.tsx`: the
      three mapper imports move from `../../../utils/map-usage-data-to-dashboard`
      / `../../../utils/map-user-usage-to-model-limits` to
      `@epam/ai-dial-chat-hooks`, joining the existing `useUsageData` import
      from the same package. Leave every `useMemo` dependency array, the
      `formatResetTime` `useCallback`, the boundary timer, the
      `visibilitychange` handler, the notification effect, and `memo()`
      exactly as they are.
- [x] 3.2 Delete `apps/chat/src/utils/map-usage-data-to-dashboard.ts`,
      `map-user-usage-to-model-limits.ts`, and their moved spec files under
      `apps/chat/src/utils/tests/` (confirm 2.6 already relocated the specs
      before deleting).

**Verification (slice B)**

```sh
npm run test:file -- apps/chat/src/pages/SettingsPage/UsageTab/tests/UsageTab.spec.tsx
npm run verify:changed
```

## 4. Documentation and specs (slice C)

- [x] 4.1 Apply the four delta specs in this change (including the
      non-requirement `## Purpose` edits they flag) to
      `openspec/specs/usage-dashboard-lib/spec.md`,
      `openspec/specs/usage-model-limits/spec.md`,
      `openspec/specs/usage-data-hook/spec.md`, and
      `openspec/specs/usage-period-reset-times/spec.md`.
- [x] 4.2 Add a "Usage Utilities" section to `libs/chat-hooks/README.md`,
      after the existing `### useUsageData` entry, documenting
      `mapUsageDataToDashboard`, `mapUserUsageToModelLimits`, and
      `mapOverallCostLimitsToPeriodStatuses` in the same style (overview
      paragraph, usage example, parameter/return tables), naming
      `USAGE_DATA_I18N_KEYS` / `USAGE_MODEL_LIMITS_I18N_KEYS` as the
      translation-key contract.
- [x] 4.3 Correct `libs/usage-dashboard/README.md`'s BREAKING migration note
      (added by `isolate-usage-dashboard-domain-contracts`): it currently
      tells a host to copy the reference implementation into its own
      `apps/*/src/utils/`. Update it to point at
      `@epam/ai-dial-chat-hooks`'s `mapUsageDataToDashboard` /
      `mapUserUsageToModelLimits` instead, since a host can now install
      rather than copy.
- [x] 4.4 Run `npm run docs:install-matrix` and commit the regenerated
      `docs/host-install-matrix.md` if `libs/chat-hooks`'s scenario entries
      change as a result of the new `dependencies` edge (workspace-sibling
      `dependencies` are not tracked by that generator's peer-closure logic —
      confirm this by re-running it and diffing, per the precedent already
      established in `isolate-usage-dashboard-domain-contracts`).

**Verification (slice C — closes the change)**

```sh
npm exec nx build chat-hooks
npm exec nx run chat-hooks:test-packed-unit
npm run validate:docs
npm run verify:full
```

Exactly one `npm run verify:full` closes the change. Merge and release remain
separate statuses from implementation; this change does not publish either
package.
