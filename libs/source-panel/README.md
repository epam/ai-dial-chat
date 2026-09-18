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

Import the stylesheet once in the consuming app:

```ts
import '@epam/ai-dial-source-panel/styles.css';
```

## Peer Dependencies

- `react`
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-ui-kit`
- `@epam/ai-dial-conversation-input`

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

## Public class names

A host embedding this package cannot style it through its CSS-module locals —
they are hashed at build time — nor through DOM order or ARIA attributes, which
are structure and accessibility contracts rather than styling ones. The panel
therefore carries a stable public class, exported as `SOURCE_PANEL_CLASS`.

| Key     | Class                     | Element                                                        |
| ------- | ------------------------- | -------------------------------------------------------------- |
| `panel` | `dial-source-panel-panel` | The panel wrapper — the box that owns its width and transition |

The panel is drawn by [`@epam/ai-dial-sidebar`](../sidebar/README.md), which
puts this class on the **wrapper** around the region, not on the
`role="complementary"` element itself — that one carries `dial-sb-aside`. Size
or position the wrapper, and descend from it to reach the region.

The class carries no declarations of its own: nothing in `styles.css` selects on
it, so it changes nothing until a host writes a rule. Renaming it, or moving it
to a different element, is a breaking change. The convention is in
[`openspec/lib-styling-guide.md`](../../openspec/lib-styling-guide.md).

```tsx
import { SOURCE_PANEL_CLASS } from '@epam/ai-dial-source-panel';

SOURCE_PANEL_CLASS.panel; // 'dial-source-panel-panel'
```

```css
.dial-source-panel-panel {
  inline-size: 420px;
}

.dial-source-panel-panel .dial-sb-aside {
  border-inline-end: none;
}
```

Write host overrides with CSS logical properties (`margin-inline-start`,
`inset-inline-end`) so they keep working under `dir="rtl"`.
