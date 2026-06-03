## 1. Shared Types

- [x] 1.1 In `libs/chat-shared/src/models/deployment-configuration.ts`, add `'dial:chatMessageInputDisabled'?: boolean` field to `DeploymentConfigurationSchema` with a JSDoc comment explaining its semantics

## 2. Lib — Model Updates

- [x] 2.1 In `libs/conversation-input/src/models/Input.ts` (`InputProps`), add `isInputDisabled?: boolean` with JSDoc: "When true, blocks all text input, send, attach, and drop interactions."
- [x] 2.2 In `libs/conversation-input/src/models/ConversationInput.ts` (`ConversationInputProps`), add the same `isInputDisabled?: boolean` prop with the same JSDoc

## 3. Lib — Input Component

- [x] 3.1 In `libs/conversation-input/src/components/Input/Input.tsx`, destructure `isInputDisabled = false` from props
- [x] 3.2 Add `disabled={isInputDisabled}` to the `<textarea>` element
- [x] 3.3 In `handleSend`, add an early return guard: `if (isInputDisabled) return;`
- [x] 3.4 Update the send button's `isDisabled` prop: `isDisabled={isInputDisabled || !hasModelSelected}`
- [x] 3.5 Update the attach (`+`) `DialGhostIconButton` `isDisabled` prop: `isDisabled={isInputDisabled}`
- [x] 3.6 In the `dragover` handler, add early return: `if (isInputDisabled) return;`
- [x] 3.7 In the `drop` handler, add early return: `if (isInputDisabled) return;`

## 4. Lib — ConversationInput Component

- [x] 4.1 In `libs/conversation-input/src/components/ConversationInput/ConversationInput.tsx`, destructure `isInputDisabled` from props and forward it to the inner `Input` component as `isInputDisabled={isInputDisabled}`

## 5. App — ConversationRoute

- [x] 5.1 In `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx`, derive `isInputDisabled` with `useMemo`: `const isInputDisabled = useMemo(() => selectedDeploymentConfiguration?.['dial:chatMessageInputDisabled'] === true, [selectedDeploymentConfiguration]);`
- [x] 5.2 Pass `isInputDisabled={isInputDisabled}` to the `<ConversationInput>` render in `ConversationRoute.tsx`

## 6. App — ConversationView

- [x] 6.1 In `apps/chat/src/components/ConversationView/ConversationView.tsx`, add `selectedDeploymentConfiguration` to the `useDeployments()` destructuring
- [x] 6.2 Derive `isInputDisabled` with `useMemo` using the same formula as ConversationRoute
- [x] 6.3 Pass `isInputDisabled={isInputDisabled}` to the `<ConversationInput>` render in `ConversationView.tsx`

## 7. Tests — Input Unit Tests

- [x] 7.1 In `libs/conversation-input/src/components/Input/tests/Input.spec.tsx`, add test: `isInputDisabled={true}` — textarea has `disabled` attribute
- [x] 7.2 Add test: `isInputDisabled={true}` — send button is disabled (has `disabled` attribute or `aria-disabled="true"`)
- [x] 7.3 Add test: `isInputDisabled={true}` — attach button is disabled
- [x] 7.4 Add test: `isInputDisabled={true}` — pressing Enter does not call `onSend`
- [x] 7.5 Add test: `isInputDisabled={false}` (or omitted) — pressing Enter calls `onSend` with non-empty message

## 8. Tests — ConversationRoute App-Edge Mapping

- [x] 8.1 In `apps/chat/src/pages/ConversationRoute/ConversationRoute.spec.tsx`, add test: when `selectedDeploymentConfiguration` contains `{ 'dial:chatMessageInputDisabled': true }`, the rendered `ConversationInput` receives `isInputDisabled={true}`
- [x] 8.2 Add test: when `selectedDeploymentConfiguration` is `null`, `ConversationInput` receives `isInputDisabled={false}`
- [x] 8.3 Add test: when `selectedDeploymentConfiguration` exists but omits `dial:chatMessageInputDisabled`, `ConversationInput` receives `isInputDisabled={false}`

## 9. Verification

- [x] 9.1 Run `npm exec nx test @epam/ai-dial-conversation-input` — all tests pass
- [x] 9.2 Run `npm exec nx lint @epam/ai-dial-conversation-input` — no lint errors
- [x] 9.3 Run `npm exec nx lint @epam/chat` — no lint errors
- [x] 9.4 Run `npm exec nx build @epam/ai-dial-conversation-input` — build succeeds
