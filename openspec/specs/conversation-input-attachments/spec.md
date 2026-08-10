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

While the image has not loaded, `AttachmentCard` SHALL render a rectangular `Skeleton` from `@epam/ai-dial-ui-kit` over the image area. The skeleton SHALL use the ui-kit overlay API to display a centered image icon (`IconPhoto`) and SHALL use theme/ui-kit styling only. The skeleton SHALL remain visible while the image is loading or failed, and SHALL be removed when the image emits a successful load event.

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
- **THEN** the card shows a rectangular active `Skeleton` with a centered image icon overlay
- **WHEN** the image emits a successful load event
- **THEN** the skeleton is removed and the image is shown

#### Scenario: Failed image load keeps placeholder visible

- **WHEN** an image attachment thumbnail emits an error event
- **THEN** the card keeps the skeleton placeholder visible instead of showing a broken-image gap

---

### Requirement: Voice recording prop on ConversationInput

`ConversationInputProps` (and the inner `InputProps`) SHALL accept an optional `isAudioMessageSupported?: boolean` prop. This prop is host-injected — the lib MUST NOT compute it internally or know about DIAL Core semantics. When absent or `false`, the mic button is hidden and the voice bar is never rendered.

When recording stops, the captured audio is immediately added as a `File` attachment to the message input tray (same as any locally-picked file). No upload or transcription callbacks are involved in the lib layer.

#### Scenario: isAudioMessageSupported absent — no mic button

- **WHEN** `ConversationInput` is rendered without `isAudioMessageSupported` (or with it `false`)
- **THEN** no mic button is rendered and no voice bar is ever shown

#### Scenario: isAudioMessageSupported true — mic button present

- **WHEN** `isAudioMessageSupported` is `true`
- **THEN** the mic button is rendered in the action bar

---

### Requirement: `AttachmentTray` forwards a click callback to each `AttachmentCard`

`libs/attachment-input/src/models/attachment-tray.ts` (`AttachmentTrayProps`) SHALL declare two optional props:

- `onAttachmentClick?: (id: string) => void` — Called when the user clicks or keyboard-activates a card. Receives the attachment `id`; callers that need the full `DisplayAttachment` look it up from their own attachment list by `id`.
- `clickLabel?: string` — Forwarded to each `AttachmentCard` as `clickLabel`. When omitted, `AttachmentCard`'s own default (`'Open attachment'`) applies.

