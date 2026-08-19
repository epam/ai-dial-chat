# citation-card Specification

## Purpose

The citation card tooltip that shows source details, with preview, navigation, and download actions.

## Requirements

---

### Requirement: `CitationCard` renders source details in a positioned tooltip

`apps/chat/src/components/Citations/CitationCard/CitationCard.tsx` SHALL render a panel inside a `DialTooltip` (controlled, `placement="bottom-end"`) anchored to the `CitationMarker` trigger with:

**Header** (horizontal flex, space-between):
- Left: file type icon (from `getAttachmentIcon`) + source name (`DialEllipsisTooltip` for truncation)
- Right: switcher control (hidden when `annotationCount === 1`, otherwise shows `"<N/M>"` with looping previous/next icon buttons at `ElementSize.Small`)

**Body**:
- Subheader: `body.title` (omitted when absent), `dial-body-semi-text`
- Description: `body.quote` (optional, omitted when absent), `dial-small-text text-secondary`

**Footer** (buttons fit content, left-aligned):
- "Preview" button (`PrimaryButton`, `ElementSize.Small`) — rendered only when the `onPreview` prop is provided.
- Second button, always rendered:
  - When `onPreview` is provided: label depends on source type — `text/html` or `application/xhtml+xml` → "Open in browser" (`citations.popup.openInBrowser`); all other types → "Download" (`citations.popup.download`).
  - When `onPreview` is **not** provided: label is always "Open in browser" (`citations.popup.openInBrowser`), regardless of source content type — a group with no preview capability is by definition an external reference, never a local download.

Panel styling: `w-[400px]`, `bg-layer-raised`, `border border-primary`, `rounded-lg`, `p-4`, `shadow-lg`.

The component SHALL accept:
```ts
interface CitationCardProps {
  group: AnnotationGroup;
  activeIndex: number;
  onIndexChange: (i: number) => void;
  onPreview?: (annotation: Annotation) => void;
  onOpenInBrowser: (annotation: Annotation) => void;
}
```

`CitationDropdown` (the parent that owns the `DialTooltip`) SHALL read open/close/index state from `CitationCardContext` rather than accepting `isOpen`, `activeIndex`, `onOpen`, `onClose`, and `onIndexChange` as props. Its own Props interface is:
```ts
interface CitationDropdownProps {
  group: AnnotationGroup;
  onPreview?: (annotation: Annotation) => void;
  onOpenInBrowser: (annotation: Annotation) => void;
}
```
`CitationDropdown` SHALL only invoke `citationCard.closePopup()` on preview (see next requirement) when `onPreview` is provided; when `onPreview` is absent, there is no preview action to wrap.

**i18n keys**: `citations.popup.switcher`, `citations.popup.preview`, `citations.popup.openInBrowser`, `citations.popup.download`, `citations.popup.previousCitation`, `citations.popup.nextCitation`, `citations.popup.ariaLabel`.
**RTL**: switcher chevron icons SHALL be mirrored with `rtl:scale-x-[-1]`; all layout uses logical flex properties.
**Accessibility**: `role="dialog"`, `aria-modal="true"`, `aria-label` derived from source name.
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

---

### Requirement: Citation popup closes only on "Preview"; navigation and download buttons leave it open

`CitationDropdown` SHALL close the popup immediately after forwarding the `onPreview` event, when `onPreview` is provided — by calling `citationCard.closePopup()` from `CitationCardContext`. No other button in `CitationCard` (Previous, Next, "Open in browser", "Download") SHALL close the popup.

The `CitationCard` component itself only calls the `onPreview` prop when present; closing is the responsibility of `CitationDropdown`.

The reason navigation buttons (Prev/Next) must not cause a close: they update `activeIndex` in `useCitationCard`, which previously triggered `markdownComponents` to recompute with new function references, causing ReactMarkdown to unmount and remount the paragraph subtree (including `CitationDropdown` and its `DialTooltip`). The context-based architecture prevents this — see the `CitationCardContext` requirement below.

#### Scenario: Popup closes on preview click

- **WHEN** the user clicks the "Preview" button inside the open citation popup
- **THEN** `citationCard.closePopup()` is called and the popup is dismissed

#### Scenario: Popup stays open when navigating between annotations

- **WHEN** the user clicks the Previous or Next switcher button inside the open citation popup
- **THEN** `activeIndex` advances (or wraps) and the popup remains open, displaying the new annotation

#### Scenario: File source shows "Download" button

- **WHEN** the source content type is `application/pdf` and `onPreview` is provided
- **THEN** the second footer button is labelled "Download"

