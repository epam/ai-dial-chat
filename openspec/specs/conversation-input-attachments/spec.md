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

### Requirement: AttachmentCard lazy-loads image previews

`libs/conversation-input/src/components/AttachmentCard/AttachmentCard.tsx` SHALL render image attachments through a lazy-loaded `<img>` element when `attachment.type === AttachmentType.Image`, the attachment is not in `RequestStatus.Error`, and either `attachment.previewUrl` or `attachment.url` is present.

The image source SHALL prefer `attachment.previewUrl` and fall back to `attachment.url`. The `<img>` SHALL use native lazy-loading (`loading="lazy"`) and asynchronous decoding (`decoding="async"`).

While the image has not loaded, `AttachmentCard` SHALL render a rectangular `DialSkeleton` from `@epam/ai-dial-ui-kit` over the image area. The skeleton SHALL use the ui-kit overlay API to display a centered image icon (`IconPhoto`) and SHALL use theme/ui-kit styling only. The skeleton SHALL remain visible while the image is loading or failed, and SHALL be removed when the image emits a successful load event.

The image load tracking SHALL be isolated in a reusable hook owned by `libs/conversation-input` and SHALL not introduce host/application knowledge such as REST paths, generated clients, auth/session state, or file-storage URL rules.

#### Scenario: Image card uses lazy browser loading

- **WHEN** `AttachmentCard` renders an image attachment with `previewUrl`
- **THEN** the rendered `<img>` uses `src={attachment.previewUrl}`
- **AND** the rendered `<img>` has `loading="lazy"` and `decoding="async"`

#### Scenario: Image card falls back to remote URL

- **WHEN** `AttachmentCard` renders an image attachment with no `previewUrl` and a non-empty `url`
- **THEN** the card renders an image thumbnail using `url` as the image source

#### Scenario: Skeleton is shown until image load completes

- **WHEN** an image attachment thumbnail has not emitted a successful load event
- **THEN** the card shows a rectangular active `DialSkeleton` with a centered image icon overlay
- **WHEN** the image emits a successful load event
- **THEN** the skeleton is removed and the image is shown

#### Scenario: Failed image load keeps placeholder visible

- **WHEN** an image attachment thumbnail emits an error event
- **THEN** the card keeps the skeleton placeholder visible instead of showing a broken-image gap

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

---

### Requirement: `AttachmentTray` forwards a click callback to each `AttachmentCard`

`libs/conversation-input/src/models/AttachmentTray.ts` (`AttachmentTrayProps`) SHALL gain two optional props:

- `onAttachmentClick?: (attachment: DisplayAttachment) => void` — Called when the user clicks or keyboard-activates a card. Receives the full `DisplayAttachment` object.
- `clickLabel?: string` — Forwarded to each `AttachmentCard` as `clickLabel`. When omitted, `AttachmentCard`'s own default (`'Open attachment'`) applies.

`AttachmentTray.tsx` SHALL, for each rendered `AttachmentCard`:
- Pass `(attachment) => onAttachmentClick?.(attachment)` as the `onClick` prop when `onAttachmentClick` is provided.
- Pass `clickLabel` as the `clickLabel` prop (may be `undefined`; card's own default covers that case).
- Continue passing `onRemove`, `onRetry`, and `onExpand` as today — the new props are purely additive.

When `onAttachmentClick` is not provided, no `onClick` is passed to cards, and cards remain inert (no regression to existing consumers).

#### Scenario: Tray cards are inert without `onAttachmentClick`

- **WHEN** `AttachmentTray` is rendered without `onAttachmentClick`
- **THEN** each rendered `AttachmentCard` has no `onClick` prop and is not keyboard-accessible as a button

#### Scenario: Tray cards receive click handler when `onAttachmentClick` is provided

- **WHEN** `AttachmentTray` is rendered with `onAttachmentClick` and an attachment list
- **THEN** each `AttachmentCard` receives an `onClick` prop
- **AND** activating any card invokes `onAttachmentClick` with the corresponding `DisplayAttachment`

#### Scenario: `clickLabel` is forwarded to each card

- **WHEN** `AttachmentTray` is rendered with `onAttachmentClick` and `clickLabel="Download file"`
- **THEN** each `AttachmentCard` receives `clickLabel="Download file"`

#### Scenario: Existing remove and retry callbacks are unaffected

- **WHEN** `AttachmentTray` is rendered with both `onRemove` and `onAttachmentClick`
- **THEN** clicking the remove button calls `onRemove` and does NOT invoke `onAttachmentClick`
