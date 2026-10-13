## MODIFIED Requirements

### Requirement: Banner rendering and wording

The banner SHALL render the presentational `UsageLimitBannerView` from
`@epam/ai-dial-conversation-input`. The banner's own component file stays
`apps/chat/src/components/UsageLimitBanner/UsageLimitBanner.tsx` (see capability
`conversation-input-usage-banner-view`). It SHALL NOT render the kit
`Notification` itself. It passes:
- `severity`: `UsageLimitBannerSeverity.Warning` for Warning, `UsageLimitBannerSeverity.Reached` for Reached. The view maps these to `NotificationVariant.Warning` and `NotificationVariant.Error`, as a `SectionMessage`;
- `limitText`: the translated period sentence below;
- `reset`: the result of `formatUsageResetShort` (`apps/chat/src/utils/usage-reset-time.ts`) when it is defined, otherwise nothing;
- `onClose`: the handler that records the dismissal, so the banner is always closable.

The period sentence renders in semibold, followed by the reset sentence in
regular weight, on one line where width allows.

`UsageLimitBannerSeverity` from `@epam/ai-dial-conversation-input` is the single
severity enum. `selectUsageBannerSource` (`apps/chat/src/utils/usage-limits.ts`)
SHALL return it, and the app SHALL NOT declare its own severity enum. Its values
(`'warning'`, `'reached'`) keep the dismissal keys unchanged.

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
- The value SHALL be wrapped in `<time dateTime={iso}>` and carry the full accessible expansion that `formatUsageResetTime` (`apps/chat/src/utils/usage-reset-time.ts`) already produces.
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

#### Scenario: Composes the lib view

- **WHEN** the banner renders a Warning
- **THEN** it renders `UsageLimitBannerView` with `severity={UsageLimitBannerSeverity.Warning}`, the translated `limitText`, and an `onClose`

---

### Requirement: Banner accessibility, direction, and memoisation

- **Live region:** the banner's root SHALL have `role="status"`, overriding the kit's assertive `role="alert"` for both severities. `UsageLimitBannerView` sets the role, and the app does not override it. The banner appears on page load and after streaming, not in response to a user action, so it SHALL NOT interrupt the screen reader.
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
