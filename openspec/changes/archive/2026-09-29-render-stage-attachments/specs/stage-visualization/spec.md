# Spec Delta

## MODIFIED Requirements

### Requirement: `StageItem` collapses/expands its content body

Each `StageItem` SHALL render a header row (icon + name). When `stage.content` is present, or `stage.attachments` contains at least one entry, the item SHALL be a button that toggles an animated content body (CSS grid-rows transition). When both `stage.content` is absent/empty and `stage.attachments` is absent/empty, the item is a static row with no toggle.

#### Scenario: Stage without content renders a plain row
- **WHEN** `stage.content` is undefined or empty and `stage.attachments` is undefined or empty
- **THEN** no toggle button is rendered

#### Scenario: Stage with content renders a collapsible button
- **WHEN** `stage.content` is a non-empty string
- **THEN** a button element is rendered and clicking it expands/collapses the content body

#### Scenario: Stage with only attachments renders a collapsible button
- **WHEN** `stage.content` is undefined or empty and `stage.attachments` contains at least one entry
- **THEN** a button element is rendered and clicking it expands/collapses the content body

## ADDED Requirements

### Requirement: Stage attachments render as attachment tiles inside the expanded content body

When a `StageItem`'s content body is expanded and `stage.attachments` contains entries, the component SHALL map each raw attachment to a display-only attachment model and render it as an attachment tile below any `stage.content`, in array order. Tiles SHALL be rendered in a `role="list"` region with one `role="listitem"` per tile. The component SHALL NOT render an attachment's `data` inline as visible markdown text — a tile is the only visible representation of a stage attachment. The mapped tile's content type (which drives its icon and type badge) SHALL come from the attachment's own declared `type` when present, not from a type inferred from `reference_url`'s path — a stage attachment's `reference_url` points at the source document a result was extracted from, not at the attachment's own content.

#### Scenario: Each attachment renders as its own tile
- **WHEN** the expanded stage has `attachments: [{ title: "[0.2] doc.csv", data: "Some markdown text" }]`
- **THEN** the expanded body shows one attachment tile whose accessible name is "[0.2] doc.csv"

#### Scenario: A tile's type badge reflects the attachment's own declared type, not its reference_url's extension
- **WHEN** an attachment has `type: "text/markdown"`, inline `data`, and `reference_url: "files/abc/uploads/glossary_terms.csv"`
- **THEN** the tile's content type is `"text/markdown"`, not a CSV type inferred from the `.csv` path in `reference_url`

#### Scenario: Multiple attachments render in order
- **WHEN** the expanded stage has two attachments at index 0 and 1
- **THEN** both render as separate tiles, in that order, below any `stage.content`

#### Scenario: A reference-only attachment (no inline data) still renders a tile
- **WHEN** an attachment has `reference_url: "files/abc/doc.csv"` and no `data`
- **THEN** the expanded body still shows one attachment tile for it

### Requirement: Clicking a stage attachment tile invokes a caller-supplied callback

`StageItem` SHALL accept an optional `onAttachmentClick: (attachment: DisplayAttachment) => void` callback, threaded unchanged through `StagesPanel` and `CollapsedGroup`. When a tile is clicked/activated, the component SHALL resolve the click back to the specific mapped display attachment and invoke `onAttachmentClick` with that object. The component SHALL NOT itself open any preview, canvas, or download — that is the caller's responsibility.

#### Scenario: Clicking a tile calls onAttachmentClick with the mapped attachment
- **WHEN** an attachment `{ title: "result.csv", data: "Some markdown text" }` is clicked and `onAttachmentClick` is supplied
- **THEN** `onAttachmentClick` is called once with an object whose `name` is `"result.csv"` and whose `data` is `"Some markdown text"`

#### Scenario: A tile still renders when no callback is supplied
- **WHEN** `onAttachmentClick` is omitted
- **THEN** the tile still renders and clicking it does not throw
