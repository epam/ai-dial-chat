## 1. Fix `getCurrentDate()` zero-padding

- [x] 1.1 In `apps/chat/src/utils/app/import-export.ts` lines 157-163, update `getCurrentDate()`:
  ```typescript
  export function getCurrentDate() {
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
  }
  ```

## 2. Fix table CSV default filename

- [x] 2.1 In `apps/chat/src/components/Markdown/Table.tsx` `getDefaultFilename()` (lines 84-87), change:
  ```typescript
  return `table_${date}.csv`;
  ```
  to:
  ```typescript
  return `${date}_table.csv`;
  ```

## 3. Migrate table toolbar buttons to `DialPrimaryIconButton`

- [x] 3.1 In `Table.tsx`, remove the `CopyIcon` local component (lines 45-61), the `Tooltip` import (line 33), and the `DialButton` import (line 36).
- [x] 3.2 Add imports: `DialGhostIconButton`, `ElementSize` from `@epam/ai-dial-ui-kit`.
- [x] 3.3 Replace each of the three `<Tooltip> + <CopyIcon>` blocks with `<DialGhostIconButton>`:
  - `size={ElementSize.Small}`
  - `data-qa` matching the old icon's `data-qa` attribute (e.g. `"copy-csv-icon"`)
  - `tooltipProps` with `placement: 'top'`, `isTriggerClickable: true`, `tooltip` (no `contentClassName`)
  - `onClick` guarded against re-click while `copiedType` matches (same logic as old `CopyIcon`)
  - `icon` switching between `IconCheck` and the type-specific icon based on `copiedType`
- [x] 3.4 Replace the existing `<DialButton>` download button with `<DialGhostIconButton>`:
  - `size={ElementSize.Small}`
  - `data-qa="download-csv"`, `aria-label` preserved
  - `tooltipProps` with `placement: 'top'`, `isTriggerClickable: true`, `tooltip` (no `contentClassName`)
  - `icon={<IconDownload size={DEFAULT_ICON_SIZES.SMALL} stroke={1.5} />}`
  - `onClick={() => setIsDownloadModalOpen(true)}`

## 4. Verify and Test

- [ ] 4.1 Export a conversation and confirm the filename is `2026-07-03_…` (zero-padded) for today's date.
- [ ] 4.2 Export a prompt and confirm the same zero-padded date format.
- [ ] 4.3 Click the Download CSV table button and confirm the prefilled filename is `2026-07-03_table.csv`.
- [ ] 4.4 Confirm all four table toolbar buttons render consistently as UI-kit buttons.
- [ ] 4.5 Confirm copy checkmark feedback still works for all three copy buttons.
- [x] 4.6 Run `npm run lint:fix && npm run format:fix`.
- [x] 4.7 Run `npm run affected:test` to ensure no unit test regressions.
