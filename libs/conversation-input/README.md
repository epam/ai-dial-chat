# @epam/ai-dial-conversation-input

Message input component for conversations, supporting model selection, chat settings, file attachments, voice input, and message editing.

## Overview

`@epam/ai-dial-conversation-input` delivers the complete message-composition experience for AI DIAL Chat conversations. It bundles together every concern that belongs at the bottom of a chat view: a multi-line auto-resizing text area, a model/deployment selector that opens as a bottom sheet on mobile, a chat settings modal for adjusting temperature and system prompts, a voice input bar, and a separate edit-mode input for revising previously sent messages. Keeping all of these in one library means that any application integrating AI DIAL Chat gets a consistent, fully-featured input without assembling the pieces from scratch. Use it whenever a view requires a production-quality chat input. Attachment rendering is a separate concern: import `AttachmentCard`, `AttachmentTray`, `AttachmentGroup`, `FileDndOverlay`, and `getAttachmentIcon` from `@epam/ai-dial-attachment-input` directly — this package does not re-export them.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-conversation-input": "*"
  }
}
```

## Peer Dependencies

- `react`
- `react-dom`
- `@epam/ai-dial-attachment-input`
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-ui-kit`
- `@tabler/icons-react`

## Components

### ConversationInput

The primary input component. Renders the text area, attachment tray, action buttons, and model selector. Every prop is optional — the component manages its own local attachment list and textarea state, and reports outward through callbacks. `onSend` receives the message text plus the current local attachments; the model selector is only rendered when `deployments` is supplied.

```tsx
import { ConversationInput } from '@epam/ai-dial-conversation-input';

<ConversationInput
  message={draft}
  placeholder="Type a message"
  welcomeText={welcomeText}
  onSend={handleSend}
  onUploadAttachment={uploadAttachment}
  onAttachmentsChange={setDraftAttachments}
  isStreaming={isStreaming}
  onStop={handleStop}
  deployments={availableDeployments}
  selectedDeploymentId={currentDeploymentId}
  onDeploymentChange={handleDeploymentChange}
/>;
```

`pasteTextThreshold` (default `4000`) and `maxMessageLength` (default `50000`)
are two separate rules. `pasteTextThreshold` is the character count above which
pasted plain text becomes an attachment instead of inline content — it applies
only when attachments are supported. `maxMessageLength` caps the message text:
sending at or above it is blocked on **every** model regardless of attachment
support, `onMessageTooLong(length, maxMessageLength)` fires instead, and the
textarea keeps its content. A paste at or above the cap also reports through
`onMessageTooLong` when attachments are disabled, since there the pasted text
lands inline rather than becoming an attachment.

`removeLabel` and `retryLabel` are the accessible names of the remove and
retry buttons on each attachment card in the tray. They default to English
(`'Remove attachment'` / `'Retry upload'`); pass translated strings so the two
adjacent buttons stay distinguishable to assistive technology.

### EditMessageInput

Renders the input in edit mode for revising an existing message. `onCancel` and `onSave` are required; `onSave` receives the new text, the attachments the user kept, and any newly added ones.

```tsx
import { EditMessageInput } from '@epam/ai-dial-conversation-input';

<EditMessageInput
  message={message.content}
  initialAttachments={message.attachments}
  onSave={handleSave}
  onCancel={handleCancel}
  onUploadAttachment={uploadAttachment}
/>;
```

### Input

Base text input with auto-resize and keyboard shortcut handling. Use directly when a stripped-down input is needed — `ConversationInput` wraps it with the app-facing props it needs. The layout is always two rows: the textarea on its own full-width row, and the action bar (`+` button, tools chips, model selector, send/stop, mic) below it. Pass `hideActionBar` to render only the textarea and the attachment tray.

```tsx
import { Input } from '@epam/ai-dial-conversation-input';
```

### ChatSettingsModal

Modal dialog for conversation-level settings. `features` decides which fields render; the modal is uncontrolled — it seeds from the `initial*` props and reports the result through `onSave` when it closes. There is no `isOpen` prop: mount it when open, unmount it when closed.

```tsx
import { ChatSettingsModal } from '@epam/ai-dial-conversation-input';

{
  isSettingsOpen && (
    <ChatSettingsModal
      features={deployment.features}
      initialResponseFormat={settings.responseFormat}
      initialSystemPrompt={settings.systemPrompt}
      initialTemperature={settings.temperature}
      onSave={handleSaveSettings}
      onClose={handleCloseSettings}
    />
  );
}
```

### BottomSheetShell

Layout shell for bottom sheet panels on mobile — header with optional title, back and close buttons, and Escape/backdrop dismissal.

```tsx
import { BottomSheetShell } from '@epam/ai-dial-conversation-input';

<BottomSheetShell
  isOpen={isSheetOpen}
  title="Select a model"
  closeLabel="Close"
  onClose={handleCloseSheet}
>
  {sheetContent}
</BottomSheetShell>;
```

## Enums

```tsx
import { SendOnEnter } from '@epam/ai-dial-conversation-input';

SendOnEnter.Enter; // Enter submits; Shift+Enter inserts a newline
SendOnEnter.MetaEnter; // ⌘/Ctrl+Enter submits; bare Enter inserts a newline
```

## Building

```sh
npm exec nx build conversation-input
```

## Testing

```sh
npm exec nx test conversation-input
```
