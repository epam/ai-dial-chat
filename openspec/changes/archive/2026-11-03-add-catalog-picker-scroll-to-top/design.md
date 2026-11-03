## Context

`Catalog` already has a "Scroll to top" button (`catalog-scroll-to-top`):

- `useCatalogScrollToTop` (`libs/catalog/src/hooks/useCatalogScrollToTop/useCatalogScrollToTop.ts`)
  adds the scroll body's `scrollTop` to the `ListView` row offset reported by `onRowsScroll`, and
  shows the button once that sum reaches the scroll body's `clientHeight`.
- Its action scrolls the scroll body, calls `ListView`'s `scrollToTop()` in list view, and focuses
  search.
- `ScrollToTopButton` (`libs/catalog/src/components/ScrollToTopButton/ScrollToTopButton.tsx`)
  renders the kit `FabButton`.

`CatalogPickerModal` (`libs/catalog/src/components/CatalogPickerModal/CatalogPickerModal.tsx`)
lays out the popup body as a non-scrolling flex column:

- the header (heading, sort, search, From filter);
- below it, either a state (spinner, failure, empty) or a `min-h-0 flex-1` box holding the
  `ListView`;
- `ListView` scrolls its own rows inside the ui-kit `Grid` ("The grid scrolls its own rows").

`AddOnCatalogModal` renders through `CatalogPickerModal` with `listProps`, and its labels type
extends `CatalogPickerModalLabels`. Neither picker is used in `apps/chat`; the QuickApps editor
hosts both.

## Goals / Non-Goals

**Goals:**

- The button in both pickers' default list, with the same threshold, motion and focus rules as
  `Catalog`.
- Reuse the existing hook and button: no second implementation of the visibility rule.
- Host `listProps.ref` and `listProps.onRowsScroll` keep working.

**Non-Goals:**

- A button for `renderList` lists.
- Any change to `Catalog`, `ScrollToTopButton` or `useCatalogScrollToTop`'s public shape.

## Decisions

### Reuse `useCatalogScrollToTop` with the list box as the scroll body

The picker passes three things to the hook:

- the list box (the `min-h-0 flex-1` wrapper, held in state through a callback ref) as
  `scrollBody`;
- `isListView: true`;
- its own `ListViewHandle` ref and a search `inputRef`.

The box never scrolls, so its `scrollTop` stays 0 and the rows' offset alone decides. The threshold
is the box's `clientHeight`, which equals the visible list height. The hook's `scrollBody.scrollTo`
call is a harmless no-op, and `listViewRef.scrollToTop()` does the real work.

Alternative: a picker-only hook keyed on the row offset. It would duplicate the rAF coalescing and
focus handling for no gain. Rejected.

### Reset the row offset when the list box unmounts

The hook keeps the last row offset in a ref. When a search empties the list, the box unmounts. When
the list comes back, the new grid starts at its top without emitting a scroll, so the stale offset
would show the button too early. So the box's callback ref calls `handleRowsScroll(0)` when it
receives `null`. The hook then recomputes against the new box with offset 0.

### Chain the host's `ref` and `onRowsScroll`

`CatalogPickerListProps` is `Omit<ListViewProps, 'items' | 'query'>`, so a host may already pass
`ref` and `onRowsScroll`. The picker passes `ListView`:

- a callback ref that sets its own handle ref and then the host's ref (function or object);
- an `onRowsScroll` that calls the hook's `handleRowsScroll` and then the host's callback.

Both are memoised with `useCallback` on the host value, so `ListView` does not resubscribe on every
render. `ListView` already reads `onRowsScroll` through a ref, so identity changes are cheap
anyway.

### Place the button inside the list box

The box becomes `relative`, and the button sits at `absolute bottom-4 inset-e-4 z-10`, the same
inset as in `Catalog`. Because it lives inside the box, it disappears with the list when a state
replaces it. The picker has no floating Create button, so `Catalog`'s stacking rule does not apply.

### Label

`CatalogPickerModalLabels.scrollToTop?: string`, defaulting to `'Scroll to top'`, the same string
as `CatalogTitles.scrollToTopLabel`. The host supplies the translation, and the lib does no i18n.

## Risks / Trade-offs

- [The grid may not emit `bodyScroll` when filtering shortens the list and clamps the scroll] → In
  that case the button can linger until the next scroll. Activating it is still correct: it scrolls
  to the top and focuses search, after which the next row report hides it. This is the same
  behaviour `Catalog` has in list view today.
- [jsdom has no layout, so `clientHeight` is 0 and the button never shows in tests] → The picker
  spec defines `clientHeight` on the list box and drives `onRowsScroll` from the mocked `ListView`.
- [A host that relied on the picker never showing the button] → None known. QuickApps asked for it.

## Migration Plan

Additive. Hosts get the button with the English default on the next lib release. QuickApps then
passes `scrollToTop: t(CatalogI18nKeys.ScrollToTop)` through `useCatalogPickerSharedProps`.
Rollback: revert the commit, and drop `labels.scrollToTop` in hosts that pass it.

## Open Questions

None.
