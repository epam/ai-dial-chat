## Requirements

---

### Requirement: `CitationPopup` renders source details in a positioned tooltip

`apps/chat/src/components/Citations/CitationPopup/CitationPopup.tsx` SHALL render a panel inside a `DialTooltip` (controlled, `placement="bottom-end"`) anchored to the `CitationMarker` trigger with:

**Header** (horizontal flex, space-between):
- Left: file type icon (from `getAttachmentIcon`) + source name (`DialEllipsisTooltip` for truncation)
- Right: switcher control (hidden when `annotationCount === 1`, otherwise shows `"<N/M>"` with looping previous/next icon buttons at `ElementSize.Small`)

**Body**:
- Subheader: `body.title` (omitted when absent), `dial-body-semi-text`
- Description: `body.quote` (optional, omitted when absent), `dial-small-text text-secondary`

**Footer** (buttons fit content, left-aligned):
- "Preview" button (`DialPrimaryButton`, `ElementSize.Small`)
- Second button label depends on source type:
  - `text/html` or `application/xhtml+xml` → "Open in browser" (`citations.popup.openInBrowser`)
  - All other types → "Download" (`citations.popup.download`)

Panel styling: `w-[400px]`, `bg-layer-0`, `border border-primary`, `rounded-lg`, `p-4`, `shadow-lg`.

The component SHALL accept:
```ts
interface CitationPopupProps {
  group: AnnotationGroup;
  activeIndex: number;
  onIndexChange: (i: number) => void;
  onPreview: (annotation: Annotation) => void;
  onOpenInBrowser: (annotation: Annotation) => void;
}
```

**i18n keys**: `citations.popup.switcher`, `citations.popup.preview`, `citations.popup.openInBrowser`, `citations.popup.download`, `citations.popup.previousCitation`, `citations.popup.nextCitation`, `citations.popup.ariaLabel`.
**RTL**: switcher chevron icons SHALL be mirrored with `rtl:scale-x-[-1]`; all layout uses logical flex properties.
**Accessibility**: `role="dialog"`, `aria-modal="true"`, `aria-label` derived from source name.
**Feature flag**: none.

#### Scenario: Single annotation hides the switcher

- **WHEN** `CitationPopup` is rendered with a group containing one annotation
- **THEN** no switcher control is rendered

#### Scenario: Multiple annotations show looping switcher

- **WHEN** `CitationPopup` is rendered with a group of three annotations and `activeIndex={2}`
- **THEN** clicking next wraps to index `0`

#### Scenario: Body shows title and quote

- **WHEN** the active annotation has `body.title = "Q3 Revenue"` and `body.quote = "Q3 revenue was $1B"`
- **THEN** the subheader renders "Q3 Revenue" and the description renders "Q3 revenue was $1B"

#### Scenario: Missing quote renders body with title only

- **WHEN** the active annotation has `body.title` but no `body.quote`
- **THEN** only the title is rendered in the body; no empty space for the quote

#### Scenario: "Preview" button triggers onPreview with the active annotation

- **WHEN** the user clicks the "Preview" button
- **THEN** `onPreview` is called with the current active `Annotation`

#### Scenario: File source shows "Download" button

- **WHEN** the source content type is `application/pdf`
- **THEN** the second footer button is labelled "Download"

#### Scenario: Web link source shows "Open in browser" button

- **WHEN** the source content type is `text/html`
- **THEN** the second footer button is labelled "Open in browser"

---

### Requirement: Citation popup state managed by `useCitationPopup` hook

`apps/chat/src/hooks/citations/useCitationPopup.ts` SHALL export `useCitationPopup` that:
- Tracks `openGroupSourceUrl: string | null` (which group's popup is open, or null when closed).
- Tracks `activeIndexByGroup: Record<string, number>` (the current switcher index per source URL).
- Exposes: `openPopup(sourceUrl: string)`, `closePopup()`, `setActiveIndex(sourceUrl: string, index: number)`.
- Returns derived state: `isOpen(sourceUrl: string): boolean`, `getActiveIndex(sourceUrl: string): number`.

**Memoisation**: exposed callbacks SHALL be wrapped in `useCallback`; state object SHALL be wrapped in `useMemo`.

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

When the "Preview" button is clicked in `CitationPopup`, the app SHALL invoke the existing attachment-preview flow with the `Annotation.body.source.attachment` converted to a `DisplayAttachment`.

#### Scenario: Preview opens the attachment

- **WHEN** the user clicks "Preview" for an annotation with a PDF source attachment
- **THEN** the attachment preview is triggered (same behavior as clicking an `AttachmentCard`)

---

### Requirement: Second footer button opens the source URL or downloads the file

When the second footer button is clicked, the app SHALL call `window.open(annotation.body.source.attachment.url, '_blank', 'noopener,noreferrer')`.

#### Scenario: Open in browser calls window.open with the attachment URL

- **WHEN** the user clicks "Open in browser" or "Download" for an annotation
- **THEN** `window.open` is called with the attachment URL, `"_blank"`, and `"noopener,noreferrer"`
