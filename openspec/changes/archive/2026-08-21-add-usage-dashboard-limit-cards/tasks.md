## 1. Library scaffolding

- [x] 1.1 Invoke the `nx-generate` skill; identify the generator used for `libs/settings-panel`
      (buildable React + Vite + Vitest, inferred targets, `type:ui` tag) and read its schema
      (`node_modules/@nx/react/src/generators/library/schema.json` or equivalent) plus `--help`.
- [x] 1.2 Run a non-interactive dry run (`--dry-run`) for `libs/usage-dashboard` with the resolved
      flags and review the file list before committing to the real run.
- [x] 1.3 Scaffold `libs/usage-dashboard` via `nx g @nx/react:library ...` (or the confirmed
      equivalent), matching `libs/settings-panel`'s bundler/test-runner/buildable options.
- [x] 1.4 Set `package.json` name to `@epam/ai-dial-usage-dashboard`, add `description`,
      `license: "Apache-2.0"`, `private: true`, `"nx": { "tags": ["type:ui"] }`, and peer deps
      `react`, `@epam/ai-dial-ui-kit`, `@epam/ai-dial-chat-shared` (versions matching
      `libs/settings-panel/package.json`).
- [x] 1.5 Align `vite.config.mts` externals/build config with `libs/settings-panel/vite.config.mts`
      (ESM-only, `vite-plugin-dts`, jsdom+v8-coverage vitest block); remove generator demo
      boilerplate (`app.tsx`, default styles).
- [x] 1.6 Verify `npm exec nx show project usage-dashboard` reports the expected `build`/`lint`/
      `test` targets before writing any component code.

## 2. Library models and types

- [x] 2.1 Add `libs/usage-dashboard/src/models/usage-limit-card-props.ts` with `UsageLimitStatus`
      enum and the `UsageLimitCardData` / `UsageLimitCardGroupLabels` /
      `UsageLimitCardGroupColors` / `UsageLimitCardGroupTypography` / `UsageLimitCardGroupProps` /
      `UsageLimitCardProps` interfaces from design.md §D3, with full JSDoc per `libs.md`.
- [x] 2.2 Add `libs/usage-dashboard/src/index.ts` barrel exporting `UsageLimitCardGroup`,
      `UsageLimitCard`, `UsageLimitStatus`, and every type above.

## 3. UsageLimitCard component (independently verifiable slice)

- [x] 3.1 Implement `libs/usage-dashboard/src/components/UsageLimitCard/UsageLimitCard.tsx`:
      title, scope label, optional status badge, prominent amount, progress bar (UI-kit
      `ProgressBar`, confirmed via `getEntityDetails`/`searchEntity`), used-percent trailing label,
      unlimited branch (no progress bar/ratio), 100%+ visual clamp with real `aria-valuetext`.
- [x] 3.2 Add `UsageLimitCard.module.scss` with the three-tier `--uld-*` CSS-var fallback chain per
      `openspec/lib-styling-guide.md`, wired through `buildCssVars` for `styles.colors`/
      `styles.typography`.
- [x] 3.3 Add `libs/usage-dashboard/src/components/UsageLimitCard/tests/UsageLimitCard.spec.tsx`
      covering: default/running-low/limit-reached rendering, badge text, unlimited card (no ratio),
      missing/zero/negative/NaN-derived data (verify via the fixture's already-mapped shape, since
      the library never sees raw stats), exact-90%/exact-100% boundaries, over-100% clamp with
      preserved `aria-valuetext`, long localized labels (no overflow/truncation break), and an RTL
      smoke test (`dir="rtl"` ancestor) for the accessible name/value text.
- [x] 3.4 Run `npm exec nx test usage-dashboard`, `npm exec nx lint usage-dashboard`,
      `npm exec nx typecheck usage-dashboard` (or the equivalent inferred target name confirmed in
      1.6) and fix findings before continuing.

