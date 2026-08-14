# conversation-input-usage-limits Specification

## Purpose

The monthly deployment-usage trigger and popover surfaced in the conversation input.

## Requirements

### Requirement: Monthly deployment usage

The app SHALL map `monthTokenStats` from the existing deployment-limits response
to a monthly usage model and fetch it for the selected deployment.

The model SHALL contain `used`, `total`, `remaining`, and `usedPercent`.
Invalid or missing monthly data SHALL produce no model. Finite percentage and
remaining values SHALL be clamped to valid ranges. Totals at or above
`Number.MAX_SAFE_INTEGER` SHALL be treated as absent (no model produced).

Requests for an earlier deployment SHALL NOT overwrite data for the current
deployment. Refresh failures SHALL be recoverable and SHALL NOT affect message
entry or sending.

#### Scenario: Finite monthly usage

- **WHEN** monthly usage is `2,500` of `10,000` tokens
- **THEN** the model exposes `25%` used and `7,500` remaining

#### Scenario: Invalid or unlimited monthly usage

- **WHEN** monthly data is missing, non-finite, has a non-positive total, or
  has a total at or above `Number.MAX_SAFE_INTEGER`
- **THEN** no usage model is exposed

#### Scenario: Deployment changes during a request

- **WHEN** an earlier deployment request resolves after the selected deployment
  has changed
- **THEN** its result is ignored

---

### Requirement: Isolated Conversation Input integration

`@epam/ai-dial-conversation-input` SHALL expose an optional
`usageLimitsSlot?: ReactNode` and render it in the action row near the model
selector. Omitting the slot SHALL preserve the existing layout.

Both `NewConversationComposer` and `ConversationView` SHALL compose the
app-owned usage control into this slot. The library SHALL NOT own deployment
APIs, DTOs, selection state, translations, or usage policy.

#### Scenario: Slot is provided

- **WHEN** a composer supplies the usage control
- **THEN** it appears in the Conversation Input action row

#### Scenario: Slot is omitted

- **WHEN** a consumer does not supply the slot
- **THEN** Conversation Input behaves as before

---

### Requirement: Monthly usage trigger

For valid finite monthly limits, the app SHALL show a compact, accessible usage
trigger. It SHALL reveal the percentage on hover and keyboard focus and keep
that value visible while the popover is open.

Usage at or above 90% SHALL use the theme error state. The value SHALL also be
available in the accessible name so meaning never depends on color or hover
alone. The layout SHALL support LTR and RTL.

#### Scenario: Finite threshold

- **WHEN** finite usage reaches 90%
- **THEN** the trigger displays `90%` and uses the error state

#### Scenario: Unlimited allowance

- **WHEN** the monthly allowance is unlimited (total ≥ `Number.MAX_SAFE_INTEGER`)
- **THEN** `mapDeploymentLimitsToInput` returns `undefined` and no usage control is rendered

#### Scenario: Popover remains open

- **WHEN** focus moves from the trigger into the open popover
- **THEN** the trigger value remains visible

---

### Requirement: Monthly usage popover

Activating the trigger by pointer or keyboard SHALL open a popover titled
`Usage Limit`. It SHALL contain exactly one monthly `DialProgressBar` and one
line containing the locale-formatted `N tokens remaining` value.

The popover SHALL refresh limits on open without displaying a loading
indicator. The control SHALL also refresh limits once when an active generation
ends so the trigger reflects the latest usage without requiring activation. It
SHALL support Escape, outside activation, trigger reactivation, and predictable
focus return. Errors SHALL be announced non-disruptively.

All visible and accessible text SHALL come from app-owned i18n. No feature gate,
new endpoint, cache, polling, or telemetry SHALL be introduced.

#### Scenario: Monthly popover

- **WHEN** the user opens the monthly usage popover
- **THEN** the popover shows `Usage Limit`, one progress bar, and the formatted
  remaining-token count

#### Scenario: Silent refresh

- **WHEN** limits refresh while the popover is open
- **THEN** the current values remain visible and no loader appears

#### Scenario: Generation completes

- **WHEN** an active generation ends
- **THEN** the control refreshes the selected deployment's limits once and
  updates the trigger without requiring the popover to be opened

#### Scenario: Refresh fails

- **WHEN** the refresh request fails
- **THEN** the error is announced and the composer remains usable
