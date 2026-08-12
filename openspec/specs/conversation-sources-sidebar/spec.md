# Spec: conversation-sources-sidebar

## Purpose

Specifies the right-side conversation sources panel: the sidebar shell lib (`libs/sidebar`), the open/close context, the header toggle button, attachment derivation from messages, the panel-level empty state, section components, and the mount point beside `<main>`.

---

## Requirements

### Requirement: Sidebar contexts are produced by a shared factory

`apps/chat/src/context/sidebar/createSidebarContext.tsx` SHALL export `createSidebarContext(displayName: string)` returning `{ Provider, useSidebar }`. The factory SHALL:

- Create an independent React Context whose value is `{ isOpen: boolean; open: () => void; close: () => void; toggle: () => void }`.
- Initialise `isOpen` to `false` inside the Provider.
- Wrap the value in `useMemo` so consumers do not re-render on unrelated parent renders.
- Set the produced context's `displayName` to the supplied parameter.
- Return a guarded hook that throws a clear error when used outside the Provider.

`apps/chat/src/context/sidebar/RightSidebarContext.tsx` SHALL invoke the factory once and re-export `RightSidebarProvider` and `useSourcesSidebar`.

#### Scenario: Factory produces independent contexts

- **WHEN** `createSidebarContext` is called twice with different display names
- **THEN** the two resulting providers and hooks operate on independent state — opening one does not change `isOpen` in the other

#### Scenario: Initial state is closed

- **WHEN** a consumer reads `useSourcesSidebar().isOpen` immediately after mount
- **THEN** the value is `false`

#### Scenario: `open` sets isOpen to true

- **WHEN** a consumer calls `useSourcesSidebar().open()`
- **THEN** subsequent reads of `isOpen` return `true`

#### Scenario: `toggle` flips the current value

- **WHEN** `isOpen` is `false` and a consumer calls `toggle()`
- **THEN** `isOpen` becomes `true`
- **AND WHEN** `toggle()` is called again
- **THEN** `isOpen` becomes `false`

#### Scenario: Hook outside provider throws

- **WHEN** `useSourcesSidebar()` is called from a component not wrapped in `RightSidebarProvider`
- **THEN** an error is thrown describing the missing provider

---

### Requirement: Header toggles the right sidebar

`apps/chat/src/components/Header/Header.tsx` SHALL render a right-aligned `GhostIconButton` (icon: `IconFileDescription` from `@tabler/icons-react`) that calls `useSourcesSidebar().open()` on click. The button SHALL only be rendered when the sidebar is closed (`isOpen === false`). The header SHALL keep `<Logo />` horizontally centred when the toggle is present (e.g. via `grid-cols-[1fr_auto_1fr]`). Its `aria-label` and tooltip text SHALL come from i18n key `sidebar.base.toggleOpen`.

#### Scenario: Open button is visible only when sidebar is closed

- **WHEN** `Header` renders and `useSourcesSidebar().isOpen === false`
- **THEN** a button with `aria-label` from `sidebar.base.toggleOpen` exists and is positioned at the right edge
- **AND WHEN** `useSourcesSidebar().isOpen === true`
- **THEN** no open button is rendered in the header

#### Scenario: Click opens the sidebar

- **WHEN** the open button is clicked
- **THEN** `useSourcesSidebar().isOpen` becomes `true`

#### Scenario: Logo stays centred

- **WHEN** the header renders with the toggle button visible
- **THEN** `<Logo />` is rendered in the centre column of the header layout

---

### Requirement: `SidebarPanel` shell lives in `libs/sidebar` and renders side-agnostic chrome

A new lib at `libs/sidebar` SHALL be created with package name `@epam/ai-dial-sidebar` and module-boundary tag `type:ui`, mirroring the structure of `libs/conversation-input` (Vite build, Vitest tests, ESLint flat config, exports map including `./styles.css`). The lib SHALL declare peer dependencies on `react`, `@epam/ai-dial-ui-kit`, `@epam/ai-dial-chat-shared`, `@tabler/icons-react`, and `classnames`. It SHALL NOT depend on `react-i18next` or import from `apps/**`.

