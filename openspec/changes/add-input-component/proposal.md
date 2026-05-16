## Why

The `libs/conversation-input` library previously exposed only the higher-level `ConversationInput` (with welcome text logic built in). Consumers that need a standalone, embeddable textarea-plus-send-button — without the welcome-text wrapper — had no reusable primitive to reach for. The new `Input` component fills that gap and is now exported alongside `ConversationInput`.

## What Changes

- **NEW** `libs/conversation-input/src/components/Input/Input.tsx` — standalone textarea + send button component
- **NEW** `libs/conversation-input/src/components/Input/SendButton.tsx` — dedicated circular send button with `IconArrowNarrowRight`
- **NEW** `libs/conversation-input/src/components/Input/Input.module.scss` — SCSS module driving all visual states via `--ci-*` CSS custom variables
- **NEW** `libs/conversation-input/src/models/Input.ts` — `InputProps`, `InputColors`, `InputTypography` interfaces
- **UPDATED** `libs/conversation-input/src/index.ts` — re-exports `Input`, `InputProps`, `InputColors`, `InputTypography`

## Capabilities

### New Capabilities

- `input-component`: A low-level, fully themeable textarea-plus-send-button primitive. Accepts `initialMessage`, `onSend`, `onChange`, `placeholder`, `colors`, and `typography` props. Maps color/typography props to `--ci-*` CSS variables for runtime theming. Send button appears only when the trimmed message is non-empty. Enter submits; Shift+Enter inserts a newline.

### Modified Capabilities

<!-- None — no existing spec-level behavior is changed -->

## Impact

- `libs/conversation-input` public API expands with four new exports (`Input`, `InputProps`, `InputColors`, `InputTypography`)
- `ConversationInput` is unchanged; the new `Input` is a peer primitive, not a replacement
- No backend changes; no new API endpoints
- No new i18n keys — `placeholder` is passed in as a prop (defaults to `"Type a message..."`)
- Consumers of the library gain a lighter-weight entry point when welcome-text rendering is not needed
