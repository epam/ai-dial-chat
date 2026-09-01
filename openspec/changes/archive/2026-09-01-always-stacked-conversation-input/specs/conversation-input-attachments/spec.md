## ADDED Requirements

### Requirement: Input always uses the stacked two-row layout

The `Input` component SHALL always render the textarea on its own full-width row above the action bar (`+` button, tools chips when present, model selector, send/stop, mic). There SHALL be no compact single-row layout: no prop, message length, visual line count, tool list, attachment count, or viewport width SHALL place the textarea on the same row as the action controls.

The input wrapper SHALL NOT declare a minimum height; its height SHALL follow its content.

Consequently `Input` SHALL NOT reorder or re-wrap its children per breakpoint. DOM order SHALL be the visual order — textarea container, `+` button, tools chips, trailing actions — with no `order-*` or `desktop:flex-nowrap` overrides.

#### Scenario: Empty input renders two rows

- **WHEN** `Input` is rendered with an empty message, no attachments, and no tools
- **THEN** the textarea occupies its own row above the row holding the `+` button and model selector
- **AND** the same layout is rendered at a mobile viewport and at a desktop viewport

#### Scenario: Layout does not change as the message grows

- **WHEN** the user types text that wraps onto a second visual line, or inserts an explicit newline
- **THEN** the layout is unchanged — the textarea was already on its own row and stays there
- **AND** the action controls do not move

#### Scenario: Attachments do not change the layout

- **WHEN** one or more files are attached
- **THEN** the `AttachmentTray` is rendered above the textarea row
- **AND** the textarea remains on its own row above the action bar

#### Scenario: Tools chips render on their own row

- **WHEN** the deployment exposes tools and at least one chip is visible
- **THEN** the chips render in a row between the textarea row and the trailing action controls
- **AND** the trailing action controls stay at the end of the action row

#### Scenario: Textarea renders when the action bar is hidden

- **WHEN** `Input` is rendered with `hideActionBar` and an empty message
- **THEN** the textarea is rendered inside the bordered box
- **AND** the action bar row is not rendered

## REMOVED Requirements

### Requirement: Action bar stays inline when attachments are present

**Reason**: The compact single-row layout is removed — the design now calls for the two-row (stacked) layout unconditionally, so there is no inline layout for attachments (or anything else) to preserve or trigger away from. Replaced by "Input always uses the stacked two-row layout".

**Migration**: Callers that passed `isStacked` to `Input` MUST delete the prop; it no longer exists on `InputProps` and the behaviour it opted into is now the only behaviour. Callers that relied on the compact single-row appearance have no replacement — the input is always two rows and its collapsed height grows accordingly (roughly 100 px instead of 64 px), driven by content rather than by a minimum-height floor. Tests asserting inline placement of the placeholder next to the buttons MUST be rewritten against the stacked layout.
