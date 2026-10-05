# conversation-sources-sidebar Specification

## Purpose

Specifies the right-side conversation sources panel: the sidebar shell lib (`libs/sidebar`), the presentational panel in `libs/source-panel`, the app container that feeds it, the open/close context, the toggle button, attachment derivation from messages, the panel-level empty state, section components, and the mount point beside `<main>`.

---

## Requirements

### Requirement: Sources sidebar open state is owned by `SourcesSidebarProvider`

`apps/chat/src/context/SourcesSidebarContext.tsx` SHALL define `SourcesSidebarProvider` directly (there is no shared sidebar-context factory). The provider SHALL:

- Initialise `isOpen` to `false`.
- Expose, through `useSourcesSidebar()`, the controls value `{ isOpen, handleOpen, handleClose, setMessages, setConversationModelId }`, where `handleOpen()` sets `isOpen` to `true` and `handleClose()` sets it to `false`. There is no `toggle`.
- Set the context `displayName` to `SourcesSidebarContext` (and `SourcesSidebarDataContext` for the data context described in "Sidebar data is published separately from sidebar controls").
- Make `useSourcesSidebar()` throw `useSourcesSidebar must be used within a SourcesSidebarProvider` when called outside the provider.

#### Scenario: Initial state is closed

- **WHEN** a consumer reads `useSourcesSidebar().isOpen` immediately after mount
- **THEN** the value is `false`

#### Scenario: `handleOpen` and `handleClose` set the open state

- **WHEN** a consumer calls `useSourcesSidebar().handleOpen()`
- **THEN** subsequent reads of `isOpen` return `true`
- **AND WHEN** the consumer then calls `handleClose()`
- **THEN** `isOpen` returns `false`

#### Scenario: Hook outside provider throws

- **WHEN** `useSourcesSidebar()` is called from a component not wrapped in `SourcesSidebarProvider`
- **THEN** an error is thrown naming `SourcesSidebarProvider`

---

### Requirement: `SourcesSidebarToggle` opens the right sidebar

`apps/chat/src/components/Header/SourcesSidebarToggle.tsx` SHALL render a `GhostIconButton` (icon: `IconFileDescription` with `DIAL_KIT_ICON_STROKE`) whose `aria-label` and tooltip come from `SidebarI18nKeys.ToggleOpen` (`sidebar.base.toggleOpen`) and which sets `aria-pressed={isOpen}`. Activating it SHALL first call `useAttachmentCanvas().closeCanvas()` and then `useSourcesSidebar().handleOpen()`. The toggle SHALL render `null` when the current route does not match `${ROUTES.Conversations}/*` or when the sidebar is already open.

The toggle is rendered in three places:

- `Header.tsx` (the mobile header, `desktop:hidden`) in the end column of its `grid-cols-[1fr_auto_1fr]` row, so `<Logo />` stays in the centre column; only when the header is enabled.
- `ChatLayout.tsx` in the end column of the desktop header row (`hidden … desktop:grid`).
- `app.tsx` as the attachment canvas's `leftActions` on mobile.

#### Scenario: Toggle is visible only on a conversation route while the sidebar is closed

- **WHEN** the route matches `${ROUTES.Conversations}/*` and `useSourcesSidebar().isOpen === false`
- **THEN** a button with `aria-label` from `sidebar.base.toggleOpen` is rendered
- **AND WHEN** `isOpen === true` or the route is not a conversation route
- **THEN** the toggle renders nothing

#### Scenario: Click closes the canvas and opens the sidebar

- **WHEN** the toggle is clicked
- **THEN** the attachment canvas is closed
- **AND** `useSourcesSidebar().isOpen` becomes `true`

#### Scenario: Logo stays centred in the mobile header

- **WHEN** the mobile header renders with the toggle visible
- **THEN** `<Logo />` is rendered in the centre column of the header layout

---

### Requirement: `SidebarPanel` shell lives in `libs/sidebar` and renders side-agnostic chrome

`libs/sidebar` (package `@epam/ai-dial-sidebar`, Nx tag `publishable`, Vite build, Vitest tests, exports map including `./styles.css` → `./dist/index.css`) SHALL declare `react`, `@epam/ai-dial-ui-kit`, and `@epam/ai-dial-chat-shared` as peer dependencies and `@tabler/icons-react` as a regular dependency. It SHALL NOT depend on `react-i18next` or import from `apps/**`.

The lib SHALL export `SidebarPanel: FC<SidebarPanelProps>` from `libs/sidebar/src/components/SidebarPanel/SidebarPanel.tsx`, plus the `SidebarOrientation` enum (`Left = 'left'`, `Right = 'right'`, `libs/sidebar/src/types/orientation.ts`) and the `SidebarPanelProps`, `SidebarPanelLabels`, `SidebarPanelStyles`, `SidebarPanelColors`, and `SidebarPanelTypography` types. `SidebarPanelProps` SHALL be defined in `libs/sidebar/src/models/panel-props.ts` with this shape (all symbols carry JSDoc):

- `isOpen: boolean` — required; drives the open/close width animation and sets `inert` on the `<aside>` when `false`.
- `orientation: SidebarOrientation` — required; the edge the panel anchors to.
- `title?: ReactNode` — rendered in the header between the action groups through `EllipsisTooltip` (`titleClassName` defaults to `dial-h1-text`).
- `leftActions?: ReactNode` / `rightActions?: ReactNode` — content of the start and end header groups.
- `onClose?: () => void` — when provided, a close `GhostIconButton` (`IconX`) is rendered and calls it; when omitted, no close button is rendered.
- `labels: SidebarPanelLabels` — `{ ariaLabel: string; closeLabel?: string; resizeLabel?: string }`. `ariaLabel` is the `<aside>`'s `aria-label`; `closeLabel` is the close button's `aria-label` and tooltip; `resizeLabel` (default `'Resize panel'`) labels the resize handle.
- `children: ReactNode` — body content rendered below the header bar in a scrollable region.
- `styles?: SidebarPanelStyles` — `colors` (`background`, `border`, `text`, `resizeHandler`), `typography` (`fontClassName`), `titleClassName`, `bodyClassName`, `className` (on the width wrapper), `headerClassName`, `headerActionsClassName`, `cssVars`.
- `resizable?: boolean` (default `false`), `defaultWidth?: number` (default `360`), `minWidth?: number` (default `280`), `maxWidth?: number` (default `600`), `onResizeStop?: (width: number) => void` — drag-to-resize on the edge opposite `orientation`, via the ui-kit `ConditionalResizableContainer`, enabled only while open.
- `isOverlay?: boolean` (default `false`) — keeps the panel full width in both states and slides it out of the `orientation` edge (direction-aware translate) instead of animating its width.

The shell SHALL render an `<aside role="complementary" aria-label={labels.ariaLabel}>` (public class `dial-sb-aside`) with full height, a `48 px` header bar (public class `dial-sb-header`), and a vertically scrollable body. Unless `isOverlay` is set or `styles.className` contains `w-full`, the wrapper gets an inline width that animates between `0` (closed) and the current width (open).

`orientation` SHALL control only:

- The divider: a `border-s` is added to the `<aside>` only when `orientation === SidebarOrientation.Left` and the panel is open; a Right panel has no divider class of its own.
- The resize edge (`ResizableContainerSide.Left` for a Right panel, `Right` for a Left panel), the overlay slide direction, and a Left-only clip-path for the shadow.

The close button, when present, SHALL always be appended after `rightActions` in the end header group, for either orientation.

#### Scenario: Renders children in the body for either orientation

- **WHEN** `SidebarPanel` receives `children` with `orientation` `Right` or `Left`
- **THEN** the children are rendered inside the scrollable body region in both cases

#### Scenario: Action slots are header-bar-relative

- **WHEN** `SidebarPanel` is rendered with `leftActions` and `rightActions`
- **THEN** `leftActions` appear in the start header group and `rightActions` appear in the end header group, for either orientation

#### Scenario: Close button is the last element of the end group

- **WHEN** `onClose` is provided
- **THEN** the close button is rendered after `rightActions` in the end header group, for either orientation
- **AND WHEN** `onClose` is omitted
- **THEN** no close button is rendered

#### Scenario: Divider appears only on an open Left panel

- **WHEN** `orientation === SidebarOrientation.Left` and `isOpen === true`
- **THEN** the `<aside>` has `border-s`
- **AND WHEN** `orientation === SidebarOrientation.Right`
- **THEN** the `<aside>` has no `border-s`

