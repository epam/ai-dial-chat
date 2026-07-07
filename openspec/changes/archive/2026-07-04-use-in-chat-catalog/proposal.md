## Why

The catalog's "Use in chat" button in the details panel is rendered but wired to no handler in `apps/chat`, so clicking it does nothing. Users who find a model or application in the catalog have no way to jump straight into a new chat with it selected — they must close the catalog and manually pick the deployment again from the model selector.

## What Changes

- Wire `onUseInChat` in `apps/chat/src/components/CatalogView/CatalogView.tsx`: for a Model or Application catalog item, set it as the selected deployment via `DeploymentsContext.setSelectedItemId` (persisted to user config, same as the model picker) and navigate to `ROUTES.Root` (`/`).
- Close the catalog details panel as part of/before this navigation.
- Hide the "Use in chat" button entirely for Toolset items in `libs/catalog/src/components/Details/Header/Header.tsx`, since toolsets cannot be selected as a conversation deployment. Implemented via a visibility predicate (e.g. `item.type !== CatalogEntityType.Toolset`, or an optional `isPrimaryActionVisible?: (item) => boolean` prop) — no routing, context, or i18n imports added to the lib.

## Capabilities

### New Capabilities
- `catalog-use-in-chat`: Clicking "Use in chat" on a Model or Application catalog item selects it as the active chat deployment and navigates to the new-conversation start screen; the button is hidden for Toolset items.

### Modified Capabilities
(none — `catalog-toolsets` and `catalog-model-selector` behavior is unchanged; this only adds a new interaction on top of existing selection/navigation primitives)

## Impact

- `apps/chat/src/components/CatalogView/CatalogView.tsx` — pass `onUseInChat` handler to `Catalog`, using `useDeployments()` and `useNavigate()`.
- `libs/catalog/src/components/Details/Header/Header.tsx` — conditionally render the primary action button.
- `libs/catalog/src/models/item-details-props.ts` (or equivalent props file) — possible new optional predicate prop.
- Tests: `CatalogView` handler test, `Header` visibility test (Model/Application show, Toolset hides).
- No backend, API, or i18n changes.
