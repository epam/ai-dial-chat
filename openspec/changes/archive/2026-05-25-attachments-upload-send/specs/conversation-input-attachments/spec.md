## MODIFIED Requirements

---

### Requirement: Attachment shared types

`libs/chat-shared` SHALL expose two attachment shapes:

- `ApiAttachment` — wire/storage format matching DIAL Core (`type`, `title`, `url?`, `data?`, `reference_type?`, `reference_url?`, `index?`).
- `UiAttachment` — in-progress browser shape with `id`, `name`, `contentType`, `file: File`, `type: AttachmentType`, `status: RequestStatus`, `previewUrl?`, and `apiAttachment?: ApiAttachment` (populated after successful upload).

The phase-1 single `Attachment` interface is renamed to `UiAttachment` and is no longer the wire format.

#### Scenario: UiAttachment has all upload state

- **WHEN** a file is picked
- **THEN** the resulting `UiAttachment` has `status: Loading`, an unset `apiAttachment`, and a browser `File` reference

#### Scenario: UiAttachment carries ApiAttachment after upload

- **WHEN** the upload succeeds
- **THEN** the `UiAttachment` has `status: Idle` and a populated `apiAttachment`

---

### Requirement: Input drives the upload lifecycle

The `Input` component SHALL accept an injected `uploadAttachment?: (file: File) => Promise<ApiAttachment>` prop. When files are picked, the component SHALL start each upload immediately, track per-attachment status, and expose retry for errored uploads.

#### Scenario: Upload starts on file pick

- **WHEN** the user picks one or more files
- **THEN** each new card appears in `Loading` state and `uploadAttachment(file)` runs in the background

#### Scenario: Upload success transitions to Idle

- **WHEN** `uploadAttachment` resolves for a card
- **THEN** the card's `status` becomes `Idle` and its `apiAttachment` is filled

#### Scenario: Upload failure transitions to Error

- **WHEN** `uploadAttachment` rejects for a card
- **THEN** the card's `status` becomes `Error` and a retry control is exposed

#### Scenario: Retry restarts the upload

- **WHEN** the user clicks retry on an errored card
- **THEN** the card returns to `Loading` and `uploadAttachment` runs again with the original `File`

#### Scenario: Lib has no fetch dependency

- **WHEN** `uploadAttachment` is omitted
- **THEN** picked cards stay in `Idle` and the library does not make any network call

---

### Requirement: Send eligibility considers attachments

`canSend` SHALL be true iff (`message` has non-whitespace text **OR** at least one attachment has a populated `apiAttachment`) **AND** no attachment is currently in `Loading`.

#### Scenario: Send disabled while uploading

- **WHEN** any attachment has `status: Loading`
- **THEN** the send button is not rendered (or is disabled), regardless of text

#### Scenario: Send enabled with attachment only

- **WHEN** the textarea is empty and exactly one attachment has `status: Idle` with a populated `apiAttachment`
- **THEN** the send button is rendered

#### Scenario: Send disabled with errored attachment only

- **WHEN** the textarea is empty and all attachments are in `Error`
- **THEN** the send button is not rendered

---

### Requirement: onSend payload is an object

`InputProps.onSend` and `ConversationInputProps.onSend` SHALL be `(payload: { message: string; attachments?: ApiAttachment[] }) => void`. The `attachments` array SHALL contain only attachments with a populated `apiAttachment`, in pick order, and SHALL be omitted entirely when none are present.

#### Scenario: Text-only send

- **WHEN** the user sends "Hello" with no attachments
- **THEN** `onSend` is called with `{ message: "Hello", attachments: undefined }`

#### Scenario: Attachment-only send

- **WHEN** the user sends with empty text and one uploaded attachment
- **THEN** `onSend` is called with `{ message: "", attachments: [<ApiAttachment>] }`

#### Scenario: Text-and-attachments send

- **WHEN** the user sends "Look at this" with two uploaded attachments
- **THEN** `onSend` is called with `{ message: "Look at this", attachments: [<ApiAttachment>, <ApiAttachment>] }`

---

## REMOVED Requirements

### Requirement: onAttachmentsChange callback

**Reason:** the parent app no longer observes the in-progress attachment list — it only receives the final `ApiAttachment[]` in the `onSend` payload. The unused prop is removed from both `InputProps` and `ConversationInputProps`.

**Migration:** consuming apps that previously passed `onAttachmentsChange` should remove the prop. No replacement is needed; if the parent needs the list, it can keep its own state and pass `initialAttachments` (not implemented here, separate change if requested).