#### Scenario: Close button calls `onClose`

- **WHEN** the user clicks the close button
- **THEN** `onClose` is invoked exactly once

#### Scenario: Panel exposes ARIA region

- **WHEN** the panel renders
- **THEN** it has `role="complementary"` and `aria-label` matching `labels.ariaLabel`

#### Scenario: Theming overrides emit CSS custom properties

- **WHEN** `SidebarPanel` is rendered with `styles={{ colors: { background: '#ff0000' } }}`
- **THEN** the `<aside>`'s `style` attribute contains `--sb-bg: #ff0000` (produced by `buildCssVars`)
- **AND WHEN** `styles.colors` is omitted
- **THEN** no `--sb-*` entries are set and the SCSS module's CSS-variable fallbacks resolve to the project theme

#### Scenario: Lib has no app or i18n imports

- **WHEN** the source of `libs/sidebar/**` is inspected
- **THEN** no file imports from `react-i18next`, `apps/**`, or any app-scoped path alias (e.g. `@/...`)

---

### Requirement: `ConversationSourcesPanel` renders a global empty state or the source sections

The panel SHALL render either a global empty state or the source/task sections described below, split between an app container and a host-agnostic lib component:

- **App container** — `apps/chat/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx` default-exports `memo(ConversationSourcesPanelContainer)`, which accepts no props. It obtains `messages` and `conversationModelId` from `useSourcesSidebarData()` and `isOpen`/`handleClose` from `useSourcesSidebar()`, derives `uploaded`, `generated`, and `sources` through `useConversationSources(isOpen ? messages : EMPTY_MESSAGES, attachmentDisplayResolvers)` (both module-level constants, so the derivation does not run while the sidebar is closed), reads `useActiveScheduledTask()` for scheduled-task state, builds the scheduled-task History/Details accordions, resolves every label with `t()`, and renders the lib's `ConversationSourcesPanel`.
- **Lib component** — `libs/source-panel/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx` (exported as `ConversationSourcesPanel` from `@epam/ai-dial-source-panel`) receives `isOpen`, `onClose`, `uploaded`, `generated`, `sources`, `onAttachmentClick`, `onSourceClick`, `onDownloadAll`, `isMobile`, `defaultWidth`/`minWidth`/`maxWidth`/`onResizeStop`, `labels`, `styles`, `title`, and `additionalSections`, and renders `<SidebarPanel orientation={SidebarOrientation.Right}>`. It owns the search query (reset to `''` when `isOpen` becomes `false`), filtering, the empty/no-results states, and the sections. It has no i18n, routing, or scheduler knowledge.

The container SHALL pass an `onAttachmentClick` that calls `openAttachmentCanvas(attachment)` (from `useOpenAttachmentCanvas`) and, when the canvas opens, closes the sidebar via `handleClose()`; when it does not open, it downloads the attachment through `useAttachmentAction({ resolveDownloadUrl: resolveDialFileDownloadUrl })`. The lib passes this handler to both `FilesSection` instances.

The container SHALL pass the scheduled-task History and Details accordions as `additionalSections` only when the active conversation is a scheduled-task conversation. The lib SHALL treat the panel as globally empty when `uploaded`, `generated`, and `sources` are all empty AND `additionalSections` is not provided, so a scheduled-task conversation is never globally empty.

When the panel is globally empty:

- The body SHALL render `NoDataContent` from `@epam/ai-dial-ui-kit`, centred horizontally and vertically, with `title={labels.noDataLabel}` (the container passes `t(BasicI18nKeys.Empty)`, i.e. `basic.noData`). No `icon` prop is supplied.
- No search input, download-all button, or section headings SHALL be rendered; the header carries only the close button.

When at least one of `uploaded`, `generated`, or `sources` is non-empty:

- A ui-kit `Search` SHALL render above the body inside a `role="search"` wrapper, with `placeholder` and `aria-label` set to `labels.searchPlaceholder` (`basic.searchPlaceholder`) and `clearLabel` set to `labels.searchClearLabel` (`basic.clearSearch`). When only `additionalSections` is present, the search input is not rendered.
- `rightActions` SHALL contain a `GhostIconButton` with `IconDownload` and `aria-label`/tooltip `labels.downloadAllLabel` (`sidebar.sources.downloadAll`) only when `onDownloadAll` is provided. The container passes `onDownloadAll` only when at least one attachment in `uploaded`/`generated` passes `isDownloadableAttachment`; otherwise the button is not rendered (never shown disabled).
- Activating download-all SHALL call `downloadAttachment(attachment, resolveDialFileDownloadUrl)` (from `@epam/ai-dial-chat-hooks/attachments`) for every downloadable attachment in `uploaded` and `generated`, staggered `150 ms` apart; non-downloadable attachments are skipped. It is unaffected by scheduled-task section content.

The body SHALL render, in order: `additionalSections` (History, then Details, when present), then the Uploaded Files `FilesSection`, the Generated Files `FilesSection`, and `SourcesSection`. Each of the three file/source sections renders `null` when its own (filtered) list is empty.

Search SHALL filter `uploaded` and `generated` by attachment `name`, and `sources` by `title`, `url`, or `quote`, all case-insensitively. When the query is non-empty and all three filtered lists are empty, the three sections are replaced by `PanelNoResults` (`labels.noResultsLabel`, `basic.noResults`) and a polite `role="status"` region announces the same label. `additionalSections` still render above it and are never filtered.

For both states the container SHALL pass:

- `onClose={handleClose}`.
- `labels.ariaLabel` = `t(SidebarI18nKeys.AriaLabel)` (`sidebar.sources.ariaLabel`) and `labels.closeLabel` = `t(ButtonsI18nKeys.Close)` (`buttons.close`).
- `isMobile` from `useIsMobile()`. On mobile the panel is not resizable and takes `w-full` while open. On desktop it is resizable between `312 px` and `usePanelMaxWidth(MIN_CONTENT_AREA_WIDTH)`, starting from the width stored under `StorageKey.ConversationSourcesWidth` (default `360`), and `onResizeStop` writes the new width back.
- `title` per the "Panel header shows the scheduled task's display name" requirement; it does not depend on the empty/non-empty distinction.

#### Scenario: Global empty state when no files exist and no scheduled task is active

- **WHEN** `uploaded`, `generated`, and `sources` are empty AND the active conversation is not a scheduled-task conversation
- **THEN** the body shows centred `NoDataContent` with the `basic.noData` title and default icon
- **AND** no section heading is rendered
- **AND** no search or download-all button is rendered

#### Scenario: Scheduled-task conversation is never shown the global empty state

- **WHEN** the active conversation is a scheduled-task conversation AND `uploaded`, `generated`, and `sources` are all empty
- **THEN** the panel does not render `NoDataContent`
- **AND** the History and Details sections render with their own loading/empty/error states

#### Scenario: Any derived file or source switches the panel to section content

- **WHEN** at least one item is present in `uploaded`, `generated`, or `sources`
- **THEN** the global empty state is not rendered
- **AND** the search input is rendered
- **AND** each non-empty Uploaded Files, Generated Files, or Sources section is rendered

#### Scenario: Download-all button is shown when a downloadable attachment is present

- **WHEN** at least one attachment in `uploaded` or `generated` passes `isDownloadableAttachment`
- **THEN** the download-all button in `rightActions` is rendered and enabled

#### Scenario: Download-all button is hidden when nothing is downloadable

- **WHEN** `uploaded` and `generated` contain no downloadable attachment (or both lists are empty)
- **THEN** the download-all button is not rendered

#### Scenario: Download-all ignores scheduled-task section content

- **WHEN** the active conversation is a scheduled-task conversation with a populated History section but empty `uploaded`/`generated`
- **THEN** the download-all button is not rendered, and no download related to run history or task details can be triggered

#### Scenario: Activating download-all downloads every downloadable attachment

- **WHEN** the user activates download-all while `uploaded` has one downloadable attachment and `generated` has two
- **THEN** the attachment download is triggered once per downloadable attachment, for all three, `150 ms` apart

#### Scenario: Non-downloadable attachments are skipped by download-all

- **WHEN** the user activates download-all while one attachment in `uploaded` or `generated` is not downloadable
- **THEN** no download is triggered for that attachment
- **AND** downloads are still triggered for the remaining downloadable attachments

