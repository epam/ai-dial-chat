# attachment-canvas-package-loading Specification

## Purpose

The published `@epam/ai-dial-attachment-canvas` package's build and load boundaries: which exports resolve to real build artifacts, which engine code (PDF, syntax highlighting) stays out of the static import graph, how PDF-only CSS is split from the base stylesheet, how peer-declared engines are excluded from the bundle, and how the package's PDF dependency versions and built-package boundary are verified.

## Capability: attachment-canvas-package-loading

### Overview

`libs/attachment-canvas` ships PDF preview and syntax-highlighted code viewing as heavy, on-demand engines (`pdfjs-dist`, `@epam/ai-dial-react-pdf-highlighter`, `@epam/pdf-highlighter-kit`, `react-syntax-highlighter`) behind existing dynamic-import boundaries. This capability governs the package's build and packaging boundary so that promise stays true for real consumers: statically importing the package root must not pull in that engine code or its CSS, every `package.json` `exports` target must resolve to a real build artifact, peer-declared engines must never be duplicated inside the bundle, and the PDF dependency versions must resolve to one consistent, installable tree. A built-package boundary test suite and a consumer fixture that installs the packed tarball verify these properties against the actual `dist/` output rather than the `@epam/source` workspace alias.

---

## Requirements

### Requirement: Published package exports resolve to real build artifacts

Every path target in `libs/attachment-canvas/package.json`'s `exports` map SHALL exist at that exact path in the built package output. In particular, the `"./styles.css"` subpath SHALL resolve to the actual base stylesheet file name Vite emits, not to a path no build step produces.

#### Scenario: Resolving the base stylesheet subpath

- **WHEN** a consumer imports `@epam/ai-dial-attachment-canvas/styles.css` after installing the built package
- **THEN** the import resolves to a file that exists in the package's published output and contains the base component styles

#### Scenario: A missing exports target fails verification

- **WHEN** any `exports` map entry points at a file the build does not produce
- **THEN** the package's build/publish verification fails rather than reporting success with an invalid artifact

### Requirement: PDF-only CSS loads separately from the base stylesheet

Vendor CSS required only by the PDF preview feature (the styles `PdfContent` imports for `@epam/ai-dial-react-pdf-highlighter` and `@epam/pdf-highlighter-kit`) SHALL be emitted in a build output file distinct from the package's base stylesheet, and SHALL load only when the PDF feature's own lazy chunk loads. Importing the package root and its base stylesheet, then rendering any non-PDF and non-highlighted-code attachment, SHALL NOT cause the PDF vendor CSS to be requested.

#### Scenario: Rendering a non-PDF attachment after importing the base stylesheet

- **WHEN** a consumer imports the package root and `./styles.css`, then renders an image, text, JSON, markdown, HTML, or OOXML attachment
- **THEN** no PDF-vendor stylesheet is requested by the browser

#### Scenario: Opening a PDF attachment loads its CSS alongside its JS chunk

- **WHEN** an attachment resolves to `AttachmentContentType.Pdf` for the first time
- **THEN** the PDF-only stylesheet loads at the same time as the PDF feature's dynamically imported JS chunk, with no flash of unstyled PDF UI

### Requirement: Base package import excludes PDF and syntax-highlighting engine code

Statically importing the package root SHALL NOT include `pdfjs-dist` implementation code, a PDF worker script, `@epam/ai-dial-react-pdf-highlighter` or `@epam/pdf-highlighter-kit` implementation code, or `react-syntax-highlighter` implementation code in the resulting static import graph. Plain text content and code content with no highlighting language (or `language: 'plaintext'`) SHALL continue to render synchronously with no dynamic import.

#### Scenario: Base entry contains no PDF or syntax-highlighter engine code

- **WHEN** the built package entry's static import graph is inspected
- **THEN** it contains no `pdfjs-dist`, PDF worker, PDF-highlighter, or `react-syntax-highlighter` implementation code, only the existing dynamic-import boundaries that load them on demand

#### Scenario: Plain text and unhighlighted code render without a dynamic import

- **WHEN** `CodeContent` renders content with `language` unset or equal to `'plaintext'`
- **THEN** the text renders immediately with no `react-syntax-highlighter` dynamic import triggered

### Requirement: Declared peer engines are never bundled as private duplicate copies

Every package declared as a `peerDependency` of `@epam/ai-dial-attachment-canvas` SHALL be externalized from the built bundle, including any subpath import a peer's own code resolves, so the built artifact defers entirely to the host application's own resolved copy at runtime. A package intentionally bundled into the published artifact (such as `@silurus/ooxml`'s on-demand format renderers) SHALL be declared as a runtime `dependency`, not a `peerDependency`, and SHALL NOT also appear in the peer list.

#### Scenario: A peer-declared engine is absent from the bundle

- **WHEN** the built package's PDF or syntax-highlighting dynamic chunk is inspected
- **THEN** it contains no bundled implementation code for any package listed in `peerDependencies`, only an external module reference resolved at the host's install time

#### Scenario: Intentionally bundled OOXML renderers are unaffected

- **WHEN** a DOCX, XLSX, or PPTX attachment is opened
- **THEN** the corresponding `@silurus/ooxml` format entry loads on demand exactly as before this change, since it is a runtime dependency, not an externalized peer

### Requirement: PDF dependency versions are aligned and installable without conflict

The declared version ranges for `pdfjs-dist`, `@epam/ai-dial-react-pdf-highlighter`, and `@epam/pdf-highlighter-kit` SHALL describe one mutually compatible combination, and a clean install from the regenerated lockfile SHALL resolve a single version of each with no invalid, duplicate, or unmet dependency entries.

#### Scenario: Clean install resolves one consistent PDF dependency tree

- **WHEN** `package-lock.json` is regenerated and a clean install is run
- **THEN** dependency-tree inspection shows exactly one resolved version each of `pdfjs-dist`, `@epam/ai-dial-react-pdf-highlighter`, and `@epam/pdf-highlighter-kit`, with no invalid or unmet entries

### Requirement: Built-package boundary and consumer-fixture verification

The package SHALL have automated tests that verify its **built** output — not the `@epam/source` workspace-alias entry — proves the static-exclusion, CSS-splitting, and export-resolution requirements above, plus a minimal fixture that installs the packaged tarball and imports only its public exports.

#### Scenario: Package-boundary test walks the built entry's dependency closure

- **WHEN** the package-boundary test suite runs against a freshly built `dist/`
- **THEN** it asserts the base entry's static closure excludes PDF.js, the PDF worker, PDF-only CSS, and `react-syntax-highlighter`, and separately asserts the expected dynamic chunks and CSS assets exist

#### Scenario: Consumer fixture builds against the packaged tarball

- **WHEN** the consumer fixture installs the package from a packed tarball and imports its public root and `./styles.css`
- **THEN** the fixture builds successfully, resolves the base stylesheet, contains no duplicate PDF/syntax-highlighter engine copies, and demonstrates that PDF/code assets load only on demand