`AttachmentTray.tsx` SHALL, for each rendered `AttachmentCard`:
- Pass `onAttachmentClick` directly as the `onClick` prop (both share the `(id: string) => void` signature, so no wrapper function is needed).
- Pass `clickLabel` as the `clickLabel` prop (may be `undefined`; card's own default covers that case).
- Continue passing `onRemove`, `onRetry`, and `onExpand` as today — the new props are purely additive.

When `onAttachmentClick` is not provided, no `onClick` is passed to cards, and cards remain inert (no regression to existing consumers).

#### Scenario: Tray cards are inert without `onAttachmentClick`

- **WHEN** `AttachmentTray` is rendered without `onAttachmentClick`
- **THEN** each rendered `AttachmentCard` has no `onClick` prop and is not keyboard-accessible as a button

#### Scenario: Tray cards receive click handler when `onAttachmentClick` is provided

- **WHEN** `AttachmentTray` is rendered with `onAttachmentClick` and an attachment list
- **THEN** each `AttachmentCard` receives an `onClick` prop
- **AND** activating any card invokes `onAttachmentClick` with the corresponding attachment `id`

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

### Requirement: EditMessageInput accepts externally-supplied pending attachments

`EditMessageInput` SHALL accept two new optional props, mirroring the same-named props already on `ConversationInputProps`:
- `pendingAttachments?: Attachment[]` — already-uploaded attachments supplied by the host (e.g. selected from the DIAL file manager), awaiting insertion into the edit tray
- `onPendingAttachmentsConsumed?: () => void` — signals that the host may clear its pending queue

`EditMessageInput` SHALL forward both props unchanged to its inner `Input`, which already inserts `pendingAttachments` into the tray without invoking `onUploadAttachment` for them (see the `useAttachments` pending-attachments effect).

`EditMessageInput` SHALL also accept `onDialFileSystemClick?: () => void` and `dialFileSystemLabel?: string`, with the same contract as `ConversationInputProps`: when `onDialFileSystemClick` is absent, the "DIAL file system" menu item is not rendered.

#### Scenario: External pending attachments appear in edit input

- **WHEN** `EditMessageInput` receives a non-empty `pendingAttachments` prop
- **THEN** those attachments are added to the attachment tray in the edit input
- **THEN** `onUploadAttachment` is NOT called for them

#### Scenario: onPendingAttachmentsConsumed is called after consuming external attachments

- **WHEN** `EditMessageInput` processes the externally-supplied `pendingAttachments`
- **THEN** it calls the `onPendingAttachmentsConsumed` callback to allow the parent to clear its state

#### Scenario: DIAL file system menu item absent without a handler

- **GIVEN** `onDialFileSystemClick` is not passed to `EditMessageInput`
- **WHEN** the user opens the edit-mode attach (+) menu
- **THEN** only "Attach file" appears; "DIAL file system" is absent

---

### Requirement: EditMessageInput forwards attachment card clicks to the host

`EditMessageInputProps` SHALL accept an optional `onAttachmentClick?: (attachment: DisplayAttachment) => void` prop. When provided, this callback is forwarded to the inner `Input` as `onAttachmentClick`.

`Input` resolves the clicked card's `id` against both `prefixAttachments` (pre-existing kept attachments) and the newly-added `attachments` list, then calls the callback with the matching `DisplayAttachment`. When `onAttachmentClick` is absent, attachment cards in the edit tray are not rendered as interactive.

#### Scenario: Clicking a pre-existing attachment card invokes the callback

- **WHEN** `EditMessageInput` is rendered with `onAttachmentClick` and the user clicks a card for a pre-existing attachment
- **THEN** `onAttachmentClick` is called with the matching `DisplayAttachment`

#### Scenario: Clicking a newly-added attachment card invokes the callback

- **WHEN** `EditMessageInput` is rendered with `onAttachmentClick` and the user clicks a card for a newly-added attachment
- **THEN** `onAttachmentClick` is called with the matching `Attachment` (which extends `DisplayAttachment`)

#### Scenario: Cards are inert without onAttachmentClick

- **WHEN** `EditMessageInput` is rendered without `onAttachmentClick`
- **THEN** attachment cards in the tray are not keyboard-accessible and do not respond to click

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

### Requirement: Input suppresses text-to-attachment paste conversion when attachments are disabled

`ConversationInputProps`, `InputProps`, and `EditMessageInputProps` SHALL accept an optional `isAttachmentsEnabled?: boolean` prop. When absent the value defaults to `true` (no change in behaviour).

When `isAttachmentsEnabled` is `false`, the `useClipboardPaste` handler SHALL NOT convert long pasted plain text into a `text/plain` attachment. The text SHALL be inserted inline into the textarea as if no threshold existed. Image clipboard items (pasted screenshots) are unaffected — they still convert to `AttachmentType.Image` attachments and proceed through the normal `validateAttachment` path.

The host app is responsible for setting `isAttachmentsEnabled` based on whether the selected deployment supports attachments:
- When no deployment is selected, the prop is omitted (undefined → `true`), allowing conversion.
- When a deployment is selected, the host passes `isAttachmentsEnabled={isAttachmentsAllowed}` where `isAttachmentsAllowed` is derived from `selectedDeployment.inputAttachmentTypes` being non-empty.

This prevents the erroneous "Attachments not supported" error banner that appeared when a user pasted a long prompt into the input while a model with no attachment support was selected.

#### Scenario: Long pasted text on a model without attachment support stays inline

- **WHEN** `isAttachmentsEnabled` is `false`
- **AND** the user pastes plain text longer than `pasteTextThreshold` characters
- **THEN** the text is inserted into the textarea normally
- **AND** no attachment card is created
- **AND** no "Attachments not supported" notification appears

#### Scenario: Long pasted text on a model with attachment support is converted normally

- **WHEN** `isAttachmentsEnabled` is `true` (default)
- **AND** the user pastes plain text longer than `pasteTextThreshold` characters
- **THEN** the text is converted to a `text/plain` attachment and shown as an attachment card
- **AND** the textarea receives no text (paste is intercepted)

#### Scenario: Pasted image is unaffected by isAttachmentsEnabled

- **WHEN** `isAttachmentsEnabled` is `false`
- **AND** the user pastes an image from the clipboard (no plain text in the clipboard)
- **THEN** the image is still converted to an `AttachmentType.Image` attachment
- **AND** the normal `validateAttachment` path runs for the image attachment

#### Scenario: No deployment selected — conversion is not suppressed

- **WHEN** `isAttachmentsEnabled` is `undefined` (no deployment selected)
- **AND** the user pastes plain text longer than `pasteTextThreshold` characters
- **THEN** the text is converted to a `text/plain` attachment (default behaviour)

---

### Requirement: Input enforces an optional maximum attachment count

`ConversationInputProps`, `InputProps`, and `EditMessageInputProps` SHALL accept optional host-injected count-limit props:

```ts
maximumAttachmentsAmount?: number
onAttachmentsLimitExceeded?: (count: number, limit: number) => void
```

When `maximumAttachmentsAmount` is a finite number greater than `0`, the input SHALL reject an entire newly added batch when the combined attachment count would exceed the limit. The combined count includes:
- attachments already in the input tray;
- pending attachments added from a native file picker, drag-and-drop, clipboard paste, or host-supplied `pendingAttachments`;
- for `EditMessageInput`, pre-existing kept attachments rendered through `prefixAttachments`.

When rejecting a batch, the input SHALL NOT add any attachment from that batch to the tray, SHALL NOT call `onUploadAttachment` for that batch, SHALL call `onAttachmentsLimitExceeded(count, limit)` when provided, and SHALL revoke any `previewUrl` object URLs created for rejected image attachments.

When `maximumAttachmentsAmount` is `undefined`, `0`, negative, or non-finite, the input SHALL treat the count as unlimited.

The lib SHALL remain host-agnostic: it must not know DIAL Core, quick apps, deployments, REST paths, notification UI, or i18n keys. The host app owns deriving the limit from the selected deployment and rendering any user-facing notification.

#### Scenario: Selected file batch exceeds limit

- **WHEN** `maximumAttachmentsAmount` is `2`
- **AND** the user selects 3 files in one native file-picker batch
- **THEN** no selected file is added to the tray
- **AND** `onUploadAttachment` is NOT called for any selected file
- **AND** `onAttachmentsLimitExceeded` is called with `count=3` and `limit=2`

#### Scenario: Existing tray attachments count toward limit

- **WHEN** the tray already contains 1 attachment
- **AND** `maximumAttachmentsAmount` is `2`
- **AND** the user selects 2 more files
- **THEN** the new batch is rejected
- **AND** the tray still contains only the original attachment
- **AND** `onAttachmentsLimitExceeded` is called with `count=3` and `limit=2`

#### Scenario: Edit-mode kept attachments count toward limit

- **WHEN** `EditMessageInput` is rendered with 2 kept attachments
- **AND** `maximumAttachmentsAmount` is `2`
- **AND** the user selects 1 additional file
- **THEN** the selected file is rejected
- **AND** `onAttachmentsLimitExceeded` is called with `count=3` and `limit=2`

#### Scenario: Empty maximum means unlimited

- **WHEN** `maximumAttachmentsAmount` is `undefined`
- **AND** the user selects any number of valid files
- **THEN** all selected files are accepted subject to MIME/type/upload validation
- **AND** no count-limit callback is called

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

---

### Requirement: Native file picker restricts selectable types via an accept hint

`Input`, `ConversationInput`, and `EditMessageInput` in `libs/conversation-input` SHALL accept an optional `fileAccept?: string` prop.

When provided, the component SHALL apply the value verbatim as the `accept` attribute on its native `<input type="file">` element (the device file picker opened by the "Attach file" action). When absent or empty, no `accept` attribute is applied and the native picker offers every file type.

The lib SHALL treat `fileAccept` as an opaque, host-resolved string. It MUST NOT compute the value from deployment data, MIME lists, or DIAL Core semantics — the host app resolves the selected deployment's supported types (via `mimeTypesToFileAccept` over `inputAttachmentTypes`) and passes the finished `accept` string in.

Because the browser `accept` attribute is only a selection hint (the user can still switch the OS dialog to "All files"), this requirement is complementary to and does NOT replace the `validateAttachment` post-pick validation, which continues to gate every added file.

#### Scenario: accept attribute is applied to the native picker

- **WHEN** `ConversationInput` is rendered with `fileAccept="image/*,application/pdf"`
- **THEN** the hidden `<input type="file">` used by the "Attach file" action has `accept="image/*,application/pdf"`

#### Scenario: no accept attribute when prop is absent

- **WHEN** `ConversationInput` is rendered without `fileAccept`
- **THEN** the hidden `<input type="file">` has no `accept` attribute and every file type remains selectable

#### Scenario: edit-message picker honours the accept hint

- **WHEN** `EditMessageInput` is rendered with `fileAccept="image/*"`
- **THEN** its native `<input type="file">` has `accept="image/*"`

#### Scenario: post-pick validation still runs for forced selections

- **WHEN** `fileAccept` is provided and the user overrides the OS dialog to pick an unsupported file
- **THEN** `validateAttachment` is still invoked for that file and rejects it as before
