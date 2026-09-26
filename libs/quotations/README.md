# @epam/ai-dial-quotations

## Overview

Provides citation and annotation components, hooks, and utilities for AI DIAL conversations. This library handles the full lifecycle of inline citations: parsing annotation data from message payloads (both offset-based `text_character_range`/`pdf_region` citations and inline paired-tag citations, e.g. `<cit data-id="…"></cit>`), grouping annotations (by source document, or by tag id for inline-tag citations), building the `cit` react-markdown component override (rendered as a real element once the host's `rehype-raw`/`rehype-sanitize` pipeline allows the tag through — see `MarkdownRenderer`'s `baseRehypePlugins`), and rendering the `CitationCard`, `CitationMarker`, and `CitationDropdown` popup UI. It also covers reference-only attachments (RAG/search-grounding chunks) mapped to synthetic annotations.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-quotations": "*"
  }
}
```

Import the stylesheet once in the consuming app:

```ts
import '@epam/ai-dial-quotations/styles.css';
```

## Peer Dependencies

- `react` ^19.2.8
- `@epam/ai-dial-chat-shared` \*
- `@epam/ai-dial-ui-kit` \*

## Components

### `CitationMarker`

Inline button that opens the citation popup for a source group.

```tsx
import { CitationMarker } from '@epam/ai-dial-quotations';

<CitationMarker
  sourceName="report.pdf"
  annotationCount={2}
  onOpen={() => card.openPopup(group.groupKey)}
  labels={{
    ariaLabel: `Citation from report.pdf`,
    label: 'report.pdf',
    labelWithOverflow: 'report.pdf +1',
  }}
/>;
```

### `CitationCard`

Popup card displaying a citation's title, quoted excerpt, and navigation controls.

```tsx
import { CitationCard } from '@epam/ai-dial-quotations';

<CitationCard
  group={group}
  activeIndex={activeIndex}
  onIndexChange={setActiveIndex}
  onPreview={handlePreview}
  onOpenInBrowser={handleOpen}
  labels={{
    ariaLabel: `Citation from ${group.sourceName}`,
    previousCitation: 'Previous',
    nextCitation: 'Next',
    formatSwitcherText: (current, total) => `${current} / ${total}`,
    preview: 'Preview',
    openInBrowser: 'Open in browser',
    download: 'Download',
  }}
/>;
```

### `CitationDropdown`

Combines `CitationMarker` and `CitationCard` into a tooltip-based dropdown.

Pass the optional `isPreviewable(annotation)` callback to control Preview for
each active annotation. When it returns `false`, the card shows only
"Open in browser"; without it, providing `onPreview` enables Preview as before.
Availability is checked again when the user switches annotations within a card.

```tsx
import {
  CitationDropdown,
  CitationCardProvider,
  useCitationCard,
} from '@epam/ai-dial-quotations';

const card = useCitationCard();
<CitationCardProvider value={card}>
  <CitationDropdown
    group={group}
    onOpenInBrowser={handleOpen}
    cardLabels={cardLabels}
    markerLabels={markerLabels}
  />
