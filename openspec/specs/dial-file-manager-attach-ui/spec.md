## ADDED Requirements

### Requirement: Modal header shows attachment constraints description

When the modal is in attach mode (i.e., the `onAttach` callback is present), `DialFileManagerModal` SHALL render a description paragraph below the modal title that summarises the active constraints:

- **Supported types + max size**: always shown when at least one of `allowedTypes` or `maxSelectableFileSize` is provided. Uses i18n key `DialFileManager.MaxSizeSupportedTypes` with params `{{maxSize}}` (human-readable, e.g., "512 MB") and `{{allowedExtensions}}` (comma-separated type labels from `mimeTypesToExtensionLabels`).
- **Max count suffix**: appended when `maximumAttachmentsAmount` is provided and is a finite positive number. Uses i18n key `DialFileManager.UpToFiles` with param `{{count}}`.

The description paragraph SHALL use `text-secondary` styling and be positioned inside the modal header area, below the title, before the file grid.

i18n keys: `DialFileManager.MaxSizeSupportedTypes` (params: `maxSize`, `allowedExtensions`), `DialFileManager.UpToFiles` (param: `count`)
RTL: paragraph uses `text-start` and logical padding — no physical `text-left`/`pl-*`.
Feature flag: none
Accessibility: `id` on description paragraph matched to `aria-describedby` on the popup (if the `DialPopup` component supports `aria-describedby` via a prop; otherwise omit and use prose placement).
Memoisation: description string computed in `useMemo` from props.

#### Scenario: Description shows type + size when both provided

- **WHEN** `allowedTypes` is `['image/*']` and `maxSelectableFileSize` is `5_242_880` (5 MB)
- **THEN** the header description contains "Image files" and "5 MB"

#### Scenario: Description shows max count suffix

- **WHEN** `maximumAttachmentsAmount` is `10`
- **THEN** the header description includes "up to 10 files" (or the translated equivalent)

#### Scenario: Description hidden when no constraints are provided

- **WHEN** `allowedTypes` is `[]`, `maxSelectableFileSize` is `undefined`, and `maximumAttachmentsAmount` is `undefined`
- **THEN** no description paragraph is rendered

#### Scenario: Description RTL direction

- **WHEN** the page direction is `rtl`
- **THEN** the description paragraph text aligns to the start edge and padding uses logical properties

---

### Requirement: Disabled-row tooltip for hidden paths

`DialFileManagerModal` SHALL pass a `getDisabledTooltip` callback to `DialFileManager`. The callback SHALL:
- Return the string `t(DialFileManagerI18nKeys.AttachingHiddenFilesNotAllowed)` when `isHiddenPath(row.path)` is `true`.
- Return `undefined` for all other rows.

i18n key: `DialFileManager.AttachingHiddenFilesNotAllowed`
RTL: none (tooltip text positioning is handled by the UI kit)
Feature flag: none
Accessibility: tooltip MUST be keyboard-accessible (the UI kit's `DialFileManager` is responsible for wiring tooltip aria attributes; no additional work needed in the modal unless the kit does not surface tooltips on focus).
Memoisation: `getDisabledTooltip` in `useCallback`.

#### Scenario: Hidden path row shows tooltip

- **WHEN** a grid row has `path` containing `.dial_folder` and the user hovers or focuses the row
- **THEN** the tooltip "Attaching hidden files is not allowed" (or its translation) is displayed

#### Scenario: Normal path row shows no tooltip

- **WHEN** a grid row has a normal (non-hidden) path
- **THEN** no tooltip is shown from `getDisabledTooltip`
