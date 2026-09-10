## ADDED Requirements

### Requirement: Scoped and compatible hook distribution

The package SHALL preserve existing root exports and provide independently consumable scoped entries with documented peers. Pure utilities and source-content classification SHALL resolve without unrelated feature peers and meet fixed raw/gzip budgets. Root imports SHALL meet the same retained-code isolation contract with their documented resolution peers installed.

#### Scenario: Lightweight scoped consumer

- **WHEN** a consumer imports safeDecodeURIComponent or source-content classification through its scoped entry
- **THEN** a packed build excludes markdown, renderer, MCP and feature-initialization code.

#### Scenario: Source-content compatibility

- **WHEN** a URL has an inherited object-property extension or a PDF URL has parameterized MIME metadata
- **THEN** classification returns a string without throwing and preserves canonical PDF routing.

### Requirement: Shared feature initialization

Root and scoped imports SHALL share OAuth event and attachment-cache instances. Published sideEffects metadata SHALL retain required initialization while allowing unused features to be removed.

#### Scenario: Root subscription and scoped emit

- **WHEN** a consumer subscribes through root and emits through the OAuth entry
- **THEN** the subscriber receives exactly one event from the same module instance.

## MODIFIED Requirements

### Requirement: Consistent implementation dependency delivery

Runtime dependencies SHALL be externalized and declared exactly once in dependencies or peerDependencies. Preserved output SHALL use portable package imports, without vendored monorepo-relative dependency paths or duplicate bundled runtime copies. CSS is handled through the explicit stylesheet contract.

#### Scenario: Implementation dependencies are installed normally

- **WHEN** a consumer installs the package
- **THEN** dompurify, lru-cache, mime-types, yaml and fflate resolve through declared dependencies; unused implementations remain absent from lightweight bundles even though their packages are installed.

### Requirement: Verified tree shaking and accurate side-effect metadata

Dependency-light entries SHALL exclude unrelated feature code. sideEffects SHALL identify the OAuth/file-manager facades and stable preserved modules with required initialization. Root and scoped exports SHALL share module instances; metadata SHALL NOT retain an entire root barrel or depend on obsolete hashed chunk names.

#### Scenario: Required initialization survives production bundling

- **WHEN** a consumer explicitly imports OAuth or file-manager behavior
- **THEN** its required event/cache initialization is retained and shared through supported exports.

#### Scenario: Unrelated initialization is eliminated

- **WHEN** a consumer imports only a pure utility from root or its scoped entry
- **THEN** the fixed-budget and semantic-exclusion probes pass without feature initialization.
