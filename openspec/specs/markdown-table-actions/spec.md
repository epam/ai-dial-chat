# markdown-table-actions Specification

## Purpose

Defines how users copy and download assistant-generated Markdown tables, and how those tables remain accessible and navigable while preserving a single semantic table structure.

## Requirements

### Requirement: Assistant table actions are opt-in and streaming-aware

Markdown table actions SHALL be available only when the host supplies localized action labels for an assistant chat message. The actions SHALL NOT be gated by `ENABLED_FEATURES` or `ENABLED_FEATURES_ROLES`. The available actions SHALL be Copy and Download as CSV. When the host additionally supplies an Open in Canvas label and callback, the table SHALL also expose Open in Canvas.

#### Scenario: Completed assistant table shows actions
- **WHEN** a completed assistant message renders a Markdown table and the host supplies table action labels
- **THEN** the table exposes a Copy control and a Download as CSV control

#### Scenario: Other Markdown renderers do not inherit actions
- **WHEN** a Markdown table renders without table action labels, including catalog, source, scheduled-task, and attachment-canvas previews
- **THEN** the table renders without table actions

#### Scenario: Streaming table hides actions
- **WHEN** the message that contains the table is still streaming
- **THEN** the table actions are hidden

#### Scenario: Canvas action is opt-in
- **WHEN** a completed assistant table has action labels but its host does not supply the optional Open in Canvas label and callback
- **THEN** the table exposes its Copy and Download as CSV controls without an Open in Canvas control

### Requirement: Table actions appear as a hover-only floating overlay

`MarkdownTable` SHALL render action controls as a floating overlay in the top-right corner of the table. The overlay SHALL be visible only when the user hovers over the table or when keyboard focus is inside it, and SHALL be hidden otherwise. The overlay SHALL follow the viewport when the page is scrolled (sticky positioning).

#### Scenario: Overlay is hidden when the table is not focused
- **WHEN** a table with action labels is rendered and neither hovered nor focused
- **THEN** the overlay is not visible

#### Scenario: Overlay appears on hover
- **WHEN** a user hovers over a table with action labels
- **THEN** the overlay becomes visible

#### Scenario: Overlay is reachable by keyboard
- **WHEN** a user tabs into the overlay's action buttons
- **THEN** the overlay remains visible while focus is within it

### Requirement: Copy produces rich text suitable for paste into document editors

The Copy action SHALL write the table to the system clipboard as both `text/html` (inline-styled table markup) and `text/plain` (raw Markdown pipe table). Rich paste targets (Word, Google Docs, Slack) SHALL receive the HTML version; plain-text targets SHALL receive the Markdown version.

#### Scenario: Copy pastes as a formatted table in rich targets
- **WHEN** a user activates Copy and pastes into a rich-text editor
- **THEN** the pasted content is a formatted table, not raw Markdown text

#### Scenario: Copy pastes as Markdown in plain-text targets
- **WHEN** a user activates Copy and pastes into a plain-text field
- **THEN** the pasted content is the Markdown pipe-table representation

### Requirement: Table data is serialized predictably

Table serialization SHALL use visible header and body cell text. Cell values SHALL be trimmed plain text; inline formatting SHALL NOT be preserved. CSV SHALL use commas, quote non-empty values, and escape embedded double quotes by doubling them. Markdown SHALL produce a pipe-delimited table with a left-aligned separator row.

#### Scenario: CSV preserves values containing commas and quotes
- **WHEN** a table cell contains `Draft "final", v2`
- **THEN** the CSV representation of that cell is `"Draft ""final"", v2"`

#### Scenario: Markdown copy produces a left-aligned table
- **WHEN** a table contains a header row and body rows
- **THEN** the Markdown representation contains the header row, a `| :-- |` separator row, and the body rows

### Requirement: CSV download uses a browser download

Download as CSV SHALL download the same serialized rows as Copy would produce for plain-text targets, prefixed with a UTF-8 byte-order mark and using the `text/csv;charset=utf-8` media type. The default filename SHALL be `table.csv`; a host MAY override it. No filename-editing dialog SHALL be required.

#### Scenario: CSV download opens with correct encoding
- **WHEN** a user activates Download as CSV
- **THEN** the browser downloads a CSV file containing the UTF-8 byte-order mark and the serialized table rows

