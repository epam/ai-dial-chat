# chat-input-disabled-state Specification

## Purpose

The `isInputDisabled` prop on the conversation input: what it disables, what stays interactive, and how the app edge derives it.

## Requirements

### Requirement: Input accepts isInputDisabled prop

`libs/conversation-input/src/models/Input.ts` (`InputProps`) and `libs/conversation-input/src/models/ConversationInput.ts` (`ConversationInputProps`) SHALL each expose an optional prop:

```ts
/**
 * When `true`, blocks typing, the attach menu, dictation, Enter-to-send,
 * and dropped files (`pendingDropFiles` are consumed and discarded, never
 * added to the tray). The send button still submits a message that is
 * already populated (e.g. by a starter). Starter/action buttons and the
 * model selector remain usable. Defaults to `false`.
 */
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

The `Input` component's `SendButton` SHALL be rendered with `isDisabled={!hasModelSelected || !canSend}`, where `canSend = hasSendableContent && !hasBlockedAttachments && !isSendDisabled && !isVoiceActive` — `isInputDisabled` is deliberately excluded from this expression. The send button renders whenever the composer is not streaming (and no `renderFooterActions` replaces the footer); with an empty message it renders disabled, showing `emptyMessageTooltip`. With typing blocked by the disabled textarea (see above) and the attach button also disabled, the only way `hasSendableContent` can be true while `isInputDisabled` is true is a starter having populated `message` (see the Quick Apps "populate prompt" starter behavior, `libs/chat-hooks/src/conversation/quick-app-conversation-starters.ts`). In that one case, the user cannot edit the populated text but SHALL still be able to submit it via the send button, since "Disable chat input" otherwise leaves them no way to act on a populate-only starter's text.

The Enter key SHALL NOT submit while `isInputDisabled` is `true`, regardless of message content — `handleKeyDown`'s Enter-send branch SHALL explicitly require `!isInputDisabled` in addition to `canSend`/`hasModelSelected`/`!isStreaming`. This keeps every keyboard-driven path blocked ("just not edit"), leaving the send **button** as the sole exception.

#### Scenario: Send button is disabled when there is nothing to send

- **WHEN** `Input` is rendered with `isInputDisabled={true}` and no message or attachments
- **THEN** the send button renders disabled because `canSend` is false (unaffected by `isInputDisabled`)

#### Scenario: Send button is enabled when a message is already populated

- **WHEN** `Input` is rendered with `isInputDisabled={true}` and `message="Hello"` (as set by a populate-only Quick Apps starter)
- **THEN** the send button is enabled and clicking it calls `onSend("Hello", [])`

#### Scenario: Enter key does not submit

- **WHEN** `Input` is rendered with `isInputDisabled={true}` (with or without a populated message) and the user presses Enter
- **THEN** `onSend` is not called

---

### Requirement: Input disables attach button when isInputDisabled is true

The `Input` component's attach (`+`) button, `AddAttachmentButton`, SHALL be rendered with `isDisabled={isInputDisabled || isVoiceActive}`, so it is disabled whenever `isInputDisabled` is `true`, preventing the menu from opening and file selection from being triggered. The dictation microphone button is likewise `disabled={isInputDisabled || isStreaming}`.

#### Scenario: Attach button is disabled

- **WHEN** `Input` is rendered with `isInputDisabled={true}`
- **THEN** `AddAttachmentButton` receives `isDisabled={true}`, its trigger `GhostIconButton` is `disabled`, and clicking it does not open the dropdown

---

### Requirement: Input discards dropped files when isInputDisabled is true

`Input` has no drop handlers of its own; files dropped on the page reach it through the host-supplied `pendingDropFiles` prop. `Input` SHALL forward `isInputDisabled` to `useAttachments` as `isDropDisabled` (`libs/conversation-input/src/hooks/useAttachments.ts`). While it is `true`, `useAttachments` SHALL mark every new `pendingDropFiles` entry as consumed and call `onDropFilesConsumed` without building or uploading an attachment. The files are discarded, not deferred: a `File` consumed while disabled SHALL NOT be added when the input is later re-enabled, because applying a drop the user made against a disabled control at some later moment would surprise them. This is defence in depth behind the page-level rejection below.

#### Scenario: Pending drop files are discarded

- **WHEN** `Input` is rendered with `isInputDisabled={true}` and a non-empty `pendingDropFiles`
- **THEN** no attachment is added to the tray, `onUploadAttachment` is not called, and `onDropFilesConsumed` is called once

#### Scenario: Discarded files stay discarded after re-enabling

- **WHEN** the same `Input` is re-rendered with `isInputDisabled={false}` and the same `File` still in `pendingDropFiles`
- **THEN** the file is not added to the tray

---

### Requirement: Pages reject page-level file drops while the input is disabled

`apps/chat/src/components/NewConversationComposer/NewConversationComposer.tsx` SHALL derive `isPageDropAllowed = isAttachmentsAllowed && !isInputDisabled`, and `apps/chat/src/components/ConversationView/ConversationView.tsx` SHALL derive `isPageDropAllowed = isAttachmentsAllowed && (isEditActive || !isInputDisabled)` (a message being edited is not governed by `isInputDisabled` and keeps accepting drops). Each page SHALL pass `isPageDropAllowed` as the first (`isAttachmentsAllowed`) argument of `usePageFileDrag` and as `FileDndOverlay`'s `isAttachmentsAllowed` (and its allowed/denied labels). A drag over the page therefore shows the denied overlay ("No attachments allowed"), and the drop is cancelled with `pendingFiles` left empty. The second (`isEnabled`) argument SHALL NOT be used for this: with `isEnabled = false` the hook still cancels `dragover` but leaves `drop` uncancelled, so the browser would open the dropped file and navigate away from the chat.

#### Scenario: Drop on a page whose input is disabled

- **WHEN** `ConversationView` renders for a deployment configuration with `isChatMessageInputDisabled: true` (no Quick Apps starters) and the user drags a file over the page and drops it
- **THEN** the denied overlay is shown during the drag, the drop event is cancelled, nothing is uploaded, and no attachment appears in the tray

#### Scenario: Drop on a page whose input is enabled

- **WHEN** the same page renders with `isChatMessageInputDisabled: false` and the user drops a text file
- **THEN** the allowed overlay is shown during the drag and the file is uploaded and added to the tray

#### Scenario: New-conversation composer with a disabled input

- **WHEN** `NewConversationComposer` is rendered with `isInputDisabled={true}`
- **THEN** `usePageFileDrag` receives `isAttachmentsAllowed = false` and the overlay renders its denied labels

---

### Requirement: App-edge derivation of isInputDisabled in ConversationRoute

`apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` SHALL derive a local boolean, memoised with `useMemo`:

```ts
const isInputDisabled = useMemo(
  () =>
    usingQuickAppStarters
      ? quickAppStarters.isChatMessageInputDisabled
      : !!selectedDeploymentConfiguration?.isChatMessageInputDisabled,
  [usingQuickAppStarters, selectedDeploymentConfiguration, quickAppStarters.isChatMessageInputDisabled],
);
```

where `quickAppStarters = getQuickAppConversationStarters(selectedDeployment?.conversationStarters)` and `usingQuickAppStarters` is `quickAppStarters.starters.length > 0`. It SHALL pass the value as `isInputDisabled={isInputDisabled}` to `NewConversationComposer`, which forwards it unchanged to `ConversationInput`.

#### Scenario: Flag true — ConversationRoute passes isInputDisabled true

- **WHEN** `selectedDeploymentConfiguration` contains `{ isChatMessageInputDisabled: true }` and the deployment has no valid Quick Apps starters
- **THEN** `ConversationInput` receives `isInputDisabled={true}` in `ConversationRoute`

#### Scenario: Flag absent — ConversationRoute passes isInputDisabled false

- **WHEN** `selectedDeploymentConfiguration` is `null` or does not contain `isChatMessageInputDisabled`
- **THEN** `ConversationInput` receives `isInputDisabled={false}` in `ConversationRoute`

---

### Requirement: App-edge derivation of isInputDisabled in ConversationView

`apps/chat/src/components/ConversationView/ConversationView.tsx` SHALL read `selectedDeploymentConfiguration` from its `useDeployments()` destructuring and derive `isInputDisabled` (each value memoised with `useMemo`) as:

```ts
const hasQuickAppStarters =
  getQuickAppConversationStarters(selectedDeployment?.conversationStarters)
    .starters.length > 0;
