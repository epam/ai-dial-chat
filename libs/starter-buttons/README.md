# @epam/ai-dial-starter-buttons

Responsive starter prompt buttons that overflow into a dropdown when space is limited.

## Overview

This library renders a row of quick-action or starter-prompt buttons shown at the beginning of a new conversation. On narrow screens or when there are more buttons than can fit in a single row, the overflow items collapse into a dropdown menu.

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