#### Scenario: Search filters files by name and sources by title, URL, and quote

- **WHEN** the user types into the search input
- **THEN** `uploaded` and `generated` keep only attachments whose `name` contains the query, and `sources` keeps only sources whose `title`, `url`, or `quote` contains it (case-insensitive)
- **AND** `PanelNoResults` is shown only when all three filtered lists are empty
- **AND** the History and Details sections are unaffected by the search query

#### Scenario: Closing the panel clears the search query

- **WHEN** the user has typed a query and the panel closes
- **THEN** the query is reset to an empty string

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

- **WHEN** the panel renders with non-empty `uploaded` and `generated`
- **THEN** both `FilesSection` instances receive the same `onAttachmentClick` handler

#### Scenario: Clicking an attachment card opens it in the canvas or downloads it

- **WHEN** a user clicks an attachment card in the panel
- **THEN** `openAttachmentCanvas` is called with that `DisplayAttachment`
- **AND** if the canvas opens, the sources sidebar closes
- **AND** if it does not open, the attachment is downloaded

#### Scenario: A closed sidebar does not derive sources

- **GIVEN** the sidebar is closed
- **WHEN** `useSourcesSidebarData().messages` changes (for example on a stream chunk)
- **THEN** `useConversationSources` is not recomputed over the new messages

#### Scenario: Opening the sidebar shows current sources

- **GIVEN** the sidebar is closed while messages with attachments have been published
- **WHEN** the user opens the sidebar
- **THEN** the panel renders sections derived from the current messages on that render

---

### Requirement: Source link clicks are routed by URL and content type

`ConversationSourcesPanelContainer` SHALL pass `handleSourceClick` as `onSourceClick` to the lib `ConversationSourcesPanel`, which forwards it to `SourcesSection`. `handleSourceClick` SHALL route each click as follows:

1. **External non-previewable URL** — if the URL is not a DIAL file ID and does not pass the previewability test (see below), open `window.open(url, '_blank', 'noopener,noreferrer')` immediately and return.
2. **PDF page reference** — if `parsePdfPageReference(url)` (from `@epam/ai-dial-quotations`) returns a non-`null` `page`, build a `DisplayAttachment` with `referenceUrl` set to the full source URL (including the `#page=N` fragment), `url` left undefined, and `contentType` `MIMEType.PDF`, then call `openAttachmentCanvas(attachment)`. `useOpenAttachmentCanvas` routes such an attachment through `resolveReferencePdfContent` (→ `referenceAttachmentToPdfCanvasContent`), so the PDF canvas receives `page` and a `selectedHighlightId` for that page, exactly as an inline reference-link preview does. If the canvas opens (`true`), close the sources sidebar. If it does not open (`false`): for a DIAL file ID, trigger a download of the fragment-free base file (`parsed.baseUrl`); otherwise open `window.open(url, '_blank', 'noopener,noreferrer')` with the original, fragment-bearing URL.
3. **External previewable document or DIAL file** — otherwise, resolve the source's effective content type via `resolveExternalSourceContentType(contentType, url)` (see below), build a `DisplayAttachment` from the `QuotationSource` using that resolved content type, and call `openAttachmentCanvas(attachment)`. If the canvas opens (`true`), close the sources sidebar. If the canvas does not open (`false`) and the URL is not a DIAL file ID, open `window.open(url, '_blank', 'noopener,noreferrer')`. If the canvas does not open and the URL is a DIAL file ID, trigger a download.

The page-reference branch lives only in the app container. `libs/source-panel` stays unaware of page semantics and passes the `QuotationSource` through unchanged.

Both helpers below are defined in `libs/chat-hooks/src/files/source-content.ts` and imported by the container from `@epam/ai-dial-chat-hooks/file-manager`. The module keeps its own extension and MIME tables (`OOXML_MIME_TYPE_BY_EXTENSION` for `docx`/`xlsx`/`pptx`/`csv`, `TEXT_EXTENSIONS`, `HTML_EXTENSIONS`) aligned with `@epam/ai-dial-attachment-canvas` without importing it.

**Content type resolution** — `resolveExternalSourceContentType(contentType, url)`:

- Returns `contentType` unchanged if it already trustworthily identifies the source: it starts with `'image/'`, starts with `'audio/'`, equals `'application/pdf'`, or (ignoring parameters and case) equals one of the canonical DOCX/XLSX/PPTX/CSV MIME types in `OOXML_MIME_TYPE_BY_EXTENSION`.
- Otherwise, extracts the last path segment of `url` (ignoring query string and fragment): if its lowercased extension after the last `.` is `'pdf'`, returns `'application/pdf'`; otherwise, if the extension is `docx`/`xlsx`/`pptx`/`csv`, returns that format's canonical MIME type from `OOXML_MIME_TYPE_BY_EXTENSION`. Either case **overrides** the reported `contentType`.
- Otherwise returns `contentType` unchanged.

This override exists because some web-search grounding APIs (e.g. Google Vertex AI) label every web reference — YouTube, news articles, blog posts, PDFs, Office documents, and CSV files alike — with `content-type: text/markdown` regardless of actual content. Without it, the reported `contentType` would win over a recognized document extension when building the `DisplayAttachment`, routing the canvas into the markdown/text viewer instead of the PDF or `@silurus/ooxml` renderer. The `DisplayAttachment` built in step 3 above uses this resolved content type (not the raw `QuotationSource.contentType`) for both its `contentType` and `type` (`AttachmentType.Image` vs `AttachmentType.File`) fields.

**Previewability test** — `isExternalSourcePreviewable(contentType, url)`, built on `resolveExternalSourceContentType`:

- Resolves the effective content type via `resolveExternalSourceContentType(contentType, url)`. Returns `true` if the resolved type starts with `'image/'`, starts with `'audio/'`, equals `'application/pdf'`, or is one of the canonical DOCX/XLSX/PPTX/CSV MIME types.
- Otherwise, extracts the last path segment of `url` and returns `true` when its lowercased extension is in `TEXT_EXTENSIONS` (e.g. `.md`, `.markdown`, `.json`, `.txt`, `.xml`, `.csv`, `.yaml`, source-code extensions) or `HTML_EXTENSIONS` (`.html`/`.htm`).
- Otherwise returns `false` (including a last path segment with no file extension). A URL that does not parse as absolute is treated as a relative path, with its query and fragment stripped.

Image and audio content types, and an already-correct PDF or OOXML content type, are trusted directly because web-search grounding APIs do not mislabel images/audio (or, for PDF/OOXML, because a citation annotation's own `attachment.type` field — the same authoritative marker `annotationToPdfCanvasContent` trusts — is reliable even when the source's URL carries no matching extension, e.g. an opaque citation/reference id rather than a file name).

#### Scenario: Web-search reference URL without a file extension opens in a new tab

- **GIVEN** a `QuotationSource` with `contentType = 'text/markdown'` and a redirect URL containing no file extension (e.g. `https://vertexaisearch.cloud.google.com/grounding-api-redirect/...`)
- **WHEN** the user clicks the source link
- **THEN** `window.open` is called with the URL, `'_blank'`, and `'noopener,noreferrer'`
- **AND** the canvas is not opened

#### Scenario: External PDF URL opens in the canvas

- **GIVEN** a `QuotationSource` with a URL whose last path segment ends in `.pdf`
- **WHEN** the user clicks the source link
- **THEN** `openAttachmentCanvas` is called with a `DisplayAttachment` built from the source
- **AND** if the canvas opens, the sources sidebar is closed

#### Scenario: DIAL PDF source with a page fragment opens at that page

- **GIVEN** a `QuotationSource` with `url = 'files/bucket/report.pdf#page=81'`
- **WHEN** the user clicks the source link
- **THEN** `openAttachmentCanvas` is called with a `DisplayAttachment` whose `referenceUrl` is `'files/bucket/report.pdf#page=81'`, whose `url` is undefined, and whose `contentType` is `MIMEType.PDF`
- **AND** the canvas opens the PDF at page 81
- **AND** the sources sidebar is closed

#### Scenario: External PDF source with a page fragment opens at that page

- **GIVEN** a `QuotationSource` with `url = 'https://example.com/docs/outlook.pdf#page=12'`
- **WHEN** the user clicks the source link
- **THEN** `openAttachmentCanvas` is called with a `DisplayAttachment` whose `referenceUrl` is the full URL and whose `url` is undefined

