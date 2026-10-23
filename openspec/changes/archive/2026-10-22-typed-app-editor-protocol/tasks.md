## 1. Typed connector contract

Slicing strategy: contract-first. Preserve the existing wire format, verify the library boundary, then migrate the application adapter.

- [x] 1.1 Add direction-specific types in `libs/visualizer-connector/src/models/apps-editor.ts`, parsers/serialization in `src/lib/apps-editor-protocol.ts`, and `src/lib/AppsEditorHost.ts` / `src/lib/AppsEditorClient.ts`, exporting the public API through `src/index.ts`. Preserve `ChatVisualizerConnector` behavior and deprecate only its loose editor API. Keep relative code imports extensionless and retain bundler resolution.
  - Verification: `apps-editor-protocol.spec.ts`, `AppsEditorChannel.spec.ts`, `ChatVisualizerConnector.spec.ts`, and `VisualizerConnector.spec.ts` under `libs/visualizer-connector/src/lib/tests/`.
- [x] 1.2 Add protocol tests under `libs/visualizer-connector/src/lib/tests/` for both directions, exact wire shapes, legacy normalizations, wrong window/origin, malformed fields, namespace mismatch, uppercase visualizer separation, and destruction.
  - Verification: run `libs/visualizer-connector/src/lib/tests/apps-editor-protocol.spec.ts` and `libs/visualizer-connector/src/lib/tests/AppsEditorChannel.spec.ts` plus both existing connector suites through the workspace Nx-backed test command.
- [x] 1.3 Verify the library isolation boundary: no app/server-api/generated-client imports, endpoints, session/cookie/env reads, feature flags, routing, telemetry clients, or storage behavior; domain metadata/credentials are opaque and supplied by callers.
  - Verification: inspect the new exports and imports and run the library lint/type checks.

## 2. Chat adapter migration

Depends on the typed contract in section 1.

- [x] 2.1 Migrate `apps/chat/src/pages/ApplicationEditor/setup/AppEditorIframe.tsx` to the shared host adapter, keeping domain/auth behavior in the application. Reset logout on readiness and revoke readiness on logout. Preserve the separate readiness timeout and save errors in `QuickAppSetup.tsx`.
  - Verification: `apps/chat/src/pages/ApplicationEditor/setup/tests/AppEditorIframe.spec.tsx` and `apps/chat/src/pages/ApplicationEditor/setup/tests/QuickAppSetup.spec.tsx` through the workspace test command.
- [x] 2.2 Update Chat adapter tests to use real sender windows and cover logout recovery, logout after readiness, malformed/foreign messages, current-wire compatibility, and the existing readiness error recovery.
  - Verification: the same two application-editor suites; confirm no missing readiness is synthesized for CodeApps-style uppercase events.

## 3. Documentation and verification

- [x] 3.1 Document the final exports and editor migration in `libs/visualizer-connector/README.md`, update `docs/architecture.md`, and synchronize the affected `custom-visualizers` and `quick-app-authoring` requirements while preserving the readiness recovery scenarios.
  - Verification: compare README examples with the public types and run `npm run validate:docs`, `npm run validate:specs`, and OpenSpec validation for this change.
- [x] 3.2 Complete focused tests, affected type/lint checks, and the repository's required final verification; record any unrelated pre-existing failures without claiming they passed.
  - Verification: use the Nx-backed workspace commands appropriate to the changed library and Chat adapter; run `npm run verify:changed` once after the slice and `npm run verify:full` once at completion.

## Verification results

Verified with Node 24.14.0, `NX_DAEMON=false`, and `NX_ISOLATE_PLUGINS=false`.

- Library Nx `test`, `typecheck`, `lint`, and `build`: passed, including both existing visualizer suites and the new protocol/channel suites.
- `AppEditorIframe.spec.tsx`: 75 tests passed. The full Chat test target also passed during affected verification, including `QuickAppSetup.spec.tsx`.
- Affected typecheck and lint: passed. Affected build, including Chat: passed.
- Documentation, spec-reference, and strict OpenSpec validation: passed. All six README TypeScript examples compile against the current public exports.
- The first parallel build/typecheck attempt collided in a consumer fixture's temporary tarballs; a sequential rerun passed typecheck. No source change was needed.
- The affected attachment-canvas size tests initially used a development artifact. An explicit production build measured 57,263 raw / 16,558 gzip bytes, within both limits; both size suites then passed (11 tests) with a writable npm cache. The connector is external to that measured closure. No budgets or attachment-canvas source were changed.
- The two external-install consumer fixtures remain unverified: after moving npm's cache into `/private/tmp`, registry access fails with `ENOTFOUND registry.npmjs.org`. Their failure does not represent a passing affected test command.
- `npm run verify:full` stops at the existing `apps/chat-api` type errors for `getDeploymentUsage`; the same errors were recorded before this library change. Backend sources, dependency manifests, and lockfile were not modified. Global lint/test stages therefore did not run through that command.
- Five-axis cross-review found no blocking implementation issue. There is no layout, breakpoint, or stylesheet change.
