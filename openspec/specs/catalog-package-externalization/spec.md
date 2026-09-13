# catalog-package-externalization Specification

## Purpose

`@epam/ai-dial-catalog`'s catalog and publish-panel features publish their runtime
dependencies and peers as external (including supported subpaths) rather than bundling
them, and own their CSS explicitly. A lightweight consumer that imports only a pure
mapping or enum from the package's root or catalog-mapping entry gets a packed bundle
free of grid, publication, and renderer implementation; a host that mounts the full
catalog or publish-panel feature gets exactly the styles that feature needs, without
inlined peer fonts or renderer styles it does not own.

## Requirements

### Requirement: External peers and owned styles

Catalog and publish-panel SHALL externalize declared peers, including supported
subpaths, and publish their own styles through stable exports. Their CSS SHALL NOT
inline unrelated peer fonts or renderer styles.

#### Scenario: Lightweight catalog mapping

- **WHEN** a packed consumer imports only CredentialsLevel from root or mapping
- **THEN** its retained JavaScript passes fixed raw/gzip budgets without grid,
  publication or renderer implementation.

#### Scenario: Rendered feature styling

- **WHEN** a host mounts catalog or publish-panel with documented styles and peers
- **THEN** the feature remains usable on supported desktop/mobile layouts and inherits
  host direction correctly.