#### Scenario: PDF page reference that fails to open falls back without losing the page

- **GIVEN** a `QuotationSource` with a PDF page-reference URL and `openAttachmentCanvas` returning `false`
- **WHEN** the user clicks the source link
- **THEN** for a DIAL file ID the download handler is invoked with an attachment whose `url` is the fragment-free base file ID
- **AND** for an external URL `window.open` is called with the original URL including `#page=N`, `'_blank'`, and `'noopener,noreferrer'`

#### Scenario: PDF URL without a page fragment keeps the existing route

- **GIVEN** a `QuotationSource` with `url = 'files/bucket/report.pdf'` (no `#page=N`)
- **WHEN** the user clicks the source link
- **THEN** `openAttachmentCanvas` is called with a `DisplayAttachment` whose `url` is `'files/bucket/report.pdf'` and which has no `referenceUrl`

#### Scenario: Mislabelled content type is overridden by a .pdf URL extension

- **GIVEN** a `QuotationSource` with `contentType = 'text/markdown'` (mislabelled by a web-search grounding API) and a URL whose last path segment ends in `.pdf`
- **WHEN** the user clicks the source link
- **THEN** `openAttachmentCanvas` is called with a `DisplayAttachment` whose `contentType` is `MIMEType.PDF`, not the source's original `'text/markdown'`
- **AND** the PDF opens in the PDF canvas viewer, not the markdown/text viewer

#### Scenario: PDF content type without a .pdf URL extension still opens in the canvas

- **GIVEN** a `QuotationSource` with `contentType = MIMEType.PDF` and a URL with no recognisable file extension (e.g. an opaque citation/reference id)
- **WHEN** the user clicks the source link
- **THEN** `openAttachmentCanvas` is called with a `DisplayAttachment` whose `contentType` is `MIMEType.PDF`

#### Scenario: External text-previewable URL opens in the canvas

- **GIVEN** a `QuotationSource` with a URL whose last path segment has an extension in `TEXT_EXTENSIONS` (e.g. `.md`, `.markdown`, `.json`, `.txt`, `.csv`, `.xml`)
- **WHEN** the user clicks the source link
- **THEN** `openAttachmentCanvas` is called
- **AND** if the canvas opens, the sources sidebar is closed

#### Scenario: Image source opens in the canvas regardless of URL extension

- **GIVEN** a `QuotationSource` with `contentType = 'image/png'` (or any `image/*` value)
- **WHEN** the user clicks the source link
- **THEN** `openAttachmentCanvas` is called

#### Scenario: Canvas failure on external previewable URL falls back to new tab

- **GIVEN** a `QuotationSource` with a previewable URL extension (e.g. `.pdf`) but where `openAttachmentCanvas` returns `false`
- **WHEN** the user clicks the source link
- **THEN** `window.open` is called with the source URL, `'_blank'`, and `'noopener,noreferrer'`

#### Scenario: Canvas failure on DIAL file falls back to download

- **GIVEN** a `QuotationSource` whose URL is a DIAL file ID and where `openAttachmentCanvas` returns `false`
- **WHEN** the user clicks the source link
- **THEN** the attachment download handler is invoked (not `window.open`)

---

### Requirement: `useConversationSources` derives Uploaded, Generated, and Sources lists from messages

`libs/chat-hooks/src/conversation-sources/useConversationSources/useConversationSources.ts` SHALL export `useConversationSources(messages: Message[], resolvers?: AttachmentDisplayResolvers)` returning `{ uploaded: DisplayAttachment[]; generated: DisplayAttachment[]; sources: QuotationSource[] }`. The hook SHALL:

- Walk `messages` once in a single loop.
- For user messages: push all attachments into `uploaded` via `messageAttachmentToDisplayAttachment`, deduplicated by attachment id.
- For assistant messages:
  - Split `msg.custom_content?.attachments` into **reference-only** dtos (`isReferenceOnlyAttachment` from `@epam/ai-dial-quotations` returns `true`) and **regular** dtos (all others).
  - Push only the regular dtos into `generated` via `messageAttachmentToDisplayAttachment`, deduplicated by attachment id.
  - For each reference-only dto, if `dto.reference_url` has not been seen before, append a `QuotationSource` to `sources`:
    - `url` — `dto.reference_url` (unchanged, including any `#page=N` fragment it already carries)
    - `title` — `dto.title ?? dto.reference_url`
    - `contentType` — `dto.reference_type ?? dto.type ?? ''`
    - `quote` — `dto.data` (optional)
  - Also walk `resolveMessageAnnotations(msg)`. For each annotation where `annotation?.body?.source?.attachment?.url` is present, compute its **source URL**:
    - when `getAnnotationPdfPage(annotation)` (from `@epam/ai-dial-quotations`) returns a page `N` **and** `parsePdfPageReference(attachment.url)` returns a reference with `page === null` (a `.pdf` URL with no fragment yet), the source URL is `` `${attachment.url}#page=${N}` ``;
    - otherwise the source URL is `attachment.url` unchanged.

    If that source URL has not been seen before, append a `QuotationSource` to `sources`:
    - `url` — the source URL
    - `title` — `attachment.title ?? <last path segment of attachment.url> ?? attachment.url`
    - `contentType` — `attachment.type ?? ''`
    - `quote` — `annotation.body.quote` (optional)
- Deduplicate `sources` by the (page-qualified) source URL across both reference-only attachments and annotations (first occurrence wins), using a shared `seenUrls` set. Citations of the same PDF on different pages therefore yield one row per page; citations on the same page collapse into one row.
- Tolerate `null`/`undefined` annotation items without throwing.
- Return the three lists wrapped in `useMemo`, keyed on the `messages` and `resolvers` references.

`QuotationSource` is defined in `libs/source-panel/src/models/quotation-source.ts` as:
```ts
interface QuotationSource {
  url: string;
  title: string;
  contentType: string;
  quote?: string;
}
```

Its shape is unchanged. For PDF sources, `url` MAY carry a `#page=N` fragment identifying the cited page.

#### Scenario: No messages

- **WHEN** the hook is called with `[]`
- **THEN** it returns `{ uploaded: [], generated: [], sources: [] }`

#### Scenario: Only user attachments

- **WHEN** every message in the input has `role: MessageRole.User` and one attachment each
- **THEN** all derived attachments appear in `uploaded` in message order
- **AND** `generated` and `sources` are empty

#### Scenario: Only assistant attachments without reference_url

- **WHEN** every message in the input has `role: MessageRole.Assistant` and one regular (url-bearing) attachment each
- **THEN** all derived attachments appear in `generated` in message order
- **AND** `uploaded` and `sources` are empty

#### Scenario: Reference-only attachment goes to sources, not generated

- **WHEN** an assistant message has one attachment with `reference_url` set and no `url`
- **THEN** `generated` receives no entry from that attachment
- **AND** `sources` contains one `QuotationSource` with `url = dto.reference_url`, `title = dto.title`, `contentType = dto.reference_type ?? dto.type ?? ''`, and `quote = dto.data`

#### Scenario: Mixed roles

- **WHEN** a user message with one attachment is followed by an assistant message with two regular attachments
- **THEN** `uploaded` has one entry from the user message and `generated` has two entries from the assistant message

#### Scenario: Message without custom_content

- **WHEN** a message has `custom_content === undefined` or `custom_content.attachments === undefined`
- **THEN** the hook contributes no entries from that message but still processes the rest

#### Scenario: Annotations with source URLs produce sources entries

- **WHEN** an assistant message has `custom_content.annotations` containing two annotations each with `body.source.attachment.url`
- **THEN** both appear in `sources` in annotation order

#### Scenario: PDF annotation with a page selector is page-qualified

- **WHEN** an annotation has `body.source.attachment.url = 'files/bucket/doc.pdf'` and a `pdf_bbox` selector on page 12
- **THEN** `sources` contains a `QuotationSource` with `url = 'files/bucket/doc.pdf#page=12'`

#### Scenario: Same PDF cited on different pages yields one row per page

- **WHEN** two annotations cite `files/bucket/doc.pdf`, one on page 3 and one on page 7
- **THEN** `sources` contains two entries, `…/doc.pdf#page=3` and `…/doc.pdf#page=7`, in annotation order

#### Scenario: Same PDF cited twice on the same page yields one row

