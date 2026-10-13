## MODIFIED Requirements

### Requirement: Isolated Conversation Input integration

`@epam/ai-dial-conversation-input` SHALL expose an optional
`usageLimitsSlot?: ReactNode` and render it in the action row near the model
selector. Omitting the slot SHALL preserve the existing layout.

Both `NewConversationComposer` and `ConversationView` SHALL compose the
app-owned usage control into this slot only while
`useFeatureFlag('usageLimitsControl')` is `true`. Otherwise they SHALL pass
`undefined` to `usageLimitsSlot`, so the control is not mounted, and SHALL
instead pass the app-owned `UsageLimitBanner` through `aboveInputSlot` (see
capability `conversation-input-usage-limit-banner`). The two surfaces are
mutually exclusive: for any value of the flag, exactly one of them is composed.
The library SHALL NOT own deployment APIs, DTOs, selection state, translations,
usage policy, or the feature flag.

The flag is the client-visible `features.usageLimitsControl` entry in the
config registry, driven by the `USAGE_LIMITS_CONTROL_ENABLED` environment
variable with `defaultValue: false`.

**Feature flag:** `features.usageLimitsControl` (default off). It is not gated
by `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`.

#### Scenario: Flag is off by default

- **WHEN** `USAGE_LIMITS_CONTROL_ENABLED` is not set
- **THEN** `GET /api/v1/client-config` returns `features.usageLimitsControl: false`
- **AND** neither composer renders the usage control
- **AND** both composers pass `UsageLimitBanner` through `aboveInputSlot`

#### Scenario: Flag is on

- **WHEN** `USAGE_LIMITS_CONTROL_ENABLED=true`
- **THEN** both composers supply the usage control for the selected deployment
- **AND** neither composer passes `aboveInputSlot`, so no usage banner renders

#### Scenario: Slot is provided

- **WHEN** a composer supplies the usage control
- **THEN** it appears in the Conversation Input action row

#### Scenario: Slot is omitted

- **WHEN** a consumer does not supply the slot
- **THEN** Conversation Input behaves as before
