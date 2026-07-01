## Context

`Table` (`apps/chat/src/components/Markdown/Table.tsx`) renders all markdown tables in chat messages. It already has a toolbar (lines 261–307) with three icon buttons — Copy as CSV, Copy as TXT, Copy as MD — hidden while the last message is streaming. The CSV copy function (`copyTableToCSV`, lines 241–257) extracts cell text from the DOM using `tableRef` and formats it as RFC 4180 CSV.

`triggerDownload(url, name)` in `apps/chat/src/utils/app/file.ts` (lines 56–65) handles the actual file download via a temporary `<a>` element.

Current toolbar layout (simplified):
```
div.toolbar  [flex, justify-end, rounded-t border]
  button[Copy CSV]
  button[Copy TXT]
  button[Copy MD]
```

Target layout:
```
div.toolbar  [flex, justify-end, rounded-t border]
  button[Copy CSV]
  button[Copy TXT]
  button[Copy MD]
  button[Download CSV]   ← new
```

When Download CSV is clicked → filename modal opens → user confirms → file downloaded.

## Goals / Non-Goals

**Goals:**
- Download the table as a UTF-8 BOM CSV using the same cell-extraction logic as the copy action.
- Prompt the user for a filename before downloading (prefilled `table_YYYY-MM-DD.csv`).
- Reuse existing icons, modal primitives, and download utilities.

**Non-Goals:**
- Changing existing copy buttons.
- Supporting additional download formats (TXT, MD) from this button.
- Feature-flagging (always visible).
- Bulk export of all tables in a message.

## Decisions

### 1. Fourth button in existing toolbar row

**Chosen**: Add a fourth `<button>` directly after the "Copy as MD" button inside the existing toolbar `div`.

**Why**: The toolbar is already the established home for table actions. Adding a fourth button is the minimal, consistent change. A separate row or dropdown would complicate layout without adding value.

### 2. Download icon, no checkmark feedback

**Chosen**: Use `@/public/images/icons/download.svg` (already imported in `CodeBlock.tsx`) with a plain `onClick` handler.

**Why**: Download completes instantly with OS feedback (browser download bar). The checkmark-animation pattern used by `CopyIcon` signals "copied to clipboard" — a different affordance that would mislead here.

### 3. Filename modal using `Modal` + `DialInput`

**Chosen**: New `DownloadTableCsvModal` component composing `Modal` from `@/src/components/Common/Modal`, `DialInput` from `@epam/ai-dial-ui-kit`, `DialPrimaryButton`, and `DialNeutralButton`.

**Why**: The existing `ConfirmDialog` has no input slot. Rather than forking it, a small dedicated component keeps the modal logic self-contained and follows the same `Modal` primitive pattern used everywhere in the codebase.

**Modal props interface:**
```typescript
interface DownloadTableCsvModalProps {
  isOpen: boolean;
  defaultFilename: string;
  onConfirm: (filename: string) => void;
  onClose: () => void;
}
```

**Filename reset**: `defaultFilename` is passed on each open (computed at click time in `Table.tsx`), so the input always resets to the current date's value.

### 4. UTF-8 BOM prefix

**Chosen**: Prepend `'﻿'` to the CSV string before creating the `Blob`.

**Why**: Excel on Windows interprets UTF-8 CSV files as the system codepage (typically Windows-1252) unless a BOM is present. Without it, non-ASCII characters in table cells display as garbage. The clipboard copy path does not need this because applications handle clipboard encoding independently.

### 5. CSV generation reuses `copyTableToCSV` logic

**Chosen**: Extract the cell-extraction loop into a shared helper `buildCsvString(tableRef)` returning `string`, used by both `copyTableToCSV` and the new `downloadTableAsCSV`.

**Why**: Avoids duplicating the quoting and escaping logic. A single source of truth ensures copy and download produce identical CSV content.

**Helper signature:**
```typescript
function buildCsvString(tableRef: React.RefObject<HTMLTableElement | null>): string
```

## Implementation Sketch

```typescript
// In Table.tsx

const buildCsvString = (tableRef: RefObject<HTMLTableElement | null>): string => {
  const table = tableRef.current;
  if (!table) return '';
  const rows = Array.from(table.rows);
  return rows
    .map((row) =>
      Array.from(row.cells)
        .map((cell) =>
          cell.textContent?.trim()
            ? `"${cell.textContent.trim().replace(/"/g, '""')}"`
            : '',
        )
        .join(','),
    )
    .join('\n');
};

// Download handler
const downloadTableAsCSV = useCallback(
  (filename: string) => {
    const csv = '﻿' + buildCsvString(tableRef);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, filename);
  },
  [tableRef],
);
```

## Risks / Trade-offs

- **BOM breaks some non-Excel parsers** → Acceptable trade-off; Excel is the primary target, and most modern CSV parsers handle BOM gracefully.
- **Modal adds a render cost** → Negligible; `isOpen` is `false` by default and the `Modal` component already handles portal/unmount.
- **Filename sanitization** → Users can type any string; the browser's download mechanism handles illegal filename characters per OS. No extra sanitization needed for MVP.
