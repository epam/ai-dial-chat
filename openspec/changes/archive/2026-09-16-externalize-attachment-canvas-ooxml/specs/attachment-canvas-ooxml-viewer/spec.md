## MODIFIED Requirements

### Requirement: `OoxmlFileType` enum

`libs/attachment-canvas/src/types/attachment-canvas.ts` SHALL export a string enum naming the formats supported by the transitively installed `@silurus/ooxml` runtime:

```ts
export enum OoxmlFileType {
  Docx = 'docx',
  Xlsx = 'xlsx',
  Pptx = 'pptx',
  Csv = 'csv',
}
```

`OoxmlFileType` SHALL be re-exported from `libs/attachment-canvas/src/index.ts` as a value export, because the application boundary constructs `OoxmlCanvasContent` and must name its members.

**Rationale:** the format is what selects the renderer, and it crosses the library boundary. A closed enum owned by the library keeps the host from passing an arbitrary MIME string the library would have to re-parse, and makes adding a format a compile-time change on both sides. Whether the renderer code is packaged inside the canvas tarball or resolved from its runtime dependency is not part of this public enum contract.

#### Scenario: enum members exist

- **WHEN** a consumer imports `OoxmlFileType` from `@epam/ai-dial-attachment-canvas`
- **THEN** `OoxmlFileType.Docx` equals `'docx'`, `OoxmlFileType.Xlsx` equals `'xlsx'`, `OoxmlFileType.Pptx` equals `'pptx'`, and `OoxmlFileType.Csv` equals `'csv'`

### Requirement: `@silurus/ooxml` dependency and documentation

`libs/attachment-canvas/package.json` SHALL declare `@silurus/ooxml` under `dependencies` — a runtime dependency of the library, not a peer, because the library imports it directly and hosts do not configure it. The canvas library build SHALL leave the package and its exported subpath imports external, so npm installs the renderer transitively and the consuming bundler produces the final on-demand format chunks rather than publishing a private copy inside the canvas tarball.

`libs/attachment-canvas/README.md` SHALL document the content type, the `OoxmlFileType` enum with its members, and the `getOoxmlFileType` / `isOoxmlPreviewable` utilities, with examples using the exact exported names and the required props of `OoxmlCanvasContent`.

`docs/architecture.md` SHALL name the Office and CSV formats among the supported attachment types.

`npm run validate:docs` SHALL pass — it checks that every name a lib README imports is actually exported.

No new user-visible strings, RTL behavior, accessibility behavior, state ownership, memoization contract, feature flag, telemetry, endpoint, rate limit, or cache behavior is introduced by changing the package boundary.

#### Scenario: dependency is declared as an externalized runtime dependency

- **WHEN** `libs/attachment-canvas/package.json` and the Vite externalization matcher are read
- **THEN** `dependencies` contains `@silurus/ooxml`
- **AND** the matcher externalizes its bare name and exported subpaths

#### Scenario: consumer receives the runtime automatically

- **WHEN** a host installs `@epam/ai-dial-attachment-canvas`
- **THEN** npm also installs a compatible `@silurus/ooxml` version without requiring the host to declare it

#### Scenario: readme names match the public exports

- **WHEN** `npm run validate:docs` runs
- **THEN** it passes, confirming every name the README imports is exported from the package

#### Scenario: architecture doc lists the document formats

- **WHEN** the `@epam/ai-dial-attachment-canvas` row in `docs/architecture.md` is read
- **THEN** it names DOCX, XLSX, PPTX, and CSV among the supported attachment types
