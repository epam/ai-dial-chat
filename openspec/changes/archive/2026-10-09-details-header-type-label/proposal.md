## Why

`DetailsHeader` (and `DetailsPanel`) show the entity type through `EntityHeader` → `EntityTypeLabel`, which prints the raw `CatalogEntityType` value (`TOOLSET`, `SKILL`, …). A localised host — the DIAL Quick App editor, which now embeds `DetailsHeader` (#9338) — cannot translate it. `export-catalog-details-header-credentials` listed this as a follow-up non-goal.

## What Changes

- `@epam/ai-dial-chat-shared`:
  - `EntityTypeLabel` gains `label?: string`, the visible text; it defaults to `type`, so every current render is unchanged. The color still follows `type`.
  - `EntityHeader` gains `typeLabel?: string`, forwarded to `EntityTypeLabel`.
- `@epam/ai-dial-catalog`: `ItemDetailsTexts` gains `entityTypeLabels?: Partial<Record<CatalogEntityType, string>>`. The details header passes `texts.entityTypeLabels[item.type]` as `typeLabel`, so both `DetailsHeader` and `DetailsPanel` render a host-supplied type name.
- READMEs document the props.

## Non-goals

- Translating the chat app's own catalog type labels (it keeps passing nothing).
- The list view and card type labels (`EntityTypeCellRenderer`, `AppIdentity`); they can adopt `label` later.

## Acceptance criteria

- With no label, every rendered type is unchanged.
- `DetailsHeader` with `texts={{ entityTypeLabels: { TOOLSET: 'Toolset' } }}` shows "Toolset" for a toolset.
- lint, tests, `validate:docs`, `validate:specs`, the catalog and chat-shared builds pass.

## Capabilities

### Modified Capabilities

- `catalog-item-details-fetch`: the details header's type label is host-supplied.

## Impact

- Code: `libs/chat-shared/src/components/EntityTypeLabel/EntityTypeLabel.tsx`, `libs/chat-shared/src/components/EntityHeader/EntityHeader.tsx`, `libs/catalog/src/models/item-details-props.ts`, `libs/catalog/src/components/Details/Header/Header.tsx`, their specs, both READMEs.
- Additive and optional; minor-version bump. No API, BFF, i18n, RTL or flag impact.
