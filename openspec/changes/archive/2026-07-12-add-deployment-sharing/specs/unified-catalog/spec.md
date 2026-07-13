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

### Requirement: initialDetailsItemId prop on CatalogProps
`CatalogProps` in `libs/catalog` SHALL expose an optional `initialDetailsItemId?: string` prop, so a host can deep-link into a specific item's details panel (e.g. from an accepted share invitation) without the lib knowing anything about routing or query params.

When `initialDetailsItemId` is set and matches an item in `items`, `Catalog` SHALL open that item's details panel automatically, reusing the same `handleOpenDetails` flow used for click-driven opens (fetch, loading state, and open animation included) — no parallel state machine. It opens at most once per distinct id (tracked via a ref), and is a no-op if no matching item is found or if the id has already been applied.

This is an additive, non-breaking change to the existing catalog API.

#### Scenario: Details panel opens automatically for a matching id
- **WHEN** `<Catalog items={[{ id: 'gpt-4o', ... }]} initialDetailsItemId="gpt-4o" />` is rendered
- **THEN** the details panel for `gpt-4o` opens without any click

#### Scenario: No-op when the id matches no item
- **WHEN** `initialDetailsItemId` does not match any item in `items`
- **THEN** the details panel does not open and no error is thrown

#### Scenario: Catalog renders correctly without initialDetailsItemId
- **WHEN** `<Catalog />` is rendered without `initialDetailsItemId`
- **THEN** the details panel opens only in response to a card click (no regression)
