# @epam/ai-dial-quotations

## Overview

Provides citation and annotation components, hooks, and utilities for AI DIAL conversations. This library handles the full lifecycle of inline citations: parsing annotation data from message payloads, grouping annotations by source document, injecting citation markers into rendered markdown, and rendering the `CitationCard`, `CitationMarker`, and `CitationDropdown` popup UI. It also covers reference-only attachments (RAG/search-grounding chunks) mapped to synthetic annotations.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-quotations": "*"
  }
}
```

## Peer Dependencies

- `react` ^19.0.0
- `react-markdown` ^10.1.0
- `@tabler/icons-react` ^3.0.0
- `@epam/ai-dial-chat-shared` \*
- `@epam/ai-dial-ui-kit` \*
- `@epam/pdf-highlighter-kit` >=0.0.14

## Components

### `CitationMarker`

Inline button that opens the citation popup for a source group.

```tsx
import { CitationMarker } from '@epam/ai-dial-quotations';

<CitationMarker
  sourceName="report.pdf"
  annotationCount={2}
  onOpen={() => card.openPopup(sourceUrl)}
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

Manages open/close state and per-group active annotation index for citation popups within a single message.

### `useAnnotations`

Returns the resolved `Annotation[]` for a message, returning an empty array while streaming.

### `useCitationMarkdownComponents`

Builds `react-markdown` component overrides (`p`/`li`) that inject citation markers into rendered paragraph text at the character offsets stored in each annotation group's primary selector. Returns `{ processedContent, markdownComponents }` — pass `processedContent` as the markdown source and spread `markdownComponents` into the renderer's `components` prop. When `groups` is empty, `processedContent` is returned unchanged and `markdownComponents` is `{}` without calling `buildLabels`.

The hook owns no PDF-detection, attachment-DTO, or canvas-opening logic — that belongs in the host's `onPreview` implementation.

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
);
```

## Utilities

- `groupAnnotationsBySource(annotations)` — groups annotations by their source URL into `AnnotationGroup[]`
- `resolveMessageAnnotations(message)` — resolves annotations from either internal or raw wire format
- `normalizeRawAnnotations(raw, attachments)` — normalises raw API wire-format annotations
- `annotationsToPdfHighlights(annotations)` — maps annotations to PDF viewer highlight entries
- `injectCitationSentinels(content, groups)` — inserts sentinel strings at character offsets in markdown
- `replaceSentinelsInChildren(children, renderMarker)` — replaces sentinels with React nodes in a rendered tree
- `getReferenceAttachmentGroups(dtos)` — maps reference-only attachments to synthetic annotation groups
- `isReferenceOnlyAttachment(dto)` — returns true for RAG/grounding chunks without a direct URL
- `parsePdfPageReference(url)` — parses a PDF URL with optional `#page=N` fragment
