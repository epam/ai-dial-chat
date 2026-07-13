# conversation-input-attachments Specification

## Purpose

Specifies how the conversation input library handles file attachments: uploading via a host callback, attachment card image previews, voice recording props, and tray click forwarding.
## Requirements
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

### Requirement: EditMessageInput accepts externally-supplied pending drop files

`EditMessageInput` SHALL accept two new optional props:
- `pendingDropFiles?: File[]` — files supplied from outside (e.g., page-level drag-and-drop)
- `onDropFilesConsumed?: () => void` — signals that the files have been consumed by the input

When `pendingDropFiles` changes to a non-empty array, `EditMessageInput` SHALL merge those files with its internal `pendingDropFiles` state (or set it directly when the internal queue is empty) and call `onDropFilesConsumed`.

#### Scenario: External pending files appear in edit input

- **WHEN** `EditMessageInput` receives a non-empty `pendingDropFiles` prop
- **THEN** those files are added to the attachment tray in the edit input

#### Scenario: onDropFilesConsumed is called after consuming external files

- **WHEN** `EditMessageInput` processes the externally-supplied files
- **THEN** it calls the `onDropFilesConsumed` callback to allow the parent to clear its state

---

### Requirement: DisplayAttachment carries an optional error reason

`DisplayAttachment` in `libs/chat-shared/src/models/chat.ts` SHALL gain an optional field `errorReason?: AttachmentErrorReason`.

`AttachmentErrorReason` SHALL be defined as a string enum in `libs/chat-shared/src/types/attachment.ts` (alongside `AttachmentType`):

```ts
export enum AttachmentErrorReason {
  /** Upload failed because the device was offline. */
  Network = 'network',
  /** File MIME type is not in the deployment's inputAttachmentTypes list. */
  UnsupportedType = 'unsupported-type',
}
```

`errorReason` is only set when `status === RequestStatus.Error`. It is `undefined` for all other statuses and for generic (non-categorised) errors.

Existing consumers of `DisplayAttachment` are unaffected — the field is optional.

#### Scenario: Error with known reason carries errorReason

- **WHEN** an attachment upload fails because the device is offline
- **THEN** `attachment.errorReason === AttachmentErrorReason.Network`
- **AND** `attachment.status === RequestStatus.Error`

#### Scenario: Error with unknown reason leaves errorReason undefined

- **WHEN** an attachment upload fails while the device is online
- **THEN** `attachment.errorReason` is `undefined`
- **AND** `attachment.status === RequestStatus.Error`

#### Scenario: Non-error attachment has no errorReason

- **WHEN** `attachment.status === RequestStatus.Idle`
- **THEN** `attachment.errorReason` is `undefined`

---

### Requirement: Input accepts a validateAttachment callback for pre-upload validation

`ConversationInputProps` (and the inner `InputProps`) in `libs/conversation-input` SHALL accept a new optional prop:

```ts
validateAttachment?: (attachment: Attachment) => AttachmentErrorReason | undefined
```

When provided, the input SHALL invoke `validateAttachment(attachment)` after each attachment is added (from file picker, drag-and-drop, or clipboard), before calling `onUploadAttachment`.

- If `validateAttachment` returns an `AttachmentErrorReason`, the attachment SHALL be placed immediately into `{ status: RequestStatus.Error, errorReason: reason }` and `onUploadAttachment` SHALL NOT be called.
- If `validateAttachment` returns `undefined`, the normal upload flow proceeds.

When `validateAttachment` is not provided, existing behaviour is unchanged.

#### Scenario: Invalid attachment bypasses upload and enters error state

- **WHEN** `validateAttachment` returns `AttachmentErrorReason.UnsupportedType` for a given attachment
- **THEN** the attachment card enters error state with `errorReason: AttachmentErrorReason.UnsupportedType`
- **AND** `onUploadAttachment` is NOT called for that attachment

#### Scenario: Valid attachment proceeds through normal upload flow

- **WHEN** `validateAttachment` returns `undefined` for a given attachment
- **THEN** `onUploadAttachment` is called as usual

#### Scenario: Missing validateAttachment prop preserves existing behaviour

- **WHEN** `ConversationInput` is rendered without `validateAttachment`
- **THEN** all attachments proceed directly to `onUploadAttachment` as before

---

### Requirement: Attachments already in the tray are re-validated when validateAttachment changes

`useAttachments` (`libs/conversation-input/src/hooks/useAttachments.ts`) SHALL re-run `validateAttachment` against every attachment already in the tray whenever the `validateAttachment` callback identity changes (e.g., because the host recomputed it after the user switched the selected model/deployment).

Attachments currently in `RequestStatus.Loading` are skipped by this re-validation pass — an in-flight upload is never interrupted.

