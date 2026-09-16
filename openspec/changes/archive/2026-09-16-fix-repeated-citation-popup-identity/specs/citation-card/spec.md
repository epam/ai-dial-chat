## MODIFIED Requirements

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

`useCitationMarkdownComponents` SHALL NOT accept `citationCard` as a parameter; it reads `CitationCardContext` internally via `CitationDropdown`. The `markdownComponents` returned SHALL only depend on `groups`, `onPreview`, `onOpenInBrowser`, `buildLabels`, and `isCompactTypography` — never on any citation popup state — so that ReactMarkdown never unmounts the paragraph subtree in response to a citation state update, and so each occurrence's `useId` value survives every ordinary rerender.

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