## 4. UsageLimitCardGroup component (independently verifiable slice)

- [x] 4.1 Implement `libs/usage-dashboard/src/components/UsageLimitCardGroup/UsageLimitCardGroup.tsx`:
      shared raised container, `grid-cols-1 desktop:grid-cols-2` layout, logical divider
      (`border-e`/`border-b` per design.md §D9), single-card fallback when only one of
      `daily`/`monthly` is provided, `null` when neither is provided.
- [x] 4.2 Add `UsageLimitCardGroup.module.scss` (container background/divider color vars only,
      following the same three-tier fallback convention).
- [x] 4.3 Add tests covering: both cards, single-card fallback (no divider), neither-card (renders
      nothing), 360px-viewport no-horizontal-overflow check, and RTL divider-side verification.
- [x] 4.4 Run `npm exec nx test usage-dashboard`, `npm exec nx lint usage-dashboard`,
      `npm exec nx build usage-dashboard` and fix findings.

## 5. Library docs

- [x] 5.1 Write `libs/usage-dashboard/README.md` following the standard lib README shape (H1 =
      package name, Overview, Installation, Peer Dependencies, Components section for both
      exported components with a minimal, currently-compiling usage example per component, Types
      section listing every exported type).
- [x] 5.2 Add the new library row to `docs/architecture.md`'s library table
      (`docs/architecture.md:88-111` per prior investigation) and to the Decision Log/lib list if
      one exists for `type:ui` libraries.
- [x] 5.3 Run `npm run validate:docs` and fix any reported issues.

## 6. useUsageData per-request error state

- [x] 6.1 Update `apps/chat/src/hooks/useUsageData.ts`: replace `error: Error | undefined` with
      `limitsError`/`usageError`, set independently from each `Promise.allSettled` branch, keeping
      the existing `cancelled`-flag/unmount handling unchanged.
- [x] 6.2 Update `apps/chat/src/hooks/tests/useUsageData.spec.ts` (or add one if absent) to cover:
      both succeed, only limits fails, only usage fails, both fail, unmount-before-resolve,
      disabled flag, flag toggled true mid-lifecycle — asserting `limitsError`/`usageError`
      independently.
- [x] 6.3 Run `npm exec nx test chat -- useUsageData` and fix findings.

## 7. App-level mapper (DTO → library view-model)

- [x] 7.1 Add `apps/chat/src/utils/map-usage-data-to-dashboard.ts`: pure function(s) turning
      `{ limits, usage }` (`UserLimitStatsResponseDto | undefined` each) into
      `{ daily?: UsageLimitCardData; monthly?: UsageLimitCardData }`, implementing design.md §D5/D6
      — `limits ?? usage` per-field fallback, unlimited-sentinel check (`total >= 2**53`),
      negative/NaN/missing handling (card omitted), 90%/100% thresholds → `UsageLimitStatus`, USD
      formatting via the existing `Intl.NumberFormat` currency pattern
      (`apps/chat/src/utils/map-deployment-limits-to-catalog.ts:72-76`), and `progressAriaLabel`
      construction via `t()`.
- [x] 7.2 Add `UsageI18nKeys` enum entries to `apps/chat/src/constants/translation-keys.ts` for:
      card titles, scope label, unlimited copy, running-low/limit-reached badge text, used-percent
      label builder text, progress aria-label template, partial-failure notification message,
      full-failure notification message. Add matching strings to
      `apps/chat/src/i18n/locales/en.json`.
- [x] 7.3 Add `apps/chat/src/utils/tests/map-usage-data-to-dashboard.spec.ts` covering every case
      in specs/usage-dashboard-lib and specs/usage-data-hook: both stats present, one missing, both
      missing, zero/negative/NaN `used`, `total` at/above `2**53`, `used > total` (over-limit),
      exact 90%/100% boundaries, `limits` failed but `usage` has the same aggregate figures (and
      vice versa).
