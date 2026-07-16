## Why

Toolsets and MCP-capable applications each expose a DIAL Core MCP endpoint, but the Catalog details sidebar gives users no way to discover or copy that endpoint URL. Users who want to wire a toolset or an MCP application into an external workflow currently have no supported path to obtain the connection URL from inside the Catalog UI. Adding a `Connect` action next to the existing `Share`/`Publish`/`Edit` actions closes this gap using the same anchored-popover pattern already established for `Share`.

## What Changes

- Add a `Connect` action button to the Catalog item details sidebar header, rendered after all existing action buttons (`Use in chat`, `Edit`, `Share`, `Delete`, `Publish`, credentials). The button matches the visual and interaction pattern of the existing `Share` button: neutral style, leading plug icon, trailing chevron-down icon, opens an anchored `DialDropdown` popover, closes on outside click, and wires `aria-haspopup`/`aria-expanded`.
- Add generic, host-agnostic props to `libs/catalog` (`connectOverlay`, `isConnectVisible`, and a details-text override for the button label) so the button and popover container follow the same "lib renders neutral trigger, host supplies popover content" split already used for `Share`.
- In `apps/chat`, add a popover content component that shows a type-specific title and description and a `Copy URL` button (no URL input/read-only field). Copying uses the same clipboard-copy-with-feedback pattern used elsewhere in the app.
- Add a frontend URL-building utility in `apps/chat` that composes the MCP endpoint URL from a client-safe DIAL Core external base URL and an entity id, matching the encode-per-segment behavior already used by the backend's DIAL resource path encoder.
- Expose a new client-safe configuration value for the public DIAL Core external URL through the existing client-config endpoint and `AppConfigContext`, so `apps/chat` can resolve it without any new internal-URL exposure.
- Add a host-neutral `supportsMcp` flag to the catalog item model, populated from a new `features.mcp` field on the deployments list DTO, so `CatalogView` can decide per-item Connect visibility without an extra details fetch.
- Wire `CatalogView` to show `Connect` for every toolset (when the DIAL Core external URL is configured) and for applications only when they support MCP and the external URL is configured; models, guardrails, skills, MCP pseudo-items, and non-MCP applications never show it.

## Capabilities

### New Capabilities

- `catalog-connect-action`: the `Connect` header action in the Catalog details sidebar — the host-agnostic button/popover-trigger in `libs/catalog`, the app-level popover content and MCP-endpoint URL helper in `apps/chat`, and the `CatalogView` visibility/wiring integration.

### Modified Capabilities

- `deployments-api`: `DeploymentItemDto.features` gains an optional `mcp` boolean, sourced from DIAL Core's `features.mcp`, so list items carry MCP-support information without a details fetch.
- `config-registry-and-env-provider`: `CONFIG_DEFINITIONS` gains a new `visibility: 'client'` entry for the public DIAL Core external URL, sourced from a dedicated external-URL environment variable (not the existing internal-only DIAL Core URL variable).
- `client-config-endpoint`: the `GET /api/v1/client-config` response's `config` object gains the new external-URL field.
- `app-config-context`: `AppConfigState.config` gains the resolved DIAL Core external URL field, following the existing bootstrap-load pattern.

## Impact

- **Affected code:** `libs/catalog` (models, `Header`, new `ConnectButton`), `apps/chat` (`CatalogView`, new popover container, new MCP URL helper, `AppConfigContext`, `map-deployment-to-catalog-item.ts`, i18n locale + translation-key enum), `apps/chat-api` (`environment.config.ts`, config registry definitions, `deployment-item.dto.ts`, `deployments.service.ts`, `raw-deployment.dto.ts`).
- **Generated client:** `libs/chat-api-client` regenerated after the `DeploymentItemDto`/client-config DTO changes (`npm run openapi`), no hand edits.
- **Config surface:** one new environment variable for the public DIAL Core external URL; no change to the existing internal DIAL Core URL variable's visibility.
- **No breaking changes** to existing Catalog props, DTOs, or endpoints — all additions are optional/additive.
