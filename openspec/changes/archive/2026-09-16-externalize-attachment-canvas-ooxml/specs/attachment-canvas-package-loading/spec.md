## MODIFIED Requirements

### Requirement: Declared runtime packages are never bundled as private duplicate copies

Every JavaScript package declared in `dependencies` or `peerDependencies` of `@epam/ai-dial-attachment-canvas` SHALL be externalized from the library's built bundle, including any subpath import resolved beneath that package name. Peer dependencies SHALL resolve to the host application's installed copy. Runtime dependencies, including `@silurus/ooxml`, SHALL be installed transitively by npm and resolved from that installed package when the consuming application builds. CSS subpath imports that Vite must process into emitted stylesheets SHALL remain locally resolved rather than becoming raw external CSS imports.

`@silurus/ooxml` SHALL remain in `dependencies`, not `peerDependencies`, because the library imports and owns use of that renderer while hosts neither configure it nor name it in the public canvas contract.

#### Scenario: A peer-declared engine is absent from the bundle

- **WHEN** the built package's PDF or syntax-highlighting dynamic chunk is inspected
- **THEN** it contains no bundled implementation code for any package listed in `peerDependencies`, only an external module reference resolved at the host's install time

#### Scenario: OOXML format imports remain external and on demand

- **WHEN** the built canvas output is inspected
- **THEN** it retains dynamic external imports for `@silurus/ooxml/docx`, `@silurus/ooxml/xlsx`, `@silurus/ooxml/pptx`, and `@silurus/ooxml/chart-ex`
- **AND** it contains no private OOXML renderer or worker implementation chunks

#### Scenario: OOXML is installed transitively

- **WHEN** a clean consumer installs only the packed `@epam/ai-dial-attachment-canvas` artifact and its declared dependency closure
- **THEN** `@silurus/ooxml` is installed without being declared by the consumer as a peer
- **AND** the consumer bundler resolves every referenced OOXML subpath

#### Scenario: Vendor CSS remains buildable

- **WHEN** a declared package exposes a CSS subpath imported by the canvas build
- **THEN** Vite resolves and extracts that stylesheet instead of leaving an unresolved external CSS specifier

### Requirement: Built-package boundary and consumer-fixture verification

The package SHALL have automated tests that verify its **built** output — not the `@epam/source` workspace-alias entry — proves the static-exclusion, CSS-splitting, export-resolution, and external OOXML requirements above, plus a minimal fixture that installs the packaged tarball and imports only its public exports. Package verification SHALL measure the packed artifact and fail if private OOXML renderer or worker chunks materially inflate it again.

#### Scenario: Package-boundary test walks the built entry's dependency closure

- **WHEN** the package-boundary test suite runs against a freshly built `dist/`
- **THEN** it asserts the base entry's static closure excludes PDF.js, the PDF worker, PDF-only CSS, `react-syntax-highlighter`, and OOXML implementation code
- **AND** it separately asserts the expected external dynamic import boundaries and CSS assets exist

#### Scenario: Consumer fixture builds against the packaged tarball

- **WHEN** the consumer fixture installs the package from a packed tarball and imports its public root and `./styles.css`
- **THEN** the fixture builds successfully and resolves the base stylesheet
- **AND** PDF, syntax-highlighter, and OOXML engines are absent from the eager graph and present only in on-demand consumer chunks

#### Scenario: Packed artifact stays below the OOXML-free size budget

- **WHEN** the freshly built package is packed using the publish-ready manifest
- **THEN** its compressed and unpacked sizes remain within ceilings measured from the externalized implementation
- **AND** those ceilings are low enough to fail if the current multi-megabyte OOXML implementation chunks return
