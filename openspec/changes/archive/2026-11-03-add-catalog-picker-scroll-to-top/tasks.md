Slicing strategy: vertical. Slice 1 makes the button work end to end in `CatalogPickerModal`.
Slice 2 proves it in `AddOnCatalogModal` with no code of its own and covers the host-prop
chaining. Slice 3 updates docs and closes the change.

## 1. Button in `CatalogPickerModal`

- [x] 1.1 In `libs/catalog/src/components/CatalogPickerModal/CatalogPickerModal.tsx`, add
      `scrollToTop?: string` (JSDoc: default `'Scroll to top'`) to `CatalogPickerModalLabels`.
- [x] 1.2 In the same file, hold the list box in state through a callback ref. That ref calls
      `handleRowsScroll(0)` when it receives `null`. Keep a `ListViewHandle` ref and a search
      `inputRef` (pass it to the kit `Search`), and call `useCatalogScrollToTop({ scrollBody,
      searchInputRef, listViewRef, isListView: true })`.
- [x] 1.3 Pass `ListView` a `useCallback` ref and `onRowsScroll` that feed the hook and then call
      the host's `listProps.ref` (function or object) and `listProps.onRowsScroll`.
- [x] 1.4 Make the list box `relative`, and render `ScrollToTopButton` inside it at
      `absolute bottom-4 inset-e-4 z-10` while `isVisible`, labelled
      `labels.scrollToTop ?? 'Scroll to top'`. Only the `listProps` branch renders it, never
      `renderList`.
- [x] 1.5 Architecture guard: the change adds no host knowledge to `libs/catalog` (no i18n, `/api`
      paths, app contexts, env or feature flags), only the optional label. Relative imports stay
      extensionless.
- [x] 1.6 Tests in `libs/catalog/src/components/CatalogPickerModal/tests/CatalogPickerModal.spec.tsx`.
      Have the mocked `ListView` expose `onRowsScroll` and a `scrollToTop` handle, and define the
      list box's `clientHeight`. Cover:
  - hidden at the top;
  - visible from one list height and hidden just below it;
  - activating it calls `scrollToTop()` and focuses the search input (queried by role and label);
  - `labels.scrollToTop` names it;
  - hidden when a search empties the list, and still hidden when the list comes back;
  - never shown for `renderList`.
  - Verification:
    `npm run test:file -- libs/catalog/src/components/CatalogPickerModal/tests/CatalogPickerModal.spec.tsx`

## 2. Add-on picker and host props

- [x] 2.1 Tests in `libs/catalog/src/components/CatalogPickerModal/tests/CatalogPickerModal.spec.tsx`:
      a host `listProps.onRowsScroll` is still called with each offset, and a host `listProps.ref`
      still receives the handle.
  - Verification:
    `npm run test:file -- libs/catalog/src/components/CatalogPickerModal/tests/CatalogPickerModal.spec.tsx`
- [x] 2.2 Test in `libs/catalog/src/components/AddOnCatalogModal/tests/AddOnCatalogModal.spec.tsx`:
      the button appears once the rows are scrolled by one list height, named by
      `labels.scrollToTop`.
  - Verification:
    `npm run test:file -- libs/catalog/src/components/AddOnCatalogModal/tests/AddOnCatalogModal.spec.tsx`
- [x] 2.3 RTL check: the button uses `inset-e-4` (no `right-*`/`left-*`), and its up-arrow is not
      mirrored (no `rtl:scale-x-[-1]`).
- [x] 2.4 `npm run verify:changed` (covered by the CI of PR #9693).

## 3. Docs and close

- [x] 3.1 `libs/catalog/README.md`: in "CatalogPickerModal", say the default list shows a
      "Scroll to top" button after one list height (focuses search; `labels.scrollToTop`; not for
      `renderList`). In "AddOnCatalogModal", say it inherits the button.
- [x] 3.2 `npm run validate:docs` and `npm run validate:specs`.
- [x] 3.3 `npm run verify:full` (covered by the CI of PR #9693).
- [ ] 3.4 Follow-up outside this repo: in ai-dial-quickapps-frontend, after the lib release, bump
      `@epam/ai-dial-catalog`, pass `scrollToTop: t(CatalogI18nKeys.ScrollToTop)` in
      `useCatalogPickerSharedProps`, and rework PR #324 onto that.
