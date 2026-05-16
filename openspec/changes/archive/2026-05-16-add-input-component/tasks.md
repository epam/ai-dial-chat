## 1. Accessibility Fixes

- [x] 1.1 Add an `aria-label` prop (or a visually-hidden `<label>`) to the `<textarea>` in `libs/conversation-input/src/components/Input/Input.tsx` so screen readers announce the field purpose
- [x] 1.2 Add `aria-label="Send message"` to the `<button>` in `libs/conversation-input/src/components/Input/SendButton.tsx`

## 2. Responsive Layout Fix

- [x] 2.1 Replace fixed `w-[748px] h-[56px]` on the wrapper in `libs/conversation-input/src/components/Input/Input.tsx` with `w-full max-w-[748px] min-h-[56px]` so the input does not overflow on narrow viewports

## 3. Unit Tests — Input Component

- [x] 3.1 Create `libs/conversation-input/src/components/Input/tests/Input.spec.tsx` with tests for all spec scenarios:
  - Send button is hidden when textarea is empty
  - Send button appears when user types non-whitespace text
  - Send button stays hidden for whitespace-only input
  - `initialMessage` prop pre-populates textarea on mount
  - Pressing Enter calls `onSend` with message text and clears textarea
  - Pressing Shift+Enter does NOT call `onSend` and keeps text
  - `onChange` is called on each keystroke with the updated value
  - Clicking the send button calls `onSend` with current message
  - `colors` prop values appear as `--ci-*` CSS variables on wrapper
  - `placeholder` prop is reflected on the textarea; default `"Type a message..."` is used when omitted
  - `className` prop is merged onto the wrapper element

## 4. Unit Tests — SendButton Component

- [x] 4.1 Create `libs/conversation-input/src/components/Input/tests/SendButton.spec.tsx`:
  - Clicking the button calls `onSend` callback
  - Button renders `IconArrowNarrowRight` icon

## 5. Verification

- [ ] 5.1 Run `pnpm nx lint conversation-input` — fix any reported issues
- [ ] 5.2 Run `pnpm nx typecheck conversation-input` (or `pnpm nx build conversation-input`) — fix any type errors
- [ ] 5.3 Run `pnpm nx test conversation-input` — all tests must pass
