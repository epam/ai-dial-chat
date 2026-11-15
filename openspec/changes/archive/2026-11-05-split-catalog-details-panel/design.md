## Context

`DetailsPanel` (1472 lines) and `Header` (1212 lines) are private implementation details behind public names:

- `DetailsPanel`;
- `Header`, exported as `DetailsHeader` / `DetailsHeaderProps`.

Their specs drive them through the DOM and the props only. Nothing outside the two files imports their internals.

## Decisions

### D1 — Hooks for stateful concerns, components for JSX, pure functions for rules

- **Stateful concerns become private hooks** in a `hooks/` folder beside the component, as F2 did for `Input`.
- **Rendering chunks become components** in the same folder, named `DetailsTabs`, `HeaderCredentialsButton` and `HeaderManageSlot`. Each gets a `{Name}Props` interface.
- **The header's visibility rules become one pure function** in `src/utils`, because they read only props and two pieces of lookup state.
- **Interfaces go to `src/models`**, following the lib's `models`/`utils` convention. None of the new modules is exported from `src/index.ts`.

### D2 — Per-item resets stay in declaration order

`DetailsPanel` had one `[item.id]` reset effect for tab, publish, confirmation and credentials-management state. It splits along ownership:

- `useDetailsPublish` resets its own state.
- `useDetailsConfirmation` resets its own state.
- The panel keeps the reset of the active tab and credentials management.

All of them still run in the commit that changes `item.id`, and they touch disjoint state, so the result is the same.

Order constraints that matter keep their relative order inside `useDetailsPublish`:

1. the publish-open request effect;
2. the reset;
3. the prefetch effect, which was "declared after the reset above so a new item's request is not cleared in the same commit".

The panel's tab reset stays before the tab reconciliation effect, so `''` is still overwritten by the first tab in the same commit.

### D3 — Call order

`DetailsPanel` calls the hooks in this order:

1. `useDetailsContentFile`, at the position of today's content-file block;
2. `useDetailsPublish`;
3. `useDetailsConfirmation`, which receives `publishedFolders` and `formatFolderLabel`.

`usePublishFolderView` and the publish open/close/submit callbacks move up into `useDetailsPublish`, ahead of the confirmation Escape effect. They have no effect that interacts with it.

### D4 — Credentials button owns its popover state

`isApiKeyOverlayOpen` moves into `HeaderCredentialsButton`. Today one state backs both call sites (primary and secondary), and only one of them renders for a given item. A remount happens only if an item switch moves the button between the two slots while its popover is open. Then the popover now closes instead of reopening on the new item. That outcome is the more correct one, and no spec observes it.

### D5 — Verbatim moves, dependency arrays unchanged

Every moved `useCallback`, `useMemo` and `useEffect` keeps its body and dependency array. The exception is where a value now arrives as a parameter, because then the parameter name stands in for it. Exhaustive-deps suggestions that only add stable refs or setters returned by another hook are applied, as in F3.

## Risks / Trade-offs

- **[Prop sprawl in `DetailsTabs`]** The component takes about 20 props. That is acceptable: it is private, and the alternative of passing the whole panel props object would hide what the tabs depend on.
- **[A behavior slip in a verbatim move]** Each slice runs both specs unedited. The baseline is 462 tests in 13 files under `src/components/Details`.
