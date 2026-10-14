# conversation-input-usage-limit-banner Specification

## Purpose

The default usage-limit banner shown above the conversation input while the
usage dial is off: its operator-configured warning threshold, source-row
selection, wording and reset time, in-memory dismissal, refresh behaviour, and
the generic `aboveInputSlot` it renders through.

## Requirements

### Requirement: Warning threshold operator config

`chat-api` SHALL accept an optional integer environment variable
`USAGE_LIMITS_WARNING_THRESHOLD_PERCENT`, validated at boot on
`EnvironmentVariables` in `apps/chat-api/src/config/environment.config.ts` with
`@IsInt()`, `@Min(1)`, and `@Max(99)`, defaulting to `75`. A value outside 1–99
or a non-integer SHALL fail validation at boot.

The config registry (`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`)
SHALL expose it as `key: 'usageLimits.warningThresholdPercent'`,
`type: 'config'`, `valueType: 'number'`, `visibility: 'client'`,
`defaultValue: 75`, `envVar: 'USAGE_LIMITS_WARNING_THRESHOLD_PERCENT'`.
`apps/chat-api/src/app-config/client-config.mapper.ts` SHALL map it to
`config.usageLimitsWarningThresholdPercent`, falling back to `75` when the resolved
value is not a number. `ClientConfigResponseDto` SHALL gain a required
`usageLimitsWarningThresholdPercent: number` property with `@ApiProperty`.

No endpoint is added. `GET /api/v1/client-config` keeps its existing
operationId and SDK method, and only gains the field, so the OpenAPI document
and `libs/chat-api-client` are regenerated. Example response fragment:

```json
{ "config": { "usageLimitsWarningThresholdPercent": 75 } }
```

`apps/chat/src/context/AppConfigContext.tsx` SHALL expose
`config.usageLimitsWarningThresholdPercent`, defaulting to `75` before the config
loads and when the response omits it.

The threshold governs the banner only. The dial's running-low mark,
`CatalogLimitStatus`, and the Settings → Usage page keep their fixed 75%.

#### Scenario: Default threshold

- **WHEN** `USAGE_LIMITS_WARNING_THRESHOLD_PERCENT` is not set
- **THEN** `GET /api/v1/client-config` returns `config.usageLimitsWarningThresholdPercent: 75`

#### Scenario: Custom threshold

- **WHEN** `USAGE_LIMITS_WARNING_THRESHOLD_PERCENT=90`
- **THEN** `config.usageLimitsWarningThresholdPercent` is `90`

#### Scenario: Out-of-range value fails boot

- **WHEN** `USAGE_LIMITS_WARNING_THRESHOLD_PERCENT` is `0`, `100`, `abc`, or `80.5`
- **THEN** environment validation rejects it and the service does not start

---

### Requirement: Conversation Input above-input slot

`ConversationInput` in `@epam/ai-dial-conversation-input` SHALL accept an optional `aboveInputSlot?: ReactNode`
(component file `libs/conversation-input/src/components/ConversationInput/ConversationInput.tsx`). It SHALL render the slot
inside the same width-constrained container as `Input`, directly above it,
separated from it by a fixed gap. It SHALL render nothing extra when the slot is
`null` or `undefined`, so the existing layout is preserved. The prop SHALL be
documented with JSDoc on `ConversationInputProps` and in the lib's `README.md`.

The lib SHALL NOT know what the slot contains: no usage DTO, threshold, flag,
dismissal state, or translation enters it.

**RTL impact:** none of its own. The slot is a block-level container, and any
spacing SHALL use logical or block-axis utilities.

#### Scenario: Slot renders above the input

- **WHEN** a host passes `aboveInputSlot={<p>Notice</p>}`
- **THEN** "Notice" renders before the textarea within the composer's width

#### Scenario: Slot omitted

- **WHEN** `aboveInputSlot` is omitted or `null`
- **THEN** the rendered DOM matches the output before this change

---

### Requirement: Banner severity and source row

The app-owned `UsageLimitBanner` SHALL read the selected deployment's `DeploymentLimitsResponseDto`
(component file `apps/chat/src/components/UsageLimitBanner/UsageLimitBanner.tsx`) through
`useDeploymentUsageLimits` (`libs/chat-hooks/src/usage/useDeploymentUsageLimits/useDeploymentUsageLimits.ts`).
It SHALL consider the day, week, and month rows of both the token stats
(`dayTokenStats`, `weekTokenStats`, `monthTokenStats`) and the cost stats
(`dayCostStats`, `weekCostStats`, `monthCostStats`). The minute stats are excluded.

