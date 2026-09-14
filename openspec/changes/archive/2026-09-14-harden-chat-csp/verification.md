# CSP verification

Implementation verified locally on 2026-09-14 before publication. Deployment
validation remains separate from these local checks.

## Passing checks

- Backend suite: `npm exec -- nx run @epam/chat-api:test` — 185 files, 3152 tests.
  This includes 94 focused policy, environment, and HTTP-serving tests covering
  fresh concurrent nonces, root/deep/index/encoded paths, HEAD, conditional GET,
  reserved routes, report-only headers, and document/worker WASM scope.
- Build adapter: `npm exec -- nx run @epam/chat:test --excludeTaskDependencies -- tests/csp-build.spec.mjs`
  — 6 tests. Checks approved style creation before insertion, single evaluation
  of the document receiver, scoped dependency matching, and unrelated content.
- Browser: `npm exec -- nx run @epam/chat:test-csp-browser` — Chromium, real Vite
  configuration and real backend CSP middleware. Installed UI Kit and file-manager
  grids render, desktop/mobile grid geometry and inherited RTL are exercised,
  PDF/DOCX/XLSX load, and all emitted runtime styles apply without CSP violations.
  Unsigned/wrong-nonce styles, inline attributes, inline scripts/event handlers,
  and JavaScript evaluation are rejected; document WebAssembly remains available.
- Frontend and overlay bundles:
  `npm exec -- nx run-many --target=build --projects=@epam/chat,@epam/chat-overlay-sandbox --excludeTaskDependencies`.
- Backend bundle:
  `NODE_ENV=production npm exec -- nx run @epam/chat-api:build --excludeTaskDependencies --args=''`.
  The override avoids the existing webpack-cli `--config-node-env` incompatibility;
  application source and build configuration were not changed to mask that issue.
- `npm run validate:docs` and ESLint on changed TypeScript/config files passed.

## Repository gates

`npm run verify:changed` was run after integration. It found a new Helmet options
narrowing error, which was fixed. Subsequent typechecking no longer reports an
error in the CSP implementation.

Exactly one `npm run verify:full` was run. It stops during typechecking on existing
errors in untouched backend tests (including missing test globals, stale fixture
shapes, and telemetry types) and `apps/mcp-app-sandbox/src/main.ts:28` (optional port
type). Frontend and overlay typecheck targets pass. The full lint/test stages are
therefore not reached by that chained command.

The affected app lint targets were also run independently. They report existing
Prettier errors in untouched conversation, publishing, toolset, and other files.
The new empty-callback lint errors were fixed; changed source files pass a
separate ESLint check. Earlier dependency-driven builds also exposed an existing
`outsidePressIgnoreRef` / UI Kit type mismatch in `libs/conversation-input`.
The successful bundle commands above isolate application bundling from those gates.

Full command output is retained locally under `tmp/agent-logs/`. These unrelated
failures are follow-up work and must be resolved before treating workspace-wide
verification as green.

## Five-axis self-review

- Correctness: cached templates are immutable; each HTML body matches its own CSP
  nonce. API/assets/overlay routing and CORS ordering are preserved. URL decoding,
  case-insensitive reserved paths, MIME types, malformed paths, and conditional
  requests have regression coverage.
- Readability: policy options, response handling, and vetted build adaptation are
  separate. No dependency source files or generated clients are edited.
- Architecture: integration stays in the backend and application build tooling;
  published libraries do not acquire host metadata or configuration dependencies.
- Security: nonces use 32 random bytes; style nonces never authorize inline scripts.
  No global DOM patch or observer assigns trust to arbitrary content. Report URLs
  are validated and normalized. WASM permission follows the execution context.
- Performance: no eager grid import is added. Only immutable templates are cached;
  HTML is intentionally non-cacheable, while static-asset behavior stays unchanged.
- Documentation and responsive checks: environment references and architecture
  describe the shipped behavior; browser checks include desktop LTR and mobile RTL.

Implementation review found no remaining CSP-specific blocking defect. This is
not a claim that every authenticated deployment journey or every browser has been
exercised. Keep `CSP_MODE=report-only` for the staged rollout, review deployment
violations, then enforce and rescan. Report-only retains the unsafe-inline finding.
