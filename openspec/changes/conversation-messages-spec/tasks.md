# Tasks: conversation-messages-spec

## Spec-driven improvements to `@epam/ai-dial-conversation-messages`

These tasks bring the implementation and tests into alignment with the specification in `design.md`.

---

### Fix public entry point

- [x] Export `MessageActions` from `libs/conversation-messages/src/index.ts`
  ```ts
  export { MessageActions } from './components/Message/MessageActions.js';
  ```
- [x] Export `MessageSource` type from `libs/conversation-messages/src/index.ts`
  ```ts
  export type { MessageSource } from './components/Message/MessageActions.js';
  ```

---

### Add spec for MessageBubble

Create `libs/conversation-messages/src/components/MessageBubble/MessageBubble.spec.tsx`:

- [x] Add test: renders the provided `text` content
- [x] Add test: applies `rounded-tr-[24px]` when `position` is `BubblePosition.Bottom` (default)
- [x] Add test: applies `rounded-br-[24px]` when `position` is `BubblePosition.Top`
- [x] Add test: merges additional `className` onto the container

---

### Add spec for MessageActions

Create `libs/conversation-messages/src/components/Message/MessageActions.spec.tsx`:

- [x] Add test: renders Edit and Delete buttons for `source="User"` (default)
- [x] Add test: does not render Regenerate, Copy, Markdown, Like, or Dislike buttons for `source="User"`
- [x] Add test: renders Regenerate, Copy, Markdown, Like, and Dislike buttons for `source="Agent"`
- [x] Add test: does not render Edit or Delete buttons for `source="Agent"`
- [x] Add test: calls `onEdit` when Edit button is clicked
- [x] Add test: calls `onDelete` when Delete button is clicked
- [x] Add test: calls `onRegenerate` when Regenerate button is clicked
- [x] Add test: calls `onCopy` when Copy button is clicked
- [x] Add test: calls `onToggleMarkdown` when Markdown button is clicked
- [x] Add test: calls `onLike` when Like button is clicked
- [x] Add test: calls `onDislike` when Dislike button is clicked
- [x] Add test: merges additional `className` onto the wrapper element

---

### Verification

- [ ] Run `node_modules/.bin/nx lint conversation-messages` — fix any errors
- [ ] Run `node_modules/.bin/nx typecheck conversation-messages` — fix any errors
- [ ] Run `node_modules/.bin/nx test conversation-messages` — all new tests must pass
