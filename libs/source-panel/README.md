# @epam/ai-dial-source-panel

Panel component for displaying conversation sources — uploaded files and generated citations/references.

## Overview

`@epam/ai-dial-source-panel` renders the sources sidebar that appears alongside an active conversation when the model produces citations or the user has uploaded reference files. It solves the problem of giving users transparent access to the evidence behind a model response: the panel is divided into two sections — uploaded files (documents the user attached before sending the message) and generated sources (documents the model retrieved or cited in its answer) — both of which are searchable and support clicking through to an inline preview via `@epam/ai-dial-attachment-canvas`. Use this library whenever a chat view needs to surface grounding information next to the conversation thread, allowing users to verify claims, re-read source material, or download referenced documents without leaving the conversation.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-source-panel": "*"
  }
}
```

## Peer Dependencies

- `react`
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-ui-kit`
- `@epam/ai-dial-sidebar`
- `@epam/ai-dial-conversation-input`
- `@tabler/icons-react`

## Components

### ConversationSourcesPanel

Root component. Renders both the uploaded files section and the generated sources section inside a `SidebarPanel` shell.

```tsx
import { ConversationSourcesPanel } from '@epam/ai-dial-source-panel';
import type { ConversationSourcesPanelProps } from '@epam/ai-dial-source-panel';

<ConversationSourcesPanel
  isOpen={isOpen}
  uploaded={uploadedAttachments}
  generated={generatedAttachments}
  sources={quotations}
  isMobile={isMobile}
  labels={labels}
  onClose={handleClose}
  onAttachmentClick={handleAttachmentClick}
  onSourceClick={handleSourceClick}
  onDownloadAll={handleDownloadAll}
/>;
```

## Types

```tsx
import type {
  ConversationSourcesPanelProps,
  ConversationSourcesPanelLabels,
  ConversationSourcesPanelColors,
  ConversationSourcesPanelStyles,
  ConversationSourcesPanelTypography,
  QuotationSource,
} from '@epam/ai-dial-source-panel';
```

### QuotationSource

Shape of a single cited source entry.

```tsx
interface QuotationSource {
  url: string;
  title: string;
  contentType: string;
  quote?: string;
}
```

### ConversationSourcesPanelLabels

Override default English UI strings with translated values.

```tsx
const labels: ConversationSourcesPanelLabels = {
  ariaLabel: t('Sources panel'),
  closeLabel: t('Close'),
  searchPlaceholder: t('Search sources...'),
  searchClearLabel: t('Clear search'),
  noDataLabel: t('Empty'),
  noResultsLabel: t('No results'),
  downloadAllLabel: t('Download all'),
  uploadedSectionTitle: t('Uploaded files'),
  generatedSectionTitle: t('Generated files'),
  sourcesSectionTitle: t('Sources'),
  copySourceLabel: t('Copy link'),
  sourceCopiedLabel: t('Copied!'),
  attachmentClickLabel: t('Download'),
};
```
