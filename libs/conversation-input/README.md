# @epam/ai-dial-conversation-input

Message input component for conversations, supporting model selection, chat settings, file attachments, voice input, and message editing.

## Overview

`@epam/ai-dial-conversation-input` delivers the complete message-composition experience for AI DIAL Chat conversations. It bundles together every concern that belongs at the bottom of a chat view: a multi-line auto-resizing text area, a model/deployment selector that opens as a bottom sheet on mobile, a chat settings modal for adjusting temperature and system prompts, a voice input bar, and a separate edit-mode input for revising previously sent messages. Keeping all of these in one library means that any application integrating AI DIAL Chat gets a consistent, fully-featured input without assembling the pieces from scratch. The library also re-exports the attachment components from `@epam/ai-dial-attachment-input` so consuming apps need only a single import path for the entire input area. Use it whenever a view requires a production-quality chat input; use the lower-level `@epam/ai-dial-attachment-input` directly only when you need attachment handling in isolation, without the full input chrome.

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

The primary input component. Renders the text area, attachment tray, action buttons, and model selector.

```tsx
import { ConversationInput } from '@epam/ai-dial-conversation-input';
import type { ConversationInputProps } from '@epam/ai-dial-conversation-input';

<ConversationInput
  onSubmit={handleSubmit}
  onAttach={handleAttach}
  deployments={availableModels}
  selectedDeploymentId={currentModelId}
  onDeploymentChange={setModel}
/>;
```

### EditMessageInput

Renders the input in edit mode for revising an existing message.

```tsx
import { EditMessageInput } from '@epam/ai-dial-conversation-input';

<EditMessageInput
  initialValue={message.content}
  onSave={handleSave}
  onCancel={handleCancel}
/>;
```

### Input

Base text input with auto-resize and keyboard shortcut handling. Use directly when a stripped-down input is needed.

```tsx
import { Input } from '@epam/ai-dial-conversation-input';
```

### ChatSettingsModal

Modal dialog for configuring conversation-level settings (temperature, system prompt, etc.).

```tsx
import { ChatSettingsModal } from '@epam/ai-dial-conversation-input';

<ChatSettingsModal
  features={features}
  initialResponseFormat={settings.responseFormat}
  initialSystemPrompt={settings.systemPrompt}
  initialTemperature={settings.temperature}
  onSave={setSettings}
  onClose={handleClose}
/>;
```

### BottomSheetShell

Layout shell for bottom sheet panels on mobile.

```tsx
import { BottomSheetShell } from '@epam/ai-dial-conversation-input';
```

## Enums

```tsx
import { SendOnEnter } from '@epam/ai-dial-conversation-input';

SendOnEnter.Enter; // send on Enter key
SendOnEnter.ShiftEnter; // send on Shift+Enter
```

## Re-exports from @epam/ai-dial-attachment-input

```tsx
import {
  AttachmentCard,
  AttachmentTray,
  FileDndOverlay,
  getAttachmentIcon,
} from '@epam/ai-dial-conversation-input';
```

## Building

```sh
npm exec nx build conversation-input
```

## Testing

```sh
npm exec nx test conversation-input
```
