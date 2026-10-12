## MODIFIED Requirements

### Requirement: Assistant table actions are opt-in and streaming-aware

Markdown table actions SHALL be available only when the host supplies localized action labels for a chat message. Both assistant messages and user messages qualify. User bubbles receive the same labels through `MessageBubble`, as defined in `user-message-markdown`. The actions SHALL NOT be gated by `ENABLED_FEATURES` or `ENABLED_FEATURES_ROLES`. The available actions SHALL be Copy and Download as CSV. When the host additionally supplies an Open in Canvas label and callback, the table SHALL also expose Open in Canvas.

#### Scenario: Completed assistant table shows actions

- **WHEN** a completed assistant message renders a Markdown table and the host supplies table action labels
- **THEN** the table exposes a Copy control and a Download as CSV control

#### Scenario: User message table shows actions

- **WHEN** a user message renders a Markdown table and the host supplies table action labels
- **THEN** the table exposes a Copy control and a Download as CSV control, plus Open in Canvas when the host supplies its label and callback

#### Scenario: Other Markdown renderers do not inherit actions

- **WHEN** a Markdown table renders without table action labels, including catalog, source, scheduled-task, and attachment-canvas Markdown file previews (`AttachmentContentType.Markdown`)
- **THEN** the table renders without table actions

#### Scenario: Canvas-opened table keeps Copy and Download

- **WHEN** the attachment canvas renders `AttachmentContentType.MarkdownTable` content
- **THEN** the table exposes Copy and Download as CSV using the canvas's `tableCopyLabel`, `tableCopiedLabel`, and `tableDownloadCsvLabel` labels (supplied by the app from `buttons.copy`, `buttons.copied`, and `buttons.downloadAsCsv`) and the optional `tableDownloadFilename`
- **AND** it does not expose Open in Canvas

#### Scenario: Streaming table hides actions

- **WHEN** the message that contains the table is still streaming
- **THEN** the table actions are hidden

#### Scenario: Canvas action is opt-in

- **WHEN** a completed assistant table has action labels but its host does not supply the optional Open in Canvas label and callback
- **THEN** the table exposes its Copy and Download as CSV controls without an Open in Canvas control
