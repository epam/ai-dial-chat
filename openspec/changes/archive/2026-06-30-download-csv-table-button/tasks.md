## 1. Add i18n keys

- [x] 1.1 In `apps/chat/src/constants/i18n.ts`, add three new entries to the `MarkdownI18nKeys` enum:
  - `DownloadAsCSV = 'Download as CSV'`
  - `DownloadTableAsCSV = 'Download table as CSV'`
  - `FileName = 'File name'`
- [x] 1.2 In `apps/chat/public/locales/en/markdown.json`, add the matching translation strings:
  - `"Download as CSV": "Download as CSV"`
  - `"Download table as CSV": "Download table as CSV"`
  - `"File name": "File name"`

## 2. Create DownloadTableCsvModal component

- [x] 2.1 Create `apps/chat/src/components/Markdown/DownloadTableCsvModal.tsx` with:
  - Props: `isOpen: boolean`, `defaultFilename: string`, `onConfirm: (filename: string) => void`, `onClose: () => void`
  - Local `useState<string>` for the current filename value, synced to `defaultFilename` on open via `useEffect`
  - `Modal` (from `@/src/components/Common/Modal`) as the container with `portalId="theme-main"` and `state` driven by `isOpen`
  - Heading text: `t(MarkdownI18nKeys.DownloadTableAsCSV)`
  - `DialInput` (from `@epam/ai-dial-ui-kit`) with label `t(MarkdownI18nKeys.FileName)`, bound to the filename state
  - `DialPrimaryButton` labelled `t(I18nKey.Download)` (or `"Download"` inline) calling `onConfirm(filename)` then `onClose()`
  - `DialNeutralButton` labelled `t(I18nKey.Cancel)` calling `onClose()`
  - `data-qa="download-csv-modal"` on the Modal

## 3. Update Table component

- [x] 3.1 In `apps/chat/src/components/Markdown/Table.tsx`, extract the CSV row-building logic from `copyTableToCSV` into a module-level helper `buildCsvString(tableRef)` returning `string`
- [x] 3.2 Refactor `copyTableToCSV` to call `buildCsvString` instead of the inline loop (no behavior change)
- [x] 3.3 Add `useState<boolean>` for `isDownloadModalOpen` (default `false`) and a `getDefaultFilename()` helper that returns `table_YYYY-MM-DD.csv` using the current date
- [x] 3.4 Add `downloadTableAsCSV(filename: string)` callback: prepend BOM (`'﻿'`), create `Blob` with `type: 'text/csv;charset=utf-8;'`, call `URL.createObjectURL`, then `triggerDownload(url, filename)` from `@/src/utils/app/file`
- [x] 3.5 Import `Download` icon from `@/public/images/icons/download.svg` and `DownloadTableCsvModal`
- [x] 3.6 Add the fourth toolbar button after the "Copy as MD" button:
  - Same structure as existing copy buttons but using `Download` icon (no `CopyIcon` checkmark)
  - `onClick` sets `isDownloadModalOpen(true)`
  - Tooltip: `t(MarkdownI18nKeys.DownloadAsCSV)`
  - `data-qa="download-csv"`
- [x] 3.7 Render `<DownloadTableCsvModal>` at the bottom of the component's JSX with `isOpen={isDownloadModalOpen}`, `defaultFilename={getDefaultFilename()}`, `onConfirm={downloadTableAsCSV}`, `onClose={() => setIsDownloadModalOpen(false)}`

## 4. Verify and Test

- [x] 4.1 Start the dev server (`npm run nx serve chat`) and confirm the Download CSV button appears in the table toolbar (not during streaming)
- [x] 4.2 Click the button — confirm the modal opens prefilled with today's date in `table_YYYY-MM-DD.csv` format
- [x] 4.3 Confirm — verify the file downloads and opens correctly in Excel (check BOM, check quoting of cells with commas/quotes/accented characters)
- [x] 4.4 Cancel — verify no download occurs and the modal closes cleanly
- [x] 4.5 Run `npm run lint:fix && npm run format:fix`
- [x] 4.6 Run `npm run affected:test` to ensure no unit test regressions
