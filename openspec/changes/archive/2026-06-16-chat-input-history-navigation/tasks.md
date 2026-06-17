## 1. lib — useInputHistoryNavigation hook

- [x] 1.1 Create `libs/conversation-input/src/hooks/useInputHistoryNavigation.ts` with the hook that tracks `historyIndex` (default -1) and `savedDraft` state
- [x] 1.2 Implement `navigate('up' | 'down', currentValue, cursorPos)` — checks cursor is on first/last line, returns new value or `null`
- [x] 1.3 Implement `notifyChange(newValue)` — resets index to -1 and clears saved draft when user edits
- [x] 1.4 Implement `reset()` — clears navigation state on send
- [x] 1.5 Wrap returned object in `useMemo` / `useCallback` to keep reference stable between renders
- [x] 1.6 Write unit tests in `libs/conversation-input/src/hooks/tests/useInputHistoryNavigation.spec.ts` covering all spec scenarios (up/down navigation, cursor-line guard, IME guard, editing reset, send reset)

## 2. lib — ConversationInput prop threading

- [x] 2.1 Add `messageHistory?: readonly string[]` to `ConversationInputProps` in `libs/conversation-input/src/models/ConversationInput.ts`
- [x] 2.2 Thread `messageHistory` from `ConversationInput.tsx` down to `Input.tsx` (add to `InputProps` in `libs/conversation-input/src/models/Input.ts`)

## 3. lib — Input keydown wiring

- [x] 3.1 Instantiate `useInputHistoryNavigation` inside `Input.tsx`, passing `messageHistory`
- [x] 3.2 Extend `handleKeyDown` in `Input.tsx` to handle `ArrowUp` and `ArrowDown`: call `navigate()`, and if non-null call `setValue()` and `e.preventDefault()`; guard on `e.isComposing`, `isStreaming`, and `isInputDisabled`
- [x] 3.3 Call `notifyChange` from the existing `onChange` handler in `Input.tsx`
- [x] 3.4 Call `reset()` from `handleSend` in `Input.tsx`

## 4. app — pass messageHistory from ConversationView

- [x] 4.1 In `apps/chat/src/components/ConversationView/ConversationView.tsx`, derive `messageHistory` from the active conversation's messages: filter to user-role messages and map to their content strings
- [x] 4.2 Pass `messageHistory` as a prop to `<ConversationInput>`

## 5. Verification

- [ ] 5.1 Run `npm exec nx test conversation-input` — all tests pass
- [ ] 5.2 Run `npm exec nx lint conversation-input` — no lint errors
- [ ] 5.3 Run `npm exec nx typecheck conversation-input` — no type errors
- [ ] 5.4 Run `npm exec nx affected --target=lint,typecheck,test --base=origin/development-1.0` — no regressions
- [ ] 5.5 Manual smoke test: start a conversation, send 3+ messages, press Up to cycle through history, press Down to return to draft, verify draft is preserved