The lib SHALL export `SidebarPanel: FC<SidebarPanelProps>` from `libs/sidebar/src/components/SidebarPanel/SidebarPanel.tsx`. `SidebarPanelProps` SHALL be defined in `libs/sidebar/src/models/SidebarPanel.ts` with the following shape (all symbols carry JSDoc):

- `side: 'left' | 'right'` — required; controls the divider edge and close-button placement only.
- `leftActions?: ReactNode` — rendered in the left group of the header bar (regardless of `side`).
- `rightActions?: ReactNode` — rendered in the right group of the header bar (regardless of `side`).
- `onClose: () => void` — called when the close button is activated.
- `ariaLabel: string` — applied as the panel's `aria-label`. Caller supplies the localised string.
- `closeLabel: string` — applied as the close button's `aria-label` and tooltip. Caller supplies the localised string.
- `children: ReactNode` — body content rendered below the header bar.
- `colors?: SidebarPanelColors` — optional overrides for `background`, `border`, `headerBorder`.
- `typography?: SidebarPanelTypography` — optional overrides (`fontClassName`, `fontFamily`, `fontSize`).
- `className?: string` — extra class merged onto the root.

The shell SHALL render an `<aside role="complementary" aria-label={ariaLabel}>` with a fixed `360 px` width, full height, a `48 px` header bar, and a vertically scrollable body. A close `GhostIconButton` (icon: `IconX`) SHALL always be present and SHALL call `onClose` when activated. Width, height, body scroll, and header-bar height SHALL be identical for both `side` values.

`side` SHALL control exactly two pieces of layout:

- The divider class on the panel root: `border-l border-secondary` when `side === 'right'`, `border-r border-secondary` when `side === 'left'`.
- The DOM placement of the built-in close button: appended to the right header group when `side === 'right'`; appended to the left header group as the first child when `side === 'left'`.

#### Scenario: Renders children in the body for either side

- **WHEN** `SidebarPanel` receives `children` with `side="right"` or `side="left"`
- **THEN** the children are rendered inside the scrollable body region in both cases

#### Scenario: Action slots are header-bar-relative, not side-relative

- **WHEN** `SidebarPanel` is rendered with `leftActions` and `rightActions` for either `side` value
- **THEN** `leftActions` appear in the left header group and `rightActions` appear in the right header group, in both `side` cases

#### Scenario: Close button anchors to the outer edge

- **WHEN** `side === 'right'`
- **THEN** the close button is the last element of the right header group
- **AND WHEN** `side === 'left'`
- **THEN** the close button is the first element of the left header group

#### Scenario: Divider edge follows `side`

- **WHEN** `side === 'right'`
- **THEN** the panel root has `border-l border-secondary` and not `border-r`
- **AND WHEN** `side === 'left'`
- **THEN** the panel root has `border-r border-secondary` and not `border-l`

#### Scenario: Close button calls `onClose`

- **WHEN** the user clicks the close button (either `side`)
- **THEN** `onClose` is invoked exactly once

#### Scenario: Panel exposes ARIA region

- **WHEN** the panel renders
- **THEN** it has `role="complementary"` and `aria-label` matching the `ariaLabel` prop

#### Scenario: Theming overrides emit CSS custom properties

- **WHEN** `SidebarPanel` is rendered with `colors={{ background: '#ff0000' }}`
- **THEN** the panel root's `style` attribute contains `--sb-bg: #ff0000` (or equivalent inline form produced by `buildCssVars`)
- **AND WHEN** `colors` and `typography` are omitted
- **THEN** the panel root's `style` attribute contains no `--sb-*` entries and the SCSS module's CSS-variable fallbacks resolve to the project theme

#### Scenario: Lib has no app or i18n imports

- **WHEN** the source of `libs/sidebar/**` is inspected
- **THEN** no file imports from `react-i18next`, `apps/**`, or any app-scoped path alias (e.g. `@/...`)

---

