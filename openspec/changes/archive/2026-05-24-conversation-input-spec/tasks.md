# Tasks: conversation-input-spec

## Spec-driven improvements to `@epam/ai-dial-conversation-input`

These tasks resolve the gaps identified in `design.md` and bring the implementation and tests into alignment with the specification.

---

### Fix known gaps

- [x] Investigate `Textarea` API for a submit/send callback prop and wire it to `handleSend` in `ConversationInput`
- [x] Decide on welcome text auto-hide behavior: either update implementation to hide heading when `message` is non-empty, or update the existing test to match prop-driven behavior

### Add missing test coverage

- [x] Add test: hides welcome text when `welcomeText` prop is empty string
- [x] Add test: does not call `onSend` when `disabled={true}` and Enter is pressed
- [x] Add test: `Shift+Enter` does not trigger send
- [x] Add test: `initialMessage` prop seeds the textarea value on first render
- [x] Add test: `placeholder` prop is forwarded to the textarea element

### Export type from public entry point

- [x] Verify `ConversationInputProps` is exported from `libs/conversation-input/src/index.ts` so consumers can import the type without a deep import

### Remove welcome text auto-hide behavior

- [x] Remove `!message` condition from welcome text rendering in `ConversationInput.tsx` line 40 (change `{welcomeText && !message && (` to `{welcomeText && (`)
- [x] Update test `should hide welcome text when typing` to `should keep welcome text visible when typing` and change expectation to verify text remains visible
