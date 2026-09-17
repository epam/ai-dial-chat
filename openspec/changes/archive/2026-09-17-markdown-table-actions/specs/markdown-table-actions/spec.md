## Purpose

Defines how users copy and download assistant-generated Markdown tables, and how those tables remain accessible and navigable while preserving a single semantic table structure.

## ADDED Requirements

### Requirement: Assistant table actions are opt-in and streaming-aware

Markdown table actions SHALL be available only when the host supplies localized action labels for an assistant chat message. The actions SHALL NOT be gated by `ENABLED_FEATURES` or `ENABLED_FEATURES_ROLES`. The available actions SHALL be Copy and Download as CSV.

#### Scenario: Completed assistant table shows actions
- **WHEN** a completed assistant message renders a Markdown table and the host supplies table action labels
- **THEN** the table exposes a Copy control and a Download as CSV control

#### Scenario: Other Markdown renderers do not inherit actions
- **WHEN** a Markdown table renders without table action labels, including catalog, source, scheduled-task, and attachment-canvas previews
- **THEN** the table renders without table actions

#### Scenario: Streaming table hides actions
- **WHEN** the message that contains the table is still streaming
- **THEN** the table actions are hidden

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

Download as CSV SHALL download the serialized rows prefixed with a UTF-8 byte-order mark and using the `text/csv;charset=utf-8` media type. The default filename SHALL be `table.csv`; a host MAY override it. No filename-editing dialog SHALL be required.

#### Scenario: CSV download opens with correct encoding
- **WHEN** a user activates Download as CSV
- **THEN** the browser downloads a CSV file containing the UTF-8 byte-order mark and the serialized table rows

#### Scenario: Host overrides the filename
- **WHEN** the host supplies a custom download filename
- **THEN** the downloaded file uses that filename without changing the CSV content

### Requirement: Table controls and scrolling are accessible

Each action control SHALL have a stable accessible name and a UI-kit tooltip using its localized action label. Tooltips SHALL NOT replace or change the button's accessible name. Decorative icons SHALL be hidden from assistive technology, and successful copy feedback SHALL be announced through a polite live region without changing the activated button's accessible name. The scrollable table region SHALL remain a labelled, keyboard-reachable region only while it actually overflows. A table is never height-bounded; it grows to its natural height and does not scroll vertically.

#### Scenario: Action buttons show tooltips
- **WHEN** a user hovers or focuses a table action button
- **THEN** the UI-kit tooltip shows that action's localized label while the button retains its stable accessible name

#### Scenario: Copy success is announced
- **WHEN** a copy action succeeds
- **THEN** a polite live region announces the copied status while the activated button retains its original accessible name

#### Scenario: Overflowing table is keyboard reachable
- **WHEN** a table overflows horizontally
- **THEN** its scroll container has an accessible region name and can receive keyboard focus

### Requirement: Table action labels are localized at the application edge

The shared table component SHALL receive every user-visible string as a prop and SHALL NOT import application i18n. The application SHALL use these i18n keys: `buttons.copy`, existing `buttons.copied`, `buttons.downloadAsCsv`, and `chat.scrollableTable`.

#### Scenario: Localized labels reach the shared component
- **WHEN** the application renders an assistant table in a non-English locale with translated values for the required keys
- **THEN** the table controls and overflow-region label use those translated values

### Requirement: Table layout supports RTL

Table action layout, scrolling, borders, alignment, and overflow indicators SHALL use direction-aware CSS so the table mirrors correctly when the document direction is RTL. Directionally ambiguous action icons SHALL NOT be mirrored.

#### Scenario: Arabic table mirrors without icon distortion
- **WHEN** the document direction is RTL
- **THEN** the table action overlay and scroll behavior follow the inline direction while Copy, check, and download icons remain unmirrored
