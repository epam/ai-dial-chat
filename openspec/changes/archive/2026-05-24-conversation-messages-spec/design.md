# Design: conversation-messages-spec

## Overview

`@epam/ai-dial-conversation-messages` is a React component library containing two components:

- **`MessageBubble`** — renders a styled bubble for user messages with position-aware rounded corners
- **`MessageActions`** — renders a row of icon buttons for message actions, with different buttons per source (User/Agent)

Both components are pure presentational components with no internal state. They delegate all interactive handling to parent-provided callback props.

---

## MessageBubble

### Public API

| Prop        | Type             | Default                 | Description                                           |
| ----------- | ---------------- | ----------------------- | ----------------------------------------------------- |
| `text`      | `string`         | _(required)_            | Text content to display inside the bubble             |
| `position`  | `BubblePosition` | `BubblePosition.Bottom` | Controls which corner of the bubble is fully rounded  |
| `className` | `string`         | `undefined`             | Additional Tailwind classes merged via `classNames()` |

### BubblePosition enum

```ts
export enum BubblePosition {
  Bottom = 'Bottom', // sharp bottom-right corner, 24px top-right
  Top = 'Top', // sharp top-right corner, 24px bottom-right
}
```

Used to indicate whether the bubble sits at the top or bottom of a multi-message stack. The left side is always rounded (tl/bl: 16px). One right corner is rounded (24px) and the other is square (0), creating a tail-like appearance.

### Component Structure

```
<div>          ← bubble container (bg-layer-4, flex, justify-end, rounded corners)
  <p>          ← message text (dial-body-text, text-primary, text-right)
```

#### Container classes (always applied)

`bg-layer-4 flex items-center justify-end rounded-bl-[16px] rounded-tl-[16px] px-6 py-4`

#### Position-dependent class

| `position`              | Added class         |
| ----------------------- | ------------------- |
| `BubblePosition.Top`    | `rounded-br-[24px]` |
| `BubblePosition.Bottom` | `rounded-tr-[24px]` |

### Exports

```ts
export { MessageBubble } from '@epam/ai-dial-conversation-messages';
export type { MessageBubbleProps } from '@epam/ai-dial-conversation-messages'; // add once interface is exported
export { BubblePosition } from '@epam/ai-dial-conversation-messages';
```

---

## MessageActions

### Public API

| Prop               | Type            | Default     | Description                                           |
| ------------------ | --------------- | ----------- | ----------------------------------------------------- |
| `source`           | `MessageSource` | `'User'`    | Controls which action set is rendered                 |
| `className`        | `string`        | `undefined` | Additional Tailwind classes merged via `classNames()` |
| `onEdit`           | `() => void`    | `undefined` | Called when Edit button is clicked (User only)        |
| `onDelete`         | `() => void`    | `undefined` | Called when Delete button is clicked (User only)      |
| `onRegenerate`     | `() => void`    | `undefined` | Called when Regenerate button is clicked (Agent only) |
| `onCopy`           | `() => void`    | `undefined` | Called when Copy button is clicked (Agent only)       |
| `onToggleMarkdown` | `() => void`    | `undefined` | Called when Markdown button is clicked (Agent only)   |
| `onLike`           | `() => void`    | `undefined` | Called when Like button is clicked (Agent only)       |
| `onDislike`        | `() => void`    | `undefined` | Called when Dislike button is clicked (Agent only)    |

### MessageSource type

```ts
export type MessageSource = 'User' | 'Agent';
```

### Component Structure

```
<div>                    ← wrapper (flex, gap-1, opacity-0, group-hover:opacity-100)
  <DialGhostIconButton>  ← one per action, repeated per source variant
  ...
```

The wrapper starts invisible (`opacity-0`) and becomes visible on parent hover (`group-hover:opacity-100`), so the parent element must have `group` class applied.

### Action sets by source

| Source  | Button          | Icon            | aria-label            |
| ------- | --------------- | --------------- | --------------------- |
| `User`  | Edit            | `IconPencil`    | "Edit message"        |
| `User`  | Delete          | `IconTrash`     | "Delete message"      |
| `Agent` | Regenerate      | `IconRefresh`   | "Regenerate response" |
| `Agent` | Copy            | `IconCopy`      | "Copy response"       |
| `Agent` | Toggle Markdown | `IconMarkdown`  | "Toggle markdown"     |
| `Agent` | Like            | `IconThumbUp`   | "Like response"       |
| `Agent` | Dislike         | `IconThumbDown` | "Dislike response"    |

All icons are rendered at `size={16}` via `@tabler/icons-react`. All buttons use `DialGhostIconButton` from `@epam/ai-dial-ui-kit` at `ElementSize.Small` (24×24px).

### Exports (current gaps)

`MessageActions` is currently **not exported** from `src/index.ts`. The `MessageSource` type is also missing from the public entry point.

```ts
// What should be in src/index.ts after this change:
export { MessageBubble } from './components/MessageBubble/MessageBubble.js';
export { MessageActions } from './components/Message/MessageActions.js';
export type { MessageSource } from './components/Message/MessageActions.js';
export { BubblePosition } from './types/bubble-position.js';
```

---

## Testing Strategy

**Framework**: Vitest 4 + `@testing-library/react` 16

Tests co-locate with source files:

- `libs/conversation-messages/src/components/MessageBubble/MessageBubble.spec.tsx`
- `libs/conversation-messages/src/components/Message/MessageActions.spec.tsx`

Test names describe observable behaviour. Use `role`, `label`, and text queries instead of implementation-specific selectors.

### MessageBubble coverage expectations

| Scenario                                                           | Status      |
| ------------------------------------------------------------------ | ----------- |
| Renders text content                                               | Not covered |
| Applies `rounded-tr-[24px]` with `BubblePosition.Bottom` (default) | Not covered |
| Applies `rounded-br-[24px]` with `BubblePosition.Top`              | Not covered |
| Merges additional `className` prop                                 | Not covered |

### MessageActions coverage expectations

| Scenario                                                               | Status      |
| ---------------------------------------------------------------------- | ----------- |
| Renders Edit and Delete buttons for `source="User"` (default)          | Not covered |
| Does not render Agent buttons for `source="User"`                      | Not covered |
| Renders Regenerate, Copy, Markdown, Like, Dislike for `source="Agent"` | Not covered |
| Does not render User buttons for `source="Agent"`                      | Not covered |
| Calls `onEdit` when Edit button is clicked                             | Not covered |
| Calls `onDelete` when Delete button is clicked                         | Not covered |
| Calls `onRegenerate` when Regenerate button is clicked                 | Not covered |
| Calls `onCopy` when Copy button is clicked                             | Not covered |
| Calls `onToggleMarkdown` when Markdown button is clicked               | Not covered |
| Calls `onLike` when Like button is clicked                             | Not covered |
| Calls `onDislike` when Dislike button is clicked                       | Not covered |
| Merges additional `className` prop                                     | Not covered |
