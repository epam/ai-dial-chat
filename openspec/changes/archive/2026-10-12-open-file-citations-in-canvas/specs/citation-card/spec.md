## MODIFIED Requirements

### Requirement: `CitationCard` renders source details in a positioned popover

`CitationDropdown` SHALL render the `CitationCard` panel inside a controlled 2.0 `Dropdown` overlay (`trigger={[]}`, `placement="bottom-end"`, `renderOverlay`) anchored to the `CitationMarker` trigger. It SHALL NOT use a `Tooltip` or `InteractiveTooltip`: both render nothing on a touch-only (`hover: none`) or mobile device, which leaves the card unreachable by tap. The card SHALL open from a tap on mobile and a click on desktop. The panel has:

**Header** (horizontal flex, space-between):
- Left: optional `headerIcon` + header text (`EllipsisTooltip` for truncation). For a previewable file (`onPreview` provided and the active source is not `text/html`/`application/xhtml+xml`) the header text is the file extension from `getSourceFileExtension`, and when no `headerIcon` is supplied the UI kit's `FileIcon` for that extension is shown; otherwise the header text is `group.sourceName`.
- Right: switcher control (hidden when the group has one annotation, otherwise shows `labels.formatSwitcherText(current, total)` with looping previous/next `GhostIconButton`s at `ElementSize.Small`)

**Body**:
- Subheader: `body.title` (omitted when absent), `dial-body-semi-text` by default
- Description: `body.quote` (optional) rendered through `MarkdownRenderer`, `dial-small-text` by default, coloured by the `--cc-quote-text` CSS variable (fallback `--text-secondary`)

**Footer** (buttons fit content, start-aligned):
- "Preview" button (`PrimaryButton`, `ElementSize.Small`) — rendered only when the `onPreview` prop is provided.
- Second button (`PrimaryButton`, `ElementSize.Small`), rendered for a web link always and for a previewable file only while `isDownloadEnabled` (default `true`):
  - When `onPreview` is provided: label depends on the active annotation's source type — `text/html` or `application/xhtml+xml` → `labels.openInBrowser`; all other types → `labels.download`.
  - When `onPreview` is **not** provided: label is always `labels.openInBrowser`, regardless of source content type — a group with no preview capability is by definition an external reference, never a local download.

Panel styling: `w-[400px] max-w-full` (so the card fits a viewport narrower than 400px), `rounded-lg`, `p-4`, `shadow-lg`, with the background from the `.card` module class (`--cc-card-bg`, fallback `--bg-layer-raised`); the card has no border.

The component SHALL accept:
```ts
interface CitationCardProps {
  group: AnnotationGroup;
  activeIndex: number;
  onIndexChange: (index: number) => void;
  onPreview?: (annotation: Annotation) => void;
  onOpenInBrowser: (annotation: Annotation) => void;
  isDownloadEnabled?: boolean;
  headerIcon?: ReactNode;
  labels: CitationCardLabels;
  typography?: CitationCardTypography;
  colors?: CitationCardColors;
}
```

#### Scenario: Tapping a marker on a touch-only device opens the card

- **WHEN** the device reports `hover: none` (e.g. iPhone 16, 393×852, touch) and the user taps a citation marker
- **THEN** the citation card (`role="dialog"`) opens, as a click does on desktop

