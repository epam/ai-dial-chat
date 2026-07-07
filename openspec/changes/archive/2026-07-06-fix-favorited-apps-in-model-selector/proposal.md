## Why

GitHub issue [#7610](https://github.com/epam/ai-dial-chat/issues/7610): favoriting an Application in the Catalog makes it invisible in the chat input's model selector dropdown — only favorited Models appear. The dropdown's favorites filter in `apps/chat/src/components/ModelPicker/ModelPickerPanel.tsx` hardcodes `type === CatalogEntityType.Model || type === CatalogEntityType.Agent`, silently excluding `CatalogEntityType.Application`.

`CatalogEntityType.Agent` is a frontend-only display category (used for catalog tabs, badge colors, etc. in `libs/catalog`) — DIAL Core has no "agent" concept, only "application". `mapDeploymentToCatalogItem` (`apps/chat/src/utils/map-deployment-to-catalog-item.ts`) never produces `CatalogEntityType.Agent`; it only maps Core's `model`/`toolset`/`application` deployment types to `CatalogEntityType.Model`/`Toolset`/`Application`. So in practice the existing filter's `Agent` branch is unreachable for real deployment data, and the filter effectively only ever let Models through. This breaks the "talk to a favorited app" flow entirely, since there is no workaround inside the chat input.

## What Changes

- `ModelPickerPanel.tsx`'s favorites filter (`talkableItems`) is extended to also include `CatalogEntityType.Application`, so favorited Applications appear in the model selector dropdown alongside Models. The existing (currently unreachable, for real data) `CatalogEntityType.Agent` check is kept as-is for forward compatibility, since it is a display category and not something this fix needs to remove.
- The filter continues to exclude non-selectable/non-"talkable" catalog entity types (e.g. `Toolset`, `Skill`, `Guardrail`, `Mcp`) that cannot be the target of a conversation.
- No change to how items are grouped/labeled is required; Models and Applications are listed together in the existing single list, consistent with the Catalog's own Favorites view (`CatalogView.tsx`), which already lists all favorited entity types without type filtering.

## Capabilities

### Modified Capabilities

- `catalog-model-selector`: the in-chat model selector's favorites list must include favorited Applications (not just Models/Agents), matching the Catalog's Favorites view behavior.

## Impact

- `apps/chat/src/components/ModelPicker/ModelPickerPanel.tsx` — `talkableItems` filter logic.
- Existing/new unit tests for `ModelPickerPanel` covering the favorites filter.
- No API, schema, or persistence changes; purely a frontend display-filter fix.
