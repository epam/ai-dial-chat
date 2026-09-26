Implementation record for work already completed before this OpenSpec capture. Checked items refer to inspected code and verification from this session; they do not imply the complete repository verification is green. No runtime code is changed by creating these artifacts.

Slicing strategy: vertical. Slice 1 establishes the public metadata contract and generated adapter; slice 2 adds the Catalog forms; slice 3 reuses them in the Quick app host. Slice 4 records documentation and validation. Keep TypeScript code imports extensionless and retain frontend bundler module resolution throughout.

## 1. Public metadata and generated-client boundary

- [x] 1.1 Add public application service listing and the 403/404 single-service fallback in `apps/chat-api/src/external-services/external-services.service.ts`; retain the legacy custom-application fallback and public-field mapping.

  **Verification:** `npm run test:file -- apps/chat-api/src/external-services/tests/external-services.service.spec.ts`; cover multiple services, secret exclusion, fresh statuses, missing/empty responses, ordinary-reader access and fallback behavior. Passed as part of the relevant backend project tests.

- [x] 1.2 Define `ListExternalServicesDto` and `ApplicationExternalServiceDto`, and annotate the guarded GET route with typed Swagger responses and no-store headers in `apps/chat-api/src/external-services/external-services.controller.ts` and its `dto/` files.

  **Verification:** `npm run test:file -- apps/chat-api/src/external-services/tests/external-services.controller.spec.ts`; integration coverage includes decoded ids, response/cache header, invalid-id rejection and feature gating. Passed with local HTTP-port permission for supertest.

- [x] 1.3 Add or update backend unit/integration tests for the changed service and controller in `apps/chat-api/src/external-services/tests/`.

  **Verification:** `npm run test:file -- apps/chat-api/src/external-services/tests/external-services.service.spec.ts apps/chat-api/src/external-services/tests/external-services.controller.spec.ts`; both files passed, including the added management-403 regression in the full backend project run.

- [x] 1.4 Regenerate `libs/chat-api-client/openapi.json` and `src/generated/` from Swagger; verify clean operation names and strong response models, then build and lint `chat-api-client`.

  **Verification:** `npm run openapi` and `npm run openapi:check` passed. Nx `chat-api-client:build` passed as a Chat build dependency and `chat-api-client:lint` passed in the full lint run. HTTP behavior is covered by the exact controller test command in 1.2. Generated files are not hand-edited.

- [x] 1.5 Reuse the configured `externalServicesApi` singleton in `apps/chat/src/server-api/api-client.ts` and add `listExternalServices` with generated types in `apps/chat/src/server-api/external-services.ts`.

  **Verification:** The singleton already existed and needed no duplicate instance. Type checking and OpenAPI consistency checks passed; `npm run test:file -- apps/chat/src/components/ApplicationCredentials/tests/ApplicationCredentials.spec.tsx` covers the caller contract through the app adapter.

## 2. Shared application forms in Catalog — depends on slice 1

- [x] 2.1 Implement app-owned list/refresh state in `apps/chat/src/hooks/externalServices/useApplicationCredentials/useApplicationCredentials.ts` and per-service controls in `ApplicationCredentials` and `ApplicationCredentialRow` under `apps/chat/src/components/`.

  **Verification:** `npm run test:file -- apps/chat/src/components/ApplicationCredentials/tests/ApplicationCredentials.spec.tsx`; 9 tests passed, covering multiple services, API-key consent, OAuth errors, personal logout, no-auth state, native readiness, retry, stale responses and preservation of another row's draft.

- [x] 2.2 Add unit coverage of the new hook and rows through `apps/chat/src/components/ApplicationCredentials/tests/ApplicationCredentials.spec.tsx`, with real hook state and mocked API/login boundaries; retain the existing login-hook regression suite.

  **Verification:** `npm run test:file -- apps/chat/src/components/ApplicationCredentials/tests/ApplicationCredentials.spec.tsx apps/chat/src/hooks/externalServices/tests/useExternalServiceLogin.spec.ts`; the form tests passed and the unchanged login-hook suite passed in the full Chat project test run. No new utility or separate auth flow is introduced.

- [x] 2.3 Add the six `ApplicationCredentialsI18nKeys` constants and English entries in `apps/chat/src/constants/translation-keys.ts` and `apps/chat/src/i18n/locales/en.json`; reuse existing login/consent/error keys.

  **Verification:** `npm run test:file -- apps/chat/src/components/ApplicationCredentials/tests/ApplicationCredentials.spec.tsx`; status, consent and error labels are asserted through the configured i18n test setup; app typecheck and lint passed.

- [x] 2.4 Add the optional `renderCredentials` prop to `libs/catalog/src/models/catalog-props.ts` and `item-details-props.ts`, forward it through `Catalog.tsx`, and render it only in the open editable normal view of `DetailsPanel.tsx`.

  **Verification:** `npm run test:file -- libs/catalog/src/components/Details/tests/DetailsPanel.spec.tsx`; passed in the full Catalog project suite. Boundary review confirmed the lib receives only a render callback and contains no new API paths, generated-client imports, app contexts, session/flag/routing/storage knowledge, telemetry or platform integration. Catalog build/typecheck/lint passed.

