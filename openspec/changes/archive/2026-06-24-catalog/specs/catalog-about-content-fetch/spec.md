## DEFERRED

This spec is out of scope for the current change. The backend endpoint `GET /api/v1/catalog/{id}/about` does not exist yet.

`apps/chat/src/components/CatalogView/CatalogView.tsx` retains the `Promise.resolve(undefined)` stub for `fetchAboutContent`. The `DetailsPanel` falls back to `item.description` when `aboutContent` is `undefined` — no regression.

Wire the real call once the endpoint ships.
