## 1. Backend policy and HTML delivery

Strategy: risk-first slices, proving nonce/header/browser compatibility before rollout.

- [x] 1.1 Add validated CSP mode/report configuration and response-specific policy builders in `apps/chat-api/src/config/csp.ts`; verify `config/tests/csp.spec.ts` and `config/tests/validation.spec.ts`.
- [x] 1.2 Serve nonce-bearing HTML through `app/static-assets.ts` and wire it in `main.ts`, preserving reserved routes and static resources; verify `app/tests/static-assets.spec.ts` including nonce freshness, cache behavior, HEAD, and deep links.

## 2. Frontend runtime integration

- [x] 2.1 Integrate nonces for independently bundled grids through the app-owned `tools/vite/csp-nonce.mjs` adapter; verify `apps/chat/tests/csp-build.spec.mjs` and the installed UI Kit in Chromium.
- [x] 2.2 Add the scoped trusted-style build adapter and Vite nonce placeholder for chat and optional overlay sandbox; verify adapter tests and actual dependency browser behavior. Keep all host knowledge outside published libs.
- [x] 2.3 Verify strict-mode browser behavior for approved grid/vendor styles, rejected inline scripts/styles/eval, WebAssembly scope, responsive/RTL rendering, and actual document previews.

## 3. Documentation and verification

- [x] 3.1 Update backend environment reference/template, affected app READMEs, and `docs/architecture.md` with rollout, reporting, and the WebAssembly limitation; run `npm run validate:docs`.
- [x] 3.2 Run slice checks, affected builds, exactly one `npm run verify:full`, and five-axis quality review; record environmental or pre-existing failures without claiming unverified completion.

Verification results and existing repository failures are recorded in [verification.md](verification.md).
