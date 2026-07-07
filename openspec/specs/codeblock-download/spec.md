# Spec: Code Block Download

## Purpose

Defines the download behaviour for code blocks rendered inside chat messages — icon appearance, filename dialog UX, and default filename format.

## Requirements

### Requirement: Code block download button uses standard icon
The code block toolbar download button SHALL use the `IconDownload` icon from `@tabler/icons-react`, consistent with the MD table download button.

#### Scenario: Download icon is visible in code block toolbar
- **WHEN** a non-streaming code block is rendered
- **THEN** the download button SHALL display the `IconDownload` tabler icon (not a custom SVG)

### Requirement: Code block download opens in-app filename dialog
When the user clicks the download button in a code block, the system SHALL open an in-app modal dialog (`ChangeDownloadFileNameModal`) for filename input instead of a native browser prompt.

#### Scenario: Download button click opens modal
- **WHEN** the user clicks the download button in a code block toolbar
- **THEN** an in-app modal SHALL appear with a pre-filled filename input and heading "Download code block"

#### Scenario: Modal pre-fills suggested filename
- **WHEN** the download modal opens
- **THEN** the filename input SHALL be pre-filled with the language-specific suggested filename derived from `languageFilenameMapping` / `languageExtensionMapping`, or `YYYY-MM-DD_ai-chat-code<ext>` when no mapping exists

#### Scenario: Default filename begins with date prefix
- **WHEN** no language-specific filename mapping exists for the code block's language
- **THEN** the default suggested filename SHALL begin with `YYYY-MM-DD_` (e.g. `2026-07-06_ai-chat-code.txt`)

#### Scenario: Confirm triggers file download
- **WHEN** the user confirms the filename in the modal
- **THEN** the system SHALL download a file with the confirmed filename and the code block content

#### Scenario: Cancel closes modal without download
- **WHEN** the user cancels the modal
- **THEN** the modal SHALL close and no file download SHALL occur
