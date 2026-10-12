## Why

Today, clicking an inline citation marker in an assistant message always opens the `CitationCard` popover first. The canvas only opens directly when it is already open (`isPreviewOpen`). For a **file** source (a DIAL file, or an external PDF/Office/text file), the card is an extra step: the user reads a short quote and then has to click "Preview" anyway to see the cited place in the document. The canvas already shows that place, with page navigation and a highlight. For **web-link** sources the card is still useful, because it is the only place that shows the quote before the user leaves the app via "Open in browser".

## What Changes

- **File citations:** clicking an inline citation marker that holds a single previewable file citation opens the attachment canvas at once, at the cited page/range with its highlight. No `CitationCard` popover is shown for these markers. This also holds when the canvas is closed.
- **Grouped citations:** a marker holding several citations keeps the card, because its Previous/Next switcher is the only way to reach the other citations, which may point at different files.
- **Link citations:** web-link markers keep their current behaviour, opening the `CitationCard` with the quote and "Open in browser". The same applies to non-previewable sources.
- **Reference chips:** the chips rendered under a message (`IconLink` chips for reference-only attachments) keep their current behaviour.
- **Library change:** `@epam/ai-dial-quotations` adds an optional, default-off `previewFilesOnMarkerClick` flag to `CitationDropdown` and to `UseCitationMarkdownComponentsCallbacks`. With the flag on, a marker click previews directly when a preview action exists, the host says the annotation is previewable, the group holds one annotation, and that annotation is not a web link.
  - A source counts as a web link under the same MIME rule the card already uses for its "Open in browser" vs "Download" label: `text/html` / `application/xhtml+xml`.
  - The flag is optional and off by default, so this change is not breaking.
- **App change:** `ConversationMessageItem` turns the flag on for inline citations only.

## Problem

File citations need two clicks (marker, then "Preview") to reach the canvas. Link citations need the card, so they cannot use the same shortcut.

## Solution

Generalize the existing `isPreviewOpen` direct-preview path in `CitationDropdown.handleMarkerOpen` (`libs/quotations/src/components/CitationDropdown/CitationDropdown.tsx:89`). Today the condition is "the canvas is open". With the opt-in flag it becomes "the canvas is open, **or** the active annotation is a file". File-vs-link classification reuses the card's existing `isWebLink` rule (`libs/quotations/src/components/CitationCard/CitationCard.tsx:143`), extracted into a shared util. The pattern to follow is the current `isPreviewOpen` branch.

**Alternatives considered:**

| Option | Verdict |
| --- | --- |
| (a) Hard-code the behaviour in `CitationDropdown` with no flag | Rejected: it would also change reference chips (PDF-page references have a preview action) and other hosts' behaviour without opt-in. |
| (b) Host-supplied `shouldPreviewDirectly(annotation)` callback | Rejected: it duplicates the MIME classification the lib already owns for its button label. A boolean is enough. |
| (c) App-only: the app wraps `onPreview` and skips the card some other way | Not possible: the card is opened inside the lib. |
| (d) Opt-in boolean flag (chosen) | Smallest change. Backward compatible. Keeps classification in one place. |

## Non-goals

- Changing link citations, reference chips, or the Sources side panel (`ConversationSourcesPanel`). The side panel already opens files in the canvas.
- Removing `CitationCard` or its switcher. It stays for links and non-previewable sources.
- Changing how the canvas resolves content (`handleCitationPreview`, `annotationToPdfCanvasContent`, `annotationToOoxmlCanvasContent`).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `citation-card`: the `CitationDropdown` props gain `previewFilesOnMarkerClick`. A marker click previews a file annotation directly when the flag is on. The chat app opts in for inline citations.
- `quotations-citation-markdown`: the callbacks object gains an optional `previewFilesOnMarkerClick`, forwarded to each dropdown. The "activating any marker opens exactly one card" rule gains the file exception.

## Impact

- **`libs/quotations`:**
  - `CitationDropdown.tsx`, `CitationCard.tsx` (the web-link rule moves into a shared util), `useCitationMarkdownComponents.tsx`, a new `utils/citation-source-kind.ts`, tests, and `README.md`.
  - **Library isolation:** the lib only receives a boolean and keeps using the host's `isPreviewable` callback. DIAL-file and external-source classification stay in the app (`isCitationPreviewable` in `ConversationMessageItem.tsx`).
- **`apps/chat`:** `ConversationMessageItem.tsx` passes `previewFilesOnMarkerClick: true` in `citationCallbacks`, plus a test.
- **i18n:** no new strings.
- **RTL:** no new UI, so no direction impact.
- **Feature flag:** none.
- **Rollback:** remove the flag from the app's `citationCallbacks` to get the old behaviour back. The lib flag is inert when unset.

## Acceptance criteria

- Clicking a PDF/Office/DIAL-file inline citation marker opens the canvas at the cited location, and no citation card appears. This holds on desktop and mobile, with the canvas closed or open.
- Clicking a `text/html` (web link) inline citation marker opens the card exactly as today.
- Reference chips behave as today.
- Without the flag, `CitationDropdown` / `useCitationMarkdownComponents` behave exactly as today. Existing tests pass unchanged.
- `npm run validate:docs` and `npm run validate:specs` pass.