</CitationCardProvider>;
```

## Hooks

### `useCitationCard`

Manages open/close state and per-group active annotation index for citation popups within a single message. The hook carries two key spaces:

- **Openness** (`openPopup(ownerKey)`, `closePopup(ownerKey)`, `isOpen(ownerKey)`) is keyed by **occurrence owner key** — a stable per-instance id `CitationDropdown` derives with React `useId()`, not `AnnotationGroup.groupKey` or `sourceUrl`. Two rendered occurrences resolving to the same group are therefore always independent popup owners: `openPopup` makes its key the sole owner (transferring the open card from any previous owner), and `closePopup` is **owner-scoped** — it clears state only when the given key currently owns the popup, so a dismissal from an inactive or previously active occurrence can never close the card the user just opened.
- **The switcher index** (`setActiveIndex(groupKey, index)`, `getActiveIndex(groupKey)`) stays keyed by `AnnotationGroup.groupKey` (not `sourceUrl` — two groups can share a `sourceUrl`, e.g. two inline-tag citations of the same document), because the index indexes into `group.annotations`, which is group data.

`CitationDropdown` is the only in-repo caller and applies this split automatically; a host rendering it directly needs no extra prop.

### `useAnnotations`

Returns the resolved `Annotation[]` for a message, returning an empty array while streaming — every citation family, including `html_tag`, only shows its pill once the message finishes streaming.

### `useCitationMarkdownComponents`

Builds `react-markdown` component overrides for rendering citations: a `cit` element override (rendered once the host's `rehype-raw`/`rehype-sanitize` pipeline parses the exact supported `<cit data-id="…"></cit>` shape into a real element — see `MarkdownRenderer`'s `baseRehypePlugins`; the override looks the group up by `data-id` and renders unmatched markup as literal text), plus `p`/`li` overrides that inject markers at the character offsets stored in each offset-based annotation group's primary selector. Unsupported `cit` shapes are escaped and displayed as ordinary text rather than interpreted or dropped. Returns `{ processedContent, markdownComponents }` — pass `processedContent` as the markdown source and spread `markdownComponents` into the renderer's `components` prop.

While `isStreaming` is `true`, `processedContent` hides only complete supported `<cit data-id="…"></cit>` citation elements via `stripCitTagsWhileStreaming`. Partial or unsupported `cit` markup is escaped and displayed literally, so an HTML parser cannot swallow the streamed suffix.

The hook owns no PDF-detection, attachment-DTO, or canvas-opening logic — that belongs in the host's `onPreview` implementation.

Its callbacks also accept optional `isPreviewable(annotation)`, forwarded to
`CitationDropdown`. The host supplies its source classification policy: DIAL Chat
keeps Preview for DIAL files and supported external file sources, and hides it
for ordinary external web pages such as `https://data.imf.org/en/datasets/IMF.RES:WEO`.
The library does not interpret DIAL file paths or decide which viewers the host supports.

An optional trailing `fallbackGroups` parameter (default `[]`) is a pool of groups that do not belong to this message — supplied by the host for a `<cit data-id="…">` element the message's own `groups` do not resolve. It participates only in `data-id` lookup: it is never passed to sentinel injection, so it cannot shift a marker position in `processedContent`, and a colliding id always resolves from `groups` first.

```tsx
import { useCitationMarkdownComponents } from '@epam/ai-dial-quotations';

const { processedContent, markdownComponents } = useCitationMarkdownComponents(
  message.content,
  citationGroups,
  {
    onPreview: (annotation, group) => openPreview(annotation, group),
    onOpenInBrowser: (annotation) => openInBrowser(annotation),
    buildLabels: (group) => ({
      cardLabels: {
        ariaLabel: `Citation from ${group.sourceName}`,
        previousCitation: 'Previous',
        nextCitation: 'Next',
        formatSwitcherText: (current, total) => `${current} / ${total}`,
        preview: 'Preview',
        openInBrowser: 'Open in browser',
        download: 'Download',
      },
      markerLabels: {
        ariaLabel: `Citation from ${group.sourceName}`,
        label: group.sourceName,
        labelWithOverflow: `${group.sourceName} +${group.annotations.length - 1}`,
      },
    }),
  },
  isStreaming,
  false,
  fallbackCitationGroups,
);
```

## Utilities

Raw `html_tag` normalization preserves an optional `body.selector` (object or array)
and a supplied annotation `index`. The target selector identifies the chat marker;
the body selector identifies the location in the document. Missing selector fields
are omitted so quote-only streaming deltas preserve an earlier page.