- [x] 2.5 Wire the memoized Agent-only callback and both `liveChatInteraction` gates in `apps/chat/src/components/CatalogView/CatalogView.tsx`.

  **Verification:** `npm run test:file -- apps/chat/src/components/CatalogView/tests/CatalogView.spec.tsx libs/catalog/src/components/Details/tests/DetailsPanel.spec.tsx`; existing CatalogView regression tests and slot tests passed. Source review confirmed both capability checks occur before the forms mount.

- [x] 2.6 Keep new form layout mobile-compatible and RTL-aware, with logical spacing, wrapping, labelled controls, busy/status/error semantics and keyboard-operable actions. Preserve existing Quick app chip styles.

  **Verification:** `npm run test:file -- apps/chat/src/components/ApplicationCredentials/tests/ApplicationCredentials.spec.tsx`; role/label-driven assertions passed. Source review found logical/symmetric spacing and no new directional icons. No claim is made of a browser viewport or live-provider accessibility audit.

## 3. Quick app host dialog — depends on slice 2

- [x] 3.1 Add `RequestApplicationCredentials` to `apps/chat/src/types/apps-editor.ts`; advertise `applicationCredentials` and render the shared forms in `apps/chat/src/pages/AppsEditor/AppEditorIframe.tsx` with local dialog state.

  **Verification:** `npm run test:file -- apps/chat/src/pages/AppsEditor/tests/AppEditorIframe.spec.tsx`; 38 tests passed, including trusted request handling, encoded application ids, closing, existing save/preview-related iframe behavior and disabled capability advertisement.

- [x] 3.2 Add regression tests in `apps/chat/src/pages/AppsEditor/tests/AppEditorIframe.spec.tsx` for origin/source rejection and feature gating, and verify that the iframe remains mounted when credentials open/close.

  **Verification:** `npm run test:file -- apps/chat/src/pages/AppsEditor/tests/AppEditorIframe.spec.tsx`; passed. Source review confirmed nonempty-string validation, URL-change cleanup, feature gates, and unchanged iframe ownership.

- [x] 3.3 Document the companion editor implementation and its host capability requirement; keep its implementation in the Quick Apps repository.

  **Verification:** [Quick Apps PR #140](https://github.com/epam/ai-dial-quickapps-frontend/pull/140), commit `f0a52f0`. In that repository, `npm test` passed 58 tests across 9 files; typecheck, changed-file ESLint and production build passed. The 4 tests in `src/components/common/AgentAndToolsetSelector/tests/AgentAndToolsetChip.test.tsx` passed again after restoring the original chip styles. This task records completed companion work; it does not authorize another push or merge.

## 4. Documentation, specification capture and verification — depends on slices 1–3

- [x] 4.1 Update `apps/chat/README.md`, `libs/catalog/README.md`, `docs/architecture.md` and `docs/auth/auth-bff-encrypted-cookie.md` for proactive forms, the list endpoint and the iframe contract.

  **Verification:** `npm run validate:docs` passed. The existing reactive and scheduled-offline diagrams were not changed because their flows remain unchanged; the new proactive path is documented separately.

- [x] 4.2 Capture proposal, design and three deltas in `openspec/changes/add-application-credentials/`, preserving all scenarios in modified requirements and the offline-credentials contract.

  **Verification:** Review the complete modified requirement blocks against main specs and `add-scheduled-task-offline-credentials-login/specs/external-service-authentication/spec.md`. Record synchronization order in `design.md`; do not edit main specs or archive the prerequisite as part of this capture.

- [x] 4.3 Run the prescribed slice/full verification and record outcomes, including unrelated blockers, without broadening this feature to fix them.

  **Verification:** `npm run verify:changed` ran; its initial import-order/effect warnings in changed code were corrected. Exactly one `npm run verify:full` ran: full typecheck and lint passed, but format checking stopped at two unrelated markdown files. A separate `npm run test:full:quiet` passed the Chat, Chat API and Catalog project suites but failed the unrelated consumer-fixture build described below. Final relevant frontend tests and targeted app lint/typecheck passed. Nx builds of Chat, Catalog and the generated client passed. OpenAPI generation/consistency and documentation checks passed.

- [x] 4.4 Format and strictly validate this OpenSpec change and confirm no runtime files changed during the capture.

  **Verification:** `openspec validate add-application-credentials --strict --no-interactive`, scoped Prettier check, and `git diff --check` passed. A scenario-preservation audit retained all 22 existing scenarios across the three modified requirements, plus the prerequisite's additional native scenarios. Main specs and the prerequisite change remain untouched. Runtime validation from 4.3 is reused because this capture changes only OpenSpec artifacts.

## Verification limitations and separate follow-up

The full verification is **not green**. The recorded blockers are formatting in `refactoring-backend.md` and `technical-debt-remediation-plan.md`, plus a missing installed `@tabler/icons-react/dist/esm/icons/IconCube3dSphere.mjs` during `attachment-canvas-consumer-fixture:build`. Resolve those through separate maintenance work; they are not implementation tasks for this feature. No live OAuth-provider/browser walkthrough was performed.

Main-spec synchronization and archival are later lifecycle steps. Synchronize the implemented external-service delta of `add-scheduled-task-offline-credentials-login` first, then this change; reconcile overlapping requirements if that older change is archived afterward. Do not mark the older change complete on behalf of this one.
