## Context

**Where markers come from.** Inline citation markers are rendered by `useCitationMarkdownComponents` (`libs/quotations`). It renders one `CitationDropdown` per marker.

**What a marker click does today.** `CitationDropdown.handleMarkerOpen` does one of two things:

- If `isPreviewOpen` is set and a preview action exists, it calls `onPreview(annotation)`.
- Otherwise it opens the `CitationCard` via `CitationCardContext`.

**How the app wires it.** The chat app, in `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx`, supplies the following through `citationCallbacks`:

| Callback | Role |
| --- | --- |
| `onPreview` = `handleCitationPreview` | Tries PDF canvas content, then OOXML canvas content, then the generic attachment canvas. |
| `isPreviewable` = `isCitationPreviewable` | True for a DIAL file id, or for an external source that `isExternalSourcePreviewable` accepts. |
| `isPreviewOpen` = `isCanvasOpen` | Tells the lib whether the canvas is already open. |

**How the card tells files from links.** `CitationCard` already decides "file vs web link" for its second button label: `isWebLink = onPreview == null || type is text/html | application/xhtml+xml`.

**Reference chips.** These are rendered by the app directly with `CitationDropdown`, and only get `onPreview` for PDF-page references.

## Goals / Non-Goals

**Goals**

- One click on a file citation marker opens the canvas at the cited location.
- Link citations and reference chips are unchanged.
- The lib stays backward compatible and host-agnostic.

**Non-Goals**

- Redesigning `CitationCard`.
- Changing the Sources side panel.
- Changing canvas content resolution.

## Decisions

### D1. Opt-in boolean flag `previewFilesOnMarkerClick` (default `false`)

The flag is added to `CitationDropdownProps` and to `UseCitationMarkdownComponentsCallbacks`, which forwards it.

- **Why a flag:** reference chips use the same `CitationDropdown`. Their PDF-page references have a preview action and a `application/pdf` type, so an unconditional rule would change them. The user asked for links to stay as they are, and chips are presented as links (with an `IconLink` icon).
- **Alternative rejected:** a host predicate. It would duplicate the lib's MIME rule.

### D2. Direct-preview condition

`handleMarkerOpen` previews directly when all of the following hold:

- `handlePreview` exists. That requires both `onPreview` and `isPreviewable(annotation)` to be true.
- `isPreviewOpen || (previewFilesOnMarkerClick && group.annotations.length === 1 && !isWebLinkAnnotation(annotation))` is true.

A group with several annotations keeps the card. Implementation showed a single `<cit>` id can group citations from different files (for example `other.pdf` page 2 and `report.pdf` page 3). Previewing the primary directly would leave the others unreachable, because the card's switcher is the only way to them. **Alternative rejected:** always previewing directly, which loses those citations.

Otherwise it opens the card, as today. The click calls `onPreview` exactly once with the displayed annotation (`group.annotations[activeIndex] ?? primaryAnnotation`). `closePopup(ownerKey)` is still called, which is a harmless no-op when nothing is open.

### D3. Single source for the web-link rule

The MIME check moves from `CitationCard` into `libs/quotations/src/utils/citation-source-kind.ts` as `isWebLinkAnnotation(annotation)`. It returns true when the source attachment type is `MIMEType.HTML` or `MIMEType.XHTML`.

`CitationCard` keeps its extra `onPreview == null` term and calls the helper for the MIME part. The helper is internal: it is not exported from `src/index.ts`, so there is no README class/API change for it.

Classification cases:

- An external source with no type: `isPreviewable` already returns false for it unless its extension is supported. It therefore still gets the card.
- An external `.html` file: its type is `text/html`, so it is a link and gets the card. This matches "links stay as is".

### D4. App opts in for inline citations only

`citationCallbacks` in `ConversationMessageItem.tsx` adds `previewFilesOnMarkerClick: true`. The `useMemo` dependencies are unchanged, because the value is a constant. The reference-chip `CitationDropdown` gets no flag.

### D5. Library isolation

The lib receives only a boolean and keeps delegating previewability to the host's `isPreviewable` callback. DIAL-file detection (`isDialFileId`), external-source rules (`isExternalSourcePreviewable`), and canvas opening (`openCanvas` / `handleAttachmentClick`) stay in the app and in `chat-hooks`.

### D6. Loading, error and empty states

These are unchanged and come from the existing canvas flow:

- **PDF/OOXML:** `openCanvas` opens synchronously with page and highlight.
- **Generic path:** this goes through `openAttachmentCanvas`, which shows its loading state and falls back to download when the canvas cannot render the file. That fallback is the existing behaviour of `handleAttachmentClick`.

### D7. Accessibility

The marker stays a `button` with the same `aria-label` ("Citation from {{source}}"). Today it declares no `aria-haspopup` or `aria-expanded`, so nothing about the popup is promised and no ARIA change is needed.

Focus moves to the canvas panel the same way it does for a "Preview" click today. Keyboard activation (Enter/Space) follows the same `onClick` path.

### D8. Memoisation

`markdownComponents` must stay independent of popup state (the existing requirement). The new flag is part of the callbacks object, which is already in the components' memo inputs. Because the app passes a constant, nothing remounts.

## Risks / Trade-offs

- **[Trade-off]** Multi-citation file markers still take two clicks (marker, then "Preview"). This is accepted so that every citation stays reachable.
- **[Risk]** The quote text for file citations is no longer shown in a popover.
  → **Mitigation:** the canvas shows the highlighted passage in context. This is the intent of the request.
- **[Risk]** Other hosts of `@epam/ai-dial-quotations` see no change, because the flag defaults to off.

## Migration Plan

- No data migration.
- **Rollback:** remove `previewFilesOnMarkerClick: true` from the app's `citationCallbacks`.

## Open Questions

None blocking. **Assumption (recorded):** "files" means any citation source the card would label "Download". That covers previewable sources that are not HTML/XHTML: DIAL files and external PDF/Office/text files. "Links" means HTML/XHTML sources and non-previewable sources.
