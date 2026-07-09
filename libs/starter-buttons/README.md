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
  buttons={[
    {
      id: '1',
      label: 'Summarize a document',
      onClick: () => handlePrompt('Summarize...'),
    },
    {
      id: '2',
      label: 'Write a blog post',
      onClick: () => handlePrompt('Write...'),
    },
    {
      id: '3',
      label: 'Explain a concept',
      onClick: () => handlePrompt('Explain...'),
    },
  ]}
/>;
```

## Types

```tsx
import type {
  StarterButtonsProps,
  StarterButtonsAriaLabels,
} from '@epam/ai-dial-starter-buttons';
```

### StarterButtonsAriaLabels

Override the default English ARIA labels with translated values.

```tsx
const ariaLabels: StarterButtonsAriaLabels = {
  moreButton: t('More starter prompts'),
  dropdownMenu: t('Starter prompts overflow menu'),
};

<StarterButtons buttons={buttons} ariaLabels={ariaLabels} />;
```
