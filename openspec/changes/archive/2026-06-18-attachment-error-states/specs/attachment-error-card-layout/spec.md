## ADDED Requirements

### Requirement: Error state uses inverted card layout for non-image attachments

When `AttachmentCard` renders a non-image attachment in the error state (`status === RequestStatus.Error`), the vertical layout SHALL be inverted compared to the normal state:

- **Top row** — file-type icon (`BottomIcon`) and file-type label, displayed side-by-side with `DialEllipsisTooltip` on the label text. The row does NOT stretch; it is as tall as the icon.
- **Bottom area** — the file name, occupying all remaining vertical space (`flex-1`). The name SHALL use `DialEllipsisTooltip` with multiline mode enabled, so long names wrap across lines and overflow is handled by the tooltip rather than by a hard clamp.

The normal (non-error) non-image layout is unchanged:
- Top area — filename, `line-clamp-3`.
- Bottom row — icon + label.

No new SCSS tokens are introduced. The existing `styles.meta` token continues to style the icon and label; `styles.name` continues to style the filename text.

**RTL**: Both rows use logical Tailwind utilities (`gap-*`, `items-*`, `overflow-hidden`). The `DialEllipsisTooltip` handles text directionality internally. No physical directional classes required.

**Accessibility**: No change to keyboard interaction or ARIA. The card root element's accessible label is derived from the attachment name (unchanged).

**Memoisation**: `getAttachmentCardState` is already wrapped in `useMemo` in `AttachmentCard`; no additional memoisation needed for this change.

#### Scenario: Error card shows type on top, filename below

- **WHEN** `AttachmentCard` renders a non-image attachment with `status: RequestStatus.Error`
- **THEN** the file-type icon and label appear in the top section of the card
- **AND** the filename occupies the area below

#### Scenario: Normal card retains filename-on-top layout

- **WHEN** `AttachmentCard` renders a non-image attachment with `status: RequestStatus.Idle`
- **THEN** the filename appears in the top section
- **AND** the file-type icon and label appear at the bottom

#### Scenario: Long filename wraps with tooltip in error state

- **WHEN** an error card has a filename longer than the card width
- **THEN** the filename wraps across lines and a tooltip shows the full name on hover/focus
- **AND** the card height remains fixed at 100 px (content clips if needed)

#### Scenario: Long file-type label is ellipsed with tooltip in error state

- **WHEN** an error card's file-type label is too long for the top row
- **THEN** the label is truncated with an ellipsis and a tooltip shows the full text on hover/focus
