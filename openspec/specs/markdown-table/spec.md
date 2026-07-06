## Purpose

Defines the toolbar actions available on rendered markdown tables in chat messages, covering copy and download capabilities and the visual/interaction requirements for toolbar buttons.

## Requirements

### Requirement: Table toolbar SHALL provide copy actions for every common format

A toolbar SHALL be rendered above each markdown table in a chat message, offering one-click copy of the table data as CSV, plain text (TXT), and Markdown.

#### Scenario: Copy as CSV places RFC 4180-formatted data on the clipboard
- **WHEN** the user clicks the "Copy as CSV" toolbar button
- **THEN** the table data SHALL be written to the clipboard as RFC 4180 CSV, with each cell double-quote-escaped and commas as delimiters

#### Scenario: Copy as TXT places tab-separated data on the clipboard
- **WHEN** the user clicks the "Copy as TXT" toolbar button
- **THEN** the table data SHALL be written to the clipboard with cells separated by tab characters and rows separated by newlines

#### Scenario: Copy as Markdown places a GFM table on the clipboard
- **WHEN** the user clicks the "Copy as MD" toolbar button
- **THEN** the table data SHALL be written to the clipboard as a GitHub-Flavored Markdown table, including a separator row with alignment markers

#### Scenario: Checkmark feedback is shown after a successful copy
- **WHEN** the user clicks any copy toolbar button
- **THEN** the button icon SHALL switch to a checkmark for 2 seconds, then revert to the original icon
- **THEN** clicking the button again while the checkmark is shown SHALL have no effect

### Requirement: Table toolbar SHALL provide a download action for CSV

A "Download as CSV" button SHALL be present in the table toolbar, allowing the user to save the table as a `.csv` file on their filesystem.

#### Scenario: Clicking Download CSV opens a filename dialog
- **WHEN** the user clicks the "Download as CSV" toolbar button
- **THEN** a modal dialog SHALL open with a filename input pre-filled with `YYYY-MM-DD_table.csv` (current date, ISO zero-padded)

#### Scenario: Confirming the dialog triggers the file download
- **WHEN** the user confirms the filename dialog (non-empty filename)
- **THEN** the browser SHALL initiate a file download with the specified filename
- **THEN** the downloaded file SHALL be UTF-8 encoded with a BOM prefix so Excel opens it correctly

#### Scenario: Cancelling the dialog performs no download
- **WHEN** the user dismisses or cancels the filename dialog
- **THEN** no file SHALL be downloaded and the modal SHALL close

### Requirement: Table toolbar SHALL be hidden while the last message is streaming

The toolbar SHALL not be rendered when the assistant message containing the table is still being streamed.

#### Scenario: Toolbar absent during streaming
- **WHEN** the last message in the conversation is actively streaming
- **THEN** the table toolbar SHALL not be visible

#### Scenario: Toolbar appears after streaming completes
- **WHEN** streaming of the last message completes
- **THEN** the table toolbar SHALL become visible

### Requirement: Table toolbar buttons SHALL use consistent ghost icon button styling

All buttons in the table toolbar SHALL use the `DialGhostIconButton` component from the UI kit with `size={ElementSize.Small}`, ensuring visual consistency across all toolbar actions.