#### Scenario: Web link source shows "Open in browser" button

- **WHEN** the source content type is `text/html` and `onPreview` is provided
- **THEN** the second footer button is labelled "Open in browser"

#### Scenario: Popup with no Preview action stays open on its single button click

- **WHEN** `onPreview` is not provided and the user clicks the single "Open in browser" button
- **THEN** the popup remains open (only `onOpenInBrowser` is invoked; `closePopup` is not called)

---

### Requirement: Citation popup state managed by `useCitationCard` hook and `CitationCardContext`

`apps/chat/src/hooks/citations/useCitationCard.ts` SHALL export `useCitationCard` that:
- Tracks `openGroupSourceUrl: string | null` (which group's popup is open, or null when closed).
- Tracks `activeIndexByGroup: Record<string, number>` (the current switcher index per source URL).
- Exposes: `openPopup(sourceUrl: string)`, `closePopup()`, `setActiveIndex(sourceUrl: string, index: number)`.
- Returns derived state: `isOpen(sourceUrl: string): boolean`, `getActiveIndex(sourceUrl: string): number`.

**Memoisation**: exposed callbacks SHALL be wrapped in `useCallback`; state object SHALL be wrapped in `useMemo`.

`apps/chat/src/context/CitationCardContext.tsx` SHALL export:
- `CitationCardProvider` — the React context provider component.
- `useCitationCardContext()` — hook that returns the current `CitationCardHook` value; throws if used outside a provider.
- `CitationCardHook` — the inferred return type of `useCitationCard`.

`ConversationMessageItem` SHALL wrap its return value in `<CitationCardProvider value={citationCard}>` so that all `CitationDropdown` instances rendered via `markdownComponents` can access the shared citation state without prop drilling.

`useCitationMarkdownComponents` SHALL NOT accept `citationCard` as a parameter. Its signature is:
```ts
useCitationMarkdownComponents(
  content: string,
  groups: AnnotationGroup[],
  onAttachmentPreview: (attachment: DisplayAttachment) => void,
): { processedContent: string; markdownComponents: Components }
```
The `markdownComponents` returned SHALL only depend on `groups`, `onPreview`, and `onOpenInBrowser` — all of which are stable between switcher-index changes — so that ReactMarkdown never unmounts the paragraph subtree in response to a citation state update.

#### Scenario: Opening a popup sets the open group

- **WHEN** `openPopup("https://files.example.com/report.pdf")` is called
- **THEN** `isOpen("https://files.example.com/report.pdf")` returns `true`

#### Scenario: Closing the popup clears the open state

- **WHEN** `closePopup()` is called after a popup was opened
- **THEN** `isOpen` returns `false` for all source URLs

#### Scenario: Index changes are tracked per group

- **WHEN** `setActiveIndex("https://example.com/a.pdf", 2)` is called
- **THEN** `getActiveIndex` returns `2` for that URL

---

### Requirement: "Preview" action opens the cited attachment inline

When the "Preview" button is clicked in `CitationCard`, the app SHALL invoke the existing attachment-preview flow with the `Annotation.body.source.attachment` converted to a `DisplayAttachment`.

#### Scenario: Preview opens the attachment

- **WHEN** the user clicks "Preview" for an annotation with a PDF source attachment
- **THEN** the attachment preview is triggered (same behavior as clicking an `AttachmentCard`)

---

### Requirement: Second footer button opens the source URL or downloads the file

When the second footer button is clicked, the `onOpenInBrowser` handler in `useCitationMarkdownComponents` SHALL:
- **DIAL file URLs** (`url.startsWith('files/')`): resolve the download URL via `resolveDialFileDownloadUrl`, then trigger a browser download using a programmatically created `<a download>` element clicked via `.click()`. The `download` attribute SHALL be set to `attachment.title` if present, otherwise the last path segment of the URL.
- **Web URLs** (all other values): call `window.open(url, '_blank', 'noopener,noreferrer')`.

Clicking this button SHALL NOT close the citation popup.

#### Scenario: DIAL file triggers anchor-download

- **WHEN** the user clicks "Download" for an annotation whose URL starts with `"files/"`
- **THEN** a resolved download URL is fetched and a hidden `<a download>` click is dispatched; `window.open` is NOT called

#### Scenario: Web link calls window.open

- **WHEN** the user clicks "Open in browser" for an annotation whose URL is an `https://` URL
- **THEN** `window.open` is called with the URL, `"_blank"`, and `"noopener,noreferrer"`
