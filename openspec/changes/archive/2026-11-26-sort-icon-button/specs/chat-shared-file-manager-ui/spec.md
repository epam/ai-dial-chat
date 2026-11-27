## ADDED Requirements

### Requirement: The shell's sort control is an icon button with host labels

`DialFileManagerShellLabels` (`libs/chat-shared/src/file-manager/labels.ts`) SHALL gain one optional field, so no existing host breaks:

```ts
sort?: {
  label: string;
  fieldLabels: { name: string; updatedAt: string; size: string };
  directionLabels: { asc: string; desc: string };
};
```

`DialFileManagerShell` (`libs/chat-shared/src/file-manager/DialFileManagerShell/DialFileManagerShell.tsx`) SHALL pass `labels.sort` to `DialFileManager` as `sortOptions={{ label, fieldLabels, directionLabels }}`. The fields map onto `FileManagerSortField` and `FileManagerSortDirection`, and the mapping is memoised with `useMemo`. When `labels.sort` is omitted, the shell passes no `sortOptions` and the package defaults apply.

The workspace SHALL depend on the `@epam/ai-dial-react-file-manager` release whose non-compact sort trigger is a ghost icon-only `IconButton` with `IconArrowsSort` and a tooltip. It is named by `label`, shows no visible text, and keeps the field and direction groups with trailing checks. The compact view keeps its tinted round trigger.

`DialFileManagerPage` (`apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx`) and the attach modal (`apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`) SHALL fill `labels.sort` with `t()`:

- `label`: `ButtonsI18nKeys.Sort`;
- field and direction labels: `dialFileManager.sort.name`, `dialFileManager.sort.modifiedDate`, `dialFileManager.sort.size`, `dialFileManager.sort.ascending` and `dialFileManager.sort.descending`, with matching `DialFileManagerI18nKeys` members. No existing key in the file-manager namespace carries these exact strings; the "Name" keys elsewhere belong to other features.

**RTL:** the glyph is not mirrored. **Feature flag:** none.

#### Scenario: File manager sort trigger is icon-only and translated

- **WHEN** the File manager page renders on desktop in English
- **THEN** the search row ends with one button named "Sort" with no visible text. Opening it lists Name, Modified date and Size, a divider, then Ascending and Descending, with the applied field and direction checked

#### Scenario: Shell without sort labels keeps package defaults

- **WHEN** a host renders `DialFileManagerShell` without `labels.sort`
- **THEN** `DialFileManager` receives no `sortOptions` and the trigger is named by the package default "Sort"