- **WHEN** two annotations cite `files/bucket/doc.pdf` on page 3
- **THEN** `sources` contains exactly one entry, `…/doc.pdf#page=3`

#### Scenario: Annotation without a page or on a non-PDF URL is not qualified

- **WHEN** an annotation has no PDF selector, or its attachment URL does not end in `.pdf`, or its URL already carries a fragment
- **THEN** its `QuotationSource.url` equals `body.source.attachment.url` unchanged

#### Scenario: Duplicate source URLs are deduplicated across reference attachments and annotations

- **WHEN** a reference-only attachment and a subsequent annotation resolve to the same source URL (e.g. `reference_url = 'files/bucket/doc.pdf#page=3'` and an annotation on `files/bucket/doc.pdf` with a page-3 selector)
- **THEN** `sources` contains only the first occurrence (the reference attachment)

#### Scenario: Annotations without a source URL are skipped

- **WHEN** an annotation has no `body.source.attachment.url`
- **THEN** it contributes no entry to `sources`

#### Scenario: Memoisation stable on identical messages reference

- **WHEN** the hook is rendered twice with the same `messages` reference
- **THEN** it returns the same `{ uploaded, generated, sources }` object reference both times

---

### Requirement: Section components render their title and content, or nothing when empty

`libs/source-panel` SHALL render the file and source lists through two internal (not exported) components, `FilesSection` and `SourcesSection`, each rendering a `<section>` with an `<h2>` title (`titleClassName`, default `dial-body-semi-text`, overridable through `styles.typography.sectionTitleClassName`) followed by its content. Each returns `null` when its list is empty, so no title or placeholder line is rendered. Section titles render as plain text; matches are highlighted in item labels.

`FilesSection` (`libs/source-panel/src/components/FilesSection/FilesSection.tsx`) is used for both Uploaded Files and Generated Files and accepts `{ attachments: DisplayAttachment[]; title: string; searchQuery?: string; titleClassName?: string; onAttachmentClick?: (attachment: DisplayAttachment) => void; attachmentClickLabel?: string }`. There is no `emptyMessage` prop. When `attachments.length > 0` it SHALL render an auto-fill grid (`role="list"`, `grid-cols-[repeat(auto-fill,minmax(84px,1fr))]`) where each cell (`role="listitem"`) wraps an `AttachmentCard` from `@epam/ai-dial-attachment-input` (no `onRemove`, no `onRetry`) that receives `searchQuery`, `labels={{ clickLabel: attachmentClickLabel }}`, and, only when `onAttachmentClick` is provided, `onClick={() => onAttachmentClick(att)}`. The container passes `attachmentClickLabel = t(AttachmentsI18nKeys.Download)` (`attachments.downloadFile`).

`SourcesSection` (`libs/source-panel/src/components/SourcesSection/SourcesSection.tsx`) accepts `{ title: ReactNode; sources: QuotationSource[]; copyLabel: string; copiedLabel?: string; searchQuery?: string; typography?; colors?; onSourceClick?: (source: QuotationSource) => void }` (`copiedLabel` defaults to `'Link copied to clipboard'`). When `sources.length > 0` it SHALL render a `<ul>` where each `<li>` contains:

- **Row 1** (flex, `items-center`, `justify-between`): a ui-kit `LinkButton` with `href={source.url}`, `target="_blank"`, and `aria-label={source.title}`, whose label is `<Highlight text={source.title} query={searchQuery} maxLines={1} />`; and a `GhostIconButton` with `IconCopy` and `aria-label={copyLabel}` that calls `navigator.clipboard.writeText(source.url)` and then announces `copiedLabel` in a polite `role="status"` region. When `onSourceClick` is provided, clicking the link SHALL call `e.preventDefault()` and invoke `onSourceClick(source)` instead of following the `href`.
- **Row 2** (only when `source.quote` is present): a `<div>` with the quote typography class (default `dial-tiny-text`), `styles.quote` (color token), `line-clamp-5`, and `[&>div>*+*]:mt-1`, containing a `MarkdownRenderer` rendering `source.quote`. The `[&>div>*+*]:mt-1` selector adds vertical spacing between the block-level children of `MarkdownRenderer`'s root `<div>`.

The container passes `copyLabel = t(ButtonsI18nKeys.CopyLink)` and `copiedLabel = t(ButtonsI18nKeys.Copied)`.

#### Scenario: Files section with attachments

- **WHEN** `FilesSection` receives two `DisplayAttachment`s
- **THEN** the rendered DOM contains the title, a `role="list"` grid with two `role="listitem"` cells, each wrapping an `AttachmentCard` for the corresponding attachment

#### Scenario: Files section empty

- **WHEN** `FilesSection` receives `[]`
- **THEN** nothing is rendered — no title, no grid

#### Scenario: Uploaded and Generated Files share one component

- **WHEN** the panel renders both Uploaded Files and Generated Files
- **THEN** both are `FilesSection` instances that differ only in `attachments` and `title`

#### Scenario: Sources section renders nothing when empty

- **WHEN** `SourcesSection` receives `sources={[]}`
- **THEN** it renders `null` — no heading, no list, no empty message

#### Scenario: Sources section renders link and copy button per source

- **WHEN** `SourcesSection` receives two `QuotationSource` items
- **THEN** it renders two `<li>` elements each containing a link and a copy icon button
- **AND** each link's title is rendered through `Highlight` with the current search query

#### Scenario: Copy button writes the source URL to the clipboard

- **WHEN** the user clicks the copy button for a source
- **THEN** `navigator.clipboard.writeText` is called with that source's `url`
- **AND** `copiedLabel` is announced through the section's `role="status"` region

#### Scenario: Quote row is omitted when source has no quote

- **WHEN** a `QuotationSource` has no `quote` field
- **THEN** no second row is rendered for that item

#### Scenario: Quote is rendered as markdown and clamped to five lines

- **WHEN** a `QuotationSource` has a `quote` value
- **THEN** the quote is rendered via `MarkdownRenderer` inside a wrapper div that has `line-clamp-5` applied, so markdown formatting is visible and the block is clamped at five lines with spacing between block elements

#### Scenario: Read-only attachment cards without handler

- **WHEN** any rendered `AttachmentCard` inside a section is inspected and no `onAttachmentClick` was supplied
- **THEN** no remove (×), retry (↺), or click handler is present on the card

#### Scenario: Cards receive click handler when `onAttachmentClick` is provided

- **WHEN** `FilesSection` is rendered with `onAttachmentClick` supplied
- **THEN** each `AttachmentCard` receives an `onClick` prop
- **AND** activating a card invokes `onAttachmentClick` with the corresponding `DisplayAttachment`

---

### Requirement: Panel mounts as a sibling of `<main>` and is hidden when closed

`apps/chat/src/app/app.tsx` (or the active conversation page) SHALL render the right-sidebar slot as a sibling of `<main>` inside the root flex row. Opening or closing the sidebar SHALL NOT modify `<main>`'s class names or layout props.

When `isOpen === false` the panel SHALL be visually and functionally removed. Two acceptable implementations:
- **Unmount**: the slot renders `null` so no `<aside>` element exists in the DOM.
- **Animated collapse** (preferred for smooth transitions): the `<aside>` element remains in the DOM but is collapsed to zero width and marked `inert` so it occupies no visible space, receives no pointer events, and is removed from both the tab order and the accessibility tree.

In either case, when `isOpen === false`, no focusable element inside the panel SHALL be reachable by keyboard and the `complementary` landmark SHALL not be perceivable by assistive technology.

#### Scenario: Closed sidebar is not perceivable

- **WHEN** `isOpen === false`
- **THEN** the panel either does not exist in the DOM, or exists with zero width and the `inert` attribute
- **AND** no focusable element inside the panel is reachable by keyboard

#### Scenario: Open sidebar renders the panel

- **WHEN** `isOpen === true`
- **THEN** an `aside` with `aria-label` matching `sidebar.sources.ariaLabel` is mounted as a sibling of `<main>` and is visible

#### Scenario: Toggling does not modify main layout

- **WHEN** the user opens and closes the sidebar
- **THEN** `<main>`'s class list and width-relevant style attributes are unchanged across the transitions

---

### Requirement: Sources sidebar open state is reset by the resolved schedule, not the conversation id

The sources sidebar's open state SHALL NOT be reset by a change of the raw route conversation id. Instead, the reset SHALL be keyed on the resolved subject of the sidebar: the schedule that owns the active conversation. The schedule SHALL be resolvable for a conversation through three sources:

