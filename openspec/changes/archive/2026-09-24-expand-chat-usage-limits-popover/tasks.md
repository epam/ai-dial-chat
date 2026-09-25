**Slicing strategy: contract-first.** `UsageLimitProgressRow` plus the `LimitsTab` export is the
single contract both the mapper and the popover depend on, so it lands first (group 1) and is
verifiable on its own through the catalog's existing test suite. The mapper (group 2) and the app
wiring (groups 3–4) then build against a settled type. Group 4 is the first point where the change
is visible end to end; groups 5–7 widen it to RTL, a11y, docs, and final verification.

Before starting, read `AGENTS.md` §Library isolation, `.claude/rules/libs.md`,
`.claude/rules/lib-styling.md`, `.claude/rules/a11y.md`, and `.claude/rules/rtl.md` — groups 1 and 2
touch hand-authored libs and group 5 is a direction pass.

## 1. Catalog display contract (additive, no rendered change)

- [x] 1.1 Add optional `resetLabel?: string`, `resetIsoValue?: string`, `resetAriaLabel?: string` to
      `UsageLimitProgressRow` in `libs/catalog/src/models/item-details-data.ts`, with JSDoc stating
      they are preformatted strings supplied by the host and are a present-or-all-absent trio.
      Mirror the wording on `UsageLimitCardData` in
      `libs/usage-dashboard/src/models/usage-limit-card-props.ts`.
- [x] 1.2 Render the reset line in
      `libs/catalog/src/components/Details/TabsContent/Limits/LimitRow.tsx`, beneath the row label
      next to `captionLabel`, guarded on `row.resetLabel != null`: a
      `<time dateTime={row.resetIsoValue} aria-hidden>` carrying the visible text, plus the
      `resetAriaLabel` text on a visually-hidden sibling. When `resetAriaLabel` is absent, leave the
      visible line as its own accessible name (no `aria-hidden`). Add any needed class to
      `Limits.module.scss` using logical properties only.
- [x] 1.3 Change `LimitsTabColors` in `libs/catalog/src/models/limits-props.ts` from a module-private
      interface to an exported one.
- [x] 1.4 Export `LimitsTab` from
      `libs/catalog/src/components/Details/TabsContent/Limits/Limits.tsx`, and the
      `LimitsTabProps` / `LimitsTabColors` types, through `libs/catalog/src/index.ts`. Do **not**
      export `LimitRow` or `LimitGroupSection`.
- [x] 1.5 Architecture guard: confirm the limits components and models under `libs/catalog/src/`
      contain no `/api` path, no `@epam/ai-dial-chat-api-client` import, no `apps/chat/src/server-api`
      import, no app context, no auth/session/cookie/env access, no feature flag, no route or
      navigation knowledge, no analytics/telemetry client, no third-party SDK setup, and no
      `new Date(...)` or date/time `Intl` constructor. Relative code imports stay extensionless;
      `Limits.module.scss` keeps its extension.
- [x] 1.6 Extend `libs/catalog/src/components/Details/TabsContent/tests/Limits.spec.tsx`: a row with
      the full reset trio renders a `<time>` with the expected `dateTime` and the spoken text; a row
      with `resetLabel` but no `resetAriaLabel` keeps the visible line as its accessible name; a row
      with none of the three renders no reset element at all; an unlimited row still renders its
      reset line. Use role, label, and text queries — no class or test-id selectors.

  **Verification:**
  `npm run test:file -- libs/catalog/src/components/Details/TabsContent/tests/Limits.spec.tsx`
  `npm run test:file -- libs/catalog/src/components/Details/tests/DetailsPanel.spec.tsx`

## 2. Conversation-input limits mapper

- [x] 2.1 Rewrite `libs/chat-hooks/src/catalog/map-deployment-limits-to-input.ts` to
      `mapDeploymentLimitsToInput(dto, labels, formatResetTime?)` returning
      `CatalogItemLimits | undefined`, per the "Period deployment usage" requirement: day, week,
      month token stats in that order under one group; `total`/`used` finite and `total > 0` to
      qualify; `Number.MAX_SAFE_INTEGER` as the unlimited sentinel producing
      `isUnlimited` + `noteLabel`; `used` clamped at `0`; `undefined` when nothing qualifies.
      Delete the `MonthlyUsageLimit` interface. Do not touch
      `libs/chat-hooks/src/catalog/map-deployment-limits-to-catalog.ts`.
- [x] 2.2 Declare the `ConversationInputLimitsLabels` interface in the same file — `tokenGroup`,
      `tokensPerDay`, `tokensPerWeek`, `tokensPerMonth`, `followsCostLimit`, `formatSpentCaption`,
      `formatValueLabel`, `formatProgressAriaLabel`, `formatFollowsCostLimitAriaLabel` — with JSDoc
      per `libs/*` conventions, following the shape of `DeploymentLimitsLabels` in the sibling
      catalog mapper.