### Requirement: `ConversationSourcesPanel` renders a global empty state or the source sections

`ConversationSourcesPanel` SHALL render either a global empty state or the source/task sections described below. `apps/chat/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx` accepts no props, imports `SidebarPanel` from `@epam/ai-dial-sidebar`, obtains messages from `useSourcesSidebar()`, derives `uploaded`, `generated`, and `sources` through `useConversationSources(messages)`, reads `useActiveScheduledTask()` for scheduled-task state, and renders `<SidebarPanel side="right">`.

The panel SHALL use `useAttachmentAction()` to obtain `handleAttachmentClick` and SHALL pass it as `onAttachmentClick` to both `FilesSection` instances (Uploaded Files and Generated Files).

The panel SHALL be considered empty when `uploaded.length === 0` AND `generated.length === 0` AND `sources.length === 0` AND the active conversation is not a scheduled-task conversation (per `useActiveScheduledTask()`). When the active conversation is a scheduled-task conversation, the panel SHALL NEVER be considered empty, even if `uploaded`, `generated`, and `sources` are all empty — the History and Details sections (see the ADDED requirements below) always render in that case.

When the panel is empty (per the updated definition above):

- The header SHALL contain only the built-in close button; `leftActions` and `rightActions` SHALL not render search or download-all buttons.
- The body SHALL render `DialNoDataContent` from `@epam/ai-dial-ui-kit`, centred horizontally and vertically, with `title` set to the i18n value of `basic.noData` (`"No data"`). No `icon` prop is supplied, so `DialNoDataContent` uses its default icon.
- No section headings SHALL be rendered.

When the panel is not empty:

- `leftActions` SHALL contain a search input (text field with `IconSearch`) whose `aria-label` is the i18n value of `sidebar.sources.search`. Typing into the input filters sources as described in the Search scenario below. The search input SHALL only render when at least one of `uploaded`, `generated`, or `sources` is non-empty; it MAY be omitted when the conversation has no searchable file/source content even if scheduled-task sections are rendering.
- `rightActions` SHALL contain a `GhostIconButton` with `IconDownload` and the i18n `aria-label` `sidebar.sources.downloadAll`. This button SHALL be enabled whenever at least one attachment in `uploaded` or `generated` is downloadable (i.e. has a DIAL-hosted file URL resolvable by the same mechanism `handleAttachmentClick` uses), and SHALL be disabled only when no attachment currently in `uploaded`/`generated` is downloadable. This action operates only on `uploaded`/`generated` attachments and is unaffected by scheduled-task section content.
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
- **THEN** the body shows centred `DialNoDataContent` with the `basic.noData` title and default icon
- **AND** no section heading is rendered
- **AND** no search or download-all button is rendered

#### Scenario: Scheduled-task conversation is never shown the global empty state

- **WHEN** the active conversation is a scheduled-task conversation AND `uploaded`, `generated`, and `sources` are all empty
- **THEN** the panel does not render `DialNoDataContent`
- **AND** the History and Details sections render with their own loading/empty/error states

#### Scenario: Any derived file or source switches the panel to section content

- **WHEN** at least one attachment is present in `uploaded`, `generated`, or `sources`
- **THEN** the global empty state is not rendered
- **AND** the search input is rendered enabled
- **AND** the Uploaded Files, Generated Files, and Sources sections are rendered

#### Scenario: Download-all button is enabled when a downloadable attachment is present

- **WHEN** at least one attachment in `uploaded` or `generated` has a DIAL-hosted file URL
- **THEN** the download-all button in `rightActions` is rendered without the `disabled` attribute

#### Scenario: Download-all button is disabled when nothing is downloadable

- **WHEN** `uploaded` and `generated` contain only attachments without a resolvable DIAL-hosted file URL (or both lists are empty)
- **THEN** the download-all button is rendered with the `disabled` attribute

#### Scenario: Download-all ignores scheduled-task section content

- **WHEN** the active conversation is a scheduled-task conversation with a populated History section but empty `uploaded`/`generated`
- **THEN** the download-all button is disabled and activating it (if somehow enabled) triggers no download related to run history or task details

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
- **AND** the stored sidebar messages are cleared

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

