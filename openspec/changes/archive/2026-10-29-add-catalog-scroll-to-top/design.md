## Context

`Catalog` (`libs/catalog/src/components/Catalog/Catalog.tsx`) is the single surface that lists every deployment type; `apps/chat/src/components/CatalogView/CatalogView.tsx` is its only host. Inside the root `section` it renders the heading row, then one `overflow-y-auto` scroll body holding the Favorites strip, the `Toolbar` (title row with the kit `Search`), the tab row and the result area. Nothing is sticky, so the search field scrolls away with the content.

Two view modes share that scroll body:

- **Grid (cards):** `CardGrid` virtualizes rows off the nearest scrollable ancestor (`libs/catalog/src/utils/use-scroll-virtualizer.ts` via `getScrollParent`). Scrolling back means resetting the scroll body only.
- **List:** `ListView` (`libs/catalog/src/components/ListView/ListView.tsx`) renders the kit `Grid`, which scrolls its own rows inside a box at least 360px tall. `ListView` already keeps the `GridApi` in `gridApiRef` (from `onGridApiChange`). Scrolling back means resetting the scroll body **and** the grid rows.

On mobile the floating Create button sits at `absolute inset-e-4 bottom-4 z-10` of the root `section`, and the scroll body gets `pb-16` so it does not cover the last row.

The closest existing pattern is the chat's scroll-to-bottom control: a kit `FabButton` rendered conditionally with a translated `aria-label` (`apps/chat/src/components/ConversationView/ConversationView.tsx`, `isScrollButtonVisible`). `libs/attachment-canvas/src/components/PdfContent/PdfContent.tsx` shows the lib-side `FabButton` + Tabler icon (`DIAL_ICON_SIZE.LG`, `DIAL_KIT_ICON_STROKE`, `aria-hidden`) idiom.

## Goals / Non-Goals

**Goals:**

- One generic control in `libs/catalog` that works for every tab and both view modes.
- Return to the top and land keyboard focus in search in one action.
- No layout regressions: no overlap with the floating Create button, no horizontal overflow, RTL-correct.

**Non-Goals:**

- Picker modals (`CatalogPickerModal`, `AddOnCatalogModal`) — their search is pinned above the list.
- Sticky Toolbar, scroll restoration, or any change to `CardGrid` virtualization.

## Decisions

### D1. Live in `libs/catalog`, not the app

The scroll body, the `ListView` grid and the search input are all inside the lib; the app cannot reach them without DOM queries. Keeping the control in the lib also gives any other host the behavior for free. Host knowledge stays outside: the only host input is the resolved `CatalogTitles.scrollToTopLabel` string (English default in the lib, `t(CatalogI18nKeys.ScrollToTop)` from `CatalogView`). No i18n, routing or env access is added to the lib.

