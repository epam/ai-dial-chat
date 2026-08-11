# Design: conversation-input-spec

## Overview

`ConversationInput` is a self-contained React component that renders a chat message input area, optionally preceded by a welcome heading. It delegates the textarea UI to `Textarea` from `@epam/ai-dial-ui-kit` and owns the message state, keyboard handling, and send-guard logic.

## Public API

### Props

| Prop             | Type                        | Default                                        | Description                                                           |
| ---------------- | --------------------------- | ---------------------------------------------- | --------------------------------------------------------------------- |
| `placeholder`    | `string`                    | `'Type a new prompt or use "/" to select one'` | Placeholder text shown inside the textarea when empty                 |
| `disabled`       | `boolean`                   | `false`                                        | When true, prevents sending and passes disabled state to Textarea |
| `initialMessage` | `string`                    | `''`                                           | Seed value for the textarea on first render; not reactive after mount |
| `welcomeText`    | `string`                    | `'Hello World, good day for prompting!'`       | Heading shown above the input. Pass an empty string to hide it        |
| `onSend`         | `(message: string) => void` | `undefined`                                    | Called with the trimmed message string when a valid send is triggered |

### Exports

```ts
// Main component
export { ConversationInput } from '@epam/ai-dial-conversation-input';
export type { ConversationInputProps } from '@epam/ai-dial-conversation-input';

// Styles (import separately)
import '@epam/ai-dial-conversation-input/styles.css';
```

## Component Structure

```
<div>                          ← root container (Tailwind layout)
  <h1>                         ← welcome heading (conditional on welcomeText)
  <Textarea>               ← delegated textarea + send button UI
```

### Root container

Class: `relative flex w-full flex-col items-center gap-6 p-4`

Centers the content column, provides vertical gap between heading and textarea.

### Welcome heading

- Rendered only when `welcomeText` is a non-empty string (falsy check)
- Classes: `conversation-input-welcome dial-h1-text text-center`
- `dial-h1-text` is a typography token from `@epam/ai-dial-ui-kit`
- **Note**: The heading is hidden by passing an empty string, not by typing activity. It does not auto-hide while the user is typing.

### Textarea

Receives: `ref`, `value`, `onChange`, `onKeyDown`, `placeholder`, `disabled`.

`Textarea` renders an internal send button. To wire the send button to `handleSend`, the component must pass an `onSubmit` (or equivalent) prop supported by `Textarea`. See [Known Gaps](#known-gaps) below.

## State & Refs

| Name          | Type                             | Purpose                                                            |
| ------------- | -------------------------------- | ------------------------------------------------------------------ |
| `message`     | `string` (useState)              | Controlled value of the textarea                                   |
| `textareaRef` | `RefObject<HTMLTextAreaElement>` | DOM ref to the textarea element (available for programmatic focus) |

## Behavior Contract

### Sending a message

A send is valid when `message.trim()` is non-empty AND `disabled` is `false`.

On a valid send:

1. `onSend` is called with `message.trim()`
2. `message` state is reset to `''`

A send is a no-op when the message is empty/whitespace or when `disabled` is `true`.

### Keyboard shortcuts

| Key combination | Effect                                                                          |
| --------------- | ------------------------------------------------------------------------------- |
| `Enter`         | Triggers a send (calls `handleSend`)                                            |
| `Shift + Enter` | Inserts a newline (default `<textarea>` behavior; Enter event is NOT prevented) |

### disabled state

When `disabled={true}`:

- `handleSend` returns early without calling `onSend` or clearing the message
- `Textarea` receives `disabled={true}` (UI handles visual feedback)

### initialMessage

Set as the initial `useState` value. Changing `initialMessage` after mount has no effect (not a controlled external prop).

## Styling

- **Framework**: Tailwind CSS (scanned from `src/**/*.{ts,tsx}`)
- **UI Kit tokens**: `@epam/ai-dial-ui-kit/styles.css` imported directly in the component file
- **PostCSS**: Tailwind + Autoprefixer
- **Custom class**: `conversation-input-welcome` — can be used by consumers for targeted style overrides

## Known Gaps

### 1. Send button not wired to handleSend

The current implementation does not pass a submit callback to `Textarea`, so clicking the internal send button does not invoke `handleSend`. This needs to be resolved by passing the appropriate prop (e.g., `onSubmit` or `onSend`) once the `Textarea` API is confirmed.

**Impact**: Tests that click the send button will fail against the real component unless `Textarea` is mocked.

### 2. Welcome text does not auto-hide on typing

The test `should hide welcome text when typing` asserts `queryByText(...) === null` after typing. The current implementation hides the heading only when `welcomeText` prop is falsy — it does not respond to `message` state.

**Resolution options**:

- A. Change the implementation to hide the heading when `message` is non-empty
- B. Remove the auto-hide test and document that hiding is prop-driven only

## Testing Strategy

**Framework**: Vitest + `@testing-library/react`

### Coverage expectations

| Scenario                                               | Status                     |
| ------------------------------------------------------ | -------------------------- |
| Renders welcome text when prop is provided             | Covered                    |
| Hides welcome text when `welcomeText` is empty string  | Not covered                |
| Hides welcome text while typing (if behavior is added) | Covered (but impl missing) |
| Calls `onSend` on Enter key                            | Covered                    |
| Calls `onSend` on send button click                    | Covered (but impl has gap) |
| Does not send empty/whitespace messages                | Covered                    |
| Does not send when `disabled={true}`                   | Not covered                |
| `Shift+Enter` does not trigger send                    | Not covered                |
| `initialMessage` seeds the textarea value              | Not covered                |
| `placeholder` is passed to Textarea                | Not covered                |
