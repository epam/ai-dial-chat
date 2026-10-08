# Tasks

## 1. Iframe query keys and param

- [x] 1.1 Add the `AppsEditorIframeQuery` string enum (`authProvider`, `id`, `theme`, `applicationCredentials`, `applicationName`) to `apps/chat/src/types/apps-editor.ts`, leaving `AppsEditorQuery` untouched; verify the chat typecheck passes.
- [x] 1.2 In `AppEditorIframe.tsx`, derive `applicationName = schema.displayName ?? ''` once, build the params with the enum keys, set `applicationName` only when non-empty, add it to the `iframeUrl` memo deps, and replace the in-handler `displayName` with the shared value; verify the existing `AppEditorIframe` tests still pass.

## 2. Tests

- [x] 2.1 In `apps/chat/src/pages/ApplicationEditor/setup/tests/AppEditorIframe.spec.tsx` add tests: URL contains `applicationName`; `Quick app 2.0` is encoded and round-trips via `URL.searchParams`; param absent when `displayName` is empty/undefined; changing `displayName` changes the iframe src and re-gates readiness. Verify with `npx nx test chat` filtered to this spec.

## 3. Spec validation

- [x] 3.1 Run `openspec validate pass-application-name-to-quickapps --strict` and `npm run validate:specs`; verify both pass.
- [ ] 3.2 Run lint for the chat app and verify no new warnings; after review, sync or archive the delta into `openspec/specs/app-editor-flow/spec.md`.