`CitationDropdown` (the parent that owns the `Dropdown`) SHALL read open/close/index state from `CitationCardContext` rather than accepting `isOpen`, `activeIndex`, `onOpen`, `onClose`, and `onIndexChange` as props. Its own Props interface is:
```ts
interface CitationDropdownProps {
  group: AnnotationGroup;
  onPreview?: (annotation: Annotation) => void;
  isPreviewable?: (annotation: Annotation) => boolean;
  onOpenInBrowser: (annotation: Annotation) => void;
  isDownloadEnabled?: boolean;
  isPreviewOpen?: boolean;
  previewFilesOnMarkerClick?: boolean;
  icon?: ReactNode;
  headerIcon?: ReactNode;
  cardLabels: CitationCardLabels;
  markerLabels: CitationMarkerLabels;
  cardTypography?: CitationCardTypography;
  markerLabelClassName?: string;
}
```
`CitationDropdown` SHALL only invoke `citationCard.closePopup()` on preview (see next requirement) when `onPreview` is provided; when `onPreview` is absent, there is no preview action to wrap. When `isPreviewOpen` is `true` (the host's preview panel is already open) and a preview action exists, a marker click SHALL preview the active annotation directly instead of opening the card.

When `previewFilesOnMarkerClick` is `true` (defaults to `false`), a marker click SHALL likewise preview the active annotation directly — calling `onPreview` exactly once and opening no card — whenever a preview action exists for it (`onPreview` is provided and `isPreviewable` does not return `false`), the group holds exactly one annotation, and the annotation is not a web link. An annotation is a web link when its source attachment type is `text/html` or `application/xhtml+xml`; this classification SHALL be the single helper `isWebLinkAnnotation` in `libs/quotations/src/utils/citation-source-kind.ts`, shared with the card's "Open in browser" vs "Download" label so the two cannot disagree. A web-link annotation, one with no preview action, or a group holding more than one annotation SHALL open the card exactly as when the flag is `false` — the card's switcher is the only way to reach a grouped marker's other citations, which may point at different files. The flag is a plain boolean; DIAL-specific previewability stays in the host's `isPreviewable` callback.

The chat app SHALL pass `previewFilesOnMarkerClick: true` for inline message citations (`citationCallbacks` in `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx`) and SHALL NOT pass it to the reference-chip `CitationDropdown` row, so reference chips keep opening the card.

`useCitationMarkdownComponents` SHALL accept an optional host-supplied
`isPreviewable(annotation)` callback and forward it to `CitationDropdown`.
The dropdown SHALL evaluate it for the active annotation and omit the card's
`onPreview` when it returns `false`. Omitting the callback preserves existing
preview behavior. The second button's MIME-based label SHALL use the active
annotation's source rather than the first annotation in the group.

The chat app SHALL supply the same external-source preview classification used
by its Sources panel: DIAL file sources retain Preview, supported external files
(including PDF, Office and `.html`/`.htm`) retain Preview, and ordinary external
web pages without a supported file extension show only "Open in browser".
DIAL-specific classification SHALL remain outside `libs/quotations`.

#### Scenario: External web citation has only Open in browser

- **WHEN** an inline citation references `https://data.imf.org/en/datasets/IMF.RES:WEO` with MIME type `text/html`
- **THEN** its card has no Preview action and Open in browser opens the source URL in a new tab, on mobile and desktop

#### Scenario: Switching citations re-evaluates preview availability

- **WHEN** the user switches from a web-page annotation to a PDF annotation within one card
- **THEN** Preview becomes available and the second action is Download
- **AND** switching back restores the single Open in browser action

**i18n keys** (supplied by the chat app through `CitationCardLabels`; the library reads no i18n): `citations.popup.switcher`, `basic.preview`, `citations.popup.openInBrowser`, `buttons.download`, `citations.popup.previousCitation`, `citations.popup.nextCitation`, `citations.marker.ariaLabel` (dialog label), `buttons.showMore`, `buttons.showLess`, and — for the optional `codeBlockCopyLabel` / `codeBlockCopiedLabel` / `codeBlockDownloadLabel` / `tableScrollRegionAriaLabel` / `mathScrollRegionAriaLabel` that name the quote markdown's code-block, table and block-formula controls — `buttons.copy`, `buttons.copied`, `buttons.download`, `chat.scrollableTable`, `chat.scrollableFormula`.
**RTL**: switcher chevron icons SHALL be mirrored with `rtl:scale-x-[-1]`; all layout uses logical flex properties.
**Accessibility**: `role="dialog"`, `aria-modal="true"`, `aria-label` from `labels.ariaLabel` (the app passes `citations.marker.ariaLabel`, "Citation from {{source}}").
**Feature flag**: none.

#### Scenario: Single annotation hides the switcher

- **WHEN** `CitationCard` is rendered with a group containing one annotation
- **THEN** no switcher control is rendered

#### Scenario: Multiple annotations show looping switcher

- **WHEN** `CitationCard` is rendered with a group of three annotations and `activeIndex={2}`
- **THEN** clicking next wraps to index `0`

#### Scenario: Body shows title and quote

- **WHEN** the active annotation has `body.title = "Q3 Revenue"` and `body.quote = "Q3 revenue was $1B"`
- **THEN** the subheader renders "Q3 Revenue" and the description renders "Q3 revenue was $1B"

#### Scenario: Missing quote renders body with title only

- **WHEN** the active annotation has `body.title` but no `body.quote`
- **THEN** only the title is rendered in the body; no empty space for the quote

#### Scenario: "Preview" button triggers onPreview with the active annotation

- **WHEN** `onPreview` is provided and the user clicks the "Preview" button
- **THEN** `onPreview` is called with the current active `Annotation`

#### Scenario: Preview button hidden when onPreview is omitted

- **WHEN** `CitationCard` is rendered without an `onPreview` prop
- **THEN** no "Preview" button is rendered, and the footer shows a single button labelled "Open in browser"

#### Scenario: File citation marker opens the canvas without a card

- **WHEN** `previewFilesOnMarkerClick` is `true`, the canvas is closed, and the user clicks (or taps, or activates with Enter/Space) a marker whose active annotation has an `application/pdf` DIAL-file source
- **THEN** `onPreview` is called once with that annotation, the canvas opens at the cited page with its highlight, and no `role="dialog"` citation card is rendered

#### Scenario: Web-link citation marker still opens the card

- **WHEN** `previewFilesOnMarkerClick` is `true`, the canvas is closed, and the user clicks a marker whose active annotation has a `text/html` source
- **THEN** the citation card opens with the quote and its "Open in browser" action, and `onPreview` is not called

#### Scenario: Non-previewable source still opens the card

- **WHEN** `previewFilesOnMarkerClick` is `true` and `isPreviewable` returns `false` for the active annotation
- **THEN** the marker click opens the citation card

#### Scenario: Multi-citation file marker still opens the card

- **WHEN** `previewFilesOnMarkerClick` is `true` and the marker's group holds two PDF annotations
- **THEN** the marker click opens the citation card with its Previous/Next switcher, and `onPreview` is called only from the card's "Preview" action

#### Scenario: Flag omitted preserves the card-first behaviour

- **WHEN** `previewFilesOnMarkerClick` is omitted, the canvas is closed, and the user clicks a marker with a PDF source
- **THEN** the citation card opens, as before this change

#### Scenario: Reference chips are unaffected

- **WHEN** the user clicks a reference-only PDF-page chip in the chat app while the canvas is closed
- **THEN** the citation card opens, as before this change