- The conversation-list lookup — the `scheduleId`, resolved exactly as `ActiveScheduledTaskContext` resolves it (non-task and flag-disabled conversations resolve to none).
- The remembered run history — the run ids the loaded `useScheduledTaskRuns` items showed for the last resolved schedule, remembered while that schedule was resolved. The `nextRunTime` background refresh picks up a freshly fired run before the conversation list does, so this memory SHALL recognize that run's conversation as belonging to the same schedule.
- The kept last resolved `scheduleId` — a `scheduleId` that transiently resolves to `undefined` during a conversation-list reload SHALL NOT erase the kept value; it is dropped only when the conversation id changes.

The reset rule SHALL be:

- The active conversation resolves to **no schedule** through any source (a different task's runs never match another schedule's remembered history) → the sidebar SHALL close. This covers normal-to-normal, task-to-normal, and normal-to-task navigation, reproducing today's behavior exactly (the pre-change unconditional close of issue #7213/#7936). It covers a task conversation unknown to both the conversation list and the loaded run history — one first visited without a resolved schedule context (no hold-open limbo) — and a route that resolves to no conversation id at all (bare `/conversations`, a malformed path segment): the panel stays mounted on those routes, and the reset rule SHALL close there just as the pre-change conversation-id effect did; leaving `/conversations/*` entirely unmounts the panel, so that close stays owned by the Conversation page's unmount cleanup.
- The resolved schedule **changes** (different task) → the sidebar SHALL close.
- The resolved schedule is **unchanged** (switch between runs of the same task, resolved through any combination of the three sources) → the sidebar SHALL stay open; its content continues to follow the active conversation through the existing `ActiveScheduledTaskContext`/run-history behavior with no additional close logic.

The close SHALL NOT be implemented as an effect keyed on `conversationId` in `Conversation.tsx`; ownership of the reset SHALL live in the sidebar/active-task context layer that already resolves the schedule. The existing unmount cleanup (closing the sidebar when leaving the `/conversations/*` routes) SHALL be preserved unchanged. The rule SHALL NOT affect the sidebar's open behavior: the sidebar still opens only by explicit user action, and the user's manual close is unaffected.

#### Scenario: Switching between runs of the same task keeps the sidebar open

- **WHEN** the sources sidebar is open on a scheduled-task run conversation and the user activates another run of the same task in the sidebar's own History list
- **THEN** the sidebar stays open, its Details and History content updates to the newly active run, and no close occurs

#### Scenario: Switching to a freshly fired run the run history knows but the conversation list does not

- **GIVEN** the sources sidebar is open on a run of a schedule whose run history has loaded
- **WHEN** the `nextRunTime` background refresh adds a newly fired run to the loaded run history, the conversation list has not picked the run's conversation up yet, and the user activates that run in the sidebar's own History list
- **THEN** the sidebar stays open — the remembered run history resolves the new conversation to the same schedule

#### Scenario: Same-task switch right after a scheduleId blip keeps the sidebar open

- **GIVEN** the sources sidebar is open on a scheduled-task run conversation with a resolved `scheduleId`
- **WHEN** a conversation-list reload transiently resolves the `scheduleId` to `undefined` on the same conversation, and the user then switches to another run of the same task
- **THEN** the sidebar stays open — the blip does not erase the kept schedule, even when the previous run never appeared in the loaded run history

#### Scenario: Same-task run switch via conversation panel keeps the sidebar open

- **WHEN** the sources sidebar is open on a scheduled-task run conversation and the user navigates (conversation panel row, browser back/forward, or direct URL) to a different conversation of the same `scheduleId`
- **THEN** the sidebar stays open

#### Scenario: Switching to a different task closes the sidebar

- **WHEN** the sources sidebar is open on a scheduled-task run conversation and the user activates another task's conversation in the conversation panel
- **THEN** the sidebar closes (no reopen), matching the behavior of navigating to a normal conversation

#### Scenario: Switching from a task conversation to a normal conversation closes the sidebar

- **WHEN** the sources sidebar is open on a scheduled-task run conversation and the user navigates to a non-task conversation
- **THEN** the sidebar closes

#### Scenario: Normal-to-normal conversation switch still closes the sidebar

- **WHEN** the sources sidebar is open and the user switches from one non-task conversation to another
- **THEN** the sidebar closes (the pre-change #7213/#7936 behavior is preserved; the rule is "close when the current conversation resolves to no schedule", not "close when the schedule changed")

#### Scenario: A conversation unknown to every source closes the sidebar

- **WHEN** the sidebar is open and the user navigates to a conversation that resolves to no schedule through any source (the task feature flag is disabled, or the conversation has no prior resolved-schedule context — for example a direct first visit to a run whose list entry has not loaded), or to a route that resolves to no conversation id (bare `/conversations`, a malformed path segment)
- **THEN** the sidebar closes — there is no state in which the sidebar lingers open awaiting a resolution

#### Scenario: Leaving the conversations routes closes the sidebar

- **WHEN** the sidebar is open and the user navigates away from `/conversations/*` (e.g. back to the Scheduled Tasks page)
- **THEN** the existing unmount cleanup still closes the sidebar

#### Scenario: The reset rule introduces no new open behavior

- **WHEN** the user navigates between conversations of any kind without having opened the sidebar
- **THEN** the sidebar remains closed; nothing auto-opens it

---

### Requirement: All sidebar user-visible strings come from i18n

All user-visible strings in the right sidebar (toggle aria-label, panel aria-label, close label, section titles, search and download-all aria-labels, attachment click label, and the new History/Details section strings) SHALL be sourced from i18n keys. Sidebar-specific strings live under `sidebar.base.*` and `sidebar.sources.*` in `apps/chat/src/i18n/locales/en.json`; the all-empty "No data" string reuses `basic.noData`. A typed `SidebarI18nKeys` enum/object SHALL be exposed from `apps/chat/src/constants/translation-keys.ts` for consumers.

New History/Details/task-summary strings introduced for scheduled-task conversations SHALL reuse existing `scheduledTasks.detail.*` keys, shared button keys, and run-status keys wherever their meaning matches (e.g. status labels, the "no runs" empty state, retry button text) instead of duplicating equivalent English strings under `sidebar.*`. The History/Details section titles reuse `scheduledTasks.detail.historyTitle` and `scheduledTasks.create.detailsSectionTitle`. Only strings with no existing equivalent live under `scheduledTasks.conversationPanel.*`, which today holds `modelLabel` and `currentRunLabel`; there is no load-more status string.

#### Scenario: New keys added to en.json

- **WHEN** `apps/chat/src/i18n/locales/en.json` is inspected
- **THEN** it contains keys `sidebar.base.toggleOpen`, `sidebar.sources.ariaLabel`, `sidebar.sources.downloadAll`, `sidebar.sources.sections.uploadedFiles`, `sidebar.sources.sections.generatedFiles`, `sidebar.sources.sections.sources`, `scheduledTasks.conversationPanel.modelLabel`, `scheduledTasks.conversationPanel.currentRunLabel` — History/Details section titles and the "Show more" button reuse existing keys (`scheduledTasks.detail.historyTitle`, `scheduledTasks.create.detailsSectionTitle`, `buttons.showMore`) rather than duplicating them under `conversationPanel.*`

#### Scenario: Components consume the typed key map

- **WHEN** any sidebar or scheduled-task-section component reads an i18n string
- **THEN** it does so via `t(SidebarI18nKeys.<Member>)` or the equivalent typed scheduled-tasks key map, not via a hardcoded English literal

#### Scenario: Equivalent existing strings are reused, not duplicated

- **WHEN** a History row's status label or the "no runs" empty-state text is rendered inside the sources panel
- **THEN** it uses the same i18n key already defined for that meaning under `scheduledTasks.detail.*`, not a newly duplicated key with equivalent English text

---

### Requirement: Panel header shows the scheduled task's display name with a conversation-title fallback

For a scheduled-task conversation, `SidebarPanel`'s `title` SHALL show the fetched `ScheduledTaskDto.displayName` once `taskState === 'success'`. In every other `taskState` (`'idle'`, `'loading'`, `'error'`, or `'unavailable'` after a `404`), `title` SHALL fall back to the conversation's own title. For non-scheduled-task conversations, `title` SHALL be omitted/unchanged from current behavior.

`libs/source-panel`'s `ConversationSourcesPanelProps` SHALL gain an optional `title?: ReactNode`, passed through unchanged to the underlying `SidebarPanel`'s existing `title` prop. This prop SHALL carry no scheduler-specific typing or defaults inside the lib — it is a plain, host-agnostic `ReactNode` slot.

#### Scenario: Header shows task display name once loaded

- **WHEN** the active conversation is a scheduled-task conversation and `taskState === 'success'`
- **THEN** the panel header shows the task's `displayName`

#### Scenario: Header falls back to conversation title while loading or on error

- **WHEN** the active conversation is a scheduled-task conversation and `taskState` is `'loading'`, `'error'`, or `'unavailable'`
- **THEN** the panel header shows the conversation's title instead of a task name

---

### Requirement: History section shows the task's run list with the active run highlighted

For a scheduled-task conversation, the panel SHALL render a History section built from a shared, host-agnostic presentational component (`ScheduledTaskRunHistoryList`, extracted from the existing `ScheduledTaskDetailView` history rendering into `libs/scheduled-tasks`) fed by the same `useScheduledTaskRuns` state already owned by `ActiveScheduledTaskContext` — no independent fetch is issued by the sources panel.

Each row SHALL show: a localized timestamp (reusing the existing `formatRunTimestamp` convention), a duration suffix when available, and a status icon for `Success`, `Error`, `InProgress`, or `Missed` (reusing the existing `ScheduledTaskRunStatus` enum and icon mapping). Each row's accessible name SHALL include both its status and its timestamp.

The row whose `id` equals the active conversation's `runId` SHALL receive a current-run visual treatment matching the reference design, AND an accessible indication that does not rely on color alone (e.g. an `aria-current="true"` attribute or equivalent text conveyed to assistive technology). If the active `runId` is not present in the currently loaded pages, no row is marked current until a subsequent page load includes it; the section SHALL NOT eagerly fetch every page solely to locate that run.

A row SHALL render as interactive (`role="button"`, keyboard-activatable) and, on activation, navigate to that run's conversation via `getConversationRoute(run.conversationId)` — if and only if that run has a non-empty `conversationId` (mapped from the upstream `conversation_id` field, per the `scheduled-tasks-api` capability). A row whose run has no `conversationId` SHALL remain informational-only: activating it SHALL NOT navigate, fetch run details, or expose any additional row action. `ConversationSourcesPanelContainer` performs no `markConversationViewed` call itself for this navigation — the app's existing `useActiveConversationSync` already marks the newly-active conversation viewed once the URL changes, the same mechanism `scheduled-task-detail-page`'s equivalent History card relies on.

A row whose matched conversation (resolved by matching `run.conversationId` against `useConversations().conversations` via `conversationIdsMatch`, tolerating id-format differences) has `isUnread: true` SHALL additionally show the shared unread-dot indicator, with the unread state folded into that row's accessible name (per `scheduled-task-detail-page`'s equivalent requirement — an ancestor `aria-label` overrides nested `sr-only` content, so the label cannot be a separate nested span). A run with no `conversationId`, or whose `conversationId` matches no loaded conversation item, SHALL show no unread dot.

