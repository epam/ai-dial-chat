# chat-shared-package-distribution Specification

## Purpose

`@epam/ai-dial-chat-shared` (`libs/chat-shared`) publishes its shared types and
utilities so that a lightweight consumer — one importing only a root enum or pure
utility — gets a packed bundle free of markdown, grid, and renderer implementation,
while a consumer that opts into a heavier feature (markdown rendering, file-manager
integration) still gets that feature's required styles and shared module identity.
Root exports stay synchronous and portable: declared runtime dependencies and peers
remain external rather than bundled, and the published tarball resolves outside the
workspace without monorepo-relative vendored paths.

## Requirements

### Requirement: Tree-shakeable compatible distribution

The package SHALL preserve synchronous root exports and portable module boundaries.
Declared runtime dependencies and peers SHALL remain external. Root consumers may
install the documented feature peer closure for resolution; unrelated implementations
SHALL be eliminated from a lightweight production bundle.

#### Scenario: Root enum import

- **WHEN** a packed consumer imports only FilterTab or CodeBlockTheme with documented
  peers installed
- **THEN** it passes fixed raw/gzip probe budgets and excludes markdown, grid and
  renderer implementations.

#### Scenario: Portable packed output

- **WHEN** a tarball is installed outside the workspace
- **THEN** all public exports resolve without monorepo-relative vendored imports.

### Requirement: Feature-owned styles and state

Markdown and file-manager entry points SHALL retain required styles and shared
identities without forcing unrelated feature initialization into lightweight
consumers.

#### Scenario: Deferred feature use

- **WHEN** the host opens a feature through its scoped entry
- **THEN** it renders with its required styles/assets and shares state with compatible
  root imports.
