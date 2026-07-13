# attachment-unsupported-type-error Specification

## Purpose

Specifies the validation and error notification flow when a user attaches a file whose MIME type is not accepted by the selected deployment.

## Requirements

### Requirement: Validate file MIME type against deployment inputAttachmentTypes before upload

Before calling `onUploadAttachment`, the app SHALL validate each attachment's MIME type against the selected deployment's `inputAttachmentTypes`. Validation uses the `validateAttachment` prop on `ConversationInput` / `Input`, which the app supplies.

A file is invalid when none of the allowed MIME entries match: exact equality (`application/pdf`) OR wildcard prefix match (`image/*` matches `image/jpeg`). Global wildcards `*` and `*/*` match any MIME type. When `inputAttachmentTypes` is empty or undefined, the attachment button is already hidden and this path is unreachable.

Invalid files SHALL be placed immediately into `status: RequestStatus.Error` with `errorReason: AttachmentErrorReason.UnsupportedType` without calling `onUploadAttachment`.

After processing a batch of added files (from file picker, drag-and-drop, or clipboard), if any were invalid the app SHALL show exactly one `DialNotification` (variant `Error`) with:
- **title**: i18n key `attachments.unsupportedType.title` → "File extension not supported"
- **message**: i18n key `attachments.unsupportedType.message` → "This model can only process {{formats}}. Please upload a file in a supported format.", where `{{formats}}` is a comma-separated human-readable list of accepted types derived from `inputAttachmentTypes`.

The `formats` list is produced by a pure app-level utility `mimeTypesToExtensionLabels(types: string[]): string` that converts MIME entries to uppercase extension labels (e.g., `image/jpeg` → `JPEG`, `application/pdf` → `PDF`, `text/csv` → `CSV`; wildcard `image/*` → `Image files`).

**i18n keys added:**
- `attachments.unsupportedType.title`
- `attachments.unsupportedType.message` (supports `{{formats}}` interpolation)

**Feature flag**: none.

**RTL**: notification is direction-agnostic (top-center portal). No additional directional changes.

**Accessibility**: `DialNotification` carries `role="alert"`; no additional ARIA required.

**Memoisation**: `validateAttachment` callback on `ConversationView` / `ConversationRoute` SHALL be wrapped in `useCallback` keyed on `inputAttachmentTypes`. Because it is keyed on `inputAttachmentTypes`, its identity changes whenever the user switches the selected model/deployment; `useAttachments` uses that identity change as the trigger to re-validate attachments already in the tray (see `conversation-input-attachments` — "Attachments already in the tray are re-validated when validateAttachment changes").

#### Scenario: File with unsupported MIME type is added

- **WHEN** the user picks a `.docx` file and the deployment's `inputAttachmentTypes` is `['application/pdf', 'image/jpeg']`
- **THEN** the file's card appears immediately with `status: RequestStatus.Error` and `errorReason: AttachmentErrorReason.UnsupportedType`
- **AND** no upload request is made
- **AND** a "File extension not supported" notification appears, body mentioning "PDF, JPEG"

#### Scenario: Mix of valid and invalid files added simultaneously

- **WHEN** the user drops two files: `report.pdf` (valid) and `notes.docx` (invalid)
- **THEN** `report.pdf` proceeds through the upload flow normally
- **AND** `notes.docx` enters error state with `errorReason: AttachmentErrorReason.UnsupportedType`
- **AND** exactly one "File extension not supported" notification appears

#### Scenario: Wildcard MIME entry accepts matching file

- **WHEN** the deployment's `inputAttachmentTypes` is `['image/*']` and the user picks `photo.png` (MIME `image/png`)
- **THEN** the file passes validation and `onUploadAttachment` is called normally

#### Scenario: Global wildcard accepts any file

- **WHEN** the deployment's `inputAttachmentTypes` is `['*']` or `['*/*']`
- **THEN** any file passes validation and `onUploadAttachment` is called normally

#### Scenario: Retry button is hidden for unsupported-type error cards

- **WHEN** a card has `errorReason: AttachmentErrorReason.UnsupportedType`
- **THEN** the retry button is NOT rendered on that card (the remove button remains)

#### Scenario: Multiple invalid files produce one notification

- **WHEN** the user picks three unsupported files in one selection
- **THEN** exactly one "File extension not supported" notification appears
- **AND** the notification body lists all accepted formats (not the rejected files)