---

### Requirement: Source link clicks are routed by URL and content type

`ConversationSourcesPanel` SHALL wire `handleSourceClick` as `onSourceClick` on `SourcesSection`. `handleSourceClick` SHALL route each click as follows:

1. **External non-previewable URL** — if the URL is not a DIAL file ID and does not pass the previewability test (see below), open `window.open(url, '_blank', 'noopener,noreferrer')` immediately and return.
2. **External previewable document or DIAL file** — build a `DisplayAttachment` from the `QuotationSource` and call `openAttachmentCanvas(attachment)`. If the canvas opens (`true`), close the sources sidebar. If the canvas does not open (`false`) and the URL is not a DIAL file ID, open `window.open(url, '_blank', 'noopener,noreferrer')`. If the canvas does not open and the URL is a DIAL file ID, trigger a download.

**Previewability test** — `isExternalSourcePreviewable(contentType, url)` exported from `apps/chat/src/utils/attachment-canvas.ts`:

- Returns `true` if `contentType` starts with `'image/'` or `'audio/'` (these content types are specific and unlikely to be mislabelled by web-search grounding APIs).
- Otherwise, extracts the last path segment of `url` (ignoring query string and fragment) and finds the extension after the last `.`. Returns `true` when:
  - the extension is `'pdf'` (`FileExtension.PDF`) — binary format rendered by the PDF canvas renderer; or
  - `isTextPreviewable(fileName)` from `@epam/ai-dial-attachment-canvas` returns `true` — covers `.md`, `.markdown`, `.json`, `.txt`, `.xml`, `.csv`, and all other plain-text formats the canvas text renderer supports.
- If there is no dot in the last path segment, returns `false`.
- Returns `false` on invalid URLs.

The rationale: some web-search grounding APIs (e.g. Google Vertex AI) label every web reference — YouTube, news articles, blog posts — with `content-type: text/markdown` regardless of actual content. Relying on the content type alone would route all web sources through the canvas pipeline and produce a "Preview not supported" error. The URL extension is the reliable signal; image and audio types are exempted because they are not mislabelled this way.

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

#### Scenario: External text-previewable URL opens in the canvas

- **GIVEN** a `QuotationSource` with a URL whose last path segment has an extension recognised by `isTextPreviewable` (e.g. `.md`, `.markdown`, `.json`, `.txt`, `.csv`, `.xml`)
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

`apps/chat/src/hooks/conversation-sources/useConversationSources.ts` SHALL export `useConversationSources(messages: Message[])` returning `{ uploaded: DisplayAttachment[]; generated: DisplayAttachment[]; sources: QuotationSource[] }`. The hook SHALL:

- Walk `messages` once in a single loop.
- For user messages: push all attachments into `uploaded` via `attachmentDtosToDisplayAttachments`.
- For assistant messages:
  - Split `msg.custom_content?.attachments` into **reference-only** dtos (`isReferenceOnlyAttachment` from `apps/chat/src/utils/reference-attachment.ts` returns `true`) and **regular** dtos (all others).
  - Push only the regular dtos into `generated` via `attachmentDtosToDisplayAttachments`.
  - For each reference-only dto, if `dto.reference_url` has not been seen before, append a `QuotationSource` to `sources`:
    - `url` — `dto.reference_url`
    - `title` — `dto.title ?? dto.reference_url`
    - `contentType` — `dto.reference_type ?? dto.type ?? ''`
    - `quote` — `dto.data` (optional)
  - Also walk `msg.custom_content?.annotations ?? []`. For each annotation where `annotation?.body?.source?.attachment?.url` is present and not already seen, append a `QuotationSource` to `sources`:
    - `url` — `annotation.body.source.attachment.url`
    - `title` — `annotation.body.title ?? url`
    - `contentType` — `annotation.body.source.attachment.type ?? ''`
    - `quote` — `annotation.body.quote` (optional)
