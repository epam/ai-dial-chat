## MODIFIED Requirements

### Requirement: `ConversationSourcesPanel` renders a global empty state or the source sections

`apps/chat/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx` accepts no props, imports `SidebarPanel`/`ConversationSourcesPanel` from the sources-panel lib, obtains messages from `useSourcesSidebar()`, derives `uploaded`, `generated`, and `sources` through `useConversationSources(messages)`, and renders the panel.

The panel SHALL use `useAttachmentAction()` to obtain `handleAttachmentClick` and SHALL pass it as `onAttachmentClick` to both `FilesSection` instances (Uploaded Files and Generated Files).

The panel SHALL be considered empty when `uploaded.length === 0` and `generated.length === 0` and `sources.length === 0`.

When the panel is empty:

- The header SHALL contain only the built-in close button; `leftActions` and `rightActions` SHALL not render search or download-all buttons.
- The body SHALL render a full-height, horizontally and vertically centred empty state.
- The empty state SHALL contain a decorative `IconFileDescription` followed by the i18n value of `sidebar.sources.empty.noData` (`"No data"`).
- The icon SHALL be hidden from assistive technology.
- The Uploaded Files, Generated Files, and Sources section headings and their section-level empty messages SHALL not render.

When the panel is not empty:

- `leftActions` SHALL contain a disabled `GhostIconButton` with `IconSearch` and the i18n `aria-label` `sidebar.sources.search`.
- `rightActions` SHALL contain a `GhostIconButton` with `IconDownload` and the i18n `aria-label` `sidebar.sources.downloadAll`. This button SHALL be enabled whenever at least one attachment in `uploaded` or `generated` is downloadable (i.e. has a DIAL-hosted file URL resolvable by the same mechanism `handleAttachmentClick` uses), and SHALL be disabled only when no attachment currently in `uploaded`/`generated` is downloadable.
- Activating the enabled download-all button SHALL trigger a download of every downloadable attachment in `uploaded` and `generated`, using the same URL-resolution and download-triggering mechanism as clicking an individual attachment card. Attachments that are not downloadable via that mechanism (e.g. reference-only attachments) SHALL be silently skipped, matching single-click behavior for those attachments.
- The body SHALL render, in order: the Uploaded Files `FilesSection`, the Generated Files `FilesSection`, and `SourcesSection` (receiving `sources={filteredSources}`, `title`, and `copyLabel`).

For both states:

- `onClose` SHALL call `useSourcesSidebar().handleClose()`.
- `ariaLabel` SHALL be the i18n value of `sidebar.sources.ariaLabel`.
- `closeLabel` SHALL be the i18n value of `sidebar.base.close`.

#### Scenario: Global empty state when no files exist

- **WHEN** `ConversationSourcesPanel` derives empty `uploaded` and `generated` lists
- **THEN** the body shows the centred file-description icon and `sidebar.sources.empty.noData`
- **AND** no section heading is rendered
- **AND** no search or download-all button is rendered

#### Scenario: Any derived file or source switches the panel to section content

- **WHEN** at least one attachment is present in `uploaded`, `generated`, or `sources`
- **THEN** the global empty state is not rendered
- **AND** the search button is rendered disabled
- **AND** the Uploaded Files, Generated Files, and Sources sections are rendered

#### Scenario: Download-all button is enabled when a downloadable attachment is present

- **WHEN** at least one attachment in `uploaded` or `generated` has a DIAL-hosted file URL
- **THEN** the download-all button in `rightActions` is rendered without the `disabled` attribute

#### Scenario: Download-all button is disabled when nothing is downloadable

- **WHEN** `uploaded` and `generated` contain only attachments without a resolvable DIAL-hosted file URL (or both lists are empty)
- **THEN** the download-all button is rendered with the `disabled` attribute

#### Scenario: Activating download-all downloads every downloadable attachment

- **WHEN** the user activates the enabled download-all button while `uploaded` has one downloadable attachment and `generated` has two downloadable attachments
- **THEN** the same download mechanism used for individual attachment clicks is invoked once per downloadable attachment, for all three attachments

#### Scenario: Non-downloadable attachments are skipped by download-all

- **WHEN** the user activates the enabled download-all button while one attachment in `uploaded` or `generated` is not downloadable (no resolvable DIAL-hosted URL)
- **THEN** no download is triggered for that attachment
- **AND** downloads are still triggered for the remaining downloadable attachments

#### Scenario: Search filters sources by title, URL, and quote

- **WHEN** the user types into the search input
- **THEN** the `filteredSources` list retains only sources where `title`, `url`, or `quote` contains the query (case-insensitive)
- **AND** `isNoResults` is true only when all three filtered lists are empty

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