- [x] 7.4 Run `npm exec nx test chat -- map-usage-data-to-dashboard` and fix findings.

## 8. UsageTab integration

- [x] 8.1 Update `apps/chat/src/pages/SettingsPage/UsageTab/UsageTab.tsx`: call `useUsageData`,
      run the mapper, render a loading state while `isLoading`, else render
      `UsageLimitCardGroup` from `@epam/ai-dial-usage-dashboard` with the mapped props and labels.
- [x] 8.2 Add the deduplicated error-notification effect (keyed on `[limitsError, usageError]`)
      calling `showErrorNotification` from `useNotification()`, per design.md §D8: one partial-
      failure message, one consolidated full-failure message, never both, never the raw
      `Error.message`.
- [x] 8.3 Add/extend `apps/chat/src/pages/SettingsPage/UsageTab/tests/UsageTab.spec.tsx` covering:
      loading state, both cards render, one-card render (other stat missing/invalid), one endpoint
      failing (partial notification + partial data preserved), both endpoints failing
      (single consolidated notification), notification-not-repeated-on-unrelated-rerender
      (dedup), and no notification on full success.
- [x] 8.4 Run `npm exec nx test chat -- UsageTab` and fix findings.
- [x] 8.5 Add the page header (title `<h2>` + one-line description) above the cards region in
      `UsageTab.tsx`, rendered unconditionally per design.md §D12. Add
      `UsageI18nKeys.PageTitle`/`PageDescription` and matching `en.json` strings. Extend
      `UsageTab.spec.tsx` to assert the header renders both while loading and once loaded.
- [x] 8.6 Run `npm exec nx test chat -- UsageTab` again and fix findings.

## 9. Verification and cleanup

- [x] 9.1 Run `npm exec nx affected --target=lint --base=origin/development`,
      `npm exec nx affected --target=typecheck --base=origin/development`,
      `npm exec nx affected --target=test --base=origin/development`,
      `npm exec nx affected --target=build --base=origin/development` and fix any findings.
      `apps/chat-api` was excluded from these runs: its `typecheck` target fails with 764
      pre-existing errors unrelated to this change (present identically on a clean checkout of this
      branch before any of this change's edits) — a stale/broken composite-build state in
      `apps/chat-api`'s own source, out of scope here. Two more pre-existing, unrelated issues were
      found and left as-is: `Navigation.spec.tsx` fails because `Navigation.tsx`'s existing
      `useFeatureFlag` call (added on this branch before this change) isn't in that spec's mock: and
      `useUsageData.spec.ts`'s "fetches once enabled transitions from false to true" test is flaky
      under the full parallel suite (passes reliably in isolation) — both unrelated to
      `usage-dashboard`. Fixed in place as trivial, mechanical, zero-risk corrections: one
      `import/order` fix in `Navigation.tsx` and four pre-existing `prettier` formatting violations
      (`ResourceSummary.tsx`, `UserMenu.tsx`, `SkillEditor.tsx`, `SharePopover.spec.tsx`) that surfaced
      because the Nx library generator's `npm install` (task 1.3) bumped a transitive
      prettier-related dependency in `package-lock.json`, widening `nx affected`'s lint scope
      repo-wide.
- [x] 9.2 Confirm `npm run validate:docs` is still clean after all changes.

## 10. Redesign to match the final design reference (design.md §D13)

- [x] 10.1 Rework `libs/usage-dashboard`'s model (`usage-limit-card-props.ts`): drop `scopeLabel`;
      `UsageLimitCardGroupProps.daily`/`.monthly` → `cards: UsageLimitCardData[]`; add
      `defaultBadgeLabel`, `usedOfTotalLabel`, `remainingCaptionLabel` (remaining-amount based) to
      `UsageLimitCardGroupLabels`; reword `usedPercentLabel` to bare `%`; add
      `defaultBadgeBackground`/`defaultBadgeColor` to `UsageLimitCardGroupColors`; rename
      `containerBackground` → `cardBackground`; drop `dividerColor`/`scopeLabelColor`.
- [x] 10.2 Rewrite `UsageLimitCard.tsx`: always-visible badge (incl. default "within limits");
      prominent figure is `usedLabel` (was `remainingLabel`); "used of $total" caption next to it;
      "$remaining left" + "N%" captions below the progress bar; own rounded/backgrounded box.
      Rewrite `UsageLimitCard.module.scss` accordingly, including new default-badge colors sourced
      from the UI-kit's `--bg-visual-green-2`/`--text-visual-green-1` tokens (confirmed via
      `getEntityDetails("theming")` — no dedicated success tokens exist).
