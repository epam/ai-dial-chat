## MODIFIED Requirements

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
