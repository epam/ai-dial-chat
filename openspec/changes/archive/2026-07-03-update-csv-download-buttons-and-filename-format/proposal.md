## Why

Following designer review (GitHub issue #7563, comment 2026-07-03), three polish items were identified for the CSV table download feature and existing export filename behaviour:

1. The table toolbar buttons (Copy CSV / TXT / MD) use raw Tabler icon elements while the new Download button uses `DialButton` from the UI-kit — the toolbar is visually inconsistent.
2. The table CSV download filename puts the label before the date (`table_2026-07-03.csv`) while all other chat exports put the date first (`2026-07-03_…`).
3. All existing chat/prompt exports use an un-padded date string (`2026-7-3_…`) instead of the ISO-padded form (`2026-07-03_…`), making filenames sort incorrectly.

## What Changes

- All four icon buttons in the table toolbar (`Table.tsx`) are migrated to `DialButton` from `@epam/ai-dial-ui-kit` for visual consistency with the designer spec.
- `getDefaultFilename()` in `Table.tsx` is updated: `table_${date}.csv` → `${date}_table.csv`.
- `getCurrentDate()` in `apps/chat/src/utils/app/import-export.ts` is updated to zero-pad month and day so all export filenames use ISO-format dates.

## Capabilities

### Modified Capabilities

- `download-table-as-csv`: filename format changed to `YYYY-MM-DD_table.csv`.
- `export-conversation`: export filename date portion is now zero-padded (`YYYY-MM-DD`).
- `export-prompt`: export filename date portion is now zero-padded (`YYYY-MM-DD`).

## Impact

- **Component**: `apps/chat/src/components/Markdown/Table.tsx` — button migration + filename fix.
- **Utility**: `apps/chat/src/utils/app/import-export.ts` — `getCurrentDate()` zero-padding.
- **No store changes**, **no API changes**, **no new i18n keys**, **no feature flags**.
