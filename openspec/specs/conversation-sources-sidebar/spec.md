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

Theming SHALL follow `openspec/lib-styling-guide.md`: the SCSS module `SidebarPanel.module.scss` contains only CSS-variable references with hex fallbacks (`--sb-bg`, `--sb-border`, `--sb-header-border`); layout, spacing, and border-radius live in Tailwind classes inside the TSX. The component SHALL apply `colors` / `typography` overrides via `buildCssVars` from `@epam/ai-dial-chat-shared`.

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

`apps/chat/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx` SHALL accept `Props { messages: Message[]; }`, import `SidebarPanel` from `@epam/ai-dial-sidebar`, derive `uploaded` and `generated` through `useConversationSources(messages)`, and render `<SidebarPanel side="right">`.

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

---

### Requirement: `useConversationSources` derives Uploaded and Generated lists from messages

`apps/chat/src/hooks/useConversationSources.ts` SHALL export `useConversationSources(messages: Message[])` returning `{ uploaded: DisplayAttachment[]; generated: DisplayAttachment[] }`. The hook SHALL:

- Walk `messages` once and partition by `MessageRole.User` (`uploaded`) vs `MessageRole.Assistant` (`generated`).
- For each message, flat-map `msg.custom_content?.attachments` (default `[]`) through the existing `attachmentDtosToDisplayAttachments` utility from `apps/chat/src/utils/attachment-dto-to-display.ts`.
- Return the resulting lists wrapped in `useMemo`, keyed on the `messages` reference.
- Tolerate messages without `custom_content` or with empty/undefined `attachments` (treat as no attachments).

#### Scenario: No messages

- **WHEN** the hook is called with `[]`
- **THEN** it returns `{ uploaded: [], generated: [] }`

#### Scenario: Only user attachments

- **WHEN** every message in the input has `role: MessageRole.User` and one attachment each
- **THEN** all derived attachments appear in `uploaded` in message order
- **AND** `generated` is empty

#### Scenario: Only assistant attachments

- **WHEN** every message in the input has `role: MessageRole.Assistant` and one attachment each
- **THEN** all derived attachments appear in `generated` in message order
- **AND** `uploaded` is empty

#### Scenario: Mixed roles

- **WHEN** a user message with one attachment is followed by an assistant message with two attachments
- **THEN** `uploaded` has one entry from the user message and `generated` has two entries from the assistant message

#### Scenario: Message without custom_content

- **WHEN** a message has `custom_content === undefined` or `custom_content.attachments === undefined`
- **THEN** the hook contributes no entries from that message but still processes the rest

#### Scenario: Memoisation stable on identical messages reference

- **WHEN** the hook is rendered twice with the same `messages` reference
- **THEN** it returns the same `{ uploaded, generated }` object reference both times

---

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

All user-visible strings in the right sidebar (toggle aria-labels, panel aria-label, close label, section titles, panel-level and section-level empty-state messages, search and download-all aria-labels) SHALL be sourced from i18n keys defined in `apps/chat/src/i18n/locales/en.json` under `sidebar.base.*` and `sidebar.sources.*`. A typed `SidebarI18nKeys` enum/object SHALL be exposed from `apps/chat/src/constants/translation-keys.ts` for consumers.

#### Scenario: New keys added to en.json

- **WHEN** `apps/chat/src/i18n/locales/en.json` is inspected
- **THEN** it contains keys `sidebar.base.toggleOpen`, `sidebar.base.toggleClose`, `sidebar.base.close`, `sidebar.sources.ariaLabel`, `sidebar.sources.search`, `sidebar.sources.downloadAll`, `sidebar.sources.downloadFile`, `sidebar.sources.sections.uploadedFiles`, `sidebar.sources.sections.generatedFiles`, `sidebar.sources.sections.sources`, `sidebar.sources.empty.noData`, `sidebar.sources.empty.uploadedFiles`, `sidebar.sources.empty.generatedFiles`, `sidebar.sources.empty.sources`

#### Scenario: Components consume the typed key map

- **WHEN** any sidebar component reads an i18n string
- **THEN** it does so via `t(SidebarI18nKeys.<Member>)`, not via a hardcoded English literal

---

### Requirement: Per-card download i18n key

`apps/chat/src/i18n/locales/en.json` SHALL define the key `sidebar.sources.downloadFile` with the value `"Download file"`. `SidebarI18nKeys` SHALL expose a corresponding `DownloadFile` member mapping to `'sidebar.sources.downloadFile'`.

#### Scenario: Key present in en.json

- **WHEN** `apps/chat/src/i18n/locales/en.json` is inspected
- **THEN** it contains `"downloadFile": "Download file"` nested under `sidebar.sources`

#### Scenario: Typed key member exists

- **WHEN** `SidebarI18nKeys` is inspected
- **THEN** it exposes `DownloadFile = 'sidebar.sources.downloadFile'`
