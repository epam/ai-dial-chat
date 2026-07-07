## Context

`CodeBlock` (`apps/chat/src/components/Markdown/CodeBlock.tsx`) renders syntax-highlighted code inside chat messages. It has a toolbar with Copy and Download buttons. The Download button currently:

1. Uses a custom SVG (`/public/images/icons/download.svg`) — visually inconsistent with `IconDownload` used in the MD table.
2. Calls `window.prompt()` to ask for a filename — a native OS dialog that bypasses the app's design system and cannot be styled.

`DownloadTableCsvModal` (`apps/chat/src/components/Markdown/DownloadTableCsvModal.tsx`) already implements the desired UX: a small in-app modal with a pre-filled filename input and Confirm/Cancel buttons. It accepts `isOpen`, `defaultFilename`, `onConfirm`, and `onClose` props. However, its name and heading are CSV/table-specific, making it unsuitable for reuse as-is.

## Goals / Non-Goals

**Goals:**

- Replace the custom SVG download icon in `CodeBlock` with `IconDownload` from `@tabler/icons-react`.
- Replace `window.prompt()` with an in-app modal dialog for filename input.
- Rename `DownloadTableCsvModal` to a general-purpose `DownloadFileModal` with a context-appropriate heading.
- Add a `dataQa` prop to `DownloadFileModal` so E2E tests can target modal instances independently.
- Keep the existing filename suggestion logic (`languageFilenameMapping`, `languageExtensionMapping`); use the shared `getDefaultExportFileName` util for the fallback filename.

**Non-Goals:**

- Changing the download file format or adding format options.
- Any store, epic, or API route changes.

## Decisions

### 1. Rename `DownloadTableCsvModal` → `DownloadFileModal` and add `heading` + `dataQa` props

**Decision**: Rename `DownloadTableCsvModal` to `DownloadFileModal` and update its props interface:

- Add a required `heading` prop (`string`) — callers supply the context-appropriate title.
  - Table callers pass the existing `MarkdownI18nKeys.DownloadTableAsCSV` translation.
  - Code block callers pass a new `MarkdownI18nKeys.DownloadCodeBlock` translation key (e.g. "Download code block").
- Add an optional `dataQa` prop (`string`) — passed through to the modal's root element so E2E tests can target each usage independently (e.g. `"download-csv-modal"` for table, `"download-codeblock-modal"` for code block).
- The `data-qa="download-csv-modal"` hardcoded in the current component is replaced by this prop; the `Table` caller passes `"download-csv-modal"` to preserve existing E2E selectors.

**Alternative considered**: Reuse `DownloadTableCsvModal` as-is without changes. Rejected — the heading "Download table as CSV" is wrong for code blocks and `dataQa` cannot be distinguished per caller.

### 2. Modal state location

**Decision**: Add `isDownloadModalOpen` local state inside `CodeBlock` (mirroring the `Table` component pattern). No Redux store involvement needed — download is a transient UI state local to the component instance.

### 3. Icon replacement

**Decision**: Replace `import Download from '@/public/images/icons/download.svg'` with `import { IconDownload } from '@tabler/icons-react'` and render `<IconDownload size={DEFAULT_ICON_SIZES.SMALL} stroke={1.5} />` — matching the Table component exactly.

## Risks / Trade-offs

- **`Table` caller must be updated**: Renaming the component and adding `heading` / `dataQa` as required props means `Table.tsx` must also be updated in the same PR. Low risk — single import and usage site.
  → Mitigation: Include `Table.tsx` update in the implementation tasks; it is a one-line prop addition each.