- If `validateAttachment` now returns an `AttachmentErrorReason` for an attachment that was not already in that exact error state, the attachment SHALL transition to `{ status: RequestStatus.Error, errorReason: reason }`. This reuses the existing error-card rendering, retry-button suppression rules, and `hasBlockedAttachments` gating — no new UI or send-blocking mechanism is introduced.
- If `validateAttachment` now returns `undefined` for an attachment whose `errorReason` was `AttachmentErrorReason.UnsupportedType`, the attachment SHALL transition back to `RequestStatus.Idle` with `errorReason` cleared. When that attachment has no `url` yet (it was never uploaded because it was invalid at add time), `useAttachments` SHALL call `onUploadAttachment` for it as part of the transition.
- Attachments with any other error reason (e.g. `AttachmentErrorReason.Network`) or with no error are left untouched by this pass beyond the unsupported-type checks above.
- When `validateAttachment` is not provided (`undefined`), no re-validation pass runs.

This closes the gap where a file attached while compatible with the selected model, followed by switching to a model that no longer supports that file's type, previously left the attachment silently valid until send failed.

#### Scenario: Switching to an incompatible model flags an already-attached file

- **WHEN** a PDF attachment is idle and uploaded under a model that allows PDFs
- **AND** the user switches to a model whose `inputAttachmentTypes` no longer include `application/pdf`
- **THEN** the attachment card transitions to `status: RequestStatus.Error` with `errorReason: AttachmentErrorReason.UnsupportedType`
- **AND** the send action becomes unavailable
- **AND** the retry button is not rendered on that card

#### Scenario: Switching back to a compatible model clears the error and uploads if needed

- **WHEN** an attachment is in `status: RequestStatus.Error` with `errorReason: AttachmentErrorReason.UnsupportedType` and no `url`
- **AND** the user switches to a model whose `inputAttachmentTypes` include that attachment's MIME type
- **THEN** the attachment transitions to `status: RequestStatus.Idle` with `errorReason` cleared
- **AND** `onUploadAttachment` is called for that attachment

#### Scenario: In-flight uploads are not disturbed by a model switch

- **WHEN** an attachment is in `status: RequestStatus.Loading`
- **AND** the selected model changes while the upload is still pending
- **THEN** the re-validation pass leaves that attachment's status untouched

#### Scenario: Unrelated error reasons are not cleared by re-validation

- **WHEN** an attachment is in `status: RequestStatus.Error` with `errorReason: AttachmentErrorReason.Network`
- **AND** the selected model changes to one that supports the attachment's MIME type
- **THEN** the attachment remains in `status: RequestStatus.Error` with `errorReason: AttachmentErrorReason.Network`

---

### Requirement: Input wrapper removes inline-end padding when the tray is full

When the total attachment count (prefix + new) reaches 7 or more, the `Input` wrapper SHALL drop its inline-end (`padding-right`) to `0`. For fewer than 7 attachments the default `p-3` (12 px on all sides) applies.

#### Scenario: No end padding with 7 or more attachments

- **WHEN** the combined attachment count is 7 or more
- **THEN** the input wrapper uses `py-3 pl-3` (no right padding)

#### Scenario: Default padding with fewer than 7 attachments

- **WHEN** the combined attachment count is 6 or fewer
- **THEN** the input wrapper uses `p-3` (12 px on all sides)

---

### Requirement: Action bar stays inline when attachments are present

The action bar layout (textarea, + button, model selector) SHALL remain on a single row on desktop even when the `AttachmentTray` is visible. Attachments are displayed in `AttachmentTray` above the action bar and MUST NOT trigger the stacked layout. The stacked layout (textarea above buttons) is only used when the caller explicitly opts in (`isStacked` prop) or when the message contains multiple visual lines.

#### Scenario: Placeholder stays inline with buttons when files are attached

- **WHEN** one or more files are attached and the message text is empty
- **THEN** the placeholder text is on the same row as the + button and model selector on desktop
- **AND** the `AttachmentTray` is rendered above the action bar

#### Scenario: Stacked layout still activates for multi-line messages

- **WHEN** the message text spans multiple lines (explicit newline or word-wrap)
- **THEN** the textarea is on its own row above the action buttons

---

### Requirement: Retry button is suppressed for non-retryable error reasons

`AttachmentCard` SHALL NOT render the retry button when `attachment.errorReason === AttachmentErrorReason.UnsupportedType`, even if an `onRetry` prop is provided.

For all other error states (no `errorReason`, or `errorReason === AttachmentErrorReason.Network`) the retry button continues to render when `onRetry` is present.

#### Scenario: Retry hidden for unsupported-type error

- **WHEN** `AttachmentCard` renders with `status: RequestStatus.Error` and `errorReason: AttachmentErrorReason.UnsupportedType`
- **THEN** the retry button is not rendered
- **AND** the remove button is still rendered

#### Scenario: Retry shown for network error

- **WHEN** `AttachmentCard` renders with `status: RequestStatus.Error` and `errorReason: AttachmentErrorReason.Network` and `onRetry` is provided
- **THEN** the retry button is rendered

#### Scenario: Retry shown for generic error (no reason)

- **WHEN** `AttachmentCard` renders with `status: RequestStatus.Error` and `errorReason` is `undefined` and `onRetry` is provided
- **THEN** the retry button is rendered

