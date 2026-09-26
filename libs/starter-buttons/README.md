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

Import the stylesheet once in the consuming app:

```ts
import '@epam/ai-dial-starter-buttons/styles.css';
```

## Peer Dependencies

- `react`
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-ui-kit`

## Components

### StarterButtons

Renders starter prompt buttons with automatic overflow handling.

```tsx
import { StarterButtons } from '@epam/ai-dial-starter-buttons';
import type { StarterButtonsProps } from '@epam/ai-dial-starter-buttons';

<StarterButtons
  starters={deployment.starters}
  isMobile={isMobile}
  labels={{
    list: 'Conversation starters',
    overflow: 'More starter prompts',
  }}
  onSelect={handleStarterSelect}
/>;
```

`starters` is `StarterOption[]` from `@epam/ai-dial-chat-shared` — the same shape
a deployment's configuration schema declares, so pass it through unchanged:

```tsx
import type { StarterOption } from '@epam/ai-dial-chat-shared';

const starter: StarterOption = {
  const: 1,
  title: 'Summarize a document',
  'dial:widgetOptions': widgetOptions,
};
```

The overflow behaviour is opt-out. Pass `isCollapsible={false}` and every
starter is rendered, each on its own row, with no overflow menu — the layout a
narrow embed wants, where the measured row fits a single starter and hides the
rest behind the "…" button:

```tsx
<StarterButtons
  starters={deployment.starters}
  isCollapsible={false}
  labels={{
    list: 'Conversation starters',
    overflow: 'More starter prompts',
  }}
  onSelect={handleStarterSelect}
/>
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
/>
```

## Public class names

A host embedding this package cannot style it through its CSS-module locals —
they are hashed at build time — nor through DOM order or ARIA attributes. The
list's `aria-label` comes from `labels.list` and is localisable, so a host that
selects by it breaks its own styling the moment the app is translated. Two
elements therefore carry a stable public class, exported as
`STARTER_BUTTONS_CLASS`.

| Key    | Class                       | Element                                                    |
| ------ | --------------------------- | ---------------------------------------------------------- |
| `root` | `dial-starter-buttons-root` | The component's outer wrapper                              |
| `list` | `dial-starter-buttons-list` | The `role="list"` box holding the buttons, in both layouts |

The classes carry no declarations of their own: nothing in `styles.css` selects
on them, so they change nothing until a host writes a rule. Renaming one, or
moving it to a different element, is a breaking change. The convention is in
[`openspec/lib-styling-guide.md`](../../openspec/lib-styling-guide.md).

```tsx
import { STARTER_BUTTONS_CLASS } from '@epam/ai-dial-starter-buttons';

STARTER_BUTTONS_CLASS.list; // 'dial-starter-buttons-list'
```

```css
.dial-starter-buttons-list {
  justify-content: flex-start;
}
```

Write host overrides with CSS logical properties (`margin-inline-start`,
`inset-inline-end`) so they keep working under `dir="rtl"`.
