## Context

- **The dial is off by default.** `UsageLimitsControl` (`apps/chat/src/components/UsageLimitsControl/UsageLimitsControl.tsx`) renders only while `features.usageLimitsControl` is on (PR #9387). Both composers already gate it: `ConversationView` (`apps/chat/src/components/ConversationView/ConversationView.tsx`) and `NewConversationComposer` (`apps/chat/src/components/NewConversationComposer/NewConversationComposer.tsx`).
- **No slot above the input yet.** `ConversationInput` (`libs/conversation-input/src/components/ConversationInput/ConversationInput.tsx`) offers `belowWelcomeSlot`, which sits between the greeting and the input. It also owns the composer width: `max-w-[700px]` on the welcome screen, `max-w-[748px]` in a conversation.
- **Reusable data and formatting exist:**
  - `useDeploymentUsageLimits` (`apps/chat/src/hooks/useDeploymentUsageLimits.ts`) fetches the raw `DeploymentLimitsResponseDto`;
  - `formatUsageResetTime` (`apps/chat/src/utils/usage-reset-time.ts`) is the single place where reset instants are formatted;
  - `findWorstCappedRow` (`apps/chat/src/utils/usage-limits.ts`) finds the worst row, but it works on the mapped `CatalogItemLimits`.
- **The fixed 75% problem.** `mapDeploymentLimitsToInput` (`libs/chat-hooks/src/catalog/map-deployment-limits-to-input.ts`) uses a fixed `RUNNING_LOW_RATIO = 0.75` and lists only rows at or past it.
- **Numeric client config already has a model.** `attachments.maxFileSizeBytes` goes: registry entry → `client-config.mapper.ts` → typed `ClientConfigResponseDto` field → `AppConfigContext` default.

## Goals / Non-Goals

**Goals:**
- By default (flag off), show a dismissible warning/reached banner above the composer in both composers, matching the design.
- Make the warning threshold an operator setting (default 75).
- Keep the conversation-input lib host-agnostic: it gets one generic slot.

**Non-Goals:**
- Changing the dial, its 75% mark, `CatalogLimitStatus`, or Settings → Usage.
- Persisting dismissal across reloads.
- Blocking send on a reached limit.
- Role gating.

## Decisions

### 1. Banner XOR dial, chosen by the existing flag

Both composers branch once on `useFeatureFlag('usageLimitsControl')`:
- **Flag off:** `aboveInputSlot={<UsageLimitBanner … />}` and `usageLimitsSlot={undefined}`.
- **Flag on:** the reverse.

This means no new flag. The two never render together, so the user never gets duplicate signals.

*Alternative:* a dedicated `features.usageLimitBanner` flag. Rejected because the user wants the banner as the default replacement for the dial, so a second flag would only add a combination nobody asked for.

### 2. Generic `aboveInputSlot` in `ConversationInput`

The slot renders inside the existing width container, above `<Input>`:

```tsx
<div className={mergeClasses('relative w-full', welcomeText ? 'max-w-[700px]' : 'max-w-[748px]')}>
  {aboveInputSlot != null && <div className="mb-2">{aboveInputSlot}</div>}
  <Input … />
</div>
```

`mb-2` is a block-axis margin and needs no RTL counterpart. The final gap gets tuned against the Figma frame during implementation.

The same container wraps the input in both the welcome screen and a conversation, so one slot covers both mockups. The lib receives an already-rendered node, and all usage knowledge stays in `apps/chat`, which satisfies the library-isolation rule.

*Alternatives:*
- Render the banner outside `<ConversationInput>`. Rejected because it would duplicate the lib's width and padding classes, which would drift.
- Reuse `belowWelcomeSlot`. Rejected because that slot is welcome-screen only and sits above the greeting's gap, not against the input.

### 3. Selection from the raw DTO, not the mapped model

A new pure helper in `apps/chat/src/utils/usage-limits.ts`:

```ts
enum UsageBannerSeverity { Warning = 'warning', Reached = 'reached' }
enum UsagePeriod { Day = 'day', Week = 'week', Month = 'month' }

interface UsageBannerSource {
  period: UsagePeriod;
  severity: UsageBannerSeverity;
  usedPercent: number;
  resetsAt: string | undefined;
}

const selectUsageBannerSource = (
  dto: DeploymentLimitsResponseDto | undefined,
  thresholdPercent: number,
): UsageBannerSource | undefined => …
```

The enums go in `apps/chat/src/types/`, following the string-enum rule. The helper:
- iterates the six day/week/month token and cost stats;
- uses the same "capped" test as `findWorstCappedRow`, including the `Number.MAX_SAFE_INTEGER` sentinel;
- picks the highest ratio, breaking ties by the longer period and then by token over cost;
- classifies the result against `thresholdPercent`.

Working on the DTO avoids the fixed 75% filter in `mapDeploymentLimitsToInput`. That function sits behind the fourth library-isolation exception, so it stays untouched.

*Alternative:* parameterise `RUNNING_LOW_RATIO` in `chat-hooks`. Rejected because it would change the dial and Usage page semantics, which are out of scope, and would widen the lib's API.

### 4. Reset wording: time for a day, date for a week or month

Add `formatUsageResetShort(resetsAt, period, locale, t)` next to `formatUsageResetTime` in `apps/chat/src/utils/usage-reset-time.ts`, so every `Intl` call stays in that one module.
- **Day:** `{ hour: 'numeric', minute: '2-digit', timeZoneName: 'shortOffset' }`.
- **Week and month:** `{ month: 'short', day: 'numeric' }`, plus `year` when it differs from the current year.

It returns `{ isoValue, label, ariaLabel }`, with `ariaLabel` reused from `formatUsageResetTime`, or `undefined` on any failure, the same as the existing function.

The mockup's `Resets at {time|date}` is read as "time for a day, date for a longer period". English uses "Resets at {time}." and "Resets on {date}.", as two keys.

### 5. Dismissal store: module-scoped, `useSyncExternalStore`

`apps/chat/src/hooks/useUsageLimitBannerDismissal.ts` holds a module-level `Set<string>` of dismissed keys (`${deploymentId}:${period}:${severity}`) and a listener set, and exposes `{ isDismissed(key), dismiss(key) }` through `useSyncExternalStore`. Because the store sits at module scope, a dismissal survives the switch between `NewConversationComposer` and `ConversationView`. Those are different component trees, so `useState` would reset on each switch. A page reload clears the store, as chosen.

The file also exports `resetUsageLimitBannerDismissals()` for test isolation only.

*Alternative:* a new React context under `apps/chat/src/context/`. Rejected because the state is too small to justify a provider, and a new context would also mean an `architecture.md` update.

*Alternative:* `sessionStorage`. Rejected because it survives a reload, and the decision was in-memory only.

### 6. Shared refresh-after-generation hook

The effect in `UsageLimitsControl` that watches `isGenerationInProgress` `true → false` and calls `refresh()` once the hook is idle moves verbatim into `apps/chat/src/hooks/useRefreshUsageAfterGeneration.ts`:

```ts
useRefreshUsageAfterGeneration({ isGenerationInProgress, isLoading, refresh })
```

`UsageLimitsControl` and `UsageLimitBanner` both call it. The existing `UsageLimitsControl.spec.tsx` refresh tests then guard the move.

### 7. Live region politeness

`Notification` defaults warning and error to `role="alert"`. The banner passes `role="status"` instead: it appears on navigation and after streaming, not as feedback to a user action, so an assertive announcement on every page load would be noise.

### 8. Threshold config wiring

The threshold follows the `attachments.maxFileSizeBytes` pattern end to end:
- the env var on `EnvironmentVariables` (`@IsInt @Min(1) @Max(99)`, default 75);
- a registry entry `usageLimits.warningThresholdPercent`;
- a mapper default of 75;
- a required DTO field `usageLimitsWarningThresholdPercent` with `@ApiProperty`;
- `npm run openapi`, `npm run openapi:check`, and a `chat-api-client` rebuild;
- an `AppConfigContext` field with a default of 75.

The NestJS rules come from `apps/chat-api/AGENTS.md` and `.claude/rules/nestjs-best-practices.md` and are not restated here.

## States

| State | Banner |
| --- | --- |
| No `deploymentId`, or the first fetch is pending | Nothing |
| First fetch fails | Nothing |
| Refresh fails after a success | Last good state, unchanged |
| No capped row, or worst row below threshold | Nothing |
| Warning, not dismissed | Warning variant |
| Reached, not dismissed | Error variant |
| Same key dismissed | Nothing |

## Risks / Trade-offs

- **[Kit close button not translatable]** `Notification` exposes no aria-label prop for its close button, so the name stays as the kit renders it, which breaks the "all aria-labels via i18n" rule for this one control. → Record it as a kit gap and raise a ui-kit issue (`closeAriaLabel` prop). It is out of scope per the a11y rule's scope boundary. Wiring it to `ButtonsI18nKeys.Close` is a follow-up once the kit ships the prop.
- **[Extra request with the flag off]** Every composer mount now fetches deployment limits, where PR #9387 made zero requests by default. This is one `GET` per deployment selection plus one per completed response, the same load the dial had before #9387. → Accepted; the request is the existing lightweight limits call.
- **[Week/month date without time]** A UTC boundary shown as a local date can read as a day early west of UTC (e.g. "Oct 31" for `2026-11-01T00:00Z` in GMT-5). → The `<time>` element carries the full date, time, and zone in its accessible expansion and `title`. The visible text follows the design.
- **[Two "worst row" helpers]** `findWorstCappedRow` (mapped model) and `selectUsageBannerSource` (DTO) duplicate the capped test. → Extract a shared `isCappedStat(total)` predicate in `usage-limits.ts` that both use.
- **[Threshold vs dial mismatch]** With the threshold at 90, the dial (flag on) still turns yellow at 75. → Documented in the README env table. The two surfaces are mutually exclusive, so a single user never sees both rules at once.

## Migration Plan

1. Deploy. With no env changes the banner appears by default at 75%, and the dial stays off.
2. Operators who prefer the dial set `USAGE_LIMITS_CONTROL_ENABLED=true`. Operators who want fewer warnings raise `USAGE_LIMITS_WARNING_THRESHOLD_PERCENT`.
3. Rollback: revert the change. All additions are optional props or defaulted config fields, so nothing is breaking.

## Open Questions

- The exact gap between the banner and the input, and the banner's background token, will be confirmed against the Figma frame during implementation. The kit's SectionMessage styling is assumed to match the light-grey container in the mockup.
