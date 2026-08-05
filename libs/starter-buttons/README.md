# @epam/ai-dial-starter-buttons

Responsive starter prompt buttons that overflow into a dropdown when space is limited.

## Overview

`@epam/ai-dial-starter-buttons` renders the row of quick-action prompt buttons that appear on a new or empty conversation screen, giving users one-tap access to common tasks like summarising a document, writing a draft, or explaining a concept. The core problem it solves is responsive overflow: deployments can expose an arbitrary number of starter prompts, but there is only so much horizontal space available, especially on mobile. This library measures available space and automatically moves excess buttons into a "More" dropdown, ensuring the primary actions stay visible without the layout ever wrapping or clipping. Use it in any view that needs to present a curated set of starter prompts above or inside the conversation input; pass the full list and let the component handle layout and accessibility for both the visible buttons and the overflow menu.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-starter-buttons": "*"
  }
}
```

## Peer Dependencies

- `react`
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-ui-kit`
- `@tabler/icons-react`

## Components

### StarterButtons

Renders starter prompt buttons with automatic overflow handling.

```tsx
import { StarterButtons } from '@epam/ai-dial-starter-buttons';
import type { StarterButtonsProps } from '@epam/ai-dial-starter-buttons';

<StarterButtons
  starters={[
    { const: '1', title: 'Summarize a document' },
    { const: '2', title: 'Write a blog post' },
    { const: '3', title: 'Explain a concept' },
  ]}
  isMobile={isMobile}
  labels={{
    list: 'Conversation starters',
    overflow: 'More starter prompts',
  }}
  onSelect={handleStarterSelect}
/>;
```

## Types

```tsx
import type {
  StarterButtonsProps,
  StarterButtonsLabels,
  StarterButtonsStyles,
} from '@epam/ai-dial-starter-buttons';
```

### StarterButtonsLabels

Override the default English ARIA labels with translated values.

```tsx
const labels: StarterButtonsLabels = {
  list: t('Conversation starters'),
  overflow: t('More starter prompts'),
};

<StarterButtons starters={starters} labels={labels} onSelect={onSelect} />;
```

### StarterButtonsStyles

Overrides the size and stroke width of the overflow menu icon.

```tsx
<StarterButtons
  starters={starters}
  labels={labels}
  styles={{ iconSize: 20, iconStrokeWidth: 2 }}
  onSelect={onSelect}
/>;
```
