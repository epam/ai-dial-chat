## ADDED Requirements

### Requirement: Heavy feature engines remain outside chat startup

The production chat SHALL exclude AG Grid community/React, Monaco/UIW editor
engines, PDF.js, KaTeX and react-syntax-highlighter JavaScript from the recursive
static initial graph. It SHALL retain working, reachable lazy feature chunks.

#### Scenario: Build budgets and graph exclusions

- **WHEN** a fresh production build is checked against a compatible UI Kit artifact
- **THEN** initial JS gzip is at most 1,100,000 bytes, CSS gzip at most 60,000
  bytes and their sum at most 1,160,000 bytes
- **AND** forbidden JavaScript module implementations are absent from every
  recursively reachable static entry/preload dependency
- **AND** AG Grid remains reachable across a dynamic import
- **AND** its initial graph contains production React runtimes

#### Scenario: Real feature activation after startup

- **WHEN** the production app runs with deterministic mock APIs at desktop and
  mobile widths
- **THEN** initial network requests, including immediate prefetches, contain no
  forbidden heavy implementation
- **AND** activating the file manager fetches Grid and renders a file row
- **AND** activating catalog list view renders a model row
- **AND** activating the prompt editor loads a working Markdown engine

### Requirement: Public package boundaries support repeatable verification

Catalog SHALL consume UI Kit `/grid`; editor loaders SHALL consume `/editors`.
Affected library builds SHALL externalize those public subpaths. Shared
file-manager UI SHALL have a dedicated optional entry with existing root
compatibility, while host API ownership stays at the app edge.

#### Scenario: Verify unpublished UI Kit without dependency drift

- **WHEN** an unpublished UI Kit is built, packed and temporarily installed for verification
- **THEN** only the installed UI Kit artifact is replaced and backed up
- **AND** other installed dependencies and the chat manifests remain unchanged
- **AND** an uncached production graph check can be repeated against that artifact
- **AND** local installation, diagnostics and mock browser tools are excluded
  from the delivered application and repository tooling
