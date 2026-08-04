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
- `@tabler/icons-react` ^3.0.0
- `@epam/ai-dial-chat-shared` \*
- `@epam/ai-dial-ui-kit` ^0.13.0-dev.26

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
  activeIndex={0}
  onIndexChange={setIndex}
  onOpenInBrowser={handleOpen}
  labels={{
    markerAriaLabel: `Citation from ${group.sourceName}`,
    previousCitation: 'Previous',
    nextCitation: 'Next',
    switcherText: '1 / 3',
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
