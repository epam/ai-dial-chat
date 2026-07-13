## Why

Users who own a QuickApp (application) or a toolset in the Catalog have no way to remove it — the details panel only offers Edit and Share. The toolset delete endpoint (`DELETE /api/v1/toolsets/:toolsetName`) already exists on the backend but is unused by the frontend, and there is no equivalent endpoint for applications at all. Users need a Delete action, gated to items they own, with the same one-click interaction model as Edit and Share.

## What Changes

- Add a **Delete** action button to the Catalog details header (`Header.tsx`), shown only when the displayed item is a QuickApp (`CatalogEntityType.Application`) or a Toolset that the current user owns (`isMyApp: true`) — never for Models or other entity types.
- Place the Delete button on the same action row as Edit and Share, immediately after Share.
- Clicking Delete calls `onDelete` immediately — no confirmation popup. The button disables while the delete request is in flight and re-enables when it settles; failure feedback (e.g. a notification) is the responsibility of the app supplying `onDelete`, not the lib.
- On successful delete, `apps/chat` calls the existing `deleteToolset` server-api for toolsets, and a new `deleteApplication` server-api for QuickApps; on success the details panel closes, the item is removed from the catalog list, and a success notification is shown.
- **BREAKING**: none — this is additive to `CatalogProps`/`DetailsPanelProps` (new optional `onDelete` prop) and to the backend API surface (new endpoint).
- Add a backend `DELETE /api/v1/applications/:applicationName` endpoint in `apps/chat-api`, mirroring the existing `toolsets.controller.ts`/`toolsets.service.ts` delete pattern: resolve the caller's bucket/path, proxy to DIAL Core's `deleteCustomApplication`, invalidate the per-user applications list cache, and map DIAL Core error statuses to typed HTTP responses.
- Regenerate `libs/chat-api-client` (`npm run openapi`) once the new endpoint is added, and add a thin `deleteApplication` wrapper in `apps/chat/src/server-api/applications.ts`.

## Capabilities

### New Capabilities

- `catalog-my-item-delete-action`: The Catalog details panel's Delete action — visibility rules (own application or toolset only), placement next to Edit/Share, the one-click delete UX (loading/error states, no confirmation step), and `apps/chat`'s wiring of the action to the toolset/application delete APIs, list refresh, and notifications.

### Modified Capabilities

- `applications-write-api`: Adds a `DELETE /api/v1/applications/:applicationName` endpoint (versioned, rate-limited, validated, cache-invalidating, DIAL Core error-mapped) alongside the existing create endpoint.

## Impact

- **`libs/catalog`**: `models/item-details-props.ts` (new `onDelete` prop + delete-related `ItemDetailsTexts` entries), `models/catalog-props.ts` (passthrough), `components/Details/DetailsPanel.tsx` (wiring), `components/Details/Header/Header.tsx` (renders the new button), new `components/Details/Header/DeleteButton/DeleteButton.tsx` (visibility rule, one-click delete, loading/error state, mirroring `ShareButton`'s visibility pattern).
- **`apps/chat`**: `components/CatalogView/CatalogView.tsx` (`handleDelete`, list refresh, notifications), `server-api/applications.ts` (new `deleteApplication`), `server-api/toolsets.ts` (start using the existing `deleteToolset`), `constants/translation-keys.ts` + `i18n/locales/en.json` (new keys), `context/DeploymentsContext`/toolsets loading (whatever refresh mechanism the catalog list uses today).
- **`apps/chat-api`**: `applications/applications.controller.ts`, `applications/applications.service.ts`, a new param DTO analogous to `toolsets/dto/get-toolset.dto.ts`, `openspec/specs/applications-write-api/spec.md`.
- **`libs/chat-api-client`**: regenerated `openapi.json` and generated SDK (`npm run openapi`, `npm run openapi:check`).
