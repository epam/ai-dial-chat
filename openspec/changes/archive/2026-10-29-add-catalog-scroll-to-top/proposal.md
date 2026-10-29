## Why

Issue [#9595](https://github.com/epam/ai-dial-chat/issues/9595): once a catalog tab holds many entities (skills, agents, toolsets, models, prompts), a user who has scrolled down has no quick way back to the top — and to the search field, which scrolls away with the Toolbar. They must scroll the whole list back manually, which is slow on long lists and on touch devices.

## Problem

- The catalog page scrolls one body element (`libs/catalog/src/components/Catalog/Catalog.tsx`, the `overflow-y-auto` wrapper below the heading). The Favorites strip, Toolbar (with the search field) and Tabs scroll away inside it; nothing is pinned.
- In list mode the `ListView` grid scrolls its own rows inside a box that is at least 360px tall (`catalog-list-view-grid` spec, "`ListView` scrolls inside its own box"), so there are two scroll positions to undo, not one.
- The behavior is the same for every tab, because every deployment type is rendered by the same `Catalog` component (`apps/chat/src/components/CatalogView/CatalogView.tsx` is the only `<Catalog>` host).

## Solution

Add a floating "Scroll to top" button to `Catalog`, generic across tabs and both view modes:

- It appears once the user has scrolled the catalog down by at least one scroll-body height (scroll body offset plus, in list mode, the grid's own row offset) and disappears again at the top.
- Activating it scrolls both the scroll body and, in list mode, the grid rows back to the top (smoothly, instantly under `prefers-reduced-motion: reduce`) and moves focus to the catalog search input — on desktop and mobile alike (confirmed with the requester; on mobile this opens the on-screen keyboard by design).
- It reuses the kit's 2.0 `FabButton` with an `IconArrowNarrowUp` glyph, mirroring the chat's existing scroll-to-bottom `FabButton` (`apps/chat/src/components/ConversationView/ConversationView.tsx`, the `isScrollButtonVisible` block). It sits at the inline-end bottom corner and, on mobile, stacks above the floating Create button instead of covering it.
- Its accessible name is a new `CatalogTitles.scrollToTopLabel` (English default `'Scroll to top'`); the app passes a translated string.

Supporting lib changes, all internal to `libs/catalog`:

- `Toolbar` gains an optional `searchInputRef`, forwarded through `TitleRow` to the kit `Search`'s `inputRef`, so `Catalog` can focus the field.
- `ListView` gains an optional imperative handle (`ref`, React 19 ref-as-prop) exposing `scrollToTop()`, and an optional `onRowsScroll(top)` callback, both backed by the `GridApi` it already holds (`ensureIndexVisible(0, 'top')`, the `bodyScroll` event). `Catalog` uses both; the `GridApi` type does not leak into `ListView`'s public contract.

**Alternatives considered:** (a) make the Toolbar sticky so search never scrolls away — rejected: it permanently eats vertical space on mobile and conflicts with the sticky grid header in list mode, and the issue explicitly asks for a way back to the top of the list; (b) a keyboard shortcut only — rejected: not discoverable and unavailable on touch; (c) put the button in the app (`CatalogView`) — rejected: the scroll body and the grid live inside the lib, so the app could only reach them through DOM queries.

## Non-goals

- `CatalogPickerModal` and `AddOnCatalogModal`: their search and filter controls already stay pinned above the scrolling list, so there is nothing to scroll back to.
- Other long lists outside the catalog (conversations, file manager, scheduled tasks).
- Persisting or restoring the scroll position across navigation or tab switches.
- Changing the existing scroll layout (no sticky Toolbar, no change to the list box's 360px floor).

## Acceptance criteria

- On the catalog page, in any tab and in both grid and list view, the button is absent at the top and appears after scrolling down by at least one scroll-body height.
- Activating it (pointer, Enter or Space) brings the scroll body and the list rows to the top, focuses the search input, and the button disappears.
- Under `prefers-reduced-motion: reduce` the scroll is instant.
- On mobile (360×640) the button does not overlap the floating Create button, and the page gains no horizontal overflow; it sits on the inline-end edge in both LTR and RTL.
- The button has an accessible name (`scrollToTopLabel`, default `'Scroll to top'`), the arrow icon is `aria-hidden`, and the app passes a translated label.
- `libs/catalog` README documents `scrollToTopLabel`, `Toolbar.searchInputRef`, and `ListView`'s `ref` handle / `onRowsScroll`; `npm run validate:docs` passes.
- Lib unit tests cover visibility threshold, both scroll resets, focus move and reduced motion.

## What Changes

- `libs/catalog`: new `ScrollToTopButton` component and `useCatalogScrollToTop` hook; `Catalog` renders it; `CatalogTitles.scrollToTopLabel`; `ToolbarProps.searchInputRef`; `ListView` `ref` handle (`ListViewHandle`) and `onRowsScroll`. All additions are optional — non-breaking.
- `apps/chat`: `CatalogView` passes `scrollToTopLabel: t(CatalogI18nKeys.ScrollToTop)`; new `catalog.scrollToTop` key in `en.json` (the only locale file today), with the matching `CatalogI18nKeys.ScrollToTop` enum member.
- `libs/catalog/README.md` updated in the same change.

## Capabilities

### New Capabilities

- `catalog-scroll-to-top`: floating button on the catalog page that returns the scroll body and list rows to the top and focuses search; the supporting `Toolbar.searchInputRef` and `ListView` scroll handle.

### Modified Capabilities

None. The `catalog-list-view-grid` requirements (grid scrolls inside its own box, fixed row height, no spacer rows) are unchanged; the new `ListView` handle is specified in `catalog-scroll-to-top`.

## Impact

- **Libs touched:** `libs/catalog` only. Library isolation holds: the lib knows nothing about routes or i18n — the label arrives as a resolved string through `CatalogTitles`, and scrolling/focus act only on the lib's own DOM and the `GridApi` it already owns. No new dependency: `FabButton` comes from the existing `@epam/ai-dial-ui-kit` peer and `IconArrowNarrowUp` from the existing `@tabler/icons-react` dependency.
- **App touched:** `apps/chat/src/components/CatalogView/CatalogView.tsx`, `apps/chat/src/constants/translation-keys.ts`, `apps/chat/src/i18n/locales/en.json`.
- **i18n:** one new user-visible string (the button's accessible name and tooltip), "Scroll to top".
- **State:** local to `Catalog` (visibility boolean); no new context or provider.
- **Rollback / compat:** purely additive, optional props; reverting the change removes the button with no data or API migration.
