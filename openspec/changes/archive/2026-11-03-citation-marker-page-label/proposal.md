## Why

Issue [#9661](https://github.com/epam/ai-dial-chat/issues/9661): an inline citation pill shows only the cited file name (`clm.pdf`), so a reader can't tell which page supports the statement without opening the document. The page is already in the annotation's `pdf_bbox`/`pdf_region` selector (or in a reference attachment's `#page=N` URL), but the label never shows it.

Most of the issue is already built. The marker opens the PDF at the cited page through `getAnnotationPdfPage` (`libs/quotations/src/utils/annotation.ts:318`, used by `libs/chat-hooks/src/files/attachment-canvas.ts:558`). A non-empty box is highlighted through `annotationsToPdfHighlights` (`libs/quotations/src/utils/annotation.ts:222`). The `<cit data-id>` ↔ annotation resolution is `groupAnnotationsByCitId` (`libs/quotations/src/utils/group-annotations-by-source.ts`). **The only gap is the label.**

Some sources already write the page into the pill text themselves. The attachment `title`, which becomes `sourceName`, arrives as e.g. `clm.pdf, page 1` or `report.pdf (p. 3)`; `CitationMarker.tsx` already notes that a source name is "routinely a full folder path plus a page number". Adding a page unconditionally would show it twice (`clm.pdf, page 1, p. 1`).

## What Changes

- `libs/quotations` exports a pure helper, `getCitationGroupPage(group)`. It returns the 1-based PDF page of the group's primary annotation: the selector page first, then a `#page=N` fragment on `sourceUrl`. It returns `undefined` when there is no page **or when `group.sourceName` already mentions a page** (`page 1`, `p. 1`, `pp. 3–5`, `pg 2`, `#page=4`, case-insensitive).
- `replaceCitTagsWithSourceNames` takes an optional 4th argument, `formatLabel(group)`, so copied or exported text can carry the same label the pill shows. The default (`group.sourceName`) leaves current output unchanged.
- `apps/chat` builds the marker labels from that helper. When a page is returned, the pill reads `clm.pdf, p. 1` (or `clm.pdf, p. 1 +2` with overflow) and the accessible name reads `Citation from clm.pdf, page 1`. When none is returned, labels stay as they are today. This applies to inline `<cit>` / offset citations, stage-content citations and the message-level reference list, because all of them go through the app's label builders in `ConversationMessageItem.tsx`.
- Copy actions in `ConversationMessageItem` pass the same label formatter, so a copied `<cit>` becomes `clm.pdf, p. 1`, not `clm.pdf`.
- No change to click behaviour: the canvas already opens at the page and highlights the bbox.

## Non-goals

- Backend / DIAL Core / model changes, including whether the model fills `bbox` (the issue's "verify bbox is populated" step is a model-side check).
- New canvas behaviour (page navigation and bbox highlight exist today).
- Page ranges or several pages in one pill: a group shows its primary annotation's page only. The card's Prev/Next switcher keeps per-annotation navigation.
- Localized page detection beyond the English tokens listed above, and detecting a page the model writes into the surrounding message text.
- Changing `CitationCard`'s header text.

## Alternatives considered

- **Always append the page** (baseline): simplest, but it duplicates the page for sources that already put it in the title. That is the case the user flagged. Rejected.
- **Format the label inside the lib (`CitationMarker` appends the page)**: breaks the "lib never formats user strings" rule (`citations.marker.*` is host-translated). Rejected.
- **Add `page` to `AnnotationGroup`**: widens a public interface every grouping path must fill, for a value one pure function can derive. Rejected in favour of a helper.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `citation-marker`: adds the `getCitationGroupPage` helper (with title-mentions-page suppression) and requires the host's marker label / aria-label to include the page when the helper returns one.
- `quotations-citation-markdown`: copy/export text replacement of `<cit>` elements uses the same host-supplied label as the pill.

## Impact

- **Libs touched:** `libs/quotations` only: one new pure util plus an optional parameter on an existing export. Non-breaking. No host knowledge enters the lib: the page comes from the annotation data the lib already parses, and the wording comes from the host's `t()` strings.
- **App:** `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx` (`buildCitationLabels`, reference-list `CitationDropdown` labels, `copyContent`).
- **i18n:** new keys `citations.marker.labelWithPage` (`"{{source}}, p. {{page}}"`), `citations.marker.labelWithPageAndOverflow` (`"{{source}}, p. {{page}} +{{count}}"`), `citations.marker.ariaLabelWithPage` (`"Citation from {{source}}, page {{page}}"`), with matching `CitationsI18nKeys` members. They are added to `apps/chat/src/i18n/locales/en.json`, which is the only locale file.
- **Docs:** `libs/quotations/README.md` (Utilities: new helper, new `replaceCitTagsWithSourceNames` parameter).
- **Rollback:** revert the commit. The lib API change is additive, and no persisted data changes.
