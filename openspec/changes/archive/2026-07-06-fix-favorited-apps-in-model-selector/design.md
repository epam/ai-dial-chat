## Context

`ModelPickerPanel.tsx` builds the in-chat model selector's list from the user's favorited catalog items (sourced via `useFavoriteApplications()` in `ConversationView.tsx`, mapped through `mapDeploymentToCatalogItem`). The panel then narrows that list to only `talkableItems` — entities that are valid conversation targets — with:

```ts
const talkableItems = useMemo(
  () =>
    favorites.filter(
      (f) => f.type === CatalogEntityType.Model || f.type === CatalogEntityType.Agent,
    ),
  [favorites],
);
```

`CatalogEntityType.Application` is missing from this allowlist, so favorited Applications never reach the dropdown. `CatalogEntityType.Agent` is a frontend-only display category (catalog tabs, badge colors in `libs/catalog`) — DIAL Core has no "agent" concept. `mapDeploymentToCatalogItem` only ever maps Core's `model`/`toolset`/`application` deployment types to `CatalogEntityType.Model`/`Toolset`/`Application`; it never produces `CatalogEntityType.Agent` for real data. So the current filter's `Agent` branch is effectively dead code and the filter passes through Models only. `CatalogView.tsx`'s own Favorites view has no type filter at all and correctly shows every favorited entity.

## Goals / Non-Goals

**Goals:**
- Favorited Applications appear in the model selector dropdown, selectable the same way as Models/Agents.
- Non-conversational entity types (Toolset, Skill, Guardrail, Mcp) remain excluded from this dropdown, since they are not valid "talk to" targets.

**Non-Goals:**
- No change to how the Catalog's own Favorites view filters or renders (already correct).
- No change to grouping/sectioning (Models vs Apps) in the dropdown — items remain a single flat list, matching current UX.
- No change to favoriting/persistence logic (`useFavoriteApplications`, favorites API).

## Decisions

- **Switch to an allowlist that includes `Application`** rather than inverting to a denylist: `talkableItems` filters for `type === Model || type === Agent || type === Application`. An allowlist keeps the "what's conversational" decision explicit and matches the existing code style, so any future non-conversational `CatalogEntityType` added later is excluded by default instead of silently leaking in.
  - Alternative considered: denylist (`type !== Toolset && type !== Skill && ...`). Rejected — it fails open for any new entity type added to the enum, which is the same class of bug being fixed here.
- **Keep the `Agent` check even though it is unreachable for current real data.** `Agent` remains a valid enum value used elsewhere (catalog tabs/badges) and nothing in this fix's scope changes how `mapDeploymentToCatalogItem` assigns types. Removing the `Agent` branch would be an unrelated cleanup with no observable effect today, and risks silently breaking behavior if a future change starts producing `CatalogEntityType.Agent` from Core data (e.g. a later mapping refinement).

## Risks / Trade-offs

- [Risk] A future non-conversational entity type could be miscategorized as `Model`/`Agent`/`Application` upstream in `mapDeploymentToCatalogItem`, reintroducing incorrect items in the dropdown → Mitigation: this is an existing mapping concern outside this fix's scope; the allowlist here only decides which already-correct types are conversational.
- [Risk] None to persistence or API surfaces — this is a pure client-side render-filter change with no data model impact.