- Deduplicate `sources` by `url` across both reference-only attachments and annotations (first occurrence wins), using a shared `seenUrls` set.
- Tolerate `null`/`undefined` annotation items without throwing.
- Return the three lists wrapped in `useMemo`, keyed on the `messages` reference.

`QuotationSource` is defined in `libs/source-panel/src/models/quotation-source.ts` as:
```ts
interface QuotationSource {
  url: string;
  title: string;
  contentType: string;
  quote?: string;
}
```

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

#### Scenario: Duplicate source URLs are deduplicated across reference attachments and annotations

- **WHEN** a reference-only attachment and a subsequent annotation both reference the same `url`
- **THEN** `sources` contains only the first occurrence (the reference attachment)

#### Scenario: Annotations without a source URL are skipped

- **WHEN** an annotation has no `body.source.attachment.url`
- **THEN** it contributes no entry to `sources`

#### Scenario: Memoisation stable on identical messages reference

- **WHEN** the hook is rendered twice with the same `messages` reference
- **THEN** it returns the same `{ uploaded, generated, sources }` object reference both times

---

### Requirement: Section components render their title, grid, and empty placeholder

`UploadedFilesSection`, `GeneratedFilesSection`, and `SourcesSection` SHALL each render a `<section>` containing the section title (`<h2>` or equivalent heading) and either content or an empty-state line. Each section accepts a `title` and `emptyMessage` prop sourced from i18n by the caller.

For `UploadedFilesSection` and `GeneratedFilesSection`:

- When `attachments.length > 0`: render a 3-column grid (`role="list"`) where each cell (`role="listitem"`) wraps an `AttachmentCard` (no `onRemove`, no `onRetry`) sized `w-full`. When an `onAttachmentClick` callback is provided to the section, the section SHALL forward `(att) => onAttachmentClick(att)` to each card's `onClick` prop and pass the i18n value of `sidebar.sources.attachment.downloadLabel` as `clickLabel`. When `onAttachmentClick` is not provided, `onClick` SHALL be omitted.
- When `attachments.length === 0`: return `null` (no title or content rendered).

Both `UploadedFilesSection` and `GeneratedFilesSection` SHALL accept an optional `onAttachmentClick?: (attachment: DisplayAttachment) => void` prop.

For `SourcesSection`:

- Accept `Props { title: string; sources: QuotationSource[]; copyLabel: string; onSourceClick?: (source: QuotationSource) => void }`.
- When `sources.length === 0`: return `null` (no title or empty message rendered).
- When `sources.length > 0`: render a `<ul>` where each `<li>` contains two rows:
  - **Row 1** (flex, `items-center`, `justify-between`): an `<a href={source.url} target="_blank" rel="noopener noreferrer">` showing `source.title` with `truncate`; and a `GhostIconButton` with `IconCopy` that calls `navigator.clipboard.writeText(source.url)` on click, `aria-label={copyLabel}`. When `onSourceClick` is provided, clicking the `<a>` SHALL call `e.preventDefault()` and invoke `onSourceClick(source)` instead of following the `href`.
  - **Row 2** (only when `source.quote` is present): a `<div>` with `quoteClassName` (typography), `styles.quote` (color token), `line-clamp-5`, and `[&>div>*+*]:mt-1` (spacing between block elements), containing a `MarkdownRenderer` rendering `source.quote`. The `[&>div>*+*]:mt-1` selector targets the block-level children of `MarkdownRenderer`'s root `<div>` to add consistent vertical spacing between headings, paragraphs, and lists.

`SourcesSection` is located at `libs/source-panel/src/components/SourcesSection/SourcesSection.tsx`.

#### Scenario: Uploaded Files section with attachments

- **WHEN** `UploadedFilesSection` receives two `DisplayAttachment[]`
- **THEN** the rendered DOM contains the title, a `role="list"` grid with two `role="listitem"` cells, each wrapping an `AttachmentCard` for the corresponding attachment

#### Scenario: Uploaded Files section empty

- **WHEN** `UploadedFilesSection` receives `[]`
- **THEN** nothing is rendered — no title, no grid

