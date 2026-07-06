## Context

Three fixes arising from designer review on GitHub issue #7563 (comment 2026-07-03).

### Current state

**Table toolbar buttons (`Table.tsx`)**  
Copy buttons (CSV / TXT / MD) use a local `CopyIcon` component that renders raw Tabler icon elements with manual `className` styling. The Download button already uses `DialButton` from `@epam/ai-dial-ui-kit`. Result: mixed visual treatment.

**Table CSV filename** (`Table.tsx` `getDefaultFilename`, line 84-87)  
```
table_2026-07-03.csv   ← label before date
```

**Chat/prompt export filenames** (`import-export.ts` `getCurrentDate`, lines 157-163)  
```typescript
const month = date.getMonth() + 1;  // no zero-padding
const day = date.getDate();          // no zero-padding
return `${year}-${month}-${day}`;    // → "2026-7-3"
```
All downstream filenames (`triggerDownloadConversation`, `triggerDownloadConversationsHistory`, `triggerDownloadPromptsHistory`, `triggerDownloadPrompt`) inherit the un-padded date.

---

## Goals / Non-Goals

**Goals**
- Unify all 4 table toolbar buttons to use `DialButton` from `@epam/ai-dial-ui-kit`.
- Rename table CSV default filename to `YYYY-MM-DD_table.csv`.
- Zero-pad month and day in `getCurrentDate()` so all exports use ISO-format dates.

**Non-Goals**
- Changing copy button behaviour (checkmark feedback stays).
- Changing the downstream filename template structure beyond the date padding.
- Adding any new UI or store logic.

---

## Decisions

### 1. Migrate all toolbar buttons to `DialGhostIconButton`

**Chosen**: Replace both the `CopyIcon` local component and the existing `DialButton` download button with `DialGhostIconButton` from `@epam/ai-dial-ui-kit` with `size={ElementSize.Small}`, using its built-in `tooltipProps` for the tooltip (no outer `<Tooltip>` wrapper needed).

**Why**: `DialGhostIconButton` is the correct ghost-style icon button primitive used in toolbar contexts across the codebase, and it accepts `tooltipProps` directly — no wrapper required.

**Before** (copy buttons):
```tsx
<Tooltip placement="top" tooltip={t(MarkdownI18nKeys.CopyAsCSV, { ns: Translation.Markdown })}>
  <CopyIcon Icon={IconCsv} onClick={copyTableToCSV} copied={CopyTableType.CSV === copiedType} type={CopyTableType.CSV} />
</Tooltip>
```

**Before** (download button):
```tsx
<DialButton className="flex max-h-[24px] items-center !px-0 text-secondary hover:text-accent-primary" ... />
```

**After** (all four buttons, same shape):
```tsx
<DialGhostIconButton
  size={ElementSize.Small}
  data-qa="copy-csv-icon"
  tooltipProps={{ placement: 'top', isTriggerClickable: true, tooltip: t(MarkdownI18nKeys.CopyAsCSV, { ns: Translation.Markdown }) }}
  onClick={() => { if (CopyTableType.CSV !== copiedType) copyTableToCSV(); }}
  icon={CopyTableType.CSV === copiedType
    ? <IconCheck size={DEFAULT_ICON_SIZES.SMALL} />
    : <IconCsv stroke={1.5} size={DEFAULT_ICON_SIZES.SMALL} />}
/>
```

Imports to add: `DialGhostIconButton`, `ElementSize` from `@epam/ai-dial-ui-kit`.  
Imports to remove: `DialButton`, `Tooltip` (both replaced by `DialGhostIconButton` with `tooltipProps`).

### 2. Rename table CSV filename

**Chosen**: Change `getDefaultFilename()`:
```typescript
// before
return `table_${date}.csv`;
// after
return `${date}_table.csv`;
```

**Why**: Aligns with all other export filenames which put the date first, making downloads sort correctly by name in file browsers.

### 3. Zero-pad `getCurrentDate()`

**Chosen**: Use `String(…).padStart(2, '0')` for month and day:
```typescript
export function getCurrentDate() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${year}-${month}-${day}`;
}
```

**Why**: Minimal, isolated change. All callers (`triggerDownloadConversation`, `triggerDownloadConversationsHistory`, `triggerDownloadPromptsHistory`, `triggerDownloadPrompt`) automatically get correct filenames with no other edits.
