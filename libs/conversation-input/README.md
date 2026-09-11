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
adjacent buttons stay distinguishable to assistive technology. `uploadingLabel`
(default `'Uploading'`) names the indeterminate progress bar a card shows while
its upload is still in flight.

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

`Input` and `ConversationInput` accept `onTranscribeAudio?: TranscribeAudio`, where the exported type is `(file: File, signal: AbortSignal) => Promise<string>`. The microphone button (label and tooltip `Dictate`, overridden with `micLabel`) uses this callback with the complete recording after Stop. The library carries no HTTP or provider details; the host owns upload, provider selection, and size validation of the complete file.

One recorder collects all audio until Stop, including pauses. No upload or recognition starts during capture. All recorder blobs, including the final event, form one file with the actual browser MIME type. Sampled silent recordings and recordings shorter than 100 ms are skipped in dictation mode.

Stop finalizes the file and releases the microphone before awaiting recognition. A nonempty result is appended once to the existing draft through `onChange`, with a separating space when needed. The waveform and voice controls replace the textarea while recording or processing, and send/model controls are hidden. The draft remains in memory; no keyboard text entry is available in either voice mode. A polite status region announces the recognized text; the editable draft receives focus once a dictation session ends, including a silent or too-short capture that produced no text. Discard aborts pending work and ignores late results. Cancellation and errors preserve the original draft. No audio is added to the message attachment tray.

`Record voice` appears in the add menu immediately before Chat settings and always creates one audio attachment, even when a transcription callback is supplied. `recordVoiceLabel` overrides its label. The host enables this item with `isVoiceRecordingSupported` (defaults to `isAudioMessageSupported`); attachments must also be enabled and the assistant must not be streaming. Attachment validation, upload and count limits follow the existing attachment pipeline. `isAudioMessageSupported` controls the Dictate button independently. Without a transcription callback, the microphone retains its legacy audio attachment fallback.

Set `isAudioMessageSupported` to show the microphone. Pass translated `transcribingLabel` (default `Transcribing audio…`) and `voiceErrorLabel` (default `Voice input failed`) for processing status and fallback failures, plus the existing microphone/stop/discard labels.

Base text input with auto-resize and keyboard shortcut handling. Use directly when a stripped-down input is needed — `ConversationInput` wraps it with the app-facing props it needs. The layout is always two rows: the textarea on its own full-width row, and the action bar (`+` button, tools chips, model selector, send/stop, mic) below it. Pass `hideActionBar` to render only the textarea and the attachment tray.

`commandMenu` (on both `Input` and `ConversationInput`) mounts a host-injected slash-command menu. When provided, typing the configured `triggerPrefix` as the first character of an empty textarea opens an overlay above the input — as does pasting into an empty textarea a value that is exactly the prefix, or the prefix plus a whitespace-free query (`/` and `/test` trigger; `/s sdf`, multi-line content, or any paste into a non-empty textarea insert as a regular paste and open nothing). The menu stays open while the value keeps matching the prefix followed by a query with no whitespace or second prefix character, and closes on unmatch, Escape, or an outside click; selection typically goes through `ctx.close({ consumeQuery: true })`, which removes the `/query` text from the textarea.

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
