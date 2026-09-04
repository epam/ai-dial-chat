# attachment-unsupported-type-error Specification

## Purpose

Specifies the validation and error notification flow when a user attaches a file whose MIME type is not accepted by the selected deployment.

## Requirements

### Requirement: Validate file MIME type against deployment inputAttachmentTypes before upload

Before calling `onUploadAttachment`, the app SHALL validate each attachment's MIME type against the selected deployment's `inputAttachmentTypes`. Validation uses the `validateAttachment` prop on `ConversationInput` / `Input`, which the app supplies from the shared `useAttachmentValidation` hook — the hook owns the matching rules, the accepted-format list, and the `fileAccept` string, and reports failures through a single `onValidationError({ reason, formats })` callback so each surface only decides how to present them.

A file is invalid when none of the allowed MIME entries match: exact equality (`application/pdf`) OR wildcard prefix match (`image/*` matches `image/jpeg`). Global wildcards `*` and `*/*` match any MIME type. When `inputAttachmentTypes` is empty or undefined, the attachment button is hidden; however, clipboard paste of images can still add attachments and will reach this validation path. Long pasted plain text is handled separately — see the `isAttachmentsEnabled` requirement in `conversation-input-attachments`.

**Which `inputAttachmentTypes` this is.** The name belongs to the BFF's own API
(`DeploymentItemDto`, `ModelDetailsDto`, `ApplicationDetailsDto`) and to everything
downstream of it, which is what this requirement describes. DIAL Core sends the same
field one layer up as **`input_attachment_types`**, and
`deployment-mapper.util.ts` renames it on the way through — see the field table in
`deployments-api`. Read the camelCase name from `/api/v1/deployments`, and the
snake_case one only from a raw Core payload. Asking Core for the camelCase name
returns `undefined` for every deployment, which reads as "this model accepts no
attachments" and is indistinguishable from a model that genuinely accepts none.

Invalid files SHALL be placed immediately into `status: RequestStatus.Error` with `errorReason: AttachmentErrorReason.UnsupportedType` without calling `onUploadAttachment`.

After processing a batch of added files (from file picker, drag-and-drop, or clipboard), if any were invalid the app SHALL show exactly one error notification through the variant-specific `showErrorNotification` helper, with:
- **title**: i18n key `attachments.unsupportedType.title` → "File extension not supported"
- **message**: i18n key `attachments.unsupportedType.message` → "This model can only process {{formats}}. Please upload a file in a supported format.", where `{{formats}}` is a comma-separated human-readable list of accepted types derived from `inputAttachmentTypes`.

When the failure reason is that the deployment accepts **no** attachment types at all, the pair `attachments.noAttachmentsAllowed.title` / `.message` ("Attachments not supported" / "This model does not support file attachments.") SHALL be used instead, with no `{{formats}}` interpolation — listing zero accepted formats would produce an empty sentence.

The `formats` list is produced by the pure `mimeTypesToExtensionLabels(types: string[], wildcardLabels?: Record<string, string>): string` utility exported from `@epam/ai-dial-attachment-input`. For a concrete MIME value, the utility normalizes case and ignores MIME parameters, resolves known values through `MIME_TYPE_EXT_MAP`, and renders the mapped extension in uppercase (e.g. `application/vnd.openxmlformats-officedocument.wordprocessingml.document` → `DOCX`, `application/pdf` → `PDF`, `text/csv` → `CSV`). The established `image/jpeg` → `JPEG` label is preserved; an unknown concrete MIME falls back to its uppercased subtype. A `<major>/*` wildcard is mapped through a label table (`image/*` → `Image files`, `audio/*` → `Audio files`, `video/*` → `Video files`, `text/*` → `Text files`, `*/*` → `All files`), falling back to `<major> files` for an unlisted major type. A host may override that wildcard table through the second argument.

**i18n keys:**
- `attachments.unsupportedType.title`
- `attachments.unsupportedType.message` (supports `{{formats}}` interpolation)
- `attachments.noAttachmentsAllowed.title`
- `attachments.noAttachmentsAllowed.message`

**Feature flag**: none.

**RTL**: notification is direction-agnostic (top-center portal). No additional directional changes.

**Accessibility**: `Notification` carries `role="alert"`; no additional ARIA required.

**Memoisation**: the `validateAttachment` callback returned by `useAttachmentValidation` SHALL be memoised on the allowed-MIME-type list, and that list is compared by content rather than by reference (see `chat-hooks-attachment-validation` — "Content-stable `allowedMimeTypes` and `validateAttachment`"). Its identity changes only when the user actually switches the selected model/deployment to one with a different set of accepted types; `useAttachments` uses that identity change as the trigger to re-validate attachments already in the tray (see `conversation-input-attachments` — "Attachments already in the tray are re-validated when validateAttachment changes").

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

#### Scenario: Structured MIME entry is readable in an error notification

- **WHEN** validation fails for a deployment whose `inputAttachmentTypes` contains `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- **THEN** the notification body lists `DOCX`, not the raw MIME subtype

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

#### Scenario: A deployment that accepts nothing gets its own message

- **WHEN** validation fails because the deployment's `inputAttachmentTypes` is empty
- **THEN** the "Attachments not supported" title and message are shown instead, with no `{{formats}}` list
