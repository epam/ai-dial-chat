# published-library-cold-load-parity Specification

## Purpose

Published `@epam/ai-dial-*` libraries must not silently regress startup cost relative
to their source form. This capability defines the reproducible fixture, budgets, and
release gates that compare identical React hosts built against source and against
freshly packed tarballs: equal external dependency versions, isolated installation
with no workspace or registry substitution for internal artifacts, and a report that
includes source revision/content hashes, tarball integrity, raw/gzip startup JS,
CSS/assets, early dynamic requests, and retained module origins. It also checks, in source and packed browser hosts, that a
fixed set of deferred features stays off the startup path, loads on first open and is
not re-fetched on reopen (with mobile/RTL, stylesheet and failure-recovery checks for
the markdown feature only), and that a normal npm installation of the released package
set has no hidden incompatibility. Browser coverage it does not yet have is listed as
known gaps.

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

The browser-parity check SHALL load the source and packed application fixtures in headless Chromium and verify, for
each entry of `DEFERRED_FEATURES` in `libs/chat-hooks/e2e-fixtures/application-mode.mjs`
— `catalog` (`Catalog`), `publishPanel` (`PublishPanel`), `markdown`
(`MarkdownRenderer`) and `fileManagerUi` (`DialFileManagerShell`) — that, starting
from a freshly reloaded document, its first new JS chunk is not requested before the
ready marker, a new JS chunk is requested when the feature is opened, the mounted root
has a non-zero layout box, and reopening after `__closeFeature` does not re-fetch that
chunk. The check is `libs/chat-hooks/e2e-fixtures/browser-parity.mjs`, run as the Nx
target `@epam/ai-dial-chat-hooks:test-packed-browser-parity` by the PR workflow. Each
feature is mounted by a fixture opener (`__openCatalogFeature`,
`__openPublishPanel`, `__openMarkdownFeature`, `__openFileManagerFeature`) with fixed,
inert props (empty lists, no-op callbacks, a stub file-manager controller) standing in
for host behaviour. The run SHALL also verify OAuth identity: no
`__oauthIdentityEvents` before `./oauth` is opened, and exactly one event carrying
`toolsetId: 'browser-parity-fixture'` after `__openOAuthAndEmit`.

For the markdown feature only, the run SHALL additionally verify:

- **Recovery via page reload** (`checkMarkdownReloadAndAssets`): the first markdown
  chunk request is aborted, the first `__openMarkdownFeature()` rejects, the page is
  reloaded (`page.reload`), and the second open succeeds, renders KaTeX math
  (`.katex`), fetches a stylesheet, and logs no console error other than the aborted
  request's `net::ERR_FAILED`.
- **Mobile + RTL** (`checkMobileRtlRender`): at a 375×812 viewport with
  `<html dir="rtl" lang="ar">`, the feature renders math with a non-zero layout box and
  `#markdown-feature-root`'s computed `direction` is `rtl`.

The deferred-feature mounts run at Playwright's default (desktop-width) viewport in
LTR. Known gaps — not verified by any fixture today, and recorded as open task 2.6 of
the archived change `2026-09-10-fix-published-library-cold-load`:

- **Same-document loader retry** — recovery is proven only across a full-page reload;
  retrying a failed feature load within the same document is not exercised.
- **Attachment PDF/office/editor features** — no attachment renderer is in
  `DEFERRED_FEATURES`; their first-open/reopen behaviour in a packed browser host is not
  covered.
- **Per-feature styles/assets, mobile and RTL for catalog, publication and file-manager**
  — those features are checked only for chunk loading, a non-zero layout box and
  reopen; stylesheet/asset loading, mobile layout and RTL are checked for markdown only.
- **Shared cache identity** — only the OAuth `EventTarget` singleton is checked; no
  shared cache instance is compared across entries.

#### Scenario: Deferred feature loads on open and not before

- **WHEN** a `DEFERRED_FEATURES` entry is opened in a freshly reloaded source or packed
  fixture document
- **THEN** its chunk was not requested before the ready marker, a new chunk is requested
  on open, its root has a non-zero layout box, and reopening does not re-fetch the chunk

#### Scenario: Markdown recovers after a failed chunk load via page reload

- **WHEN** the first markdown chunk request is aborted and the open rejects, and the page
  is then reloaded
- **THEN** the next `__openMarkdownFeature()` succeeds, math renders, a stylesheet is
  fetched, and the only console error is the aborted request's `net::ERR_FAILED`

#### Scenario: Markdown renders under mobile RTL

- **WHEN** the markdown feature is opened at 375×812 with `dir="rtl"` on `<html>`
- **THEN** it renders with a non-zero layout box and a computed `direction` of `rtl`

#### Scenario: Unverified coverage is reported as a gap

- **WHEN** the browser-parity check passes
- **THEN** that pass is not reported as covering same-document retry, attachment
  PDF/office/editor features, per-feature styles/mobile/RTL beyond markdown, or shared
  cache identity

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
