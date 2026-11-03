## Why

Issue #9595 added a "Scroll to top" button to `Catalog`. QA asked for the same control in the
QuickApp editor's catalog pickers: Change model, Add agent, Add toolset and Add skill
([comment](https://github.com/epam/ai-dial-chat/issues/9595#issuecomment-6573105542)). With a long
list there, the only way back to the search field is to scroll all the way up by hand.

Those pickers now render this library's `CatalogPickerModal` and `AddOnCatalogModal`
(ai-dial-quickapps-frontend#323). So the control belongs in the library, where every host of the
pickers gets it. The `catalog-scroll-to-top` spec currently says the button SHALL NOT render in
either picker, and this change reverses that.

## What Changes

- `CatalogPickerModal` (`libs/catalog/src/components/CatalogPickerModal/CatalogPickerModal.tsx`)
  renders the existing `ScrollToTopButton` at the list's bottom inline-end corner once the default
  list's rows are scrolled down by at least the list box's height. Activating it returns the rows to
  the first row and focuses the picker's search field.
- Visibility and the action reuse `useCatalogScrollToTop`
  (`libs/catalog/src/hooks/useCatalogScrollToTop/useCatalogScrollToTop.ts`), fed by `ListView`'s
  `onRowsScroll` and `ref.scrollToTop()`, the same wiring `Catalog` uses in list view
  (`libs/catalog/src/components/Catalog/Catalog.tsx`).
- `CatalogPickerModalLabels` gains an optional `scrollToTop` (default `'Scroll to top'`).
  `AddOnCatalogModalLabels` extends it, so `AddOnCatalogModal` gets the button and the label with
  no change of its own.
- A `ref` or `onRowsScroll` the host passes in `listProps` keeps working: the picker chains it
  rather than replacing it.
- Lists from `renderList` get no button, because the picker cannot tell how a host's own list
  scrolls.
- Not breaking: every new prop field is optional and has a default.

## Non-goals

- No change to `Catalog`'s own button, its placement, or `ScrollToTopButton`.
- No button for `renderList` lists.
- No change in `apps/chat`, which renders neither picker. The QuickApps host passes the translated
  label in its own PR.

## Alternatives considered

- **Hand-rolled button in the QuickApps host** (the first attempt,
  ai-dial-quickapps-frontend#324): no longer possible, because the host no longer owns the list or
  its scroll element.
- **A new `scrollToTop` render slot, so the host builds the button**: pushes the scroll tracking and
  the `ListView` handle onto every host, against the lib's "one install, renders complete" rule.
  Rejected.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalog-scroll-to-top`: the button now also renders in `CatalogPickerModal`, and so in
  `AddOnCatalogModal`, for the default list. The "Catalog shows a 'Scroll to top' button once
  scrolled down" requirement drops its "SHALL NOT render in `CatalogPickerModal` or
  `AddOnCatalogModal`" clause, and a new requirement covers the pickers.

## Impact

- **Code:** `libs/catalog/src/components/CatalogPickerModal/CatalogPickerModal.tsx` and its spec
  `tests/CatalogPickerModal.spec.tsx`; `libs/catalog/README.md` (the `CatalogPickerModal` and
  `AddOnCatalogModal` sections).
- **Library boundary:** nothing host-specific enters the lib. The host passes only a translated
  string, `labels.scrollToTop`.
- **i18n:** one new user-visible string, as an optional label with an English default. `apps/chat`
  is unaffected. QuickApps fills it with its existing `catalog.scrollToTop` key.
- **RTL / a11y:** logical placement (`inset-e-*`), an up-arrow that is not mirrored, a named
  `FabButton` with a tooltip, and focus moving to search before the button unmounts. All of this is
  inherited from `ScrollToTopButton` and `useCatalogScrollToTop`.
- **Rollback:** revert the commit. Hosts that pass `labels.scrollToTop` keep compiling only on
  versions that have the field, so a revert also means dropping that label in the host.

## Acceptance criteria

- In both pickers, with the default list, the button is hidden at the top, appears once the rows
  are scrolled by one list height, and disappears when scrolled back.
- Activating it calls `ListView`'s `scrollToTop()` and leaves the search input focused.
- `labels.scrollToTop` names the button, and the default is "Scroll to top".
- A host's `listProps.onRowsScroll` and `listProps.ref` still receive their calls and the handle.
- A `renderList` picker never shows the button.
- `catalog` lint, typecheck and tests pass, and `npm run validate:docs` and
  `npm run validate:specs` pass.