#### Scenario: Generated Files section parity

- **WHEN** `GeneratedFilesSection` receives the same input shapes
- **THEN** it follows the same rendering rules as `UploadedFilesSection`

#### Scenario: Sources section renders nothing when empty

- **WHEN** `SourcesSection` receives `sources={[]}`
- **THEN** it renders `null` — no heading, no list, no empty message

#### Scenario: Sources section renders link and copy button per source

- **WHEN** `SourcesSection` receives two `QuotationSource` items
- **THEN** it renders two `<li>` elements each containing an `<a>` link and a copy icon button

#### Scenario: Copy button writes the source URL to the clipboard

- **WHEN** the user clicks the copy button for a source
- **THEN** `navigator.clipboard.writeText` is called with that source's `url`

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

- **WHEN** `UploadedFilesSection` or `GeneratedFilesSection` is rendered with `onAttachmentClick` supplied
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

### Requirement: All sidebar user-visible strings come from i18n

All user-visible strings in the right sidebar (toggle aria-label, panel aria-label, close label, section titles, search and download-all aria-labels, attachment click label, and the new History/Details section strings) SHALL be sourced from i18n keys. Sidebar-specific strings live under `sidebar.base.*` and `sidebar.sources.*` in `apps/chat/src/i18n/locales/en.json`; the all-empty "No data" string reuses `basic.noData`. A typed `SidebarI18nKeys` enum/object SHALL be exposed from `apps/chat/src/constants/translation-keys.ts` for consumers.

New History/Details/task-summary strings introduced for scheduled-task conversations SHALL reuse existing `scheduledTasks.detail.*` keys, shared button keys, and run-status keys wherever their meaning matches (e.g. status labels, the "no runs" empty state, retry button text) instead of duplicating equivalent English strings under `sidebar.*`. Keys with no existing equivalent (e.g. the "History"/"Details" section titles as they appear in this panel, the load-more `aria-live` status text) SHALL be added under `scheduledTasks.conversationPanel.*`.

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

For a scheduled-task conversation, `SidebarPanel`'s `title` SHALL show the fetched `ScheduledTaskDto.displayName` once `taskState === 'success'`. While `taskState === 'loading'` or on `taskState === 'error'`, `title` SHALL fall back to the conversation's own title. For non-scheduled-task conversations, `title` SHALL be omitted/unchanged from current behavior.

`libs/source-panel`'s `ConversationSourcesPanelProps` SHALL gain an optional `title?: ReactNode`, passed through unchanged to the underlying `SidebarPanel`'s existing `title` prop. This prop SHALL carry no scheduler-specific typing or defaults inside the lib — it is a plain, host-agnostic `ReactNode` slot.

#### Scenario: Header shows task display name once loaded

- **WHEN** the active conversation is a scheduled-task conversation and `taskState === 'success'`
- **THEN** the panel header shows the task's `displayName`

#### Scenario: Header falls back to conversation title while loading or on error

- **WHEN** the active conversation is a scheduled-task conversation and `taskState` is `'loading'` or `'error'`
- **THEN** the panel header shows the conversation's title instead of a task name

---

### Requirement: History section shows the task's run list with the active run highlighted

For a scheduled-task conversation, the panel SHALL render a History section built from a shared, host-agnostic presentational component (`ScheduledTaskRunHistoryList`, extracted from the existing `ScheduledTaskDetailView` history rendering into `libs/scheduled-tasks`) fed by the same `useScheduledTaskRuns` state already owned by `ActiveScheduledTaskContext` — no independent fetch is issued by the sources panel.

Each row SHALL show: a localized timestamp (reusing the existing `formatRunTimestamp` convention), a duration suffix when available, and a status icon for `Success`, `Error`, `InProgress`, or `Missed` (reusing the existing `ScheduledTaskRunStatus` enum and icon mapping). Each row's accessible name SHALL include both its status and its timestamp.

