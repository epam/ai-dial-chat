## MODIFIED Requirements

### Requirement: `ConversationSourcesPanel` renders a global empty state or the source sections

`ConversationSourcesPanel` SHALL render either a global empty state or the source/task sections described below. `apps/chat/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx` accepts no props, imports `SidebarPanel` from `@epam/ai-dial-sidebar`, obtains `messages` and `conversationModelId` from `useSourcesSidebarData()` and `isOpen`/`handleClose` from `useSourcesSidebar()` (both exported from `apps/chat/src/context/SourcesSidebarContext.tsx`), derives `uploaded`, `generated`, and `sources` through `useConversationSources(isOpen ? messages : EMPTY_MESSAGES)` where `EMPTY_MESSAGES` is a module-level constant array, so the derivation does not run while the sidebar is closed, reads `useActiveScheduledTask()` for scheduled-task state, and renders `<SidebarPanel side="right">`.

The panel SHALL use `useAttachmentAction()` to obtain `handleAttachmentClick` and SHALL pass it as `onAttachmentClick` to both `FilesSection` instances (Uploaded Files and Generated Files).

The panel SHALL be considered empty when `uploaded.length === 0` AND `generated.length === 0` AND `sources.length === 0` AND the active conversation is not a scheduled-task conversation (per `useActiveScheduledTask()`). When the active conversation is a scheduled-task conversation, the panel SHALL NEVER be considered empty, even if `uploaded`, `generated`, and `sources` are all empty — the History and Details sections (see the ADDED requirements below) always render in that case.

When the panel is empty (per the updated definition above):

- The header SHALL contain only the built-in close button; `leftActions` and `rightActions` SHALL not render search or download-all buttons.
- The body SHALL render `NoDataContent` from `@epam/ai-dial-ui-kit`, centred horizontally and vertically, with `title` set to the i18n value of `basic.noData` (`"No data"`). No `icon` prop is supplied, so `NoDataContent` uses its default icon.
- No section headings SHALL be rendered.

When the panel is not empty:

- `leftActions` SHALL contain a search input (text field with `IconSearch`) whose `aria-label` is the i18n value of `sidebar.sources.search`. Typing into the input filters sources as described in the Search scenario below. The search input SHALL only render when at least one of `uploaded`, `generated`, or `sources` is non-empty; it MAY be omitted when the conversation has no searchable file/source content even if scheduled-task sections are rendering.
- `rightActions` SHALL contain a `GhostIconButton` with `IconDownload` and the i18n `aria-label` `sidebar.sources.downloadAll` whenever at least one attachment in `uploaded` or `generated` is downloadable (i.e. has a DIAL-hosted file URL resolvable by the same mechanism `handleAttachmentClick` uses). When no attachment currently in `uploaded`/`generated` is downloadable, the button SHALL NOT be rendered at all (it is hidden, never shown in a disabled state). This action operates only on `uploaded`/`generated` attachments and is unaffected by scheduled-task section content.
- Activating the enabled download-all button SHALL trigger a download of every downloadable attachment in `uploaded` and `generated`, using the same URL-resolution and download-triggering mechanism as clicking an individual attachment card. Attachments that are not downloadable via that mechanism (e.g. reference-only attachments) SHALL be silently skipped, matching single-click behavior for those attachments.
- The body SHALL render sections in the following order:
  1. When the active conversation is a scheduled-task conversation: the History section, then the Details section (both defined in the ADDED requirements below).
  2. The Uploaded Files `FilesSection`.
  3. The Generated Files `FilesSection`.
  4. `SourcesSection` (receiving `sources={filteredSources}`, `title`, and `copyLabel`).
- Uploaded Files, Generated Files, and Sources SHALL retain their existing individual empty behavior (rendering `null` when their own list is empty) regardless of whether scheduled-task sections are present.

For both states:

- `onClose` SHALL call `useSourcesSidebar().handleClose()`.
- `ariaLabel` SHALL be the i18n value of `sidebar.sources.ariaLabel`.
- `closeLabel` SHALL be the i18n value of `sidebar.base.close`.
- `SidebarPanel`'s `title` (per the ADDED "panel header" requirement below) SHALL be independent of the empty/non-empty distinction above.

#### Scenario: Global empty state when no files exist and no scheduled task is active

- **WHEN** `ConversationSourcesPanel` derives empty `uploaded`, `generated`, and `sources` lists AND the active conversation is not a scheduled-task conversation
- **THEN** the body shows centred `NoDataContent` with the `basic.noData` title and default icon
- **AND** no section heading is rendered
- **AND** no search or download-all button is rendered

#### Scenario: Scheduled-task conversation is never shown the global empty state

- **WHEN** the active conversation is a scheduled-task conversation AND `uploaded`, `generated`, and `sources` are all empty
- **THEN** the panel does not render `NoDataContent`
- **AND** the History and Details sections render with their own loading/empty/error states

