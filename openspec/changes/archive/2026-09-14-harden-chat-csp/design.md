## Context

`apps/chat-api/src/config/csp.ts:51` allows inline styles globally; scripts already
exclude JavaScript `unsafe-inline` and `unsafe-eval`. `app/static-assets.ts` serves
unchanging Vite HTML through `ServeStaticModule`. The installed AG Grid supports a native `styleNonce` option, but a browser test
showed that `provideGlobalGridOptions` does not configure the grid inside the
installed UI Kit distribution. UI Kit's MCP documentation exposes native options
on `Grid.additionalGridOptions`; nested file-manager grids do not all expose a
shared application configuration point.

OOXML creates two style elements without nonce support. The local chat-overlay
library also inserts styles. PDF.js uses CSSOM font rules. OOXML uses main-page
and blob-worker execution, so its WebAssembly permission cannot be moved to the
file download or `.wasm` response. A separate viewer document would be needed.

## Goals / Non-Goals

Goals: strict style enforcement without breaking supported renderers, a deployable
report-only stage, and correct document-scoped WebAssembly permissions.
Non-goals are listed in the proposal. This changes neither i18n nor UI layout;
browser checks exercise desktop/mobile and inherited RTL direction.

## Decisions

1. Replace static HTML delivery with app-owned Express middleware. Keep static
   asset delivery and reserved-route behavior, cache the template in memory, and
   substitute Vite's nonce placeholder per response using 32 random bytes. Send
   `Cache-Control: no-store`; no HTML ETag, Last-Modified, or conditional 304. This
   avoids intercepting arbitrary response bodies or assigning nonces to upstream HTML.
2. An application build adapter rewrites only literal `createElement('style')`
   calls in the installed OOXML, UI Kit, and file-manager distributions and the
   local overlay style helper to assign the document's nonce before insertion.
   Parse source rather than replacing arbitrary strings, and evaluate each
   document receiver once. This covers independently bundled grid runtimes without
   adding an eager grid import or changing library APIs.
3. Keep the adapter under application build tooling. Do not patch DOM prototypes,
   observe and authorize arbitrary inserted nodes, change node_modules, or
   authorize HTML-supplied style attributes. Published library code and unrelated
   dependencies are untouched. Vite adds the placeholder and nonce metadata.
4. `CSP_MODE=report-only` is the rollout default. It emits a strict candidate policy
   alongside the existing enforced HTML policy. `CSP_MODE=enforce` emits only the
   strict policy. Both modes keep JavaScript evaluation and inline JavaScript blocked.
   Optional validated `CSP_REPORT_URI` configures `report-uri`, `report-to`, and
   `Reporting-Endpoints`; collection belongs to the operator's reporting service.
5. Generic API/assets policy has no WASM permission. Chat HTML retains
   `wasm-unsafe-eval`; the specifically named bundled PDF-worker response has its
   own minimal worker policy. The optional overlay sandbox HTML has no WASM
   permission. CSP on download responses never substitutes for document policy.

## Risks / Trade-offs

- Dependency style producers can change → source-transform tests plus a browser
  smoke test against the installed packages; report-only stage before enforcement.
- Strict CSS attributes can reveal previously hidden compatibility problems →
  browser verification and violation reporting; do not whitelist arbitrary content.
- Template caching and nonce reuse → immutable template only, fresh replacement
  per response, tests for parallel/conditional/HEAD/deep-link requests.
- Independently bundled grids cannot share a global nonce setting → adapt the
  trusted bundled style producers and test the actual installed UI Kit grid.
- WASM remains on chat HTML → documented limitation, separate viewer isolation is
  a future architectural change rather than a misleading endpoint-only permission.

## Migration Plan

Build frontend and backend together. Deploy with `CSP_MODE=report-only` and a
report destination. Exercise all supported journeys, investigate violations, then
set `CSP_MODE=enforce` and rescan the actual deployment. Revert only the mode for
compatibility rollback; this restores the pre-existing inline-style allowance.

## Open Questions

The deployment's reporting service URL is operator-owned and is not invented or
enabled against an external service by this change.