- [x] 2.3 Set each row's `captionLabel` from the matching sibling cost stat (`dayCostStats`,
      `weekCostStats`, `monthCostStats`) through `labels.formatSpentCaption`, reading only that
      stat's `used`, as the catalog mapper already does.
- [x] 2.4 Compute the group's `status` as the worst case across capped rows —
      `CatalogLimitStatus.LimitReached` at ratio ≥ 1, else `CatalogLimitStatus.RunningLow` at
      ratio ≥ 0.75, else absent.
- [x] 2.5 Accept `formatResetTime?: FormatResetTime` (the structural type already declared in
      `libs/chat-hooks/src/usage/map-usage-data-to-dashboard.ts`) and set the row's reset trio from a
      defined result only. Do not import the app's own `ResetTimeDisplay`.
- [x] 2.6 Update the `libs/chat-hooks` barrel so `mapDeploymentLimitsToInput` and
      `ConversationInputLimitsLabels` are exported and `MonthlyUsageLimit` is gone.
- [x] 2.7 Architecture guard: confirm the file contains no `i18next`/`react-i18next` import, no app
      translation-key enum import, no `new Date(...)`, no date/time `Intl` constructor, no endpoint
      path, and no client construction — it receives a DTO, labels, and a callback only.
- [x] 2.8 Rewrite `libs/chat-hooks/src/catalog/tests/map-deployment-limits-to-input.spec.ts` to cover
      every scenario in "Period deployment usage": three periods in order, minute stats never
      mapped, a missing period not shifting the others, the unlimited sentinel, `undefined` on no
      qualifying stat, worst-case status, reset trio passed through, and reset fields absent when
      `formatResetTime` is omitted or returns `undefined`.

  **Verification:**
  `npm run test:file -- libs/chat-hooks/src/catalog/tests/map-deployment-limits-to-input.spec.ts`
  `npm run test:file -- libs/chat-hooks/src/catalog/tests/map-deployment-limits-to-catalog.spec.ts`
  (must pass untouched — proves the catalog mapper is unaffected)
  `npm run verify:changed`

## 3. i18n keys

- [x] 3.1 Add to `apps/chat/src/i18n/locales/en.json` under `conversationInput.usageLimits`:
      `tokenGroup` (`Token limits`), `tokensPerDay` (`Today`), `tokensPerWeek` (`This week`),
      `tokensPerMonth` (`This month`), `spentLabel` (`{{amount}} spent`), `value`
      (`{{used}} / {{total}}`), `followsCostLimit` (`Follows cost limit`),
      `followsCostLimitAriaLabel` (`{{label}}: {{used}} used. Follows cost limit.`),
      `progressAriaLabel` (`{{label}}: {{used}} of {{total}} used`). Period labels use calendar
      wording — do not copy the catalog's `Last 24 hours` / `Last 7 days` / `Last 30 days` values.
- [x] 3.2 Re-word `conversationInput.usageLimits.triggerAriaLabel` so it names the reported period
      alongside the value (it currently reads `Monthly token usage: {{value}}`). Remove
      `conversationInput.usageLimits.tokensRemaining` and
      `conversationInput.usageLimits.progressAriaLabel`; keep `popoverTitle` and `error` as they are.
- [x] 3.3 Mirror every added, renamed, and removed key in the `ConversationInputI18nKeys` enum in
      `apps/chat/src/constants/translation-keys.ts`.

## 4. Popover and trigger

- [x] 4.1 Update `apps/chat/src/hooks/useDeploymentUsageLimits.ts` to hold
      `CatalogItemLimits | undefined`, accept the labels object and the `formatResetTime` callback
      from its caller, and pass both into `mapDeploymentLimitsToInput`. Keep the existing
      `AbortController` + `cancelled` flag + monotonic `fetchIdRef` structure and the JSDoc
      explaining why the request id exists; update the JSDoc's monthly wording.
- [x] 4.2 In `apps/chat/src/components/UsageLimitsControl/UsageLimitsControl.tsx`, remove the
      `labels` prop and build the labels object in-component from `useTranslation`, memoised with
      `useMemo` on `t`. Resolve the active locale through the app's `useLanguage` hook and build a
      `useCallback`-stable `formatResetTime` wrapping `formatUsageResetTime` from
      `apps/chat/src/utils/usage-reset-time.ts`, following the pattern in
      `apps/chat/src/pages/SettingsPage/UsageTab/UsageTab.tsx`.
- [x] 4.3 Replace the single `ProgressBar` and the `tokensRemaining` line with `<LimitsTab>` from
      `@epam/ai-dial-catalog`, passing the mapped `CatalogItemLimits`. Widen the panel from `w-64` to
      `w-80`, keeping `max-w-[calc(100vw-2rem)]`.
- [x] 4.4 Replace `USAGE_LIMIT_THRESHOLD_PERCENT` and `limit.usedPercent` with the group's
      `CatalogLimitStatus`: error state on `LimitReached`, warning state on `RunningLow`, default
      otherwise. Derive the ring's percentage from the worst capped row and include that row's
      period label in `triggerAriaLabel`. Delete the exported constant.
