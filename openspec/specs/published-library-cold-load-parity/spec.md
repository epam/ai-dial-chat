# published-library-cold-load-parity Specification

## Purpose

Published `@epam/ai-dial-*` libraries must not silently regress startup cost relative
to their source form. This capability defines the reproducible fixture, budgets, and
release gates that compare identical React hosts built against source and against
freshly packed tarballs: equal external dependency versions, isolated installation
with no workspace or registry substitution for internal artifacts, and a report that
includes source revision/content hashes, tarball integrity, raw/gzip startup JS,
CSS/assets, early dynamic requests, and retained module origins. It also verifies that
deferred features behave identically in a packed browser host, and that a normal npm
installation of the released package set has no hidden incompatibility.

## Requirements

### Requirement: Reproducible source-versus-packed verification

The fixture SHALL build identical React hosts, startup hooks, conversation sources and
mapping paths against source and freshly packed libraries with equal external
versions. Packed mode SHALL use isolated installation without workspace or registry
substitution for internal artifacts. Reports SHALL include source revision/content
hashes, tarball integrity, raw/gzip initial JS, CSS/assets, early dynamic requests and
retained module origins. Missing required metadata SHALL fail verification.

#### Scenario: Resolution fallback

- **WHEN** any retained module resolves outside the fixture's allowed roots or an
  internal tarball integrity differs
- **THEN** verification fails and identifies the offending path/package.

### Requirement: Blocking startup budgets

CI SHALL enforce packed/source <= 1.20 for raw/gzip static and browser-observed
startup JS, fixed JS/CSS/assets ceilings, and independent semantic exclusions.
Requests started before first usable render SHALL count even when their responses
arrive later. Tiny probes SHALL use committed fixed ceilings, not automatically
inflated source-derived budgets.

Empty startup SHALL exclude file-manager/AG Grid, publication/editor, Monaco, PDF/office
engines, KaTeX and syntax highlighting. Pure probes SHALL additionally exclude
unrelated markdown/MCP and initialization. Required scenario code SHALL remain
exercised.

#### Scenario: Early dynamic request

- **WHEN** a heavy import starts before the ready marker but finishes afterward
- **THEN** its bytes and module origins remain in startup accounting.

#### Scenario: Inflated source or hidden heavy implementation

- **WHEN** a ratio passes but an absolute ceiling or semantic exclusion fails
- **THEN** CI fails; raising thresholds solely to accommodate the defect is not
  completion.

### Requirement: Functional deferred features

A packed browser host SHALL verify first-open/reopen, required styles/assets, shared
OAuth/cache identity and supported desktop/mobile/RTL rendering for
catalog/publication, file-manager, markdown/code/math and attachment PDF/office/editor
features. Deterministic adapters SHALL supply host behavior. Same-document loader
retry SHALL be distinguished from full-page reload recovery.

#### Scenario: Feature recovery

- **WHEN** a feature load fails once and the host retries within the same document
- **THEN** it becomes functional and styled without duplicated shared state or a stuck
  loader.

### Requirement: Coherent release and migration

Normal npm installation SHALL consume the complete compatible internal peer closure,
with actual export/declaration checks and no force, legacy-peer-deps or overrides
concealing incompatible ranges. Migration documentation SHALL use supported exports
and describe upgrading and rolling back the complete package set and lockfile.

#### Scenario: Existing mixed-release artifacts

- **WHEN** installed artifacts include a consumer whose exact internal peer range
  conflicts with the chosen release
- **THEN** verification identifies the conflicting edge using existing local versions,
  rather than passing a negative test because a registry version is missing.
