## ADDED Requirements

### Requirement: `AttachmentTray` forwards a click callback to each `AttachmentCard`

`libs/conversation-input/src/models/AttachmentTray.ts` (`AttachmentTrayProps`) SHALL gain two optional props:

- `onAttachmentClick?: (attachment: DisplayAttachment) => void` — Called when the user clicks or keyboard-activates a card. Receives the full `DisplayAttachment` object.
- `clickLabel?: string` — Forwarded to each `AttachmentCard` as `clickLabel`. When omitted, `AttachmentCard`'s own default (`'Open attachment'`) applies.

`AttachmentTray.tsx` SHALL, for each rendered `AttachmentCard`:
- Pass `(attachment) => onAttachmentClick?.(attachment)` as the `onClick` prop when `onAttachmentClick` is provided.
- Pass `clickLabel` as the `clickLabel` prop (may be `undefined`; card's own default covers that case).
- Continue passing `onRemove`, `onRetry`, and `onExpand` as today — the new props are purely additive.

When `onAttachmentClick` is not provided, no `onClick` is passed to cards, and cards remain inert (no regression to existing consumers).

#### Scenario: Tray cards are inert without `onAttachmentClick`

- **WHEN** `AttachmentTray` is rendered without `onAttachmentClick`
- **THEN** each rendered `AttachmentCard` has no `onClick` prop and is not keyboard-accessible as a button

#### Scenario: Tray cards receive click handler when `onAttachmentClick` is provided

- **WHEN** `AttachmentTray` is rendered with `onAttachmentClick` and an attachment list
- **THEN** each `AttachmentCard` receives an `onClick` prop
- **AND** activating any card invokes `onAttachmentClick` with the corresponding `DisplayAttachment`

#### Scenario: `clickLabel` is forwarded to each card

- **WHEN** `AttachmentTray` is rendered with `onAttachmentClick` and `clickLabel="Download file"`
- **THEN** each `AttachmentCard` receives `clickLabel="Download file"`

#### Scenario: Existing remove and retry callbacks are unaffected

- **WHEN** `AttachmentTray` is rendered with both `onRemove` and `onAttachmentClick`
- **THEN** clicking the remove button calls `onRemove` and does NOT invoke `onAttachmentClick`
