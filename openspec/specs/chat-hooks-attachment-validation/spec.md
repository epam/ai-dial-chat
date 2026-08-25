# chat-hooks-attachment-validation Specification

## Purpose

Reusable attachment MIME-type validation hook exported by `@epam/ai-dial-chat-hooks`: caller-resolved allowed-types validation with structured, translation-free error reporting.

## Requirements

### Requirement: Resolved-MIME-type validation
`@epam/ai-dial-chat-hooks` SHALL export a `useAttachmentValidation` hook
that accepts a caller-resolved `allowedMimeTypes: string[]` (never a full
app-owned deployment object) and returns `inputAttachmentTypes`,
`isAttachmentsAllowed`, `fileAccept`, and a `validateAttachment` function
that classifies a given `Attachment` as allowed or rejected against
exactly those types.

#### Scenario: No types allowed
- **WHEN** `allowedMimeTypes` is an empty array and `validateAttachment` is
  called with any attachment
- **THEN** the hook returns `AttachmentErrorReason.UnsupportedType` for that
  attachment and `isAttachmentsAllowed` is `false`

#### Scenario: Supported file passes
- **WHEN** `allowedMimeTypes` includes the attachment's `contentType`
- **THEN** `validateAttachment` returns `undefined` for that attachment

#### Scenario: Unsupported file is rejected
- **WHEN** `allowedMimeTypes` is non-empty and does not include the
  attachment's `contentType`
- **THEN** `validateAttachment` returns `AttachmentErrorReason.UnsupportedType`

### Requirement: Structured, translation-free validation-error reporting
The hook SHALL report a rejected attachment through an optional
`onValidationError(event: AttachmentValidationErrorEvent)` callback instead
of calling `useTranslation`/`useNotification` itself. The event SHALL carry
a library-owned `AttachmentValidationErrorReason` and interpolation-ready
facts (`allowedMimeTypes`, an already-formatted `formats` string), never
translated text.

#### Scenario: Callback fires once per debounce window
- **WHEN** three unsupported files are validated within the debounce
  window (default `100`ms)
- **THEN** `onValidationError` is called exactly once, with the reason from
  the most recent rejection

#### Scenario: Reason distinguishes no-types-allowed from unsupported-type
- **WHEN** `allowedMimeTypes` is empty vs. non-empty but non-matching
- **THEN** the emitted event's `reason` is
  `AttachmentValidationErrorReason.NoTypesAllowed` in the first case and
  `AttachmentValidationErrorReason.UnsupportedType` in the second

#### Scenario: No callback provided
- **WHEN** `onValidationError` is omitted and an unsupported file is
  validated
- **THEN** `validateAttachment` still returns
  `AttachmentErrorReason.UnsupportedType` and no error is thrown

### Requirement: Debounce timer cleanup on unmount
The hook SHALL clear its pending debounce timer when the component using
it unmounts, so no `onValidationError` call fires after unmount.

#### Scenario: Unmount cancels a pending validation-error report
- **WHEN** an unsupported file is validated and the component unmounts
  before the debounce window elapses
- **THEN** `onValidationError` is never called for that rejection
