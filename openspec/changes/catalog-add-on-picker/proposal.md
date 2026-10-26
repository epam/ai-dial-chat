## Why

**Problem.** Two hosts build the same add-on UI on top of `@epam/ai-dial-catalog`, each with its own copy:

- **The add-on picker** (Add skill / Add toolset / Add agent). It holds a checked set over a multiple-selection
  `ListView`, opens with what is attached already checked, and on Add commits the whole set. The copies are
  Quick Apps' `src/components/common/AddOnCatalogModal/AddOnCatalogModal.tsx` with
  `src/utils/apply-catalog-selection.ts`, and the DIAL Loop editor's
  `src/components/AddOnCatalogModal/AddOnCatalogModal.tsx` with `src/utils/apply-catalog-selection.ts`.
- **The attached item's row.** The avatar, name and version are drawn the way the catalog list's Name cell
  draws them, so the row and the picker read alike. It has a logged-out badge, one line below, and a trash
  revealed on hover or focus. The copies are Quick Apps' `src/components/common/AddOnListItem/AddOnListItem.tsx`
  with `KnowledgeBaseList` for file locations, and the editor's `src/components/AddOnListItem/AddOnListItem.tsx`.
- **Focus after a removal**, which keeps focus in the list. The copies are Quick Apps'
  `src/hooks/use-list-remove-focus.ts` and the editor's `src/hooks/useListRemoveFocus.ts`.

The copies already drift: the editor's row draws file locations and source lines, while Quick Apps' does not.
Both rows are built only from catalog and shared pieces: `DeploymentIcon`, `ItemHeader` and
`CredentialsBadge`, the last in `libs/catalog/src/components/CredentialsBadge/CredentialsBadge.tsx`.

**Solution.** Move the shared part into `libs/catalog`, modelled on the existing
`libs/catalog/src/components/CatalogPickerModal/CatalogPickerModal.tsx`:

- **`AddOnCatalogModal`.** It wraps `CatalogPickerModal` with `listProps` in
  `CatalogSelectionMode.Multiple`. The component owns the checked set, opens with `attachedIds` checked, and
  calls `onConfirm(ids)` with the set resolved by `applyCatalogSelection`. A footer note can be built from
  the checked set.
- **`applyCatalogSelection`**, exported from the `./mapping` entry. Attached ids that stay checked keep their
  order, newly checked ids follow, unchecked ids are removed, and ids the picker does not list stay in place.
- **`AddOnListItem`.** The whole row is the button that opens the item's detail. It has a `DeploymentIcon`
  or `FileIcon` with the `CredentialsBadge` over it, and `ItemHeader` with the version. A location can
  replace the name as plain kit `Breadcrumbs`. It has one line below, a trailing slot and an opacity-hidden
  trash. Every string and type class is a prop.
- **`useListRemoveFocus(count)`.** Once the list is shorter and focus has fallen to the body, it focuses the
  first button of the list, or of its container.

**Lib boundary.** The lib takes `CatalogItem[]`, ids, already-resolved icon URLs, `CatalogItemCredentials`
and translated labels. What a host reads its add-ons from (Quick Apps' `addOns` and `agentSkills`, the
editor's `toolsets[]` and `dial` connections), how it maps entities to `CatalogItem`, and how it writes the
confirmed ids all stay in the host.

## What Changes

- New `AddOnCatalogModal` and `AddOnListItem` components and the `useListRemoveFocus` hook, exported from
  `@epam/ai-dial-catalog`.
- New `applyCatalogSelection`, exported from `@epam/ai-dial-catalog/mapping` and re-exported from the root.
- The README gains sections for each.
- No existing export changes.

## Capabilities

### New Capabilities

- `catalog-add-on-picker`: the add-on picker dialog, its selection rule, the attached-item row and focus
  after a removal.

### Modified Capabilities

None.

## Non-goals

- Migrating Quick Apps and the editor onto these exports. That is a follow-up in each host repo once a dev
  release ships. Quick Apps also drops its private `CatalogPickerModal` and `filter-catalog-items.ts` copies
  then.
- Entity-to-`CatalogItem` mappers and scope labels. They depend on each host's data shapes.
- The models picker (`ModelCatalogModal`). Its column layout and star handling differ per host.
- Details popups opened from a row.

## Alternatives considered

1. **Leave the copies** (baseline). This costs nothing now, but the two rows already differ.
2. **A `selectionMode` on `CatalogPickerModal` itself.** This widens a shell that is deliberately
   selection-agnostic, and its single-pick hosts would carry multi-pick props. Rejected.
3. **The row in `@epam/ai-dial-chat-shared`.** It needs `CredentialsBadge`, a catalog component, so
   chat-shared would depend on catalog. Rejected.
4. **Picked: separate catalog components.** This keeps the shell as it is and puts the row beside the list
   whose Name cell it mirrors.

## Acceptance criteria

- `AddOnCatalogModal` opens with the attached ids checked. Add commits the resolved set. Cancel commits
  nothing. Loading, error and empty states are `CatalogPickerModal`'s.
- `applyCatalogSelection` has unit coverage for order, removal and unlisted ids.
- `AddOnListItem` is a named button, described by its line below. It draws a breadcrumb location when given
  one. Its trash is named, reachable by Tab, and shown on focus. It renders the badge for signed-out
  credentials.
- `useListRemoveFocus` moves focus into the list after a removal.
- The README documents each export with compiling examples.
- `nx run catalog:typecheck`, `lint` and `test` pass.

## Impact

- **Code:** `libs/catalog/src/components/AddOnCatalogModal/`, `libs/catalog/src/components/AddOnListItem/`,
  `libs/catalog/src/utils/list-selection.ts`, `libs/catalog/src/utils/use-list-remove-focus.ts`,
  `libs/catalog/src/index.ts`, `libs/catalog/src/entry-points/mapping.ts`, `libs/catalog/README.md`.
- **i18n:** new user-visible strings are props with English defaults (`Select all`, `Select <name>`,
  `Remove <name>`, `Location`). Hosts pass translated ones, and the lib does no i18n.
- **Compatibility / rollback:** additive. Nothing that exists changes. Revert the commit.