Runs SHALL be shown in server order (newest first), matching the order already returned by `listScheduledTaskRuns` and preserved by `useScheduledTaskRuns`'s append-without-resort behavior.

#### Scenario: Row shows status, timestamp, and duration

- **WHEN** a loaded run has `status: 'Success'` and a `durationSeconds` value
- **THEN** its row shows a success status icon, its formatted timestamp, and a duration suffix
- **AND** the row's accessible name mentions both the status and the timestamp

#### Scenario: Active run is visually and accessibly marked

- **WHEN** a loaded run's `id` equals the active conversation's `runId`
- **THEN** that row receives the current-run visual treatment
- **AND** an accessible attribute or text conveys "current run" independent of color

#### Scenario: Active run not yet loaded shows no highlighted row

- **WHEN** the active `runId` is not present among the currently loaded run items
- **THEN** no row is marked as current
- **AND WHEN** a later page load includes that run
- **THEN** that row becomes marked as current without any additional fetch triggered solely to find it

#### Scenario: Row with a conversation id navigates to it

- **WHEN** the user clicks (or activates via keyboard) a row whose run has a non-empty `conversationId`
- **THEN** the app navigates to `getConversationRoute(run.conversationId)`, and `ConversationSourcesPanelContainer` makes no direct `markConversationViewed` call

#### Scenario: Row without a conversation id stays a no-op

- **WHEN** the user clicks or activates a run row whose run has no `conversationId`
- **THEN** no navigation occurs, no run-detail request is issued, and no additional menu or action appears

#### Scenario: Unread run shows the dot and accessible suffix

- **WHEN** a row's run has a `conversationId` matching a loaded conversation-list item whose `isUnread` is `true`
- **THEN** the row renders the unread dot and its accessible name ends with the unread indicator label

#### Scenario: Read or unmatched run shows no dot

- **WHEN** a row's run has no `conversationId`, or a `conversationId` that matches no loaded conversation-list item, or matches one whose `isUnread` is `false`
- **THEN** the row renders no unread dot and no unread suffix in its accessible name

---

### Requirement: History section supports skeleton, empty, and error states with a "Show more" pagination button