A row is **capped** when its `total` is finite, greater than `0`, and below the
upstream unlimited sentinel (`Number.MAX_SAFE_INTEGER`). For each capped row,
`usedPercent = round(max(used, 0) / total × 100)`, clamped to 0–100.

The **source row** is the capped row with the highest ratio. A tie SHALL go to
the longer period (month > week > day), and an equal period to the token row.

Severity SHALL be:
- **Reached** when the source row's ratio is ≥ 1.
- **Warning** when its `usedPercent` is ≥ `config.usageLimitsWarningThresholdPercent` and its ratio is < 1.
- **None** otherwise. The banner then renders nothing.

The selection SHALL be a pure helper in `apps/chat/src/utils/usage-limits.ts`
that takes the DTO and the threshold. It SHALL NOT go through
`mapDeploymentLimitsToInput`, which drops rows below its fixed 75% ratio.

#### Scenario: Warning at the default threshold

- **WHEN** `dayTokenStats` is `{ used: 80, total: 100 }`, every other row is below 75%, and the threshold is 75
- **THEN** the banner shows the Warning severity for the Daily period at 80%

#### Scenario: Below threshold

- **WHEN** the worst capped row is at 70% and the threshold is 75
- **THEN** the banner renders nothing

#### Scenario: Custom threshold raises the bar

- **WHEN** the threshold is 90 and the worst row is at 80%
- **THEN** the banner renders nothing

#### Scenario: Reached outranks warning

- **WHEN** `weekCostStats` is at 100% and `dayTokenStats` is at 95%
- **THEN** the banner shows the Reached severity for the Weekly period

#### Scenario: Tie goes to the longer period

- **WHEN** `dayTokenStats` and `monthTokenStats` are both at 100%
- **THEN** the source row is the Monthly one

#### Scenario: Unlimited rows ignored

- **WHEN** every row has `total ≥ Number.MAX_SAFE_INTEGER` or `total ≤ 0`
- **THEN** the banner renders nothing

---

### Requirement: Banner rendering and wording

The banner SHALL render the kit `Notification` with
`type={NotificationType.SectionMessage}` and `closable`:
- `variant={NotificationVariant.Warning}` for Warning;
- `variant={NotificationVariant.Error}` for Reached.

Its `message` SHALL be the period sentence in semibold, followed by the reset
sentence in regular weight, on one line where width allows.

Period sentences, as i18n keys in `ConversationInputUsageBannerI18nKeys` in
`apps/chat/src/constants/translation-keys.ts` and in `apps/chat/src/i18n/locales/en.json`.
They are full sentences, not composed fragments, so translators can inflect them:

| Severity | Day | Week | Month |
| --- | --- | --- | --- |
| Warning | `conversationInput.usageBanner.warningDay` — "Daily limit {{percent}}% used." | `conversationInput.usageBanner.warningWeek` — "Weekly limit {{percent}}% used." | `conversationInput.usageBanner.warningMonth` — "Monthly limit {{percent}}% used." |
| Reached | `conversationInput.usageBanner.reachedDay` — "Daily limit reached." | `conversationInput.usageBanner.reachedWeek` — "Weekly limit reached." | `conversationInput.usageBanner.reachedMonth` — "Monthly limit reached." |

Reset sentence, from the source row's `resetsAt`, formatted in the viewer's
locale and timezone:
- **Day:** time with zone offset, through `conversationInput.usageBanner.resetsAtTime`, "Resets at {{time}}." (e.g. "Resets at 3:00 AM GMT+3.").
- **Week and month:** date, through `conversationInput.usageBanner.resetsOnDate`, "Resets on {{date}}." (e.g. "Resets on Oct 19."). The year is included when it differs from the current year.
- The value SHALL be wrapped in `<time dateTime={iso}>` and carry the full accessible expansion that `formatUsageResetTime` (`libs/chat-hooks/src/usage/usage-reset-time.ts`) already produces.
- When `resetsAt` is absent or unparseable, the reset sentence is omitted and the period sentence renders alone.

#### Scenario: Daily warning wording

- **WHEN** the source row is `dayTokenStats` at 80% with `resetsAt` `2026-10-13T00:00:00Z` and the viewer is in GMT+3, locale `en`
- **THEN** the banner reads "Daily limit 80% used. Resets at 3:00 AM GMT+3."

#### Scenario: Monthly reached wording

- **WHEN** the source row is `monthCostStats` at 100% with `resetsAt` `2026-11-01T00:00:00Z`, viewer in UTC
- **THEN** the banner reads "Monthly limit reached. Resets on Nov 1." with the error variant

