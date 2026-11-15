## 1. Selection rule

- [x] 1.1 `libs/catalog/src/utils/list-selection.ts` with `applyCatalogSelection`, exported from `src/entry-points/mapping.ts`; spec in `src/utils/tests/list-selection.spec.ts`.
      Verification: `npm exec nx run @epam/ai-dial-catalog:test -- list-selection`.

## 2. Picker

- [x] 2.1 `libs/catalog/src/components/AddOnCatalogModal/AddOnCatalogModal.tsx` on `CatalogPickerModal` (`listProps`, Multiple); `AddOnCatalogModalLabels`/`AddOnCatalogModalProps` exported from `src/index.ts`; spec (opens checked, Add commits the set, Cancel commits nothing).
      Verification: `npm exec nx run @epam/ai-dial-catalog:test -- AddOnCatalogModal`.

## 3. Row and focus

- [x] 3.1 `libs/catalog/src/utils/use-list-remove-focus.ts` and `libs/catalog/src/components/AddOnListItem/AddOnListItem.tsx`; exports with `AddOnListItemProps`/`AddOnListItemLabels`; specs (named button and description, location trail, credentials badge, trash by Tab, focus after removal).
      Verification: `npm exec nx run @epam/ai-dial-catalog:test -- AddOnListItem`.

## 4. Docs and checks

- [x] 4.1 README sections for `AddOnCatalogModal`, `AddOnListItem`, `useListRemoveFocus` and `applyCatalogSelection`.
      Verification: `npm run validate:docs`.
- [x] 4.2 `npm exec nx run @epam/ai-dial-catalog:typecheck`, `npm exec nx run @epam/ai-dial-catalog:lint`, `npm exec nx run @epam/ai-dial-catalog:test`, `npm exec nx run @epam/ai-dial-catalog:build`.
      Verification: all four green.

## Follow-ups (host repos)

- [ ] F.1 Quick Apps: use the lib's `AddOnCatalogModal`, `AddOnListItem`, `useListRemoveFocus`, `applyCatalogSelection`; drop its `CatalogPickerModal` and `filter-catalog-items.ts` copies.
- [ ] F.2 DIAL Loop editor: same, once the dev release ships.
