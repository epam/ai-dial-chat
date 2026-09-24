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
  isPreviewable?: (annotation: Annotation) => boolean;
  onOpenInBrowser: (annotation: Annotation) => void;
}
```
`CitationDropdown` SHALL only invoke `citationCard.closePopup()` on preview (see next requirement) when `onPreview` is provided; when `onPreview` is absent, there is no preview action to wrap.

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

### Requirement: Citation popup state managed by `useCitationCard` hook and `CitationCardContext`

`libs/quotations/src/utils/useCitationCard.ts` SHALL export `useCitationCard` that:

- Tracks `openOwnerKey: string | null` — the **rendered marker occurrence** whose popup is open, or `null` when closed. The key space SHALL be occurrence identity, NOT `AnnotationGroup.groupKey` and NOT `sourceUrl`, so that two rendered occurrences resolving to the same group never share open state.
- Tracks `activeIndexByGroup: Record<string, number>` (the current switcher index per `groupKey`). The switcher index SHALL remain keyed by `groupKey`, because the index indexes into `group.annotations`, which is group data.
- Exposes: `openPopup(ownerKey: string)`, `closePopup(ownerKey: string)`, `setActiveIndex(groupKey: string, index: number)`.
- Returns derived state: `isOpen(ownerKey: string): boolean`, `getActiveIndex(groupKey: string): number`.

`openPopup(ownerKey)` SHALL make `ownerKey` the sole owner, replacing any previous owner — activating a second occurrence transfers the open card to it rather than opening a second one.

`closePopup(ownerKey)` SHALL be **owner-scoped**: it clears `openOwnerKey` only when `ownerKey` equals the current owner, and SHALL be a no-op otherwise. A dismissal originating from an occurrence that does not own the popup — an inactive occurrence, or one that owned it before ownership transferred — SHALL NOT close the card that is currently open.

The hook deliberately carries two key spaces. Openness is per occurrence; switcher position is per group. Parameter names SHALL state which space each argument belongs to, and the hook's JSDoc SHALL document the split.

**Memoisation**: exposed callbacks SHALL be wrapped in `useCallback`; the returned object SHALL be wrapped in `useMemo`.

`libs/quotations/src/context/CitationCardContext.tsx` SHALL export:
- `CitationCardProvider` — the React context provider component.
- `useCitationCardContext()` — hook that returns the current `CitationCardHook` value; throws if used outside a provider.
- `CitationCardHook` — the inferred return type of `useCitationCard`.

The consuming app's message-item component SHALL wrap its return value in `<CitationCardProvider value={citationCard}>` so that all `CitationDropdown` instances rendered via `markdownComponents` can access the shared citation state without prop drilling.

`CitationDropdown` SHALL derive a stable per-instance occurrence key with React `useId()` and SHALL use that key — never `group.groupKey` and never `group.sourceUrl` — for `citationCard.isOpen(...)`, `citationCard.openPopup(...)`, and `citationCard.closePopup(...)`. It SHALL continue to use `group.groupKey` for `citationCard.getActiveIndex(...)` and `citationCard.setActiveIndex(...)`, and `group.sourceUrl` where the meaning is "the attachment to preview/download". The occurrence key SHALL NOT be a prop, so a host rendering `CitationDropdown` directly requires no change.

`CitationDropdown` SHALL NOT clone, rebuild, or copy the `AnnotationGroup` it receives, nor the `Annotation` objects inside it. Downstream mappers identify the clicked annotation by reference identity (`annotationToOoxmlCanvasContent` compares `entry === annotation`; `annotationToPdfCanvasContent` resolves its group with `groups.find(g => g.annotations.includes(annotation))`), so occurrence scoping SHALL be achieved without touching citation data.

`useCitationMarkdownComponents` SHALL NOT accept `citationCard` as a parameter; it reads `CitationCardContext` internally via `CitationDropdown`. The `markdownComponents` returned SHALL depend on citation data, `onPreview`, `isPreviewable`, `onOpenInBrowser`, `buildLabels`, and presentation inputs — never on any citation popup state — so that ReactMarkdown never unmounts the paragraph subtree in response to a citation state update, and so each occurrence's `useId` value survives every ordinary rerender.

#### Scenario: Opening a popup sets the open owner

- **WHEN** `openPopup("occ-1")` is called
- **THEN** `isOpen("occ-1")` returns `true`

#### Scenario: Two occurrences of one group have independent open state

- **WHEN** two rendered `CitationDropdown` instances resolve to the same `AnnotationGroup` (identical `groupKey` and `sourceUrl`), and the first occurrence's marker is activated
- **THEN** only the first occurrence's card is open, and the second occurrence's card is not rendered

#### Scenario: Two groups sharing a sourceUrl have independent open state

- **WHEN** two `AnnotationGroup`s share the same `sourceUrl` but have `groupKey` values `"cit:e43864"` and `"cit:e52dc2"`, and one group's marker is activated
- **THEN** only that marker's card is open

#### Scenario: Activating another occurrence transfers the open card

- **WHEN** occurrence A's card is open and occurrence B's marker is activated
- **THEN** `isOpen` returns `true` for B and `false` for A, and exactly one card is rendered

#### Scenario: Closing from the owning occurrence clears the open state

- **WHEN** `closePopup("occ-1")` is called while `"occ-1"` owns the popup
- **THEN** `isOpen` returns `false` for every key

#### Scenario: Closing from a non-owning occurrence is a no-op

- **WHEN** `openPopup("occ-2")` is called while `"occ-1"` owned the popup, and `closePopup("occ-1")` is then called
- **THEN** `isOpen("occ-2")` still returns `true` — the stale occurrence's dismissal does not close the newly opened card

#### Scenario: Index changes are tracked per groupKey

- **WHEN** `setActiveIndex("cit:e43864", 2)` is called
- **THEN** `getActiveIndex` returns `2` for `"cit:e43864"`

#### Scenario: URL-keyed group's groupKey still equals its sourceUrl

- **WHEN** a `text_character_range` `AnnotationGroup` is produced by `groupAnnotationsBySource` with `sourceUrl = "https://files.example.com/report.pdf"`
- **THEN** its `groupKey` also equals `"https://files.example.com/report.pdf"`, preserving prior behavior for that family of groups

#### Scenario: Popup ownership survives an ordinary rerender

- **WHEN** a card is open and the message item rerenders for an unrelated reason
- **THEN** the same occurrence's card remains open, with the same switcher index

---

### Requirement: Citation popup closes only on "Preview"; navigation and download buttons leave it open

`CitationDropdown` SHALL close the popup immediately after forwarding the `onPreview` event, when `onPreview` is provided — by calling `citationCard.closePopup(ownerKey)` from `CitationCardContext` with **its own** occurrence key, so the close cannot dismiss another occurrence's card. No other button in `CitationCard` (Previous, Next, "Open in browser", "Download") SHALL close the popup.

The `CitationCard` component itself only calls the `onPreview` prop when present; closing is the responsibility of `CitationDropdown`.

`CitationDropdown`'s `onOpenChange(false)` handler SHALL likewise close only through its own occurrence key. Because the underlying tooltip's outside-press dismissal is not disabled while the tooltip is controlled, a dismissal event can be delivered to an occurrence that does not own the popup; owner-scoped closing SHALL make that a no-op rather than dismissing the active card.

The reason navigation buttons (Prev/Next) must not cause a close: they update `activeIndex` in `useCitationCard`, which previously triggered `markdownComponents` to recompute with new function references, causing ReactMarkdown to unmount and remount the paragraph subtree (including `CitationDropdown` and its tooltip). The context-based architecture prevents this — see the `CitationCardContext` requirement above.

#### Scenario: Popup closes on preview click

- **WHEN** the user clicks the "Preview" button inside the open citation popup
- **THEN** `citationCard.closePopup` is called with that occurrence's own key and the popup is dismissed

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

#### Scenario: A dismissal aimed at a stale occurrence leaves the active card open

- **WHEN** occurrence A's card was open, occurrence B's card is now open, and A's tooltip delivers `onOpenChange(false)`
- **THEN** B's card remains open and its footer buttons remain mounted and clickable

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
