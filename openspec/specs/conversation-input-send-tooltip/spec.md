## Purpose

Define host-configurable send-button tooltip text for empty and populated conversation inputs while preserving existing consumers.

## Requirements

### Requirement: Optional empty-composer tooltip

`InputProps` and `ConversationInputProps` SHALL expose `emptyMessageTooltip?: string` in addition to `sendTooltip?: string`. `ConversationInput` SHALL forward both values to `Input`. `Input` SHALL select `emptyMessageTooltip ?? sendTooltip` when it has no sendable content, and `sendTooltip` otherwise. Sendable content SHALL mean non-whitespace message text, at least one attachment, or an inline-start slot such as a selected skill. Other reasons that disable sending SHALL NOT select the empty tooltip.

The existing local message and attachment state in `Input` SHALL own this selection; hosts SHALL NOT need to mirror that state. Both strings SHALL be supplied by the host. A host such as pg-chat can reuse `chat.sendMessage` and `chat.sendDisabledTooltip`; the library SHALL NOT import app i18n. No new translations, feature flags, backend endpoints, caching, telemetry, or memoization are required. This direction-agnostic text change SHALL preserve existing RTL layout, keyboard behavior, accessible send label, disabled state, and streaming controls.

#### Scenario: Empty draft with an override

- **WHEN** a host supplies `sendTooltip="Send message"` and `emptyMessageTooltip="Type a message first"` with an empty or whitespace-only draft and no other content
- **THEN** hovering the send button shows `Type a message first`
- **AND** sending remains disabled

#### Scenario: Populated draft regardless of other send restrictions

- **WHEN** the draft contains text, including when sending is blocked by `isSendDisabled` or a missing model
- **THEN** hovering the send button shows the regular `sendTooltip`

#### Scenario: Attachment-only or skill-only message

- **WHEN** there is an attachment or inline-start slot and no message text
- **THEN** hovering the send button shows the regular `sendTooltip`
- **AND** this remains true for a blocked attachment

#### Scenario: Draft changes

- **WHEN** typing, clearing, message prop updates, or a successful send reset changes the composer between empty and populated states
- **THEN** the tooltip switches to the corresponding configured text

#### Scenario: Backward-compatible parent application

- **WHEN** an existing caller supplies only `sendTooltip="Send message"`
- **THEN** both empty and populated inputs retain the `Send message` hover tooltip
- **AND** the parent application's existing prop wiring remains unchanged

#### Scenario: Unconfigured tooltips

- **WHEN** neither tooltip prop is supplied
- **THEN** no send tooltip is rendered

#### Scenario: Explicitly suppressed empty tooltip

- **WHEN** `emptyMessageTooltip` is an empty string and the composer has no content
- **THEN** no tooltip is rendered even if `sendTooltip` is supplied
