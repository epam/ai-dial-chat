## Purpose

Defines how users copy and download assistant-generated Markdown tables, and how those tables remain accessible and navigable while preserving a single semantic table structure.

## ADDED Requirements

### Requirement: Assistant table actions are opt-in and streaming-aware

Markdown table actions SHALL be available only when the host supplies localized action labels for an assistant chat message. The actions SHALL NOT be gated by `ENABLED_FEATURES` or `ENABLED_FEATURES_ROLES`. The available actions SHALL be copy as CSV, copy as TXT, copy as Markdown, and download as CSV.

#### Scenario: Completed assistant table shows actions
- **WHEN** a completed assistant message renders a Markdown table and the host supplies table action labels
- **THEN** the table exposes copy-as-CSV, copy-as-TXT, copy-as-Markdown, and download-as-CSV controls

#### Scenario: Other Markdown renderers do not inherit actions
- **WHEN** a Markdown table renders without table action labels, including catalog, source, scheduled-task, and attachment-canvas previews
- **THEN** the table renders without a table action bar

#### Scenario: Streaming table hides actions
- **WHEN** the message that contains the table is still streaming
- **THEN** the table action bar is hidden

### Requirement: Table headers are reusable and customizable

`MarkdownTable` SHALL accept an optional header renderer that receives built-in `{ label, icon, onClick }` action descriptors and returns header content. `@epam/ai-dial-conversation-messages` SHALL export a reusable `TableHeader` component that accepts leading content and caller-supplied action descriptors, and SHALL render those descriptors as accessible UI-kit tooltip buttons. `AssistantMessageBubble` SHALL use that header by default when table action labels are supplied and SHALL accept additional `tableHeaderActions` descriptors.

#### Scenario: Assistant table uses the reusable header
- **WHEN** a completed assistant table renders with table action labels and no custom header renderer
- **THEN** the table header uses the reusable `conversation-messages` component and renders the built-in actions

#### Scenario: Host supplies custom header actions
- **WHEN** a host passes a custom header renderer to a table or assistant message
- **THEN** the host supplies action descriptors rather than button elements, and `TableHeader` renders the buttons and tooltips

#### Scenario: Custom headers follow streaming behavior
- **WHEN** a message with a custom table header is still streaming
- **THEN** the custom table header is hidden

### Requirement: Table data is serialized predictably

Table copy actions SHALL serialize visible header and body cell text. Cell values SHALL be trimmed plain text; inline formatting SHALL NOT be preserved. CSV SHALL use commas, quote non-empty values, and escape embedded double quotes by doubling them. TXT SHALL use tab delimiters. Markdown SHALL produce a pipe-delimited table with a left-aligned separator row.

#### Scenario: CSV preserves values containing commas and quotes
- **WHEN** a table cell contains `Draft "final", v2`
- **THEN** the copied CSV represents that cell as `"Draft ""final"", v2"`

#### Scenario: TXT uses tab-delimited rows
- **WHEN** a table contains a header row and two body rows
- **THEN** the copied TXT contains three lines whose visible cell values are separated by tab characters

#### Scenario: Markdown copy produces a left-aligned table
- **WHEN** a table contains a header row and body rows
- **THEN** the copied Markdown contains the header row, a `| :-- |` separator row, and the body rows

### Requirement: CSV download uses a browser download

Download-as-CSV SHALL download the same serialized rows as copy-as-CSV, prefixed with a UTF-8 byte-order mark and using the `text/csv;charset=utf-8` media type. The default filename SHALL be `table.csv`; a host MAY override it. No filename-editing dialog SHALL be required.

#### Scenario: CSV download opens with correct encoding
- **WHEN** a user activates download-as-CSV
- **THEN** the browser downloads a CSV file containing the UTF-8 byte-order mark and the serialized table rows

#### Scenario: Host overrides the filename
- **WHEN** the host supplies a custom download filename
- **THEN** the downloaded file uses that filename without changing the CSV content

### Requirement: Table controls and scrolling are accessible

Each action control SHALL have a stable accessible name and a UI-kit tooltip using its localized action label. Tooltips SHALL NOT replace or change the button's accessible name. Decorative icons SHALL be hidden from assistive technology, and successful copy feedback SHALL be announced through a polite live region without changing the activated button's accessible name. The scrollable table region SHALL remain a labelled, keyboard-reachable region only while it actually overflows. Tall tables SHALL scroll vertically while their header row remains visible.

#### Scenario: Action buttons show tooltips
- **WHEN** a user hovers or focuses a table action button
- **THEN** the UI-kit tooltip shows that action's localized label while the button retains its stable accessible name

#### Scenario: Copy success is announced
- **WHEN** a copy action succeeds
- **THEN** a polite live region announces the copied status while the activated button retains its original accessible name

#### Scenario: Overflowing table is keyboard reachable
- **WHEN** a table overflows horizontally or vertically
- **THEN** its scroll container has an accessible region name and can receive keyboard focus

#### Scenario: Header remains visible during vertical scrolling
- **WHEN** a table is taller than its bounded scroll area
- **THEN** the user can scroll body rows while the header row remains visible

### Requirement: Table action labels are localized at the application edge

The shared table component SHALL receive every user-visible string as a prop and SHALL NOT import application i18n. The application SHALL use these i18n keys: `buttons.copyAsCsv`, `buttons.copyAsTxt`, existing `buttons.copyAsMarkdown`, existing `buttons.copied`, `buttons.downloadAsCsv`, and `chat.scrollableTable`.

#### Scenario: Localized labels reach the shared component
- **WHEN** the application renders an assistant table in a non-English locale with translated values for the required keys
- **THEN** the table controls and overflow-region label use those translated values

### Requirement: Table layout supports RTL

Table action layout, scrolling, borders, alignment, and overflow indicators SHALL use direction-aware CSS so the table mirrors correctly when the document direction is RTL. Directionally ambiguous action icons SHALL NOT be mirrored.

#### Scenario: Arabic table mirrors without icon distortion
- **WHEN** the document direction is RTL
- **THEN** the table action bar and scroll behavior follow the inline direction while CSV, TXT, Markdown, check, and download icons remain unmirrored
