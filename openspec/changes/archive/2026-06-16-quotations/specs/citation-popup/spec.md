## ADDED Requirements

### Requirement: `CitationPopup` renders source details in a positioned popover

`apps/chat/src/components/Citations/CitationPopup/CitationPopup.tsx` SHALL render a popover panel anchored to a trigger element with:

**Header** (horizontal flex, space-between):
- Left: source name label (`sourceName` from the active annotation's group)
- Right: switcher control (hidden when `annotationCount === 1`, otherwise shows `"<N/M>"` with previous/next icon buttons)

**Body**:
- Subheader: `body.title` (omitted when absent)
- Description: `body.quote` (omitted when absent)

**Footer** (two primary UI kit `Button` components, full-width or side-by-side):
- "Preview" button — i18n key `citations.popup.preview`
- "Open in browser" button — i18n key `citations.popup.openInBrowser`

The component SHALL accept:
```ts
interface CitationPopupProps {
  group: AnnotationGroup;
  activeIndex: number;            // 0-based index into group.annotations
  onIndexChange: (i: number) => void;
  onPreview: (annotation: Annotation) => void;
  onOpenInBrowser: (annotation: Annotation) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
}
```

The popover SHALL be dismissible via Escape key and by clicking outside (standard UI kit popover behavior). The `onClose` callback SHALL be called in both cases.

**i18n keys**: `citations.popup.source`, `citations.popup.switcher` (e.g. `"{{current}}/{{total}}"`), `citations.popup.preview`, `citations.popup.openInBrowser`, `citations.popup.previousCitation`, `citations.popup.nextCitation` (aria-labels for switcher buttons).
**RTL**: all layout uses logical flex properties; switcher chevron icons SHALL be mirrored with `rtl:scale-x-[-1]`; the `<N/M>` label is direction-agnostic (number characters).
**Accessibility**: `role="dialog"`, `aria-modal="true"`, `aria-label` derived from source name (i18n key `citations.popup.ariaLabel`); focus SHALL move to the popover on open and return to the trigger on close.
**Memoisation**: `onPreview` and `onOpenInBrowser` callbacks SHALL be wrapped in `useCallback` by the parent to avoid unnecessary re-renders.
**Feature flag**: none.

#### Scenario: Single annotation hides the switcher

- **WHEN** `CitationPopup` is rendered with a group containing one annotation
- **THEN** no switcher control is rendered

#### Scenario: Multiple annotations show switcher

- **WHEN** `CitationPopup` is rendered with a group of three annotations and `activeIndex={0}`
- **THEN** the switcher displays `"1/3"` and the previous button is disabled

#### Scenario: Switcher navigates to the next annotation

- **WHEN** the user clicks the next arrow in the switcher
- **THEN** `onIndexChange` is called with `activeIndex + 1`

#### Scenario: Body shows title and quote

- **WHEN** the active annotation has `body.title = "Q3 Revenue"` and `body.quote = "Q3 revenue was $1B"`
- **THEN** the subheader renders "Q3 Revenue" and the description renders "Q3 revenue was $1B"

#### Scenario: Missing title and quote renders empty body

- **WHEN** the active annotation has no `body.title` or `body.quote`
- **THEN** the popup body area is empty (no placeholder text)

#### Scenario: "Preview" button triggers onPreview with the active annotation

- **WHEN** the user clicks the "Preview" button
- **THEN** `onPreview` is called with the current active `Annotation`

#### Scenario: "Open in browser" button triggers onOpenInBrowser

- **WHEN** the user clicks the "Open in browser" button
- **THEN** `onOpenInBrowser` is called with the current active `Annotation`

#### Scenario: Escape key closes the popup

- **WHEN** the popup is open and the user presses Escape
- **THEN** `onClose` is called

#### Scenario: Click outside closes the popup

- **WHEN** the popup is open and the user clicks outside the popover panel
- **THEN** `onClose` is called

---

### Requirement: Citation popup state managed by `useCitationPopup` hook

`apps/chat/src/hooks/citations/useCitationPopup.ts` SHALL export `useCitationPopup` that:
- Tracks `openGroupSourceUrl: string | null` (which group's popup is open, or null when closed).
- Tracks `activeIndexByGroup: Record<string, number>` (the current switcher index per source URL).
- Exposes: `openPopup(sourceUrl: string)`, `closePopup()`, `setActiveIndex(sourceUrl: string, index: number)`.
- Returns derived state: `isOpen(sourceUrl: string): boolean`.

**i18n**: none.
**RTL**: none — state hook only.
**Memoisation**: exposed callbacks SHALL be wrapped in `useCallback`; state object SHALL be wrapped in `useMemo`.

#### Scenario: Opening a popup sets the open group

- **WHEN** `openPopup("https://files.example.com/report.pdf")` is called
- **THEN** `isOpen("https://files.example.com/report.pdf")` returns `true`

#### Scenario: Closing the popup clears the open state

- **WHEN** `closePopup()` is called after a popup was opened
- **THEN** `isOpen` returns `false` for all source URLs

#### Scenario: Index changes are tracked per group

- **WHEN** `setActiveIndex("https://example.com/a.pdf", 2)` is called
- **THEN** subsequent reads return index `2` for that URL

---

### Requirement: "Preview" action opens the cited attachment inline

When the "Preview" button is clicked in `CitationPopup`, the app SHALL invoke the existing attachment-preview flow (the same handler used when clicking an `AttachmentCard` in the assistant bubble) with the `Annotation.body.source.attachment` as the attachment argument.

The cited file is already accessible because DIAL Core auto-shared it; no additional authorization step is required.

**i18n**: reuses existing preview strings; no new keys.
**RTL**: no new directional layout.

#### Scenario: Preview opens the attachment

- **WHEN** the user clicks "Preview" in the citation popup for an annotation with `body.source.attachment = { type: "application/pdf", url: "files/.../report.pdf" }`
- **THEN** the attachment preview for `report.pdf` is triggered (same behavior as clicking an `AttachmentCard`)

---

### Requirement: "Open in browser" action navigates to the source URL

When the "Open in browser" button is clicked, the app SHALL call `window.open(annotation.body.source.attachment.url, '_blank', 'noopener,noreferrer')`.

**i18n**: `citations.popup.openInBrowser` (already declared above).
**RTL**: no directional impact.

#### Scenario: Open in browser calls window.open with the attachment URL

- **WHEN** the user clicks "Open in browser" for an annotation with `body.source.attachment.url = "https://files.example.com/report.pdf"`
- **THEN** `window.open` is called with `"https://files.example.com/report.pdf"`, `"_blank"`, and `"noopener,noreferrer"`
