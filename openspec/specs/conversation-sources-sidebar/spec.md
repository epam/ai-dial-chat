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

`apps/chat/src/context/sidebar/RightSidebarContext.tsx` SHALL invoke the factory once and re-export `RightSidebarProvider` and `useRightSidebar`.

#### Scenario: Factory produces independent contexts

- **WHEN** `createSidebarContext` is called twice with different display names
- **THEN** the two resulting providers and hooks operate on independent state — opening one does not change `isOpen` in the other

#### Scenario: Initial state is closed

- **WHEN** a consumer reads `useRightSidebar().isOpen` immediately after mount
- **THEN** the value is `false`

#### Scenario: `open` sets isOpen to true

- **WHEN** a consumer calls `useRightSidebar().open()`
- **THEN** subsequent reads of `isOpen` return `true`

#### Scenario: `toggle` flips the current value

- **WHEN** `isOpen` is `false` and a consumer calls `toggle()`
- **THEN** `isOpen` becomes `true`
- **AND WHEN** `toggle()` is called again
- **THEN** `isOpen` becomes `false`

#### Scenario: Hook outside provider throws

- **WHEN** `useRightSidebar()` is called from a component not wrapped in `RightSidebarProvider`
- **THEN** an error is thrown describing the missing provider

---

### Requirement: Header toggles the right sidebar

`apps/chat/src/components/Header/Header.tsx` SHALL render a right-aligned `DialGhostIconButton` (icon: `IconFile` from `@tabler/icons-react`) that calls `useRightSidebar().toggle()` on click. The header SHALL keep `<Logo />` horizontally centred when the toggle is present (e.g. via `grid-cols-[1fr_auto_1fr]`). The button SHALL set `aria-pressed` from `isOpen`. Its `aria-label` and tooltip text SHALL come from i18n keys `sidebar.sources.toggleOpen` (when closed) and `sidebar.sources.toggleClose` (when open).

#### Scenario: Toggle button present in the header

- **WHEN** `Header` renders inside `RightSidebarProvider`
- **THEN** a button with the open/close `aria-label` exists and is positioned at the right edge

#### Scenario: Click toggles the context

- **WHEN** the button is clicked
- **THEN** `useRightSidebar().isOpen` flips
- **AND** `aria-pressed` reflects the new value
- **AND** the `aria-label` switches between the open and close strings

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

The shell SHALL render an `<aside role="complementary" aria-label={ariaLabel}>` with a fixed `360 px` width, full height, a `48 px` header bar, and a vertically scrollable body. A close `DialGhostIconButton` (icon: `IconX`) SHALL always be present and SHALL call `onClose` when activated. Width, height, body scroll, and header-bar height SHALL be identical for both `side` values.

Theming SHALL follow `openspec/lib-styling-guide.md`: the SCSS module `SidebarPanel.module.scss` contains only CSS-variable references with hex fallbacks (`--sb-bg`, `--sb-border`); layout, spacing, and border-radius live in Tailwind classes inside the TSX. The component SHALL apply `colors` / `typography` overrides via `buildCssVars` from `@epam/ai-dial-chat-shared`.

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

`apps/chat/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx` accepts no props, imports `SidebarPanel` from `@epam/ai-dial-sidebar`, obtains messages from `useSourcesSidebar()`, derives `uploaded`, `generated`, and `sources` through `useConversationSources(messages)`, and renders `<SidebarPanel side="right">`.

The panel SHALL use `useAttachmentAction()` to obtain `handleAttachmentClick` and SHALL pass it as `onAttachmentClick` to both `FilesSection` instances (Uploaded Files and Generated Files).

The panel SHALL be considered empty when `uploaded.length === 0` and `generated.length === 0` and `sources.length === 0`.

When the panel is empty:

- The header SHALL contain only the built-in close button; `leftActions` and `rightActions` SHALL not render search or download-all buttons.
- The body SHALL render a full-height, horizontally and vertically centred empty state.
- The empty state SHALL contain a decorative `IconFileDescription` followed by the i18n value of `sidebar.sources.empty.noData` (`"No data"`).
- The icon SHALL be hidden from assistive technology.
- The Uploaded Files, Generated Files, and Sources section headings and their section-level empty messages SHALL not render.

When the panel is not empty:

- `leftActions` SHALL contain a disabled `DialGhostIconButton` with `IconSearch` and the i18n `aria-label` `sidebar.sources.search`.
- `rightActions` SHALL contain a `DialGhostIconButton` with `IconDownload` and the i18n `aria-label` `sidebar.sources.downloadAll`. This button SHALL be enabled whenever at least one attachment in `uploaded` or `generated` is downloadable (i.e. has a DIAL-hosted file URL resolvable by the same mechanism `handleAttachmentClick` uses), and SHALL be disabled only when no attachment currently in `uploaded`/`generated` is downloadable.
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
- When `attachments.length === 0`: render the `emptyMessage` text in place of the grid.

