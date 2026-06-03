### Requirement: Input accepts isInputDisabled prop

`libs/conversation-input/src/models/Input.ts` (`InputProps`) and `libs/conversation-input/src/models/ConversationInput.ts` (`ConversationInputProps`) SHALL each expose an optional prop:

```ts
/** When true, blocks all text input, send, attach, and drop interactions. Starter/action buttons remain usable. */
isInputDisabled?: boolean;
```

`ConversationInput` SHALL forward the prop value unchanged to its inner `Input` component. The prop MUST default to `false` when absent so existing callers are unaffected.

#### Scenario: isInputDisabled absent — input enabled

- **WHEN** `ConversationInput` is rendered without `isInputDisabled`
- **THEN** the textarea is editable, the send button is active, and the attach button opens its menu normally

#### Scenario: isInputDisabled forwarded to Input

- **WHEN** `ConversationInput` is rendered with `isInputDisabled={true}`
- **THEN** the inner `Input` component receives `isInputDisabled={true}`

---

### Requirement: Input disables textarea when isInputDisabled is true

The `Input` component's `<textarea>` element SHALL receive the native `disabled` HTML attribute when `isInputDisabled` is `true`.

#### Scenario: Textarea is disabled

- **WHEN** `Input` is rendered with `isInputDisabled={true}`
- **THEN** the textarea has `disabled` attribute set (it is not focusable and does not accept keystrokes)

#### Scenario: Textarea is enabled by default

- **WHEN** `Input` is rendered without `isInputDisabled`
- **THEN** the textarea does not have the `disabled` attribute

---

### Requirement: Input blocks send when isInputDisabled is true

The `Input` component's internal `handleSend` function SHALL return early without calling `onSend` when `isInputDisabled` is `true`. The send button SHALL be rendered with `isDisabled={isInputDisabled || !hasModelSelected}`.

#### Scenario: Send button is disabled

- **WHEN** `Input` is rendered with `isInputDisabled={true}`
- **THEN** the send button is disabled and clicking it does not call `onSend`

#### Scenario: Enter key does not submit

- **WHEN** `Input` is rendered with `isInputDisabled={true}` and the user presses Enter
- **THEN** `onSend` is not called

---

### Requirement: Input disables attach button when isInputDisabled is true

The `Input` component's attach (`+`) button SHALL be rendered with `isDisabled={true}` when `isInputDisabled` is `true`, preventing the menu from opening and file selection from being triggered.

#### Scenario: Attach button is disabled

- **WHEN** `Input` is rendered with `isInputDisabled={true}`
- **THEN** the attach (`+`) `DialGhostIconButton` has `isDisabled={true}` and clicking it does not open the dropdown

---

### Requirement: Input ignores file drop when isInputDisabled is true

The `Input` component's `dragover` and `drop` event handlers SHALL return early when `isInputDisabled` is `true`. No files SHALL be appended to the attachment tray.

#### Scenario: Drop is ignored

- **WHEN** `Input` is rendered with `isInputDisabled={true}` and the user drops a file onto the component
- **THEN** no attachment is added to the tray and `onAttachmentsChange` is not called

---

### Requirement: App-edge derivation of isInputDisabled in ConversationRoute

`apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` SHALL derive a local boolean:

```ts
const isInputDisabled =
  selectedDeploymentConfiguration?.isChatMessageInputDisabled === true;
```

and pass it as `isInputDisabled={isInputDisabled}` to `ConversationInput`. The value SHALL be memoised with `useMemo` keyed on `selectedDeploymentConfiguration`.

#### Scenario: Flag true — ConversationRoute passes isInputDisabled true

- **WHEN** `selectedDeploymentConfiguration` contains `{ isChatMessageInputDisabled: true }`
- **THEN** `ConversationInput` receives `isInputDisabled={true}` in `ConversationRoute`

#### Scenario: Flag absent — ConversationRoute passes isInputDisabled false

- **WHEN** `selectedDeploymentConfiguration` is `null` or does not contain `isChatMessageInputDisabled`
- **THEN** `ConversationInput` receives `isInputDisabled={false}` in `ConversationRoute`

---

### Requirement: App-edge derivation of isInputDisabled in ConversationView

`apps/chat/src/components/ConversationView/ConversationView.tsx` SHALL add `selectedDeploymentConfiguration` to its `useDeployments()` destructuring, derive `isInputDisabled` by the same formula as `ConversationRoute`, and pass it as `isInputDisabled={isInputDisabled}` to `ConversationInput`.

#### Scenario: Flag true — ConversationView passes isInputDisabled true

- **WHEN** `selectedDeploymentConfiguration` contains `{ isChatMessageInputDisabled: true }`
- **THEN** `ConversationInput` receives `isInputDisabled={true}` in `ConversationView`

#### Scenario: Flag absent — ConversationView passes isInputDisabled false

- **WHEN** `selectedDeploymentConfiguration` is `null` or does not contain `isChatMessageInputDisabled`
- **THEN** `ConversationInput` receives `isInputDisabled={false}` in `ConversationView`

---

### Requirement: Starter and action buttons remain usable when isInputDisabled is true

Starter buttons (rendered via `renderFooterActions` or the starters bar), form buttons, and any other action buttons inside `ConversationInput` SHALL NOT be disabled by `isInputDisabled`. Only the free-text input path (textarea, send, attach, drop) is blocked.

#### Scenario: Starter buttons still clickable when input disabled

- **WHEN** `ConversationInput` is rendered with `isInputDisabled={true}` and starter buttons are present
- **THEN** clicking a starter button invokes its handler normally

---

### Requirement: isInputDisabled tested in Input unit tests

`libs/conversation-input/src/components/Input/tests/Input.spec.tsx` SHALL include test cases covering:

- `isInputDisabled={true}` renders the textarea with the `disabled` attribute.
- `isInputDisabled={true}` renders the send button as disabled.
- `isInputDisabled={true}` renders the attach button as disabled.
- `isInputDisabled={true}` does not call `onSend` when Enter is pressed.
- `isInputDisabled={false}` (or omitted) allows send via Enter.

---

### Requirement: App-level mapping tested in ConversationRoute tests

`apps/chat/src/pages/ConversationRoute/ConversationRoute.spec.tsx` SHALL include test cases covering:

- When `selectedDeploymentConfiguration` has `isChatMessageInputDisabled: true`, the rendered `ConversationInput` receives `isInputDisabled={true}`.
- When `selectedDeploymentConfiguration` is `null`, the rendered `ConversationInput` receives `isInputDisabled={false}`.
- When `selectedDeploymentConfiguration` exists but lacks `isChatMessageInputDisabled`, the rendered `ConversationInput` receives `isInputDisabled={false}`.
