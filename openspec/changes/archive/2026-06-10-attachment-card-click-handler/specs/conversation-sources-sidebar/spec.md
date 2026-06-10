## MODIFIED Requirements

### Requirement: Section components render their title, grid, and empty placeholder

`UploadedFilesSection`, `GeneratedFilesSection`, and `SourcesSection` SHALL each render a `<section>` containing the section title (`<h2>` or equivalent heading) and either content or an empty-state line. Each section accepts a `title` and `emptyMessage` prop sourced from i18n by the caller.

For `UploadedFilesSection` and `GeneratedFilesSection`:

- When `attachments.length > 0`: render a 3-column grid (`role="list"`) where each cell (`role="listitem"`) wraps an `AttachmentCard` (no `onRemove`, no `onRetry`) sized `w-full`. When an `onAttachmentClick` callback is provided to the section, the section SHALL forward `(att) => onAttachmentClick(att)` to each card's `onClick` prop and pass the i18n value of `sidebar.sources.attachment.downloadLabel` as `clickLabel`. When `onAttachmentClick` is not provided, `onClick` SHALL be omitted.
- When `attachments.length === 0`: render the `emptyMessage` text in place of the grid.

Both `UploadedFilesSection` and `GeneratedFilesSection` SHALL accept an optional `onAttachmentClick?: (attachment: DisplayAttachment) => void` prop.

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

#### Scenario: Read-only attachment cards without handler

- **WHEN** any rendered `AttachmentCard` inside a section is inspected and no `onAttachmentClick` was supplied
- **THEN** no remove (×), retry (↺), or click handler is present on the card

#### Scenario: Cards receive click handler when `onAttachmentClick` is provided

- **WHEN** `UploadedFilesSection` or `GeneratedFilesSection` is rendered with `onAttachmentClick` supplied
- **THEN** each `AttachmentCard` receives an `onClick` prop
- **AND** activating a card invokes `onAttachmentClick` with the corresponding `DisplayAttachment`

---

### Requirement: `ConversationSourcesPanel` renders a global empty state or the source sections

`apps/chat/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx` SHALL accept `Props { messages: Message[]; }`, import `SidebarPanel` from `@epam/ai-dial-sidebar`, derive `uploaded` and `generated` through `useConversationSources(messages)`, and render `<SidebarPanel side="right">`.

The panel SHALL use `useAttachmentAction()` to obtain `handleAttachmentClick` and SHALL pass it as `onAttachmentClick` to both `FilesSection` instances (Uploaded Files and Generated Files).

The panel SHALL be considered empty when both `uploaded.length === 0` and `generated.length === 0`.

When the panel is empty:

- The header SHALL contain only the built-in close button; `leftActions` and `rightActions` SHALL not render search or download-all buttons.
- The body SHALL render a full-height, horizontally and vertically centred empty state.
- The empty state SHALL contain a decorative `IconFileDescription` followed by the i18n value of `sidebar.sources.empty.noData` (`"No data"`).
- The icon SHALL be hidden from assistive technology.
- The Uploaded Files, Generated Files, and Sources section headings and their section-level empty messages SHALL not render.

When the panel is not empty:

- `leftActions` SHALL contain a disabled `DialGhostIconButton` with `IconSearch` and the i18n `aria-label` `sidebar.sources.search`.
- `rightActions` SHALL contain a disabled `DialGhostIconButton` with `IconDownload` and the i18n `aria-label` `sidebar.sources.downloadAll`.
- The body SHALL render, in order: the Uploaded Files `FilesSection`, the Generated Files `FilesSection`, and `SourcesSection`.

For both states:

- `onClose` SHALL call `useSourcesSidebar().handleClose()`.
- `ariaLabel` SHALL be the i18n value of `sidebar.sources.ariaLabel`.
- `closeLabel` SHALL be the i18n value of `sidebar.base.close`.

#### Scenario: Global empty state when no files exist

- **WHEN** `ConversationSourcesPanel` derives empty `uploaded` and `generated` lists
- **THEN** the body shows the centred file-description icon and `sidebar.sources.empty.noData`
- **AND** no section heading is rendered
- **AND** no search or download-all button is rendered

#### Scenario: Any derived file switches the panel to section content

- **WHEN** at least one attachment is present in either `uploaded` or `generated`
- **THEN** the global empty state is not rendered
- **AND** the search and download-all buttons are rendered disabled
- **AND** the Uploaded Files, Generated Files, and Sources sections are rendered

#### Scenario: Close button closes the sidebar via context

- **WHEN** the user activates the close button
- **THEN** `useSourcesSidebar().isOpen` becomes `false` on the next read
- **AND** the stored sidebar messages are cleared

#### Scenario: Non-empty sections render in fixed order

- **WHEN** the panel is not empty
- **THEN** Uploaded Files appears first, Generated Files second, Sources third

#### Scenario: Panel passes click handler to both file sections

- **WHEN** `ConversationSourcesPanel` renders with non-empty `uploaded` and `generated`
- **THEN** both `FilesSection` instances receive the same `onAttachmentClick` handler from `useAttachmentAction`

#### Scenario: Clicking an attachment card triggers download

- **WHEN** a user clicks an attachment card in the panel
- **THEN** `handleAttachmentClick` is invoked with the corresponding `DisplayAttachment`

---

### Requirement: All sidebar user-visible strings come from i18n

All user-visible strings in the right sidebar (toggle aria-labels, panel aria-label, close label, section titles, panel-level and section-level empty-state messages, search and download-all aria-labels, attachment click label) SHALL be sourced from i18n keys defined in `apps/chat/src/i18n/locales/en.json` under `sidebar.base.*` and `sidebar.sources.*`. A typed `SidebarI18nKeys` enum/object SHALL be exposed from `apps/chat/src/constants/translation-keys.ts` for consumers.

#### Scenario: New keys added to en.json

- **WHEN** `apps/chat/src/i18n/locales/en.json` is inspected
- **THEN** it contains keys `sidebar.base.toggleOpen`, `sidebar.base.toggleClose`, `sidebar.base.close`, `sidebar.sources.ariaLabel`, `sidebar.sources.search`, `sidebar.sources.downloadAll`, `sidebar.sources.sections.uploadedFiles`, `sidebar.sources.sections.generatedFiles`, `sidebar.sources.sections.sources`, `sidebar.sources.empty.noData`, `sidebar.sources.empty.uploadedFiles`, `sidebar.sources.empty.generatedFiles`, `sidebar.sources.empty.sources`, `sidebar.sources.attachment.downloadLabel`

#### Scenario: Components consume the typed key map

- **WHEN** any sidebar component reads an i18n string
- **THEN** it does so via `t(SidebarI18nKeys.<Member>)`, not via a hardcoded English literal