const isInputDisabled =
  !hasQuickAppStarters &&
  !!selectedDeploymentConfiguration?.isChatMessageInputDisabled;
```

`getQuickAppConversationStarters` is imported from `@epam/ai-dial-chat-hooks`.

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

Starter buttons (rendered via `renderFooterActions` or the starters bar), form buttons, and any other action buttons inside `ConversationInput` SHALL NOT be disabled by `isInputDisabled`. Only the free-text input path (textarea, Enter-to-send, attach, dictation, drop) is blocked; the send button remains available for an already-populated message.

#### Scenario: Starter buttons still clickable when input disabled

- **WHEN** `ConversationInput` is rendered with `isInputDisabled={true}` and starter buttons are present
- **THEN** clicking a starter button invokes its handler normally

---

### Requirement: Model selector stays interactive when isInputDisabled is true

`ModelSelectorControl` SHALL NOT read `isInputDisabled` at all. Only `isDisabled` (fed from `InputProps.isModelSelectorDisabled`) and `isStreaming` gate the selector — a composer whose free-text path is blocked MUST still let the user open the picker and change the deployment, since a Quick App with `isChatMessageInputDisabled` would otherwise lock the user into its pre-set model with no way out.

#### Scenario: Picker opens while the input is disabled

- **WHEN** `Input` is rendered with `isInputDisabled={true}`, a `modelPickerOverlay`, and `isModelSelectorDisabled` absent, and the user clicks the model selector
- **THEN** the picker overlay opens and the selector is not dimmed

#### Scenario: Explicitly disabled selector stays closed

- **WHEN** `Input` is rendered with `isInputDisabled={true}` and `isModelSelectorDisabled={true}` and the user clicks the model selector
- **THEN** the picker overlay does not open and the selector renders dimmed

---

### Requirement: isInputDisabled tested in Input unit tests

`libs/conversation-input/src/components/Input/tests/Input.spec.tsx` SHALL include test cases covering:

- `isInputDisabled={true}` renders the textarea with the `disabled` attribute.
- `isInputDisabled={true}` with an already-populated `message` renders the send button as enabled, and clicking it calls `onSend`.
- `isInputDisabled={true}` renders the attach button as disabled.
- `isInputDisabled={true}` does not call `onSend` when Enter is pressed, populated message or not.
- `isInputDisabled={false}` (or omitted) allows send via Enter.
- `isInputDisabled={true}` consumes `pendingDropFiles` without adding them, and they stay discarded after re-enabling.

#### Scenario: Input suite covers both states of the flag

- **WHEN** the `Input` unit test suite is executed
- **THEN** it asserts the disabled textarea, disabled attach button, and suppressed Enter-send for `isInputDisabled={true}`
- **AND** it asserts that an already-populated message still sends, and that Enter-send works again when the flag is absent

---

### Requirement: App-level mapping tested in ConversationRoute tests

`apps/chat/src/pages/ConversationRoute/ConversationRoute.spec.tsx` SHALL include test cases covering (the mocked composer surfaces the forwarded `isInputDisabled` value):

- When `selectedDeploymentConfiguration` has `isChatMessageInputDisabled: true`, the rendered `ConversationInput` receives `isInputDisabled={true}`.
- When `selectedDeploymentConfiguration` is `null`, the rendered `ConversationInput` receives `isInputDisabled={false}`.
- When `selectedDeploymentConfiguration` exists but lacks `isChatMessageInputDisabled`, the rendered `ConversationInput` receives `isInputDisabled={false}`.

#### Scenario: Route suite covers every derivation input

- **WHEN** the `ConversationRoute` test suite is executed
- **THEN** it asserts `isInputDisabled={true}` only for a configuration with `isChatMessageInputDisabled: true`
- **AND** it asserts `isInputDisabled={false}` for both a `null` configuration and one that omits the field
