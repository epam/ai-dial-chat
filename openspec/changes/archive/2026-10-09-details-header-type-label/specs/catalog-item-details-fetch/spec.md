## ADDED Requirements

### Requirement: The details header's entity type label is host-supplied

`EntityTypeLabel` (`libs/chat-shared/src/components/EntityTypeLabel/EntityTypeLabel.tsx`) SHALL accept `label?: string` and render it in place of the raw `type`, keeping the color derived from `type`. `EntityHeader` (`libs/chat-shared/src/components/EntityHeader/EntityHeader.tsx`) SHALL accept `typeLabel?: string` and forward it.

`ItemDetailsTexts` (`libs/catalog/src/models/item-details-props.ts`) SHALL accept `entityTypeLabels?: Partial<Record<CatalogEntityType, string>>`. The details header (`libs/catalog/src/components/Details/Header/Header.tsx`), rendered by `DetailsPanel` and exported as `DetailsHeader`, SHALL pass `texts.entityTypeLabels[item.type]` to `EntityHeader` as `typeLabel`. A type without an entry SHALL keep the raw value.

#### Scenario: A host translates the type

- **WHEN** `DetailsHeader` renders a toolset with `texts={{ entityTypeLabels: { TOOLSET: 'Toolset' } }}`
- **THEN** the header shows "Toolset" and not "TOOLSET"

#### Scenario: Default unchanged

- **WHEN** no `entityTypeLabels` entry exists for the item's type
- **THEN** the header shows the raw type value, as before