#### Scenario: Any derived file or source switches the panel to section content

- **WHEN** at least one attachment is present in `uploaded`, `generated`, or `sources`
- **THEN** the global empty state is not rendered
- **AND** the search input is rendered enabled
- **AND** the Uploaded Files, Generated Files, and Sources sections are rendered

#### Scenario: Download-all button is shown when a downloadable attachment is present

- **WHEN** at least one attachment in `uploaded` or `generated` has a DIAL-hosted file URL
- **THEN** the download-all button in `rightActions` is rendered and enabled

#### Scenario: Download-all button is hidden when nothing is downloadable

- **WHEN** `uploaded` and `generated` contain only attachments without a resolvable DIAL-hosted file URL (or both lists are empty)
- **THEN** the download-all button is not rendered

#### Scenario: Download-all ignores scheduled-task section content

- **WHEN** the active conversation is a scheduled-task conversation with a populated History section but empty `uploaded`/`generated`
- **THEN** the download-all button is not rendered, and no download related to run history or task details can be triggered

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
- **AND** `isNoResults` is true only when all three filtered lists (`uploaded`, `generated`, `sources`) are empty after filtering
- **AND** the History and Details sections are unaffected by the search query and are never included in `isNoResults`

#### Scenario: Close button closes the sidebar via context

- **WHEN** the user activates the close button
- **THEN** `useSourcesSidebar().isOpen` becomes `false` on the next read
- **AND** the stored sidebar messages are preserved (they are cleared only when the conversation page unmounts), so reopening the sidebar shows the same content

#### Scenario: Non-empty sections render in fixed order for non-task conversations

- **WHEN** the panel is not empty and the active conversation is not a scheduled-task conversation
- **THEN** Uploaded Files appears first, Generated Files second, Sources third

#### Scenario: Section order for scheduled-task conversations places task sections first

- **WHEN** the active conversation is a scheduled-task conversation
- **THEN** History appears first, Details second, Uploaded Files third, Generated Files fourth, Sources fifth

#### Scenario: Panel passes click handler to both file sections

- **WHEN** `ConversationSourcesPanel` renders with non-empty `uploaded` and `generated`
- **THEN** both `FilesSection` instances receive the same `onAttachmentClick` handler from `useAttachmentAction`

#### Scenario: Clicking an attachment card triggers download

- **WHEN** a user clicks an attachment card in the panel
- **THEN** `handleAttachmentClick` is invoked with the corresponding `DisplayAttachment`

#### Scenario: A closed sidebar does not derive sources

- **GIVEN** the sidebar is closed
- **WHEN** `useSourcesSidebarData().messages` changes (for example on a stream chunk)
- **THEN** `useConversationSources` is not recomputed over the new messages

#### Scenario: Opening the sidebar shows current sources

- **GIVEN** the sidebar is closed while messages with attachments have been published
- **WHEN** the user opens the sidebar
- **THEN** the panel renders sections derived from the current messages on that render


## ADDED Requirements

### Requirement: Sidebar data is published separately from sidebar controls

`apps/chat/src/context/SourcesSidebarContext.tsx` SHALL expose two contexts, both rendered by the existing `SourcesSidebarProvider`:

- The controls context, read by `useSourcesSidebar()`, with value `{ isOpen, handleOpen, handleClose, setMessages, setConversationModelId }`. Every member except `isOpen` is referentially stable for the provider's lifetime.
- The data context, read by `useSourcesSidebarData()`, with value `{ messages, conversationModelId }`.

Each context value SHALL be memoized with `useMemo` over its own fields only. Each hook SHALL throw a clear error when used outside `SourcesSidebarProvider`. A `setMessages` or `setConversationModelId` call SHALL NOT change the controls context value. `useSourcesSidebar()` no longer returns `messages` or `conversationModelId`. `ConversationSourcesPanel` is their only reader.

The provider's name, props and mount point in `apps/chat/src/main.tsx` do not change. There is no user-visible string, RTL or a11y change, feature flag, cache or telemetry.

#### Scenario: A controls-only consumer does not re-render on a messages update

- **GIVEN** a component that calls only `useSourcesSidebar()`, rendered inside `SourcesSidebarProvider`
- **WHEN** `setMessages` is called with a new array
- **THEN** that component does not re-render

#### Scenario: A data consumer sees the new messages

- **GIVEN** a component that calls `useSourcesSidebarData()`
- **WHEN** `setMessages` is called with a new array
- **THEN** that component re-renders and reads the new array

#### Scenario: The data hook outside the provider throws

- **WHEN** `useSourcesSidebarData()` is called outside `SourcesSidebarProvider`
- **THEN** it throws an error naming the provider
