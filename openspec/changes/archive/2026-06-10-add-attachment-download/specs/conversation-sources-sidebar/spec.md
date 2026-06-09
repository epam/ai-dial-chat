## MODIFIED Requirements

### Requirement: Section components render their title, grid, and empty placeholder

`UploadedFilesSection`, `GeneratedFilesSection`, and `SourcesSection` SHALL each render a `<section>` containing the section title (`<h2>` or equivalent heading) and either content or an empty-state line. Each section accepts a `title` and `emptyMessage` prop sourced from i18n by the caller.

For `UploadedFilesSection` and `GeneratedFilesSection`:

- When `attachments.length > 0`: render a 3-column grid (`role="list"`) where each cell (`role="listitem"`) wraps an `AttachmentCard` sized `w-full`. For attachments that have a remote `url`, pass `onDownload` and `downloadLabel` so the card renders a per-card download button. For attachments without a `url` (inline base64), omit `onDownload` so no download button is shown.
- When `attachments.length === 0`: render the `emptyMessage` text in place of the grid.

For `SourcesSection`:

- Always render the `emptyMessage` text below the title in this slice (link list is out of scope).

#### Scenario: Uploaded Files section with attachments

- **WHEN** `UploadedFilesSection` receives two `DisplayAttachment[]`
- **THEN** the rendered DOM contains the title, a `role="list"` grid with two `role="listitem"` cells, each wrapping an `AttachmentCard` for the corresponding attachment

#### Scenario: Uploaded Files section empty

- **WHEN** `UploadedFilesSection` receives `[]`
- **THEN** the rendered DOM contains the title and the empty-message text, but no grid

#### Scenario: Generated Files section parity

- **WHEN** `GeneratedFilesSection` receives the same input shapes
- **THEN** it follows the same rendering rules as `UploadedFilesSection`

#### Scenario: Sources section header-only

- **WHEN** `SourcesSection` is rendered
- **THEN** it shows the title followed by the empty-message text, regardless of any other state

#### Scenario: Download button present for URL-backed attachments

- **WHEN** an `AttachmentCard` inside a section is rendered for an attachment with a non-empty `url`
- **THEN** a download button is present and labelled with the `sidebar.sources.downloadFile` i18n string

#### Scenario: Download button absent for inline attachments

- **WHEN** an `AttachmentCard` inside a section is rendered for an attachment whose `url` is absent
- **THEN** no download button is rendered on that card

#### Scenario: Download button triggers file download

- **WHEN** the user activates the download button on a URL-backed attachment card
- **THEN** the browser initiates a file download for the attachment

## ADDED Requirements

### Requirement: Per-card download i18n key

`apps/chat/src/i18n/locales/en.json` SHALL define the key `sidebar.sources.downloadFile` with the value `"Download file"`. `SidebarI18nKeys` SHALL expose a corresponding `DownloadFile` member mapping to `'sidebar.sources.downloadFile'`.

#### Scenario: Key present in en.json

- **WHEN** `apps/chat/src/i18n/locales/en.json` is inspected
- **THEN** it contains `"downloadFile": "Download file"` nested under `sidebar.sources`

#### Scenario: Typed key member exists

- **WHEN** `SidebarI18nKeys` is inspected
- **THEN** it exposes `DownloadFile = 'sidebar.sources.downloadFile'`
