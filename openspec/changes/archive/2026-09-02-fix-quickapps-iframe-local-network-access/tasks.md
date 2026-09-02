## 1. Frontend: delegate Local Network Access to the embedded iframe

- [x] 1.1 Add `allow="local-network-access=*"` to the `<iframe>` in `apps/chat/src/pages/AppsEditor/AppEditorIframe.tsx`.
- [x] 1.2 Update/add the unit test in `apps/chat/src/pages/AppsEditor/tests/AppEditorIframe.spec.tsx` (or equivalent existing test file) asserting the rendered iframe has `allow="local-network-access=*"`.

## 2. Backend: emit a Permissions-Policy header delegating to allowlisted origins

- [x] 2.1 Add `buildPermissionsPolicyHeader(allowedIframeOrigins: string[]): string` to `apps/chat-api/src/config/csp.ts`, returning `local-network-access=(self <origin> ...)`, with `local-network-access=(self)` when the list is empty.
- [x] 2.2 In `apps/chat-api/src/main.ts`, register an `app.use` middleware immediately after the existing `helmet(...)` call that sets the `Permissions-Policy` response header using `buildPermissionsPolicyHeader(allowedIframeOrigins ?? [])`.
- [x] 2.3 Add unit tests for `buildPermissionsPolicyHeader` covering: empty allowlist, single origin, multiple origins.

## 3. Verification

- [x] 3.1 Run `npm run test:file -- apps/chat/src/pages/AppsEditor/tests/AppEditorIframe.spec.tsx` (or the actual test file path) and `npm run test:file -- apps/chat-api/src/config/csp.spec.ts` (create if it doesn't exist) to confirm both changes pass.
- [x] 3.2 Run `npm run verify:changed` to confirm lint/typecheck/affected tests pass for the changed files. **Note**: `npm run verify:changed` itself fails on this branch (and on unmodified `origin/development`) due to a pre-existing Nx workspace-sync/typecheck issue unrelated to this change (confirmed by reproducing the same failure with our edits stashed). Verified equivalently instead: `npx eslint` on all 5 changed files (clean, aside from a pre-existing `@nx/enforce-module-boundaries` finding on `AppEditorIframe.tsx`/its spec that also reproduces on the unmodified file), `npx prettier --check` (clean), and `npx tsc -p apps/chat-api/tsconfig.app.json --noEmit` (no errors in `csp.ts` or `main.ts`; pre-existing unrelated errors in other files).
- [ ] 3.3 Manually verify in a browser: load `/apps-editor` against an environment where the embedded app or its identity provider resolves to a private IP, confirm the Local Network Access permission prompt is answerable/no longer silently hangs the Keycloak login popup.
