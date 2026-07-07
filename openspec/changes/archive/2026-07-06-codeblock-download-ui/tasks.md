## 1. Fix Download Icon in CodeBlock

- [x] 1.1 In `@/src/components/Markdown/CodeBlock.tsx`, remove the `import Download from '@/public/images/icons/download.svg'` line
- [x] 1.2 Add `IconDownload` to the `@tabler/icons-react` import in `CodeBlock.tsx`
- [x] 1.3 Replace `<Download width={...} height={...} />` with `<IconDownload size={DEFAULT_ICON_SIZES.SMALL} stroke={1.5} />` in the download button

## 2. Create `ChangeDownloadFileNameModal` and replace window.prompt

- [x] 2.1 Rename `DownloadTableCsvModal` to `ChangeDownloadFileNameModal` — create `@/src/components/Markdown/ChangeDownloadFileNameModal.tsx` with added `heading` (required) and `dataQa` (optional) props; delete old `DownloadTableCsvModal.tsx`
- [x] 2.2 Add `DownloadCodeBlock` key to `MarkdownI18nKeys` in `@/src/constants/i18n.ts`
- [x] 2.3 Add `getDefaultExportFileName(fileName: string): string` to `@/src/utils/app/import-export` — returns `YYYY-MM-DD_${fileName}` using ISO date slice; remove the local `getDefaultFilename` from `Table.tsx` and replace with `getDefaultExportFileName('table.csv')`
- [x] 2.4 Update `Table.tsx` to import and use `ChangeDownloadFileNameModal`, passing `heading={t(MarkdownI18nKeys.DownloadTableAsCSV)}` and `dataQa="download-csv-modal"`
- [x] 2.5 Add `isDownloadModalOpen` local state (`useState(false)`) to `CodeBlock.tsx`
- [x] 2.6 Update the download button `onClick` handler to call `setIsDownloadModalOpen(true)`
- [x] 2.7 Add `handleDownloadConfirm(filename: string)` callback using `triggerDownload` from `@/src/utils/app/file`
- [x] 2.8 Compute `suggestedFileName` outside the callback: `languageFilenameMapping[displayLanguage] ?? getDefaultExportFileName(\`ai-chat-code${fileExtension}\`)` (import from `@/src/utils/app/import-export`)
- [x] 2.9 Render `<ChangeDownloadFileNameModal>` at the bottom of `CodeBlock`'s JSX, passing `isOpen`, `defaultFilename={suggestedFileName}`, `heading={t(MarkdownI18nKeys.DownloadCodeBlock)}`, `onConfirm`, `onClose`, and `dataQa="download-codeblock-modal"`

## 3. Verify & Clean Up

- [x] 3.1 Run `npm run nx lint chat` and `npm run format:fix` — fix any issues
- [x] 3.2 Manually verify in browser: code block download button shows correct icon, click opens modal with pre-filled filename, confirm downloads file, cancel closes modal without download