The row whose `id` equals the active conversation's `runId` SHALL receive a current-run visual treatment matching the reference design, AND an accessible indication that does not rely on color alone (e.g. an `aria-current="true"` attribute or equivalent text conveyed to assistive technology). If the active `runId` is not present in the currently loaded pages, no row is marked current until a subsequent page load includes it; the section SHALL NOT eagerly fetch every page solely to locate that run.

Run rows are informational only in this section: activating a row SHALL NOT navigate to another conversation, fetch run details, or expose any additional row actions.

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

#### Scenario: Row click is a no-op

- **WHEN** the user clicks or activates a run row
- **THEN** no navigation occurs, no run-detail request is issued, and no additional menu or action appears

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

For a scheduled-task conversation, the panel SHALL render a Details section built from a shared, host-agnostic presentational component (`ScheduledTaskDetailsSummary`, `libs/scheduled-tasks`) showing:

- **Model**: the task's model resolved to its deployment display name via the existing deployments context (the same resolution used in `ScheduledTaskDetailPage.tsx:106`), falling back to the raw model id when unresolved.
- **Instructions**: the task's prompt/instructions rendered through the same shared markdown renderer (`MDMessageViewer` from `@epam/ai-dial-chat-shared`) used by `ScheduledTaskDetailView` and chat assistant messages — raw markdown SHALL NOT be shown as plain text, and no separate markdown implementation SHALL be introduced.

The Details section SHALL NOT render edit controls. It is a concise summary; the "Task details" navigation (see `scheduled-task-conversation-context`) remains the path to the full task view.

#### Scenario: Model resolves to its deployment display name

- **WHEN** the task's `model` id matches a known deployment
- **THEN** the Details section shows that deployment's display name, not the raw id

#### Scenario: Unresolvable model falls back to the raw id

- **WHEN** the task's `model` id does not match any known deployment
- **THEN** the Details section shows the raw model id

#### Scenario: Instructions render as formatted markdown

- **WHEN** the task's instructions contain markdown syntax (e.g. lists, bold text)
- **THEN** the Details section renders that formatting via `MDMessageViewer`, not as an escaped/plain-text string

#### Scenario: No edit affordance is present

- **WHEN** the Details section is inspected
- **THEN** no edit button, input, or other mutation control is rendered

---

### Requirement: History and Details sections are independently collapsible with reset-on-conversation-change defaults

The History and Details sections SHALL each be wrapped in a controlled `DialAccordion` (from `@epam/ai-dial-ui-kit`), controlling `expanded` explicitly rather than relying on `defaultExpanded`. History SHALL default to expanded; Details SHALL default to collapsed. When the active scheduled-task conversation changes (a new `scheduleId`), both sections SHALL reset to these default states.

Each section's trigger SHALL be a keyboard-operable button exposing `aria-expanded` and associated with its controlled content region (e.g. via `aria-controls` and a matching `id`). Directional chevrons SHALL mirror correctly in RTL. When a section is collapsed, its content SHALL NOT retain focusable descendants in the tab order (verified against `DialAccordion`'s actual mount/unmount behavior; if content remains mounted while hidden, the call site SHALL apply `inert` to the collapsed content per `.claude/rules/a11y.md`). Loading and error messages inside each section SHALL use scoped `role="status"`/`role="alert"` semantics as appropriate, not a page-level equivalent.

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
- A `404` from `getScheduledTask` (task deleted) SHALL be treated as "task unavailable": the conversation and existing sections remain visible, and the Details/History sections show a localized "unavailable" state rather than an app-level error.
- `401`/`403`/`429`/`502`/`503` responses SHALL follow the existing API error/notification conventions without redirecting away from the conversation.
- Each section's retry action SHALL retry only its own failed request (task detail vs. run history), not the other.

#### Scenario: Task-detail 404 keeps the conversation and other sections visible

- **WHEN** `getScheduledTask` responds with `404`
- **THEN** the conversation and existing Uploaded/Generated/Sources sections remain visible
- **AND** the Details section (and the panel title, per the header-fallback requirement) show a localized "unavailable" state instead of the task name/content

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