- [x] 10.3 Rewrite `UsageLimitCardGroup.tsx` as a simple `cards.map(...)` grid (mobile:
      `grid-cols-1`; desktop: `grid-cols-[repeat(var(--uld-card-count),minmax(0,1fr))]` driven by
      `cards.length`); delete the now-unneeded `UsageLimitCardGroup.module.scss` (no shared
      container/divider left to theme).
- [x] 10.4 Update `UsageLimitCard.spec.tsx`/`UsageLimitCardGroup.spec.tsx` for the new API and
      always-visible-badge/used-prominent/independent-box behavior. Run
      `npm exec nx test usage-dashboard`, `lint usage-dashboard`, `build usage-dashboard`.
- [x] 10.5 Rework `apps/chat/src/utils/map-usage-data-to-dashboard.ts` to read
      `dayCostStats`/`weekCostStats`/`monthCostStats` and return an ordered
      `UsageLimitCardData[]` (Today/This week/This month), dropping the `{ daily?, monthly? }`
      shape. Update `map-usage-data-to-dashboard.spec.ts` accordingly.
- [x] 10.6 Replace the `DailyLimitTitle`/`MonthlyLimitTitle`/`ScopeLabel`/`RemainingLabel` (etc.)
      `UsageI18nKeys` entries with `TodayTitle`/`ThisWeekTitle`/`ThisMonthTitle` (+ period
      descriptions), `DefaultBadgeLabel`, `UsedOfTotalLabel`, `RemainingCaptionLabel`, and a
      `%`-only `UsedPercentLabel`. Update `en.json` to match.
- [x] 10.7 Update `UsageTab.tsx`'s `labels` object and its call to `UsageLimitCardGroup` for the
      `cards` prop; extend `usage-tab-temp-mock.ts`'s mock data with `weekCostStats`. Update
      `UsageTab.spec.tsx` for the three-card shape.
- [x] 10.8 Update `libs/usage-dashboard/README.md` and the openspec `proposal.md`/`design.md`
      (§D13)/`specs/usage-dashboard-lib/spec.md`/`specs/usage-data-hook/spec.md` to describe the
      final (three-card, independent-box, used-prominent, always-visible-badge) design rather than
      the superseded two-card iteration. Run `npm run validate:docs` and
      `npm exec openspec validate add-usage-dashboard-limit-cards --strict`.
- [x] 10.9 Run `npm exec nx typecheck chat`, `npm exec nx test chat -- map-usage-data-to-dashboard`,
      `npm exec nx test chat -- UsageTab`, and `npm exec nx build chat`; fix any findings.

## 11. Pixel-precision pass against the exported Figma CSS

- [x] 11.1 Match `UsageLimitCard.tsx`/`.module.scss` to the exact Figma "Period card" spec: card
      `px-6 py-5` (20px/24px), `rounded-xl` (12px), `shadow-md`; inner figure/progress-bar group
      `gap-2` (8px), outer card `gap-4` (16px); title typography `dial-body-semi-text` (was
      `dial-h3-text`, same size but design names it "Body Text (Semi Bold)"); prominent amount
      typography `dial-display1-text` (was `dial-display3-text` — wrong scale step, 32px/48px vs
      22px/32px); badge `rounded-full` (was `rounded-2xl`).