*Alternative:* an app-level overlay in `CatalogView` — rejected (needs the lib's internal DOM).

### D2. Visibility = combined offset ≥ one scroll-body height

`useCatalogScrollToTop({ scrollBody, searchInputRef, listViewRef, isListView })` returns `{ isVisible, handleRowsScroll, scrollToTop }`. It takes the scroll body **element**, not a ref: `Catalog` returns its spinner early while `isLoading`, so the scroll body mounts after the hook's first effect, and only a changing dependency makes the effect subscribe once it exists. `Catalog` keeps the element in state through a callback ref (`ref={setScrollBody}`). The hook owns:

- a passive `scroll` listener on the scroll body plus the latest list row offset (a ref fed by `handleRowsScroll`, passed to `ListView.onRowsScroll`);
- a `requestAnimationFrame`-coalesced recompute of `bodyTop + (isListView ? rowsTop : 0) >= body.clientHeight`;
- `setIsVisible` only when the boolean flips, so scrolling does not re-render `Catalog` per frame.

The row offset is kept even while grid mode hides the list (the list stays mounted), but only counted in list mode, so toggling view mode recomputes correctly. The hook also recomputes when `isListView` changes.

*Alternatives:* an `IntersectionObserver` on the Toolbar ("show when search is out of view") — rejected: in list mode the rows can scroll far while the Toolbar is still visible, and a fixed pixel constant ignores viewport size. One viewport height is the common "you've left the top" heuristic and is trivially testable.

### D3. Scroll + focus sequence

`scrollToTop()`:

1. `scrollBody.scrollTo({ top: 0, behavior })`, with `behavior` = `'auto'` when `window.matchMedia('(prefers-reduced-motion: reduce)').matches`, else `'smooth'`. Read at click time (no subscription needed).
2. If list mode, `listViewRef.current?.scrollToTop()`.
3. `searchInputRef.current?.focus({ preventScroll: true })`.

Focus moves before the button unmounts, so focus is never dropped to `document.body`. Focusing search on mobile (on-screen keyboard opens) was confirmed with the requester as intended — the issue's goal is quick access to search.

`preventScroll` stops the browser from jump-scrolling the input into view and fighting the smooth scroll; the smooth scroll ends at the top, where the input is visible anyway.

### D4. `ListView` handle without leaking ag-grid

`ListView` takes React 19 ref-as-prop `ref?: Ref<ListViewHandle>` and implements it with `useImperativeHandle(ref, () => ({ scrollToTop: () => gridApiRef.current?.ensureIndexVisible(0, 'top') }), [])`. Guard against an empty grid (`getDisplayedRowCount() === 0`) so ag-grid does not warn.

`onRowsScroll` subscribes in `handleGridApiChange`: `api.addEventListener('bodyScroll', listener)` reporting `event.top` when `event.direction === 'vertical'`; the previous API's listener is removed on change and on unmount. The callback is read through a ref so a new `onRowsScroll` identity does not resubscribe. Both are typed only with `number`/`void`, so no `GridApi` type crosses `ListView`'s public surface.

*Alternative:* query `.ag-body-viewport` from `Catalog` — rejected: couples the lib to ag-grid DOM class names the kit owns.

### D5. `Toolbar.searchInputRef`

`ToolbarProps.searchInputRef?: Ref<HTMLInputElement>` is forwarded `Toolbar → TitleRow → <Search inputRef>`. The kit `Search` passes unknown props to `Input`, whose `inputRef` targets the `<input>`. This is optional and does not change `Toolbar` for other hosts.

### D6. Placement

`ScrollToTopButton` renders inside a positioned wrapper in the root `section` (sibling of the floating Create wrapper), `absolute inset-e-4 z-10`:

- Floating Create visible (mobile + create enabled): `bottom-20` (16px inset + 48px FAB + 16px gap), i.e. stacked above Create.
- Otherwise: `bottom-4`.

The scroll body already reserves `pb-16` on mobile for the Create FAB. The scroll-to-top button appears only after the user has scrolled at least one screen, so its covering card content mid-list is acceptable; at the end of the list the user can still scroll past it because the button is not in flow. Logical `inset-e-*` flips under RTL; the up arrow is symmetric and is not mirrored.

`FabButton` gets `tooltipProps={{ tooltip: label }}` and `aria-label={label}`; verify `TooltipProps` field names via the UI kit MCP when implementing.

### D7. Memoisation

- `scrollToTop` and `handleRowsScroll` are `useCallback` with stable refs as deps so `ListView`'s props do not churn.
- `ScrollToTopButton` is a small presentational `FC`; no `React.memo` needed — it re-renders only when visibility flips.
- `Catalog` passes `scrollToTopLabel` from the already-destructured `titles`; no new `useMemo`.

### D8. Loading / empty / error states

- `isLoading`: `Catalog` returns the spinner early, so the button is not rendered.
- Empty tab or custom/personal empty state: the scroll body is short, the threshold is never reached, the button stays hidden. No special case needed.
- No network or error path is introduced.

## Risks / Trade-offs

- [Smooth scroll fires many scroll events] → rAF coalescing + flip-only `setState`.
- [Focusing search on mobile pops the keyboard] → accepted product decision (requester confirmed); revisit if UX feedback disagrees.
- [Button covers part of a card while scrolled] → bottom inline-end corner, only shown after a full screen of scrolling; same trade-off as the existing chat FAB.
- [`ensureIndexVisible` on an empty or not-yet-ready grid] → guarded by `gridApiRef.current` and displayed-row count.
- [jsdom has no layout] → tests stub `scrollTop`/`clientHeight`/`scrollTo` on the scroll body and fire `scroll`, following the stubbing in `libs/attachment-canvas/src/components/PdfContent/tests/PdfContent.spec.tsx`; mock `matchMedia` for reduced motion.

## Migration Plan

Additive and optional; ships in one PR (lib + app + README). Rollback is a revert of that PR. No data, API or config migration.

## Open Questions

None blocking. Exact `FabButton` tooltip prop shape is confirmed with the UI kit MCP during implementation.
