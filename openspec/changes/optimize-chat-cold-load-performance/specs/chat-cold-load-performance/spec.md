## ADDED Requirements

### Requirement: Initial JS/CSS graph excludes non-critical heavy dependencies
The JavaScript and CSS files referenced directly by `apps/chat/dist/index.html` (the entry script, its `modulepreload` chunks, and its stylesheets) for the `/` route SHALL NOT include Monaco editor code, AG Grid engine code, `pdfjs-dist` core/worker code, KaTeX, or `react-syntax-highlighter`. Each of these SHALL instead load only when the feature that needs it is actually used (grid/editor components render, a PDF attachment is opened, a message containing math or a fenced code block is rendered).

#### Scenario: Cold load of `/` with a plain-text-only conversation
- **WHEN** a user with an authenticated session navigates to `/` with an empty HTTP cache and no conversation contains math or a fenced code block
- **THEN** the network requests triggered by the initial page load do not include any chunk containing Monaco, AG Grid, `pdfjs-dist`, KaTeX, or `react-syntax-highlighter` code

#### Scenario: Opening a PDF attachment loads PDF.js on demand
- **WHEN** an authenticated user, already on `/` or `/conversations/:id`, opens a message attachment that is a PDF
- **THEN** the application fetches and initializes `pdfjs-dist` (including its worker) at that point and renders the PDF preview correctly, with no functional regression versus current behavior

#### Scenario: A message containing a fenced code block or math renders correctly after a lazy load
- **WHEN** a conversation message contains a fenced code block or a math expression
- **THEN** the corresponding rendering engine (`react-syntax-highlighter` or KaTeX) loads on demand and the message renders with correct syntax highlighting or math formatting, matching pre-change output, with no visible layout break during or after the load

### Requirement: Initial preload byte budgets
The initial JS and CSS graph referenced by `apps/chat/dist/index.html` for the `/` route SHALL stay within explicit maximum byte budgets, measured as gzip-compressed transfer size from a clean production build (`npx nx build chat`), re-derived from the reproduced baseline documented in this change's `design.md` and confirmed by the same measurement method after implementation.

#### Scenario: Post-change clean build meets the JS budget
- **WHEN** a clean production build of `apps/chat` is produced and its `dist/index.html`'s referenced JS files are measured for gzip size
- **THEN** the total gzip-compressed JS referenced by the initial graph is at or below the budget recorded in `design.md`'s Goals section (baseline ~1.65 MB gzip; target reduction of at least 70%)

#### Scenario: Post-change clean build meets the CSS budget
- **WHEN** a clean production build of `apps/chat` is produced and its `dist/index.html`'s referenced stylesheets are measured for gzip size
- **THEN** the total gzip-compressed CSS referenced by the initial graph is at or below the budget recorded in `design.md`'s Goals section, and no visual regression (including RTL layouts) is introduced by any removed or deferred stylesheet content

### Requirement: Existing conversation route remains fully functional
Deferring or splitting any dependency out of the initial `/` graph SHALL NOT change the functional behavior, streaming behavior, or API contract of `/conversations/:id`, and SHALL NOT materially regress its own load performance relative to its pre-change baseline.

#### Scenario: Navigating directly to an existing conversation
- **WHEN** an authenticated user with an empty HTTP cache navigates directly to `/conversations/:id` for an existing conversation containing attachments, code blocks, and math content
- **THEN** the conversation renders with full functional parity to pre-change behavior (attachments open, code highlights, math renders, streaming works), and the route's own cold-load timing does not materially regress versus its pre-change baseline

### Requirement: No artificial metric gaming
No change made to satisfy the byte budgets or load-timing goals SHALL render an artificially large placeholder, hide real content, or remove/degrade a user-visible feature solely to improve a measured metric.

#### Scenario: Reviewing a proposed lazy-loading change
- **WHEN** a change proposes deferring or splitting a dependency out of the initial graph
- **THEN** the change preserves the feature's full functionality on demand and does not introduce a placeholder, skeleton, or early paint whose only purpose is to record an earlier Largest Contentful Paint timestamp than what real content achieves

### Requirement: Repeatable lab measurement procedure
The change SHALL define and be verifiable against a fully specified, repeatable lab measurement profile (device/CPU throttle, network throttle, browser, server location, compression, cache state, authentication state, run count) documented in `design.md`, producing median and p95 Largest Contentful Paint and a `chat-ready` milestone timestamp for the `/` route, explicitly labeled as a lab proxy rather than production real-user monitoring.

#### Scenario: Running the documented lab profile
- **WHEN** the lab measurement procedure documented in `design.md` is executed against a build before and after this change's implementation
- **THEN** the resulting report states the exact device/CPU/network/browser/cache/auth conditions used, reports median and p95 LCP and the `chat-ready` mark across at least 7 runs per configuration, and explicitly states that the results are a lab proxy and not a substitute for production real-user monitoring
