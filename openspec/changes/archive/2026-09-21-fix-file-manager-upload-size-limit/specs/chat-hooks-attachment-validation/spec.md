## MODIFIED Requirements

### Requirement: Resolved-MIME-type validation
`@epam/ai-dial-chat-hooks` SHALL export a `useAttachmentValidation` hook
that accepts a caller-resolved `allowedMimeTypes: string[]` (never a full
app-owned deployment object) and an optional `maxFileSizeBytes?: number`,
and returns `inputAttachmentTypes`,
`isAttachmentsAllowed`, `fileAccept`, and a `validateAttachment` function
that classifies a given `Attachment` as allowed or rejected against
exactly those types and that size limit.

`validateAttachment` SHALL check MIME type and file size independently:
a MIME-type rejection SHALL be returned before a size check runs, so a file
that fails both checks is reported as `AttachmentErrorReason.UnsupportedType`
only, on this synchronous return value — the size-specific
`AttachmentErrorReason.FileTooLarge` result applies to files that pass the
MIME-type check but fail the size check. (The asynchronous, debounced
`onValidationError` event stream reports both failure categories
independently — see the size-validation requirement below.)

#### Scenario: No types allowed
- **WHEN** `allowedMimeTypes` is an empty array and `validateAttachment` is
  called with any attachment
- **THEN** the hook returns `AttachmentErrorReason.UnsupportedType` for that
  attachment and `isAttachmentsAllowed` is `false`

#### Scenario: Supported file passes
- **WHEN** `allowedMimeTypes` includes the attachment's `contentType` and
  the attachment's size is within `maxFileSizeBytes` (or `maxFileSizeBytes`
  is `undefined`)
- **THEN** `validateAttachment` returns `undefined` for that attachment

#### Scenario: Unsupported file is rejected
- **WHEN** `allowedMimeTypes` is non-empty and does not include the
  attachment's `contentType`
- **THEN** `validateAttachment` returns `AttachmentErrorReason.UnsupportedType`

#### Scenario: MIME-type rejection takes precedence over size rejection
- **WHEN** an attachment is both an unsupported MIME type and larger than
  `maxFileSizeBytes`
- **THEN** `validateAttachment`'s synchronous return value is
  `AttachmentErrorReason.UnsupportedType`

## ADDED Requirements

### Requirement: Resolved-file-size validation

`useAttachmentValidation` SHALL accept an optional `maxFileSizeBytes?: number` parameter. When provided, `validateAttachment` SHALL classify an attachment whose byte size strictly exceeds `maxFileSizeBytes` as `AttachmentErrorReason.FileTooLarge`, provided the attachment already passed the MIME-type check. When `maxFileSizeBytes` is `undefined`, no size restriction is applied — every attachment is exempt from the size check regardless of its size.

An attachment whose size exactly equals `maxFileSizeBytes` SHALL pass the size check (the limit is inclusive).

#### Scenario: Oversized file is rejected
- **WHEN** `maxFileSizeBytes` is `536_870_912` and an attachment's size is `600_000_000`
- **THEN** `validateAttachment` returns `AttachmentErrorReason.FileTooLarge`

#### Scenario: File at exactly the limit passes
- **WHEN** `maxFileSizeBytes` is `536_870_912` and an attachment's size is `536_870_912`
- **THEN** `validateAttachment` returns `undefined` (assuming its MIME type is also allowed)

#### Scenario: No size restriction when maxFileSizeBytes is absent
- **WHEN** `maxFileSizeBytes` is `undefined`
- **THEN** no attachment is rejected for size, regardless of how large it is

### Requirement: Structured, translation-free size-validation-error reporting

The hook SHALL report a size-rejected attachment through the same optional `onValidationError(event: AttachmentValidationErrorEvent)` callback used for MIME-type rejections, debounced the same way (default `100`ms). The event's `reason` SHALL be a new `AttachmentValidationErrorReason.FileTooLarge` member, and the event SHALL carry `maxFileSizeBytes` (echoing the caller-provided limit) instead of `allowedMimeTypes`/`formats` for this reason. This is a translation-free, structured event — the hook SHALL NOT call `useTranslation`/`useNotification` itself.

`AttachmentValidationErrorReason` (`libs/chat-hooks/src/attachment/useAttachmentValidation/useAttachmentValidation.ts`) SHALL gain a `FileTooLarge = 'fileTooLarge'` member alongside the existing `NoTypesAllowed` and `UnsupportedType`.

#### Scenario: Size-rejection callback fires once per debounce window
- **WHEN** three oversized files are validated within the debounce window
- **THEN** `onValidationError` is called exactly once, with `reason: AttachmentValidationErrorReason.FileTooLarge`

#### Scenario: Size-rejection event carries the limit, not MIME facts
- **WHEN** an oversized file is validated and `onValidationError` fires
- **THEN** the event's `reason` is `AttachmentValidationErrorReason.FileTooLarge` and its `maxFileSizeBytes` field matches the `maxFileSizeBytes` parameter passed to the hook

#### Scenario: No callback provided
- **WHEN** `onValidationError` is omitted and an oversized file is validated
- **THEN** `validateAttachment` still returns `AttachmentErrorReason.FileTooLarge` and no error is thrown
