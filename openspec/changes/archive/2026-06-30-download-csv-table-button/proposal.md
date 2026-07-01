## Why

When a model returns a table in chat, users who want to work with the data in a spreadsheet must manually copy the table text and paste it into a tool — a fragile, error-prone workflow, especially for large or complex tables. A one-click CSV download eliminates those steps and delivers a properly-formatted file directly to the user's filesystem.

## What Changes

- A fourth icon button ("Download as CSV") is added to the existing table toolbar in `apps/chat/src/components/Markdown/Table.tsx`, alongside the existing Copy as CSV / TXT / MD buttons.
- Clicking the button opens a filename dialog (prefilled `table_YYYY-MM-DD.csv`) before triggering the download.
- The downloaded file is UTF-8 with BOM so Excel opens it correctly without encoding configuration.
- New i18n keys are added to `MarkdownI18nKeys` and `apps/chat/public/locales/en/markdown.json`.

## Capabilities

### New Capabilities

- `download-table-as-csv`: Users can download any rendered markdown table as a `.csv` file directly from the chat UI via a toolbar button.

### Modified Capabilities

<!-- No existing spec-level requirements change. -->

## Impact

- **Component**: `apps/chat/src/components/Markdown/Table.tsx` — new button, modal state, download function.
- **New component**: `apps/chat/src/components/Markdown/DownloadTableCsvModal.tsx` — filename input dialog.
- **Constants**: `apps/chat/src/constants/i18n.ts` — three new `MarkdownI18nKeys` entries.
- **Translations**: `apps/chat/public/locales/en/markdown.json` — three new keys.
- **No store changes** — purely a UI/utility feature.
- **No API changes**.
- **No feature flag** — always visible, low risk.
- **Non-goals**: Not changing existing copy buttons. Not supporting other download formats. Not adding bulk-export of all tables in a message.