#### Scenario: Missing reset time

- **WHEN** the source row has no `resetsAt`
- **THEN** only the period sentence renders

---

### Requirement: Dismissal until the situation worsens

Pressing the banner's close button SHALL hide it. The dismissal SHALL be
recorded under the key `${deploymentId}:${period}:${severity}`, where period is
`day`/`week`/`month` and severity is `warning`/`reached`. The banner SHALL stay
hidden while the current source row produces the same key. It SHALL reappear
when the key changes: another deployment is selected, another period becomes the
source row, or the severity rises from Warning to Reached. A Reached → Warning
drop (after a reset) produces a new key and therefore also shows.

Dismissals SHALL be held in memory for the lifetime of the browser tab, shared
by both composers so that moving between the new-chat screen and a
conversation does not resurrect a dismissed banner. They are owned by the hook
`useUsageLimitBannerDismissal` in
`libs/chat-hooks/src/usage/useUsageLimitBannerDismissal/useUsageLimitBannerDismissal.ts`, a module-scoped store
read through `useSyncExternalStore`. They SHALL NOT be written to
`localStorage`, `sessionStorage`, or the user config. A page reload clears them.

#### Scenario: Stays dismissed as usage creeps up

- **WHEN** the user dismisses a Daily 80% warning and usage then rises to 85% on the same day row
- **THEN** the banner stays hidden

#### Scenario: Reappears on escalation

- **WHEN** a dismissed Daily warning becomes Daily reached
- **THEN** the banner shows again with the error variant

#### Scenario: Dismissal survives navigation

- **WHEN** the user dismisses the banner on the new-chat screen, sends a message, and lands in the conversation
- **THEN** the conversation composer does not show the banner for the same key

#### Scenario: Another deployment

- **WHEN** the user switches to a deployment whose source row is over the threshold
- **THEN** that deployment's banner shows, regardless of the earlier dismissal

---

### Requirement: Data freshness, loading, and error states

The banner SHALL fetch through `useDeploymentUsageLimits` when it mounts and
whenever `deploymentId` changes. It SHALL refresh once after a response finishes
streaming (`isGenerationInProgress` `true` → `false`). That effect SHALL move
from `UsageLimitsControl` into a shared hook,
`useRefreshUsageAfterGeneration` in `apps/chat/src/hooks/`, which both
components call, so their behaviour cannot drift. `ConversationView` SHALL pass
`isGenerationInProgress={isAssistantTyping}` to the banner.

- **Before the first response, or with no `deploymentId`:** the banner renders nothing. There is no skeleton, so the layout does not jump on every page load.
- **Fetch failure:** the banner keeps rendering from the last successful response, or renders nothing if there was none. It shows no error text; the Settings → Usage page owns error reporting.
- **Caching:** none beyond the hook's in-memory last response. There is no cache key or TTL.

#### Scenario: Refresh after a response

- **WHEN** a response finishes streaming in a conversation
- **THEN** the banner's limits are fetched once more and its severity updates

#### Scenario: Failure keeps last value

- **WHEN** a refresh rejects after a successful fetch showing a warning
- **THEN** the warning stays visible unchanged

---

### Requirement: Banner accessibility, direction, and memoisation

- **Live region:** the banner SHALL pass `role="status"` to `Notification`, overriding the kit's assertive `role="alert"` for both severities. The banner appears on page load and after streaming, not in response to a user action, so it SHALL NOT interrupt the screen reader.
- **Close button:** it is the kit's own and reachable by Tab. Its accessible name is owned by `@epam/ai-dial-ui-kit`. The kit exposes no label prop, so translating it is out of scope here and is recorded as a kit gap in `design.md`.
- **Contrast and icons:** text contrast comes from the kit's Notification tokens. The warning and error icons are symmetric, so nothing is mirrored for RTL. Layout uses only logical properties.
- **Memoisation:** the component SHALL be exported as `memo(UsageLimitBanner)`. Source-row selection and the formatted strings SHALL be computed with `useMemo` keyed on the DTO, threshold, locale, and `t`. The close handler SHALL be a `useCallback`.
- **Observability:** none. No telemetry or metrics events are added.

#### Scenario: Polite announcement

- **WHEN** the banner first renders with the warning variant
- **THEN** its container has `role="status"`

#### Scenario: Keyboard dismissal

- **WHEN** a keyboard user tabs to the close button and presses Enter
- **THEN** the banner is dismissed