#### Scenario: Host overrides the filename
- **WHEN** the host supplies a custom download filename
- **THEN** the downloaded file uses that filename without changing the CSV content

### Requirement: A selected table can open in the existing canvas

When a host supplies both the optional Open in Canvas label and an `onOpenInCanvas(markdown: string)` callback, `MarkdownTable` SHALL provide the selected table's serialized Markdown to that callback when the user activates the Open in Canvas control. The shared renderer SHALL NOT import, configure, or otherwise depend on the attachment-canvas package. The application SHALL adapt the callback to the existing attachment canvas by opening `MarkdownCanvasContent` containing only the selected table and a localized canvas title. No new endpoint, generated-client operation, cache, telemetry event, rate limit, or feature flag is required.

#### Scenario: Open in Canvas expands only the selected table
- **WHEN** a completed assistant message contains one or more Markdown tables and a user activates Open in Canvas for one table
- **THEN** the application opens the existing canvas with Markdown content generated from that table only
- **AND THEN** the canvas renders the selected table without the remainder of the assistant message

#### Scenario: Canvas expansion follows visible-table serialization
- **WHEN** a visible table contains formatted cell content or a source alignment marker
- **THEN** the Markdown passed to the host callback contains the same trimmed cell text and left-aligned table structure as Copy
- **AND THEN** it does not claim to preserve source-only inline formatting or alignment

#### Scenario: Streaming table cannot open in canvas
- **WHEN** the message that contains the table is still streaming
- **THEN** Open in Canvas is unavailable with the rest of the table actions

### Requirement: Table controls and scrolling are accessible

Each action control SHALL have a stable accessible name and a UI-kit tooltip using its localized action label. Tooltips SHALL NOT replace or change the button's accessible name. Decorative icons SHALL be hidden from assistive technology, and successful copy feedback SHALL be announced through a polite live region without changing the activated button's accessible name. The scrollable table region SHALL remain a labelled, keyboard-reachable region only while it actually overflows horizontally. A table is never height-bounded; it grows to its natural height and does not scroll vertically.

#### Scenario: Action buttons show tooltips
- **WHEN** a user hovers or focuses a table action button
- **THEN** the UI-kit tooltip shows that action's localized label while the button retains its stable accessible name

#### Scenario: Copy success is announced
- **WHEN** a copy action succeeds
- **THEN** a polite live region announces the copied status while the activated button retains its original accessible name

#### Scenario: Overflowing table is keyboard reachable
- **WHEN** a table overflows horizontally
- **THEN** its scroll container has an accessible region name and can receive keyboard focus

#### Scenario: A tall table is never clipped or made vertically scrollable
- **WHEN** a table has more rows than fit in the visible viewport
- **THEN** the table grows to its full height alongside the rest of the message instead of scrolling within a bounded region

### Requirement: Table action labels are localized at the application edge

The shared table component SHALL receive every user-visible string as a prop and SHALL NOT import application i18n. The application SHALL use these i18n keys: `buttons.copy`, existing `buttons.copied`, `buttons.downloadAsCsv`, `buttons.openInCanvas`, `chat.scrollableTable`, and `chat.markdownTableTitle`.

#### Scenario: Localized labels reach the shared component
- **WHEN** the application renders an assistant table in a non-English locale with translated values for the required keys
- **THEN** the table controls and overflow-region label use those translated values

#### Scenario: Canvas action and title are localized at the application edge
- **WHEN** the application renders an assistant table in a non-English locale and the user opens it in canvas
- **THEN** the action's accessible name and tooltip use `buttons.openInCanvas`
- **AND THEN** the canvas title uses `chat.markdownTableTitle`

### Requirement: Table layout supports RTL

Table action layout, scrolling, borders, alignment, and overflow indicators SHALL use direction-aware CSS so the table mirrors correctly when the document direction is RTL. Directionally ambiguous action icons SHALL NOT be mirrored; the Open in Canvas icon SHALL follow the selected Tabler icon's directional semantics and be mirrored only if it has inherent left/right meaning.

#### Scenario: Arabic table mirrors without icon distortion
- **WHEN** the document direction is RTL
- **THEN** the table action overlay and scroll behavior follow the inline direction while Copy, check, and download icons remain unmirrored