- [x] 4.5 Remove the `usageLimitsLabels` `useMemo` from
      `apps/chat/src/components/ConversationView/ConversationView.tsx` and
      `apps/chat/src/components/NewConversationComposer/NewConversationComposer.tsx`, leaving each
      `usageLimitsSlot` passing only `deploymentId` and `isGenerationInProgress`. Remove the now-dead
      `ConversationInputI18nKeys` imports only if nothing else in the file uses them.
- [x] 4.6 Rewrite `apps/chat/src/components/UsageLimitsControl/tests/UsageLimitsControl.spec.tsx`:
      three rows render for three configured periods; a row shows or omits its reset line; the
      trigger takes the error state when any capped row is at its limit while the month is low; no
      control renders when the mapper returns `undefined`; Escape closes and returns focus; a failed
      refresh announces politely while the last rows stay visible. Query by role, label, and text.
- [x] 4.7 Update `apps/chat/src/hooks/tests/useDeploymentUsageLimits.spec.ts` for the new return
      shape and the two new arguments, keeping the stale-response and refresh-failure cases.

  **Verification:**
  `npm run test:file -- apps/chat/src/components/UsageLimitsControl/tests/UsageLimitsControl.spec.tsx`
  `npm run test:file -- apps/chat/src/hooks/tests/useDeploymentUsageLimits.spec.ts`
  `npm run verify:changed`
  `npm run build:quiet` (the `@epam/ai-dial-catalog` barrel gained an export, so bundling is affected)

## 5. RTL and accessibility pass

- [x] 5.1 Audit every class added in groups 1 and 4 for logical properties — `ms-*`/`me-*`,
      `ps-*`/`pe-*`, `start-*`/`end-*`, `text-start`/`text-end`, `border-s-*`/`border-e-*` — and
      confirm `Limits.module.scss` uses `margin-inline-*` / `padding-inline-*` / `inset-inline-*`.
      The popover panel's `bottom-full end-0` anchoring is already logical; keep it that way. No new
      icon is introduced, so nothing needs `rtl:scale-x-[-1]`.
- [x] 5.2 Add an RTL rendering assertion to the `UsageLimitsControl` spec: with `dir="rtl"` on an
      ancestor the popover renders without a physical `left-*`/`right-*` class on its panel.
- [x] 5.3 Accessibility check per `.claude/rules/a11y.md`: the trigger keeps `aria-expanded` and
      `aria-haspopup="dialog"` and its decorative ring stays `aria-hidden`; the panel keeps
      `role="dialog"` + `aria-labelledby`; the error line keeps `aria-live="polite"`; each progress
      bar carries `aria-valuetext` from its row's `ariaLabel`; the `<time>` element is not given an
      `aria-label`; any text-color fallback in a `var(--token, #hex)` chain resolves to at least
      7:1 contrast.

  **Verification:**
  `npm run test:file -- apps/chat/src/components/UsageLimitsControl/tests/UsageLimitsControl.spec.tsx`

## 6. Documentation

- [x] 6.1 Update `libs/catalog/README.md`: document the `LimitsTab` export with a minimal compiling
      example including its required props, and list the three new optional `UsageLimitProgressRow`
      fields wherever the row shape is described.
- [x] 6.2 Update `libs/chat-hooks/README.md` for the new `mapDeploymentLimitsToInput` signature and
      the `ConversationInputLimitsLabels` type, and remove every mention of `MonthlyUsageLimit`.
- [x] 6.3 Check whether `apps/chat/README.md` or `docs/architecture.md` describes the usage popover
      as monthly-only; update the sentence if so. No lib or app is added or removed, so no new
      architecture entry is needed.

  **Verification:**
  `npm run validate:docs`

## 7. Close out

- [x] 7.1 Run `npm run verify:full` once and fix anything it surfaces.
- [x] 7.2 Confirm the catalog is untouched in practice: `git diff` shows no change to
      `libs/chat-hooks/src/catalog/map-deployment-limits-to-catalog.ts`,
      `apps/chat/src/components/CatalogView/CatalogView.tsx`, or
      `libs/catalog/src/components/Details/DetailsPanel.tsx`, and
      `libs/catalog/src/components/Details/TabsContent/tests/Limits.spec.tsx`'s pre-existing cases
      pass unmodified.

## 8. Follow-ups (out of scope — do not implement here)

- [ ] 8.1 Record a separate change for the catalog's trailing-window period labels
      (`catalog.details.limits.tokensPerDay/Week/Month` read `Last 24 hours` / `Last 7 days` /
      `Last 30 days`, which `usage-period-reset-times` forbids for these calendar-anchored stats).
- [ ] 8.2 Record a separate change for per-minute headroom in the composer, if it is wanted — it
      needs a live-updating rate indicator, not a static row (`design.md` Decision 2).
