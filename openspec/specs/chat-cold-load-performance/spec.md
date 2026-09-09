# chat-cold-load-performance Specification

## Purpose

Defines the initial-load byte budgets, the required lazy/deferred boundaries for PDF.js, Monaco, KaTeX, and syntax highlighting, and the repeatable build-time measurement procedure used to verify cold-load bundle composition for `apps/chat` without regressing stable chat behavior.

## Requirements

### Requirement: Initial JS/CSS graph excludes in-scope non-critical heavy dependencies
The JavaScript and CSS files referenced directly by `apps/chat/dist/index.html` (the entry script, its `modulepreload` chunks, and its stylesheets) for the `/` route SHALL NOT include Monaco editor code, `pdfjs-dist` core/worker code, KaTeX, or `react-syntax-highlighter`. Each dependency SHALL load only when the corresponding feature is used. AG Grid embedded in `@epam/ai-dial-ui-kit` is explicitly excluded and belongs to a separate package-level change.

#### Scenario: Cold load of `/` with a plain-text-only conversation
- **WHEN** a user with an authenticated session navigates to `/` with an empty HTTP cache and no conversation contains math or a fenced code block
- **THEN** the initial graph contains no Monaco, `pdfjs-dist`, KaTeX, or `react-syntax-highlighter` implementation code

#### Scenario: Opening a PDF attachment loads PDF.js on demand
- **WHEN** an authenticated user on `/` or `/conversations/:id` opens a PDF attachment
- **THEN** the application requests PDF.js and its worker on demand through the attachment-canvas PDF boundary and renders the existing PDF preview

#### Scenario: Rendering code or math loads its engine on demand
- **WHEN** a message or attachment first requires syntax highlighting or KaTeX rendering
- **THEN** the corresponding engine loads on demand while an immediate lightweight fallback preserves readable content during the transition

### Requirement: Initial preload byte budgets
Using the repeatable measurement script against a clean production build, the initial graph SHALL improve by at least 30% from the reproduced 1,724,639-byte gzip baseline and SHALL remain at or below 1,100,000 gzip bytes of JavaScript, 60,000 gzip bytes of CSS, and 1,160,000 gzip bytes in total. These budgets cover only this change's app-side and in-repository lazy-loading scope; UI-kit AG Grid packaging and generated API-client decomposition are separate follow-ups.

#### Scenario: Post-change clean build meets the budgets
- **WHEN** `apps/chat` is built cleanly and `node scripts/measure-initial-bundle.mjs` measures every script, `modulepreload`, and stylesheet referenced by `dist/index.html`
- **THEN** the measured JS, CSS, total, and percentage-reduction values satisfy all stated budgets

### Requirement: Deferred features preserve existing behavior
Deferring a dependency SHALL NOT change the functional, streaming, accessibility, RTL, or API behavior of the feature that consumes it. The deliberate conversation-page module prefetch SHALL remain intact.

#### Scenario: Navigating directly to an existing conversation
- **WHEN** an authenticated user navigates directly to an existing conversation containing attachments, code blocks, and math content
- **THEN** the conversation renders with functional parity: attachments open, code highlights, math renders, and streaming transitions complete correctly

#### Scenario: Auditing an existing lazy boundary
- **WHEN** bundle inspection proves that a separately owned package barrel keeps a feature implementation in the eager graph
- **THEN** the change records that package boundary as a named follow-up and does not claim the boundary is effective or introduce an unsafe app-only workaround

### Requirement: No artificial metric gaming
No change made to satisfy the byte budgets SHALL render an artificially large placeholder, hide real content, or remove or degrade a user-visible feature solely to improve a measured metric.

#### Scenario: Reviewing a lazy-loading change
- **WHEN** a dependency is deferred from the initial graph
- **THEN** the feature remains fully available on demand and any fallback represents its real loading state rather than an artificial LCP target

### Requirement: Repeatable measurement procedures
The change SHALL provide a repeatable build-time bundle measurement and SHALL document a future lab profile covering device/CPU throttle, network throttle, browser, server location, compression, cache state, authentication state, run count, LCP, and a defined `chat-ready` milestone. A deployed Lighthouse run, emitted `chat-ready` instrumentation, and production RUM are not required by this change and SHALL NOT be reported as completed unless they are actually executed.

#### Scenario: Measuring the production bundle
- **WHEN** clean production output exists
- **THEN** the committed measurement script reports raw and gzip bytes for each initial asset plus JS, CSS, and combined totals using the same method as the baseline

#### Scenario: Reusing the documented lab profile later
- **WHEN** a human or CI runner later executes the documented browser profile
- **THEN** the report records the exact environment and reports median and p95 LCP plus the defined `chat-ready` milestone across at least seven runs, explicitly labeled as a lab proxy rather than production RUM

### Requirement: Heavy feature engines remain outside chat startup
The production chat SHALL exclude AG Grid community/React, Monaco/UIW editor engines, PDF.js, KaTeX and react-syntax-highlighter JavaScript from the recursive static initial graph. It SHALL retain working, reachable lazy feature chunks.

#### Scenario: Build budgets and graph exclusions
- **WHEN** a fresh production build is checked against a compatible UI Kit artifact
- **THEN** initial JS gzip is at most 1,100,000 bytes, CSS gzip at most 60,000 bytes and their sum at most 1,160,000 bytes
- **AND** forbidden JavaScript module implementations are absent from every recursively reachable static entry/preload dependency
- **AND** AG Grid remains reachable across a dynamic import
- **AND** its initial graph contains production React runtimes

#### Scenario: Real feature activation after startup
- **WHEN** the production app runs with deterministic mock APIs at desktop and mobile widths
- **THEN** initial network requests, including immediate prefetches, contain no forbidden heavy implementation
- **AND** activating the file manager fetches Grid and renders a file row
- **AND** activating catalog list view renders a model row
- **AND** activating the prompt editor loads a working Markdown engine

### Requirement: Public package boundaries support repeatable verification
Catalog SHALL consume UI Kit `/grid`; editor loaders SHALL consume `/editors`. Affected library builds SHALL externalize those public subpaths. Shared file-manager UI SHALL have a dedicated optional entry with existing root compatibility, while host API ownership stays at the app edge.

#### Scenario: Verify unpublished UI Kit without dependency drift
- **WHEN** an unpublished UI Kit is built, packed and temporarily installed for verification
- **THEN** only the installed UI Kit artifact is replaced and backed up
- **AND** other installed dependencies and the chat manifests remain unchanged
- **AND** an uncached production graph check can be repeated against that artifact
- **AND** local installation, diagnostics and mock browser tools are excluded from the delivered application and repository tooling
