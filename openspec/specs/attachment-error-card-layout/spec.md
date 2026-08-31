# attachment-error-card-layout Specification

## Purpose

Specifies what the file-attachment tile changes when a non-image attachment is in the error state.

## Requirements

### Requirement: The error state re-styles the file tile without reordering it

When `AttachmentCard` renders a non-image attachment in the error state (`status === RequestStatus.Error`), the tile SHALL keep its normal vertical order — the file name on top, the file-type row below — and SHALL express the error through styling, corner-action spacing, and an announced status instead:

- **Error surface.** The tile root SHALL carry the error style token, and SHALL NOT carry the hover style token, so a tile the user cannot act on does not respond as if it were actionable.
- **Corner-action spacing.** The tile's action buttons are absolutely positioned in the trailing top corner, so exactly one of the two text blocks must reserve room for them. In the normal state that is the **name**; in the error state it is the **file-type row**, because the error state swaps the download action for a retry action that sits alongside remove, and the type row is the one that would otherwise collide with the pair.
- **Announced status.** An `sr-only` `role="status"` `aria-live="polite"` element SHALL carry the error text, and each corner action SHALL reference it by id, so the failure reaches assistive technology even though it is conveyed visually by color alone.
- **Disabled affordances.** Download SHALL be suppressed in the error state; retry SHALL be offered instead, except when the failure reason is an unsupported file type, which retrying cannot fix.

**Text truncation.** Both text blocks truncate with CSS, not JavaScript, and expose the full value through the native `title` attribute rather than a tooltip component:

- The name is `line-clamp-2 break-all` — an attachment name is often a single unbroken token, so it must be allowed to break mid-word.
- The file-type row is a single `truncate` line reading `typeLabel` alone, or `typeLabel · sizeLabel` when a size is known.

When a `searchQuery` is supplied, the name SHALL render through the shared `Highlight` component (capped at the same two lines) rather than as plain text.

**Tile size.** The tile is a fixed `84px` square from the shared tile base class in both states; the error state changes no dimension.

No new SCSS tokens are introduced. `styles.nameText` continues to style the file name and `styles.typeText` the icon and type label; the error state adds only `styles.tileError`.

**RTL**: the tile uses logical Tailwind utilities (`gap-*`, `items-*`, `overflow-hidden`). No physical directional classes are required.

**Accessibility**: the tile root's accessible name comes from its click label; the error text is carried by the status element described above.

#### Scenario: Error card keeps the filename on top

- **WHEN** `AttachmentCard` renders a non-image attachment with `status: RequestStatus.Error`
- **THEN** the filename still appears above the file-type row, as it does in the normal state
- **AND** the tile carries the error style token and not the hover one

#### Scenario: Corner-action spacing moves to the type row on error

- **WHEN** a non-image attachment enters the error state
- **THEN** the reserved space for the corner action buttons moves from the filename block to the file-type row

#### Scenario: The error is announced, not only colored

- **WHEN** a non-image attachment is in the error state
- **THEN** an `sr-only` `role="status"` element carries the error text
- **AND** each corner action button references that element by id

#### Scenario: Retry replaces download, except for an unsupported type

- **WHEN** a non-image attachment is in the error state with a retryable reason
- **THEN** the retry action is rendered and the download action is not
- **AND** when the reason is an unsupported file type, no retry action is offered

#### Scenario: Long filename wraps and exposes the full value

- **WHEN** a card has a filename longer than the tile width
- **THEN** the filename wraps to at most two lines, breaking mid-word if needed, and the full name is available through the element's `title`
- **AND** the tile keeps its fixed 84 px square footprint

#### Scenario: Long file-type label is ellipsed

- **WHEN** a card's file-type row is too long for the tile width
- **THEN** it is truncated with an ellipsis on a single line
