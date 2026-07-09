# @epam/ai-dial-conversation-input

Message input component for conversations, supporting model selection, chat settings, file attachments, voice input, and message editing.

## Overview

This library provides the full conversation input experience. It includes the primary text input, a bottom sheet for model selection on mobile, a chat settings modal, and an edit-mode input for revising existing messages. It re-exports the attachment components from `@epam/ai-dial-attachment-input` for convenience.

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
- `@epam/ai-dial-kit`
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
  isOpen={isOpen}
  onClose={handleClose}
  values={settings}
  onChange={setSettings}
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
