# attachment-file-too-large-error Specification

## Purpose

Specifies the validation and error notification flow when a user attaches a file whose size exceeds the configured maximum attachment size.

## Requirements

### Requirement: Validate file size against a configurable maximum before upload

Before calling `onUploadAttachment`, the app SHALL validate each attachment's file size against a configurable maximum, mirroring the existing MIME-type validation flow (`attachment-unsupported-type-error`). Validation uses the `maxFileSizeBytes` parameter on the shared `useAttachmentValidation` hook (`chat-hooks-attachment-validation`), sourced by the app from `useAppConfig().config.maxAttachmentFileSizeBytes`. The hook classifies an oversized attachment as `AttachmentErrorReason.FileTooLarge` and reports the rejection through the existing `onValidationError({ reason, ... })` callback, so each surface (chat input, drag-and-drop, paste) decides only how to present it.

A file is oversized when its byte size (`File.size` for a freshly-picked local file) strictly exceeds `maxFileSizeBytes`. A file at exactly the limit is allowed. When `maxFileSizeBytes` is `undefined` (e.g. before `AppConfig` has loaded), no size restriction is applied — this mirrors the existing "no restriction when absent" behavior of `maxSelectableFileSize` in `dial-file-manager-attach-validation`.

Invalid files SHALL be placed immediately into `status: RequestStatus.Error` with `errorReason: AttachmentErrorReason.FileTooLarge` without calling `onUploadAttachment`. The MIME-type check runs first and short-circuits: a file whose MIME type is already unsupported is classified as `AttachmentErrorReason.UnsupportedType` and the size check never runs for it (see `chat-hooks-attachment-validation`'s "MIME-type rejection takes precedence over size rejection"). The size check applies only to files that already passed the MIME-type check.

After processing a batch of added files (from file picker, drag-and-drop, or clipboard), if any were rejected for being too large the app SHALL show exactly one error notification through the variant-specific `showErrorNotification` helper, with:

- **title**: i18n key `attachments.fileTooLarge.title` → "File too large"
- **message**: i18n key `attachments.fileTooLarge.message` → "Max file size is {{maxSize}}. Please upload a smaller file.", where `{{maxSize}}` is a human-readable size (e.g. "512 MB"). Matching the existing `unsupportedType.message` precedent, this is a generic statement of the constraint, not a list of the specific rejected file names — the hook's `onValidationError` event does not carry per-file names, only the aggregate `maxFileSizeBytes` limit.

When a batch contains files rejected for unsupported type and other files rejected for size, the app SHALL show one notification per distinct reason (matching the existing precedent of a dedicated notification per validation failure category), not a single combined message. A single file is never rejected for both reasons at once, per the precedence rule above.

**i18n keys:**

- `attachments.fileTooLarge.title`
- `attachments.fileTooLarge.message` (supports `{{maxSize}}` interpolation)

**Feature flag**: none.

**RTL**: notification is direction-agnostic (top-center portal). No additional directional changes.

**Accessibility**: `Notification` carries `role="alert"`; no additional ARIA required.

**Memoisation**: `validateAttachment`'s identity changes when either `allowedMimeTypes` or `maxFileSizeBytes` changes; unchanged otherwise, per the existing content-stability rule in `chat-hooks-attachment-validation`.

#### Scenario: File exceeding the configured maximum is rejected

- **WHEN** the user picks a file whose size is `600_000_000` bytes and `maxAttachmentFileSizeBytes` is `536_870_912`
- **THEN** the file's card appears immediately with `status: RequestStatus.Error` and `errorReason: AttachmentErrorReason.FileTooLarge`
- **AND** no upload request is made
- **AND** a "File too large" notification appears stating the 512 MB limit

#### Scenario: File at exactly the limit is accepted

- **WHEN** the user picks a file whose size exactly equals `maxAttachmentFileSizeBytes`
- **THEN** the file passes size validation and, if it also passes MIME-type validation, `onUploadAttachment` is called normally

#### Scenario: Mix of oversized and valid files added simultaneously

- **WHEN** the user drops two files: `huge.mp4` (over the limit) and `report.pdf` (within the limit and an allowed type)
- **THEN** `report.pdf` proceeds through the upload flow normally
- **AND** `huge.mp4` enters error state with `errorReason: AttachmentErrorReason.FileTooLarge`
- **AND** exactly one "File too large" notification appears

#### Scenario: No restriction when the limit is not yet known

- **WHEN** `maxFileSizeBytes` is `undefined` because `AppConfig` has not finished loading
- **THEN** no file is rejected for size, regardless of how large it is

#### Scenario: Retry button is hidden for file-too-large error cards

- **WHEN** a card has `errorReason: AttachmentErrorReason.FileTooLarge`
- **THEN** the retry button is NOT rendered on that card (the remove button remains) — retrying cannot make an oversized file smaller

#### Scenario: A file that is both an unsupported type and oversized is reported only as unsupported-type

- **WHEN** a single file is both an unsupported MIME type and over the size limit
- **THEN** only a "File extension not supported" notification appears for it — the MIME-type check runs first and short-circuits, so the size check never runs for that file (see `chat-hooks-attachment-validation`'s "MIME-type rejection takes precedence over size rejection")
