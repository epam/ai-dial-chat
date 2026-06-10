## MODIFIED Requirements

### Requirement: Input uploads attachments immediately through a host callback

`Input`, `ConversationInput`, and `EditMessageInput` SHALL accept an optional `onUploadAttachment?: (attachment: Attachment) => Promise<string>` prop.

When `onUploadAttachment` is provided, the input SHALL call it immediately after each attachment is added from file picker, drag-and-drop, or clipboard paste. The input SHALL keep upload integration host-agnostic: it receives only a URL string from the callback and must not know REST paths, buckets, auth/session state, generated API clients, or upload path rules.

The input SHALL store the returned URL on the matching `Attachment.url`.

#### Scenario: Attachment enters loading state on add

- **WHEN** an attachment is added and `onUploadAttachment` is provided
- **THEN** the attachment card enters `status: RequestStatus.Loading`
- **THEN** the send action is unavailable while the upload is pending

#### Scenario: Attachment stores URL after successful upload

- **WHEN** `onUploadAttachment` resolves with a URL
- **THEN** the matching attachment transitions to `status: RequestStatus.Idle`
- **THEN** the matching attachment stores that URL
- **THEN** the send action becomes available when all attachments are idle

#### Scenario: Attachment enters error state after failed upload

- **WHEN** `onUploadAttachment` rejects
- **THEN** the matching attachment transitions to `status: RequestStatus.Error`
- **THEN** the tray remains visible with retry and remove actions
- **THEN** the send action is unavailable while the failed attachment remains

#### Scenario: Retry reuploads the failed attachment

- **WHEN** the user activates retry on an error attachment
- **THEN** the input calls `onUploadAttachment` again for the same attachment
- **THEN** successful retry stores the returned URL and transitions the card back to idle

#### Scenario: Tray clears after successful send

- **WHEN** the user sends a message with uploaded attachments and `onSend` resolves successfully
- **THEN** the `AttachmentTray` is no longer rendered and the attachment list is empty

#### Scenario: Tray retained on send error

- **WHEN** `onSend` rejects
- **THEN** the original attachment list remains visible

---

### Requirement: Voice recording props on ConversationInput

`ConversationInputProps` (and the inner `InputProps`) SHALL accept three new optional props:

```ts
isTranscriptionSupported?: boolean
onUploadAudio?: (file: File, contentType: string) => Promise<string>
onTranscribeAudio?: (audioUrl: string) => Promise<string>
```

These props are host-injected. The lib MUST NOT compute `isTranscriptionSupported` internally or know about DIAL Core semantics. When all three are absent, the mic button is hidden and the voice bar is never rendered.

#### Scenario: All three props absent — no mic button

- **WHEN** `ConversationInput` is rendered without `isTranscriptionSupported`, `onUploadAudio`, or `onTranscribeAudio`
- **THEN** no mic button is rendered and no voice bar is ever shown

#### Scenario: isTranscriptionSupported true — mic button present

- **WHEN** `isTranscriptionSupported` is `true` and the callbacks are provided
- **THEN** the mic button is rendered in the action bar