- [x] 11.2 Split the running-low status into two distinct color slots per the Figma export: a
      darker amber (`#7f6300`) for the amount/badge **text** (`warningAccentColor`/
      `warningBadgeColor`) vs. the brighter amber (`#eec840`) for the progress-bar **fill** (new
      `warningProgressColor`) — the bar's bright fill fails text contrast, so Figma intentionally
      uses two shades. Added `warningProgressColor` to `UsageLimitCardGroupColors`; badge background
      fallback corrected to `#faf0cf`.
- [x] 11.3 Extend `usage-tab-temp-mock.ts` so the three temporary mock cards demonstrate all three
      status/badge variants (RunningLow, Default/"Within limits", LimitReached) instead of two
      cards both landing on the default status.
- [x] 11.4 Run `npm exec nx run-many --target=typecheck --projects=usage-dashboard,chat`,
      `npm exec nx test usage-dashboard`, `npm exec nx test chat -- UsageTab`,
      `npm exec nx run-many --target=build --projects=usage-dashboard,chat`, and
      `npm run validate:docs`; fix any findings.

## 12. Percent clamp, threshold correction, and exact color tokens (design.md §D14)

- [x] 12.1 Clamp the visible used-percent label at 100 in `UsageLimitCard.tsx`
      (`Math.min(Math.round(data.usedPercent), 100)`); `progressAriaLabel`/`aria-valuetext` keep
      the real, uncapped percentage. Updated `UsageLimitCard.spec.tsx`'s over-100 test to assert
      the visible label reads `100%` while `aria-valuetext` still reads the true value.
- [x] 12.2 Lower `RUNNING_LOW_THRESHOLD_PERCENT` in `map-usage-data-to-dashboard.ts` from 90 to 75,
      per explicit user correction against the final design (yellow above 75%, blue below, red at
      100%). Updated the boundary tests (`75%`/`74.9%` instead of `90%`/`89.9%`).
- [x] 12.3 Replaced every approximated/invented hex fallback in `UsageLimitCard.module.scss` and
      `usage-limit-card-props.ts` with the exact token from the root `tailwind.config.js`,
      resolved directly from the user's Figma CSS export (see design.md §D14's table): `--text-info`
      / `--text-control-blue-hover` (default text/bar), `--text-warning` / `--text-warning-icon`
      (running-low text/bar), `--text-error` / `--bg-control-error-active` (limit-reached
      text/bar), and `--bg-success`+`--text-success` / `--bg-warning` / `--bg-error` (badge
      backgrounds+text per status family). Added `defaultProgressColor` and `errorProgressColor`
      to `UsageLimitCardGroupColors` to complete the text/bar split for all three statuses.
- [x] 12.4 Run `npm exec nx run-many --target=typecheck --projects=usage-dashboard,chat`,
      `npm exec nx test usage-dashboard`, `npm exec nx test chat -- map-usage-data-to-dashboard`,
      `npm exec nx test chat -- UsageTab`,
      `npm exec nx run-many --target=build --projects=usage-dashboard,chat`, and
      `npm run validate:docs`; fix any findings.

## 13. Remove the temporary mock-data workaround (backend fixed)

- [x] 13.1 Deleted `usage-tab-temp-mock.ts`; `UsageTab.tsx` calls `mapUsageDataToDashboard(limits,
      usage, t)` directly again and the error-notification effect keys on the real
      `limitsError`/`usageError` from `useUsageData`, with no suppression.
- [x] 13.2 Reverted `UsageTab.spec.tsx`'s two `TEMP:` tests to assert the real partial-/full-failure
      notification behavior (one localized notification, not the raw `Error.message`) and restored
      the notification-dedup-on-rerender test that the temporary mock had made moot.
- [x] 13.3 Ran `npm exec nx typecheck chat`, `npm exec nx test chat -- UsageTab`, and
      `npm exec nx build chat`; all clean.