- `groupAnnotations(annotations)` — dispatches by selector type and returns the concatenation of `groupAnnotationsByCitId` (for `html_tag` annotations) and `groupAnnotationsBySource` (for every other annotation); prefer this over calling either grouping function directly
- `groupAnnotationsBySource(annotations)` — groups non-`html_tag` annotations by their source URL into `AnnotationGroup[]`
- `groupAnnotationsByCitId(annotations)` — groups `html_tag`-selector annotations by `target.selector.id`, one group per distinct tag id (never collapsing two ids that cite the same document)
- `resolveMessageAnnotations(message)` — resolves annotations from either internal or raw wire format and repairs persisted `html_tag` sources whose historical PDF fallback conflicts with a recognized URL extension
- `normalizeRawAnnotations(raw, attachments)` — **moved to `@epam/ai-dial-chat-shared`**, which owns the annotation model. It normalises raw API wire-format annotations (the legacy `attachment_index` + `pdf_region` shape and the `html_tag` + flat `body.source.url` shape, including DOCX/XLSX/PPTX MIME inference). `@epam/ai-dial-chat-hooks` needed it while streaming and nothing else from this package, so keeping it here made a conversation-only host install the whole citation stack ([issue #8719](https://github.com/epam/ai-dial-chat/issues/8719))
- `annotationsToPdfHighlights(annotations)` — maps annotations with positive integer pages and finite coordinates to PDF viewer highlight entries; recognizes `pdf_bbox` selectors (`{ page, x1, y1, x2, y2 }`) and `pdf_region` selectors in either coordinate form (`bbox: { lt: [left, top], wh: [width, height] }` or the legacy `bbox: { left, top, width, height }`), converting a region to edges as `x1 = left`, `y1 = top`, `x2 = left + width`, `y2 = top + height`; zero-area boxes are supported; each highlight's `id` comes from `annotationHighlightId`
- `annotationHighlightId(annotation, fallbackIndex)` — returns the highlight id for one annotation, the same id `annotationsToPdfHighlights` assigns it: `annotation.index` when the wire supplied one, otherwise an id derived from the annotation's own identity (its `cit` tag id plus a digest of its selectors), falling back to `fallbackIndex` only for an annotation carrying none of those. The id is opaque — compare it, never parse it — and a position-derived id is unique only within the list it came from, which is why it is the last resort
- `getAnnotationPdfPage(annotation)` — returns the first positive integer page from its `pdf_bbox`/`pdf_region` body selectors, skipping malformed entries and invalid pages; returns `undefined` when no valid page exists
- `injectCitationSentinels(content, groups)` — inserts sentinel strings at character offsets in markdown, for offset-based (non-`html_tag`) groups only
- `stripCitTagsWhileStreaming(content)` — hides supported paired citation elements while streaming and escapes every other `cit` shape for literal display
- `replaceSentinelsInChildren(children, renderMarker)` — replaces sentinels with React nodes in a rendered tree
- `getReferenceAttachmentGroups(dtos)` — maps reference-only attachments to synthetic annotation groups
- `isReferenceOnlyAttachment(dto)` — returns true for RAG/grounding chunks without a direct URL
- `parsePdfPageReference(url)` — parses a PDF URL with optional `#page=N` fragment

### Office citation selectors

`isDocxRangeSelector`, `isPptxRangeSelector`, and `isExcelRcRangeSelector` narrow an `AnnotationSelector` to its Office range shape, requiring every field the shape needs — a `_range`-suffixed selector missing a field matches no guard. `annotationToOfficeHighlightLocations(annotation)` converts `body.selector` (scalar or array) to validated `OfficeHighlightLocation[]`, skipping invalid entries without throwing.

```tsx
import {
  annotationToOfficeHighlightLocations,
  isDocxRangeSelector,
  isExcelRcRangeSelector,
  isPptxRangeSelector,
} from '@epam/ai-dial-quotations';
import type { OfficeHighlightLocation } from '@epam/ai-dial-quotations';

const locations: OfficeHighlightLocation[] =
  annotationToOfficeHighlightLocations(annotation);
```

`OfficeHighlightLocation` includes `DocxOfficeHighlightLocation`, `PptxOfficeHighlightLocation`, `ExcelOfficeHighlightLocation`, `DocxTableRowOfficeHighlightLocation`, and `PptxTableRowOfficeHighlightLocation`. It is discriminated by the wire's own `type` string, not by `@epam/ai-dial-attachment-canvas`'s `OoxmlHighlightKind` — this lib cannot depend on `attachment-canvas` (a real circular dependency: `attachment-canvas` already depends on this lib for the PDF highlight path). `libs/chat-hooks`, which depends on both, maps `OfficeHighlightLocation[]` into `OoxmlHighlight[]`.

For `DocxOfficeHighlightLocation`/`PptxOfficeHighlightLocation`, `endExclusive` is the wire's `end` copied through **unchanged** — confirmed already exclusive against captured DIAL Core responses, not `end + 1`. `ExcelOfficeHighlightLocation.end` stays the inclusive last-cell address, a distinct concept unaffected by that conversion point.

Temporary compatibility for [#8863](https://github.com/epam/ai-dial-chat/issues/8863)
accepts `docx_text_anchor` and `pptx_text_anchor` only when `text` is one Markdown
table row bounded by pipes, with at least two cells and a positive integer
`occurrence`. It decodes backslash-escaped punctuation into plain `cells: string[]`;
PPTX also requires a positive integer `slide`. Plain-text anchors, separator rows,
multiline Markdown, and invalid fields are skipped. The compatibility policy counts
`occurrence` from 1 in the DOCX body or within the specified PPTX slide; this is a
frontend policy, not a verified general backend anchor contract. TODO: remove the
adapter after the backend emits precise table-cell ranges and persisted anchors
no longer need it.

`gatherSameSourceAnnotations(clicked, annotations)` returns every annotation in `annotations` whose `body.source.attachment.url` equals `clicked`'s, in original order, gathering across the whole list (not one `cit`-id group, unlike `groupAnnotationsByCitId`) — keyed on URL only, since two different files can share a display title.

## Public class names

A host embedding this package cannot style it through its CSS-module locals —
they are hashed at build time — nor through DOM order or ARIA attributes, which
are structure and accessibility contracts rather than styling ones. Selected
elements therefore carry a stable public class.

| Key                | Class                               | Element                                                                 |
| ------------------ | ----------------------------------- | ----------------------------------------------------------------------- |
| `citationCard`     | `dial-quotations-citation-card`     | The card's `role="dialog"` root, which carries the themed CSS variables |
| `citationDropdown` | `dial-quotations-citation-dropdown` | The floating panel a `CitationDropdown` reveals, holding the card       |
| `citationMarker`   | `dial-quotations-citation-marker`   | The marker pill that opens a citation                                   |

```tsx
import { QUOTATIONS_CLASS } from '@epam/ai-dial-quotations';

QUOTATIONS_CLASS.citationCard; // 'dial-quotations-citation-card'
```

The marker is a `NeutralButton` from
[`@epam/ai-dial-ui-kit`](https://www.npmjs.com/package/@epam/ai-dial-ui-kit), so
`dial-kit-base-button` is on the same element — this class is what tells a
citation marker apart from any other pill in the same host. It caps its own
width and ellipsises a long source name, which is server-supplied and routinely
a folder path plus a page number, so widen it by overriding `max-inline-size`
rather than by unsetting the truncation:

```css
.dial-quotations-citation-marker {
  max-inline-size: 320px;
}
```

The classes carry no declarations of their own: nothing in `styles.css`
selects on them, so they change nothing until a host writes a rule. Renaming
one, or moving it to a different element, is a breaking change. The convention
is in [`openspec/lib-styling-guide.md`](../../openspec/lib-styling-guide.md).

Write host overrides with CSS logical properties (`margin-inline-start`,
`inset-inline-end`) so they keep working under `dir="rtl"`.