Both `UploadedFilesSection` and `GeneratedFilesSection` SHALL accept an optional `onAttachmentClick?: (attachment: DisplayAttachment) => void` prop.

For `SourcesSection`:

- Accept `Props { title: string; sources: QuotationSource[]; copyLabel: string }`.
- When `sources.length === 0`: return `null` (no title or empty message rendered).
- When `sources.length > 0`: render a `<ul>` where each `<li>` contains two rows:
  - **Row 1** (flex, `items-center`, `justify-between`): an `<a href={source.url} target="_blank" rel="noopener noreferrer">` showing `source.title` with `truncate`; and a `DialGhostIconButton` with `IconCopy` that calls `navigator.clipboard.writeText(source.url)` on click, `aria-label={copyLabel}`.
  - **Row 2** (only when `source.quote` is present): a `<div>` with `quoteClassName` (typography), `styles.quote` (color token), `line-clamp-5`, and `[&>div>*+*]:mt-1` (spacing between block elements), containing a `MarkdownRenderer` rendering `source.quote`. The `[&>div>*+*]:mt-1` selector targets the block-level children of `MarkdownRenderer`'s root `<div>` to add consistent vertical spacing between headings, paragraphs, and lists.

`SourcesSection` is located at `libs/source-panel/src/components/SourcesSection/SourcesSection.tsx`.

#### Scenario: Uploaded Files section with attachments

- **WHEN** `UploadedFilesSection` receives two `DisplayAttachment[]`
- **THEN** the rendered DOM contains the title, a `role="list"` grid with two `role="listitem"` cells, each wrapping an `AttachmentCard` for the corresponding attachment

#### Scenario: Uploaded Files section empty

- **WHEN** `UploadedFilesSection` receives `[]`
- **THEN** the rendered DOM contains the title and the empty-message text, but no grid

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

### Requirement: Panel mounts as a sibling of `<main>` and unmounts when closed

`apps/chat/src/app/app.tsx` (or the active conversation page) SHALL render the right-sidebar slot as a sibling of `<main>` inside the root flex row. The slot SHALL render `<ConversationSourcesPanel>` when `useRightSidebar().isOpen === true`, and SHALL render `null` (no element) when `isOpen === false`. Opening or closing the sidebar SHALL NOT modify `<main>`'s class names or layout props.

#### Scenario: Closed sidebar renders no element

- **WHEN** `isOpen === false`
- **THEN** the right-sidebar slot renders `null`
- **AND** no `aside` with `aria-label` matching `sidebar.sources.ariaLabel` exists in the DOM

#### Scenario: Open sidebar renders the panel

- **WHEN** `isOpen === true`
- **THEN** an `aside` with `aria-label` matching `sidebar.sources.ariaLabel` is mounted as a sibling of `<main>`

#### Scenario: Toggling does not modify main layout

- **WHEN** the user opens and closes the sidebar
- **THEN** `<main>`'s class list and width-relevant style attributes are unchanged across the transitions

---

### Requirement: All sidebar user-visible strings come from i18n

All user-visible strings in the right sidebar (toggle aria-labels, panel aria-label, close label, section titles, panel-level and section-level empty-state messages, search and download-all aria-labels, attachment click label) SHALL be sourced from i18n keys defined in `apps/chat/src/i18n/locales/en.json` under `sidebar.base.*` and `sidebar.sources.*`. A typed `SidebarI18nKeys` enum/object SHALL be exposed from `apps/chat/src/constants/translation-keys.ts` for consumers.

#### Scenario: New keys added to en.json

- **WHEN** `apps/chat/src/i18n/locales/en.json` is inspected
- **THEN** it contains keys `sidebar.base.toggleOpen`, `sidebar.base.toggleClose`, `sidebar.base.close`, `sidebar.sources.ariaLabel`, `sidebar.sources.search`, `sidebar.sources.downloadAll`, `sidebar.sources.copySource`, `sidebar.sources.sections.uploadedFiles`, `sidebar.sources.sections.generatedFiles`, `sidebar.sources.sections.sources`, `sidebar.sources.empty.noData`, `sidebar.sources.empty.uploadedFiles`, `sidebar.sources.empty.generatedFiles`, `sidebar.sources.empty.sources`, `sidebar.sources.attachment.downloadLabel`

#### Scenario: Components consume the typed key map

- **WHEN** any sidebar component reads an i18n string
- **THEN** it does so via `t(SidebarI18nKeys.<Member>)`, not via a hardcoded English literal