The History section SHALL show 6 skeleton rows during the initial load (matching `ScheduledTaskDetailView`'s existing skeleton-row convention) and appended skeleton rows while a "Show more" request is in flight. It SHALL show a localized empty state when the task has zero runs, and a section-scoped error message with a retry action when the initial or a subsequent page request fails — this error SHALL NOT hide the Details section, the file/source sections, or the conversation itself.

Unlike `ScheduledTaskDetailView`'s own History card (which keeps its existing scroll-triggered infinite loading, unchanged by this capability), the conversation sources panel's History section SHALL use an explicit **"Show more" button** rendered below the loaded rows instead of a scroll sentinel:

- The button SHALL render only when `hasMore === true`; it SHALL NOT render once `hasMore === false`.
- Activating the button SHALL call `useScheduledTaskRuns.loadMore` (page size 20, offset based on server rows consumed, append without client re-sort, dedupe by run id, `hasMore` derived from `count`/`next` — all reused unmodified) exactly once per activation.
- The button SHALL show a busy/loading state and SHALL be disabled while `isLoadingMore === true`, preventing duplicate requests from repeated activation.
- The button (and the rows it appends to) only exists while the History section is expanded — collapsing the section via the accordion removes it from view and, since its content is not interactable while collapsed (see the collapsible-sections requirement), no further pages can be requested until it is re-expanded.
- Any in-flight request SHALL be cancelled or its result ignored if `scheduleId` changes before it resolves.

#### Scenario: Initial loading shows skeleton rows

- **WHEN** the History section's first page request is in flight
- **THEN** 6 skeleton rows render in place of real rows

#### Scenario: Empty task shows a localized empty state

- **WHEN** the task has zero runs and the initial load has completed successfully
- **THEN** a localized empty-state message renders instead of any rows
- **AND** no "Show more" button renders

#### Scenario: History error is scoped and retryable

- **WHEN** the initial or a "Show more" run-history request fails
- **THEN** a History-scoped error message and retry action render
- **AND** the Details section, file/source sections, and conversation messages remain visible and unaffected

#### Scenario: "Show more" button loads the next page exactly once per click

- **WHEN** `hasMore === true`, no request is in flight, and the user activates the "Show more" button
- **THEN** exactly one load-more request is issued
- **AND** the button shows a busy/disabled state until the request settles

#### Scenario: Button is hidden once every page is loaded

- **WHEN** a page response indicates no further pages (`hasMore` becomes `false`)
- **THEN** the "Show more" button is no longer rendered

#### Scenario: Collapsing History hides the button along with the rows

- **WHEN** the History section is collapsed
- **THEN** the "Show more" button (and the loaded rows) are not interactable, per the collapsible-sections requirement

#### Scenario: Deduplication across pages

- **WHEN** two consecutive pages happen to include an overlapping run `id`
- **THEN** the rendered list contains that run exactly once

#### Scenario: Initial page loads even while the panel is closed

- **WHEN** scheduler metadata resolves for the active conversation while the sources panel is closed
- **THEN** the initial run-history page request still starts (owned by `ActiveScheduledTaskContext`, independent of panel open state)
- **AND** no "Show more" request is issued until the panel is opened, History is expanded, and the user activates the button

---

### Requirement: Details section shows resolved model and rendered instructions

For a scheduled-task conversation, the panel SHALL render a Details section built from a shared, host-agnostic presentational component (`ScheduledTaskDetailsSummary`, `libs/scheduled-tasks`) showing, in order:

- **Model**: the deployment that executed THIS run — the run conversation's own model id (`conversation.assistantModelId || conversation.model.id`, the same value the Conversation page passes as `initialModelId`), published through `SourcesSidebarContext` alongside the messages the page already publishes — resolved to its deployment display name via the deployments context (`findDeploymentByIdOrReference` + `resolveLocalizedText`), falling back to the raw model id when unresolved. The schedule's current `model` SHALL NOT be the source: it names the deployment of the latest saved settings, which a later edit may have changed after this run fired (issue #9045). While the run conversation is still loading (no model id published yet), the Model field SHALL be omitted rather than showing another value.
- **Skill**: when the task has a `skillUrl`, the skill's display name from `useScheduledTaskSkillDisplayName` (a listed own/shared/public skill's name, else the name from `getSkillMetadata`, else the raw `skillUrl`) under the `scheduledTasks.create.skillLabel` label; the row is omitted when the task has no skill.
- **Instructions**: the task's prompt/instructions rendered through the same shared markdown renderer (`MDMessageViewer` from `@epam/ai-dial-chat-shared`) used by `ScheduledTaskDetailView` and chat assistant messages — raw markdown SHALL NOT be shown as plain text, and no separate markdown implementation SHALL be introduced.

The Details section SHALL NOT render edit controls. It is a concise summary; the "Task details" navigation (see `scheduled-task-conversation-context`) remains the path to the full task view.

#### Scenario: Model resolves to the deployment that executed the run

- **WHEN** the run conversation's `model.id` matches a known deployment
- **THEN** the Details section shows that deployment's display name, not the raw id

#### Scenario: Divergence from the schedule's current model

- **WHEN** the schedule's current `model` names a deployment different from the one in the run conversation's `model.id` (the schedule was edited after this run fired)
- **THEN** the Details section shows the run conversation's deployment, not the schedule's current model

#### Scenario: Unresolvable model falls back to the raw id

- **WHEN** the run conversation's `model.id` does not match any known deployment
- **THEN** the Details section shows the raw model id

#### Scenario: Model field is omitted while the conversation loads

- **WHEN** the run conversation is still loading and no model id has been published yet
- **THEN** the Details section omits the Model field rather than showing another value

#### Scenario: Instructions render as formatted markdown

- **WHEN** the task's instructions contain markdown syntax (e.g. lists, bold text)
- **THEN** the Details section renders that formatting via `MDMessageViewer`, not as an escaped/plain-text string

#### Scenario: Skill row shows the task's skill

- **WHEN** the scheduled task has a `skillUrl`
- **THEN** the Details section shows a Skill row with the skill's resolved display name, falling back to the raw `skillUrl` when it cannot be resolved

#### Scenario: No edit affordance is present

- **WHEN** the Details section is inspected
- **THEN** no edit button, input, or other mutation control is rendered

---

### Requirement: History and Details sections are independently collapsible with reset-on-conversation-change defaults

The History and Details sections SHALL each be wrapped in a controlled 2.0 `Accordion` (from `@epam/ai-dial-ui-kit`), built by `ConversationSourcesPanelContainer` and driven by `expanded`/`onToggle` state (`isHistoryExpanded`, `isDetailsExpanded`) rather than `defaultExpanded`. History SHALL default to expanded; Details SHALL default to collapsed. When the active scheduled-task conversation changes (a new `scheduleId`), both sections SHALL reset to these default states.

Each section's trigger SHALL be a keyboard-operable button exposing `aria-expanded` and associated with its controlled content region (e.g. via `aria-controls` and a matching `id`). Directional chevrons SHALL mirror correctly in RTL. When a section is collapsed, its content SHALL NOT retain focusable descendants in the tab order (the container wraps each section's content in a `<div inert={!expanded}>`, per `.claude/rules/a11y.md`). Loading and error messages inside each section SHALL use scoped `role="status"`/`role="alert"` semantics as appropriate, not a page-level equivalent.

#### Scenario: Default expand/collapse state

- **WHEN** a scheduled-task conversation is opened and the sources panel renders its sections for the first time
- **THEN** History is expanded and Details is collapsed

#### Scenario: State resets when the active conversation changes

- **WHEN** the user navigates from one scheduled-task conversation to a different one
- **THEN** History returns to expanded and Details returns to collapsed, regardless of their state on the previous conversation

#### Scenario: Trigger is keyboard-operable and exposes expanded state

- **WHEN** a section's header trigger receives keyboard focus and is activated via Enter/Space
- **THEN** the section's expanded state toggles
- **AND** `aria-expanded` on the trigger reflects the new state

#### Scenario: Collapsed content is unreachable by keyboard

- **WHEN** a section is collapsed
- **THEN** Tab navigation does not land on any focusable element that was inside that section's content

#### Scenario: Chevrons mirror in RTL

- **WHEN** the document direction is `rtl`
- **THEN** each section's expand/collapse chevron is mirrored relative to its `ltr` rendering

---

### Requirement: Scheduled-task requests and sections are gated by the scheduledTasksEnabled feature flag

When `useFeatureFlag('scheduledTasksEnabled')` is `false`, `ConversationSourcesPanel` SHALL make no `getScheduledTask` or `listScheduledTaskRuns` requests (enforced upstream by `ActiveScheduledTaskContext` treating the conversation as non-task, per the `scheduled-task-conversation-context` capability) and SHALL render no History, Details, or task-derived panel title — the panel falls back entirely to its pre-existing behavior for that conversation. This does not alter the TASK badge in the conversation panel, which remains flag-independent per its existing specification.

#### Scenario: Disabled flag suppresses task sections without affecting the badge

- **WHEN** `scheduledTasksEnabled` is `false` for a user viewing a conversation whose list item has `isScheduledTask === true`
- **THEN** the conversation panel still shows the TASK badge
- **AND** the sources panel renders no History or Details sections and makes no scheduled-task API requests
- **AND** the panel header shows the conversation title, not a task display name

---

### Requirement: Scheduled-task section errors are isolated from attachment/source content and from each other

Task-detail failure, run-history failure, and attachment/source-derivation issues SHALL be independent failure domains within the panel:

- A `getScheduledTask` failure SHALL NOT hide the History section, the existing file/source sections, or the conversation.
- A run-history failure SHALL NOT hide the Details section.
- An attachment/source rendering issue SHALL NOT hide the History or Details sections.
- A `404` from `getScheduledTask` (task deleted) SHALL be treated as "task unavailable" (`ActiveScheduledTaskDetailState.Unavailable`): the conversation and existing sections remain visible, the Details section shows the localized `scheduledTasks.conversationBanner.unavailableLabel` text (in a `role="alert"` paragraph, with no retry button) rather than an app-level error, the History section keeps rendering its own run list, and the panel title falls back to the conversation title. A non-404 task failure (`Error`) shows the same text plus a retry button.
- `401`/`403`/`429`/`502`/`503` responses SHALL follow the existing API error/notification conventions without redirecting away from the conversation.
- Each section's retry action SHALL retry only its own failed request (task detail vs. run history), not the other.

#### Scenario: Task-detail 404 keeps the conversation and other sections visible

- **WHEN** `getScheduledTask` responds with `404`
- **THEN** the conversation and existing Uploaded/Generated/Sources sections remain visible
- **AND** the Details section shows the localized "unavailable" text instead of the task content, the History section still renders its run list, and the panel title shows the conversation title (per the header-fallback requirement)

#### Scenario: Run-history failure does not hide Details

- **WHEN** the initial run-history request fails
- **THEN** the Details section still renders (assuming `getScheduledTask` succeeded)

#### Scenario: Retry only affects its own section

- **WHEN** the user activates the History section's retry action after a run-history failure
- **THEN** only the run-history request is retried, and the Details section's own state (if it had succeeded) is unchanged

#### Scenario: Rate-limited or upstream-unavailable responses use existing conventions

- **WHEN** `getScheduledTask` or `listScheduledTaskRuns` responds with `429`, `502`, or `503`
- **THEN** the existing app-wide API error/notification handling applies
- **AND** the user is not redirected away from the conversation

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
