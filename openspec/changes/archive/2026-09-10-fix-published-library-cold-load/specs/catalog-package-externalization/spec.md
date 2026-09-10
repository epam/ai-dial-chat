## ADDED Requirements

### Requirement: External peers and owned styles

Catalog and publish-panel SHALL externalize declared peers, including supported subpaths, and publish their own styles through stable exports. Their CSS SHALL NOT inline unrelated peer fonts or renderer styles.

#### Scenario: Lightweight catalog mapping

- **WHEN** a packed consumer imports only CredentialsLevel from root or mapping
- **THEN** its retained JavaScript passes fixed raw/gzip budgets without grid, publication or renderer implementation.

#### Scenario: Rendered feature styling

- **WHEN** a host mounts catalog or publish-panel with documented styles and peers
- **THEN** the feature remains usable on supported desktop/mobile layouts and inherits host direction correctly.
