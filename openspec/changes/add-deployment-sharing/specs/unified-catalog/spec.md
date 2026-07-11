## ADDED Requirements

### Requirement: shareOverlay render-prop on CatalogProps and DetailsPanelProps
`CatalogProps` and `DetailsPanelProps` in `libs/catalog` SHALL expose an optional `shareOverlay?: (item: CatalogItem, onClose: () => void) => ReactNode` prop. When provided, it is passed through `Catalog → DetailsPanel → Header` without modification. The lib SHALL NOT inspect the rendered content, import the host app's API client, or reference any endpoint path.

This is an additive, non-breaking change to the existing catalog API.

RTL impact: none — the prop is a render function; direction is inherited by the rendered content from the `<html dir>` attribute.

#### Scenario: shareOverlay passed through to Header
- **WHEN** `<Catalog shareOverlay={fn} />` is rendered and a detail panel opens
- **THEN** the `Header` component receives the same `fn` as its `shareOverlay` prop

#### Scenario: Catalog renders correctly without shareOverlay
- **WHEN** `<Catalog />` is rendered without `shareOverlay`
- **THEN** the detail header renders the Share button with the original `onShare` callback behavior (no regression)
