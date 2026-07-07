## Context

The catalog details panel (`libs/catalog/src/components/Details/Header/Header.tsx`) already renders a `PrimaryButton` bound to an `onUseInChat?: (item: CatalogItem) => void` prop, threaded unchanged through `Catalog` → `DetailsPanel` → `Header` (`CatalogProps.onUseInChat` → `DetailsPanelProps.onUseInChat` → `HeaderProps.onUseInChat`, all `(item: CatalogItem) => void`). `apps/chat/src/components/CatalogView/CatalogView.tsx` does not pass `onUseInChat` to `<Catalog>` today, so the button renders but does nothing.

`Header.tsx` has no type-based conditional rendering today — both `onUseInChat` and `onShare` buttons render unconditionally whenever the callback prop is present. `CatalogItem` already carries a required `type: CatalogEntityType` field (`Model | Application | Agent | Toolset | Guardrail | Skill | Mcp`), and `Catalog.tsx` already branches on `item.type` elsewhere (e.g. tab filtering), so type-based conditionals have direct precedent in this lib.

Deployment selection already has an established, working pattern: `DeploymentsContext.setSelectedItemId(id: string | null)` synchronously updates local state and fire-and-forgets persistence to user config (`void setSelectedDeployment(id).catch(...)`) — callers do not need a separate persistence step. `ConversationRoute.tsx` calls it directly as `onSelect={setSelectedItemId}` from its model picker. `CatalogView.tsx` already holds a `useNavigate()` instance and calls `navigate(<path>)` for other actions (e.g. building toolset/app editor URLs), and `ROUTES.Root === '/'` is the new-conversation start screen.

## Goals / Non-Goals

**Goals:**
- Make "Use in chat" functional for Model and Application catalog items: select as active deployment, navigate to `/`.
- Hide "Use in chat" for Toolset items without adding routing/context/i18n dependencies to `libs/catalog`.
- Keep the change minimal: reuse the existing prop-threading chain and existing selection/navigation primitives — no new context, no new API calls.

**Non-Goals:**
- Toolset selection for a deployment (separate feature).
- `?model=` deep-linking into `/` (future enhancement, not implemented here).
- Any change to Share, favorites, or About content behavior.
- Any change to `Header.tsx` layout beyond conditional rendering of the existing button.

## Decisions

**1. Visibility rule lives inside `Header.tsx` as a direct type check, not a new prop.**
`Header` already imports `CatalogItem`/`CatalogEntityType` (it receives `item: CatalogItem`). Adding `item.type !== CatalogEntityType.Toolset` as the render guard around the existing `PrimaryButton` requires no new prop, no change to `HeaderProps`, `DetailsPanelProps`, or `CatalogProps`, and no change to any lib consumer's call site. This is simpler than threading an `isPrimaryActionVisible?: (item) => boolean` predicate through three prop layers for a single, stable, enum-based rule.
- *Alternative considered*: optional `isPrimaryActionVisible?: (item: CatalogItem) => boolean` predicate prop on `DetailsPanelProps`/`CatalogProps`, defaulting to "visible for all types except Toolset" when absent. Rejected for this change because there is only one exclusion rule today and no current consumer needs to override it; introducing the predicate now is speculative generality. If a second entity type later needs custom visibility, revisit and promote to a predicate then.
- *Alternative considered*: reuse the existing (currently unused) `ItemDetailsTexts.hasPrimaryAction?: boolean` flag. Rejected — that flag is a static per-panel-instance text/config value supplied once by the app, not a per-item computed value, so it cannot express "visible for Model/Application, hidden for Toolset" within a single catalog session where both item types are shown.

**2. `onUseInChat` handler lives in `CatalogView.tsx`, built from existing hooks already in scope.**
`CatalogView.tsx` already calls `useDeployments()` (for `catalogItems` construction context) and `useNavigate()`. The handler is:
```ts
const handleUseInChat = useCallback(
  (item: CatalogItem) => {
    setSelectedItemId(item.id);
    navigate(ROUTES.Root);
  },
  [setSelectedItemId, navigate],
);
```
passed as `<Catalog ... onUseInChat={handleUseInChat} />`. No new context, no new server-api call — `setSelectedItemId` already persists to user config internally, matching the `ConversationRoute` model-picker pattern exactly.
- *Alternative considered*: dispatch a custom navigation-with-state event (`navigate(ROUTES.Root, { state: { deploymentId } })`) and have `ConversationRoute` read `location.state` to select on mount. Rejected — `setSelectedItemId` already persists synchronously and `ConversationRoute` already reads `selectedItemId` from context on render, so routing state would duplicate an existing, simpler mechanism and add a second source of truth for "what's selected."

**3. Closing the details panel is a side effect of navigation, not a separate explicit close call.**
`CatalogView` (or `Catalog` internally) already unmounts/hides the details panel on route change because the panel is part of the `/catalog` route tree, not `/`. Navigating to `ROUTES.Root` naturally unmounts the catalog page, which closes the details panel as a consequence — no explicit `closeDetailsPanel()` call is needed. This will be confirmed during implementation by checking how `Catalog`'s open/selected-item state is scoped (component-local state vs. lifted to `CatalogView`); if it turns out details-panel-open state is lifted to a context that outlives the route, an explicit reset will be added at that point.

## Risks / Trade-offs

- **[Risk]** If details-panel-open state is not naturally scoped to the `/catalog` route (e.g. lifted into a longer-lived context), navigating away and back could show a stale open panel. → **Mitigation**: verify state scoping during implementation (task in tasks.md); add an explicit close/reset call at the `onUseInChat` call site only if the naive navigation does not already clear it.
- **[Risk]** Widening `CatalogEntityType` in the future (e.g. a new non-selectable type) requires remembering to update the `Header.tsx` guard. → **Mitigation**: this is an accepted trade-off per Decision 1; if a second exclusion is needed, promote to the `isPrimaryActionVisible` predicate described as the rejected alternative.
- **[Trade-off]** No deep-link (`?model=`) support means a user cannot bookmark/share a "start chat with model X" URL from this flow. → Explicitly out of scope per the proposal; noted as a future enhancement only.
