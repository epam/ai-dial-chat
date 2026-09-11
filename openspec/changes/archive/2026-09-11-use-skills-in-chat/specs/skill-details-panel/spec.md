# Spec Delta: skill-details-panel

## ADDED Requirements

### Requirement: `DetailsPanel` is exported and composable outside the Catalog page

The `DetailsPanel` component (today internal to `libs/catalog`, with only its `DetailsPanelProps` type exported) SHALL be exported from `@epam/ai-dial-catalog`'s public index so hosts can compose it into surfaces other than the Catalog page — e.g. the chat route's skill details side panel (`skill-input-attachment` delta). The export SHALL NOT change the component's behavior, props contract, or the details-resolution pipeline (manifest download + parse, file listing, content-first tabs for skills, independent degradation); mounting it outside the Catalog page SHALL NOT mount `CatalogView` (no tab persistence, sort/filter, or page chrome comes with it). The lib's README SHALL document the new export in the same change.

#### Scenario: Composing the panel outside the Catalog page

- **WHEN** a host imports `DetailsPanel` from `@epam/ai-dial-catalog` and renders it with a host-supplied `CatalogItem`, details fetch, and action handlers
- **THEN** it renders the same details layout and content-first tabs it shows on the Catalog page, without mounting the catalog's page chrome

#### Scenario: Catalog page behavior is unchanged

- **WHEN** the export lands and the Catalog page renders skill details
- **THEN** the page's details behavior is byte-identical to before the export
