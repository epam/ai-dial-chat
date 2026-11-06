## ADDED Requirements

### Requirement: `applyCatalogSelection` resolves a picker's confirmed ids

`@epam/ai-dial-catalog/mapping` (re-exported from the root) SHALL export
`applyCatalogSelection(attachedIds, checkedIds, listedIds): string[]`
(`libs/catalog/src/utils/list-selection.ts`). It returns:

1. the attached ids that are checked or not listed, in their attached order, then
2. the checked ids that were not attached, in the iteration order of `checkedIds`.

An attached id that is listed and unchecked SHALL be dropped.

#### Scenario: Uncheck and add

- **WHEN** `attachedIds` is `['a', 'b']`, `checkedIds` is `{'b', 'c'}` and `listedIds` is `{'a', 'b', 'c'}`
- **THEN** the result is `['b', 'c']`

#### Scenario: Unlisted ids stay

- **WHEN** `attachedIds` is `['agent', 'a']`, `checkedIds` is empty and `listedIds` is `{'a'}`
- **THEN** the result is `['agent']`

### Requirement: `AddOnCatalogModal` picks several catalog items

`AddOnCatalogModal` (`libs/catalog/src/components/AddOnCatalogModal/AddOnCatalogModal.tsx`) SHALL render
`CatalogPickerModal` with `listProps` in `CatalogSelectionMode.Multiple`, for `type`. It takes:

- `items: CatalogItem[]` and `attachedIds: string[]`;
- `status`, `error` and `onRetry`;
- `labels: AddOnCatalogModalLabels`, which extends `CatalogPickerModalLabels` with `selectAll?` (default
  `'Select all'`) and `selectRow?: (name: string) => string` (default `` `Select ${name}` ``);
- `listProps?`, the remaining `ListView` props (`columnVisibility`, `isFavoriteVisible`,
  `credentialsBadgeLoggedOutLabel`, …);
- `renderFooterStart?: (checkedIds: ReadonlySet<string>) => ReactNode`;
- `onConfirm: (ids: string[]) => void` and `onClose`.

The checked set SHALL start as `attachedIds`. On Add the component SHALL call `onConfirm` with
`applyCatalogSelection(attachedIds, checked, ids of items)`. Cancel and close SHALL call only `onClose`.
It performs no i18n.

#### Scenario: Opens with what is attached

- **WHEN** it opens with `attachedIds` naming one of two items
- **THEN** that item's checkbox is checked and the other is not

#### Scenario: Add commits the set

- **WHEN** the user unchecks the attached item, checks the other one and presses Add
- **THEN** `onConfirm` receives the other item's id, preceded by any attached id not among `items`

#### Scenario: Cancel commits nothing

- **WHEN** the user changes checks and presses Cancel
- **THEN** `onClose` is called and `onConfirm` is not

### Requirement: `AddOnListItem` draws one attached add-on

`AddOnListItem` (`libs/catalog/src/components/AddOnListItem/AddOnListItem.tsx`) SHALL render one row with
`onOpen` and `onRemove`:

- The row is a native `<button>` named by the item and described by its line below.
- **Icon:**
  - a `DeploymentIcon` of `iconSize` (default `36`, from `iconUrl` or the name's initials), or a `FileIcon`
    when `fileType` is given;
  - the icon is hidden from assistive tech;
  - when `credentials` is given, a `CredentialsBadge` over it, labelled `labels.credentialsBadge`.
- **Name:** `ItemHeader` with `name` and `version` as its postfix, in `titleClassName` (default
  `'dial-small-semi-text'`) and `versionClassName` (default `'dial-tiny-text'`).
- **Location:** when `path` is given, plain-text kit `Breadcrumbs` named `labels.location` (default
  `'Location'`) replace the name. The button then covers the row as an absolutely positioned overlay, and the
  trail does not take pointer events.
- **Line below:** `description` (a node) in `descriptionClassName` (default `'dial-tiny-text'`), set as the
  button's `aria-describedby`.
- **Trailing:** a `trailing` node after the text.
- **Trash:** a `GhostIconButton` named `labels.remove` (default `` `Remove ${name}` ``). It is hidden by
  opacity until the row is hovered or holds focus, so it stays in the tab order. It is absent without
  `onRemove`.
- `isDisabled` disables both buttons.

#### Scenario: Opens from a named button

- **WHEN** the row for "Figma" (version `1.0.0`) is clicked
- **THEN** `onOpen` is called, and the button's accessible name is "Figma 1.0.0"

#### Scenario: Location row

- **WHEN** `path` is `['DIAL', 'Docs', 'survey']`
- **THEN** a navigation landmark named by `labels.location` shows the three segments, and the button still opens the item

#### Scenario: Signed out

- **WHEN** `credentials` reports the user signed out
- **THEN** the credentials badge is drawn over the icon

### Requirement: `useListRemoveFocus` keeps focus after a removal

`useListRemoveFocus(count)` (`libs/catalog/src/utils/use-list-remove-focus.ts`) SHALL return a ref for the
list's container. When `count` drops and the focused element is the body or detached, it SHALL focus the
first `button` inside a `ul` in the container, or else the container's first `button`.

#### Scenario: Last item removed

- **WHEN** the only row's trash removes it and the row unmounts
- **THEN** focus moves to the container's first button
