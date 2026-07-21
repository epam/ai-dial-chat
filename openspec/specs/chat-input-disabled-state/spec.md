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

### Requirement: Input blocks send when isInputDisabled is true, except for an already-populated message

The `Input` component's send button SHALL be rendered with `isDisabled={!hasModelSelected || hasBlockedAttachments}` — `isInputDisabled` is deliberately excluded from this expression. The send button only ever renders when `hasSendableContent` is true (non-empty message or attachments present), so this has no observable effect while the message is empty: with typing blocked by the disabled textarea (see above) and the attach button also disabled, the only way `hasSendableContent` can be true while `isInputDisabled` is true is a starter having populated `message` (see the Quick Apps "populate prompt" starter behavior, `apps/chat/src/utils/quick-app-conversation-starters.ts`). In that one case, the user cannot edit the populated text but SHALL still be able to submit it via the send button, since "Disable chat input" otherwise leaves them no way to act on a populate-only starter's text.

The Enter key SHALL NOT submit while `isInputDisabled` is `true`, regardless of message content — `handleKeyDown`'s Enter-send branch SHALL explicitly require `!isInputDisabled` in addition to `canSend`/`hasModelSelected`/`!isStreaming`. This keeps every keyboard-driven path blocked ("just not edit"), leaving the send **button** as the sole exception.

#### Scenario: Send button is disabled when there is nothing to send

- **WHEN** `Input` is rendered with `isInputDisabled={true}` and no message or attachments
- **THEN** the send button does not render (unaffected by this requirement — behavior identical to before)

#### Scenario: Send button is enabled when a message is already populated

- **WHEN** `Input` is rendered with `isInputDisabled={true}` and `message="Hello"` (as set by a populate-only Quick Apps starter)
- **THEN** the send button is enabled and clicking it calls `onSend("Hello", [])`

#### Scenario: Enter key does not submit

- **WHEN** `Input` is rendered with `isInputDisabled={true}` (with or without a populated message) and the user presses Enter
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

`apps/chat/src/components/ConversationView/ConversationView.tsx` SHALL add `selectedDeploymentConfiguration` to its `useDeployments()` destructuring and derive `isInputDisabled` as:

```ts
const hasQuickAppStarters =
  getQuickAppConversationStarters(selectedDeployment?.conversationStarters)
    .starters.length > 0;
const isInputDisabled =
  !hasQuickAppStarters &&
  !!selectedDeploymentConfiguration?.isChatMessageInputDisabled;
```

and pass it as `isInputDisabled={isInputDisabled}` to `ConversationInput`, where `selectedDeployment` is the deployment resolved from `activeDeploymentId` (the `fixedModel` id when set, otherwise `selectedItemId`).

`isChatMessageInputDisabled` is a deployment-configuration-schema flag meant to persist for the entire conversation, for form/schema-driven apps that always require a button- or `configuration_value`-driven message (they provide an ongoing interaction path via per-message embedded buttons, so the free-text path can stay blocked indefinitely). Quick Apps' `conversationStarters.chatMessageInputDisabled` (surfaced through the same underlying schema flag on some deployments) is, by contrast, only ever a welcome-screen nudge to pick a starter — once a conversation exists there is no further button-driven interaction to fall back on, so `ConversationView` MUST NOT keep the input disabled for a deployment that exposes Quick Apps starters, regardless of what the schema flag says.

#### Scenario: Flag true, no Quick Apps starters — ConversationView passes isInputDisabled true

- **WHEN** `selectedDeploymentConfiguration` contains `{ isChatMessageInputDisabled: true }` and the resolved deployment has no valid Quick Apps `conversationStarters`
- **THEN** `ConversationInput` receives `isInputDisabled={true}` in `ConversationView`

#### Scenario: Flag absent — ConversationView passes isInputDisabled false

- **WHEN** `selectedDeploymentConfiguration` is `null` or does not contain `isChatMessageInputDisabled`
- **THEN** `ConversationInput` receives `isInputDisabled={false}` in `ConversationView`

#### Scenario: Flag true but deployment has Quick Apps starters — input stays enabled after the first message

- **WHEN** `selectedDeploymentConfiguration.isChatMessageInputDisabled` is `true` AND the resolved deployment has valid Quick Apps `conversationStarters`
- **THEN** `ConversationInput` receives `isInputDisabled={false}` in `ConversationView`, so the user can send free-form follow-up messages after starting the conversation from a starter

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
- `isInputDisabled={true}` with an already-populated `message` renders the send button as enabled, and clicking it calls `onSend`.
- `isInputDisabled={true}` renders the attach button as disabled.
- `isInputDisabled={true}` does not call `onSend` when Enter is pressed, populated message or not.
- `isInputDisabled={false}` (or omitted) allows send via Enter.

---

### Requirement: App-level mapping tested in ConversationRoute tests

`apps/chat/src/pages/ConversationRoute/ConversationRoute.spec.tsx` SHALL include test cases covering:

- When `selectedDeploymentConfiguration` has `isChatMessageInputDisabled: true`, the rendered `ConversationInput` receives `isInputDisabled={true}`.
- When `selectedDeploymentConfiguration` is `null`, the rendered `ConversationInput` receives `isInputDisabled={false}`.
- When `selectedDeploymentConfiguration` exists but lacks `isChatMessageInputDisabled`, the rendered `ConversationInput` receives `isInputDisabled={false}`.
