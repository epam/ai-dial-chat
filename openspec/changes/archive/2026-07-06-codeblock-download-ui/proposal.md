## Why

The Download button in code blocks uses an incorrect icon (custom SVG) and triggers a native browser `window.prompt()` dialog, while the MD table download button uses the standard `IconDownload` from tabler-icons and opens a polished in-app modal (`DownloadTableCsvModal`). The inconsistency degrades UX and violates the platform's UI patterns. Issue [#7589](https://github.com/epam/ai-dial-chat/issues/7589) (milestone 0.48).

## What Changes

- Replace the custom `Download` SVG import in `CodeBlock` with `IconDownload` from `@tabler/icons-react` (same icon used by the MD table toolbar).
- Replace the `window.prompt()` call in `downloadAsFile` with a React modal dialog (reusing or extending the existing `DownloadTableCsvModal` component).
- The modal pre-fills the suggested filename (same logic as current prompt) and lets the user confirm or cancel before downloading.

## Capabilities

### New Capabilities

- `codeblock-download`: Download action for code blocks — opens an in-app filename dialog (consistent with MD table download UX) and triggers a file download on confirmation.

### Modified Capabilities

<!-- No existing spec-level requirements are changing. -->

## Impact

- **Component**: `apps/chat/src/components/Markdown/CodeBlock.tsx` — icon and download handler changes.
- **Component** (reused): `apps/chat/src/components/Markdown/DownloadTableCsvModal.tsx` — may be reused as-is or lightly generalised to support a `heading` prop for code block context.
- **No new API routes** required; download is client-side only.
- **No store changes** required; no async side effects.
- **Non-goals**: Changing the file format, adding format selection, or modifying the CSV export pipeline for tables.
