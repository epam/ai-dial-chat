## 1. Strategy and contract checks

Strategy: vertical slices, with contract tests first inside each slice. Sections 2–11 depend on 1; they are independently verifiable. Section 5 also depends on the established title reconciliation API from 4. Section 12 depends on every slice. New file paths below are planned implementation/test locations, not claims that they exist today. Keep all relative TypeScript code imports extensionless and retain bundler resolution. Run `npm run verify:changed` once at the end of each completed slice, not after each checkbox.

- [x] 1.1 Record the B1–B8/A2/D public-contract matrix in `libs/chat-hooks/README.md`, `libs/quotations/README.md` and `libs/chat-shared/README.md`; preserve default semantics and app-facing exports. Confirm new subpaths are only B5; B8 uses the existing shared root export.

## 2. B1 — Generation registry

- [x] 2.1 Add `libs/chat-hooks/src/conversation/tests/generation-registry.spec.ts` for same-path replacement, stale completion, independent paths/instances and absence of implicit teardown. Port observable cases from the existing context suite.

- [x] 2.2 Implement `libs/chat-hooks/src/conversation/generation-registry.ts`, export it through `libs/chat-hooks/src/entry-points/conversation.ts` and the existing root where appropriate, and reduce `apps/chat/src/context/GenerationContext.tsx` to a ref-owned registry adapter. Preserve its four methods, lifetime and stable memoized context value; use library types directly.

## 3. B2 — Active scheduled task

- [x] 3.1 Add `libs/chat-hooks/src/scheduled-task/tests/active-scheduled-task.spec.ts` for classification, disabled/unresolved states, 404 versus other errors, retry, A→B cancellation, unmount and runId-only changes.

- [x] 3.2 Add `libs/chat-hooks/src/scheduled-task/active-scheduled-task.ts` and `libs/chat-hooks/src/scheduled-task/useActiveScheduledTaskDetails.ts`; wire the scheduled-tasks public entry point. Delegate `apps/chat/src/context/ActiveScheduledTaskContext.tsx` to them while retaining route guards, matcher, feature flag and existing run-history hook. Keep one details instance for all consumers.

## 4. B3 — Title reconciliation and JSON transport

- [x] 4.1 Add `libs/chat-hooks/src/conversation/tests/title-enrichment-controller.spec.tsx` for snapshot revisions, local writes, tombstones/restore, exact encoded IDs, partial results, protection expiry and identity/unmount cancellation. Add two-instance isolation and a JSON-only adapter case.

- [x] 4.2 Implement `libs/chat-hooks/src/conversation/useConversationTitleEnrichmentController.ts` and its transport/policy types. Share reconciliation for every emitted batch; support sequential JSON batches, configured protection duration, stable callbacks and stop-on-error. Keep parser/endpoints and configured values out of the library.

## 5. B3 — Parent incremental transport adoption (depends on 4)

- [x] 5.1 Add bounded incremental/visible-priority/fallback tests to `libs/chat-hooks/src/conversation/tests/title-enrichment-controller.spec.tsx`, including old-scope emissions and cancelled flushes. Preserve coverage in `apps/chat/src/hooks/conversation/tests/useConversationTitleEnrichment.spec.tsx`.

- [x] 5.2 Replace reconciliation in `apps/chat/src/hooks/conversation/useConversationTitleEnrichment.ts` with the common controller, wiring existing `apps/chat/src/server-api/conversation-title-stream.ts` and `conversations.api.ts` adapters, parent count/byte/flush policy, visible IDs and 315000 ms protection. Export the public controller/types and retain the current app hook API. Do not edit the backend streaming-service change.

## 6. B4 — Skill preview synchronization

- [x] 6.1 Add `libs/chat-hooks/src/skill-editor/tests/useSkillFilePreviewSyncController.spec.ts` for revision replacement, resource-key separation, manifest/folder during loading, A→B→A, failure without reopen loops, retry, unmount and a newer foreign canvas owner.

- [x] 6.2 Implement `libs/chat-hooks/src/skill-editor/useSkillFilePreviewSyncController.ts` and expose it via the skill-editor entry point. Refactor `apps/chat/src/hooks/attachment/useSkillFilePreviewSync.ts` to pass canvas snapshots/operations, shared commit predicates and resolved selections. Preserve the page's resource key, presentation state and retry integration; remove the duplicate request arbitration algorithm rather than layering competing arbiters.

## 7. B5 — External-service login

- [x] 7.1 Add `libs/chat-hooks/src/external-services/tests/useExternalServiceLogin.spec.ts` for OAuth/API key/DIAL-native flows, both supported levels, consent, reserved popup, stale logout failure, authoritative cancel recheck, unsuccessful timeout, key trim and cleanup. Keep the popup/handshake engine existing; mock boundaries, not a duplicate protocol.

- [x] 7.2 Implement `libs/chat-hooks/src/external-services/useExternalServiceLogin.ts` and shared types, add `libs/chat-hooks/src/entry-points/external-services.ts` and the public subpath in `libs/chat-hooks/package.json` plus its build entry configuration. Convert `apps/chat/src/hooks/externalServices/useExternalServiceLogin.ts` to callbacks and explicit outcome adaptation.

- [x] 7.3 Add/preserve callback-dispatch integration coverage in `apps/chat/src/pages/ToolsetAuthCallback/tests/ToolsetAuthCallback.spec.tsx` for ExternalService, OfflineCredentials and Toolset with consent forwarding. Preserve the existing parent exchange branch.

## 8. B6 — Deployment change tracking

- [x] 8.1 Add `libs/chat-hooks/src/conversation/tests/useDeploymentChangeTracking.spec.ts` for initial restore, equality, null selection, unload/reload and direct conversationId changes while loaded.

- [x] 8.2 Implement/export `libs/chat-hooks/src/conversation/useDeploymentChangeTracking.ts`; reduce `apps/chat/src/hooks/useDeploymentChangeEffect.ts` to context lookup and status-message callback. Preserve `createDeploymentChangedMessage` and app persistence; reset the baseline on conversation identity, not only loaded state.

## 9. B7/B8 — Small display adapters

- [x] 9.1 Add dedicated unit suites `libs/quotations/src/utils/tests/useHtmlTagAnnotationGroups.spec.ts` and `libs/chat-shared/src/conversation-transfer/tests/conversation-transfer-queue.spec.ts` for unknown annotation input, stable identity, all job statuses, missing codes, warningNames and input immutability.

- [x] 9.2 Implement/export `libs/quotations/src/utils/useHtmlTagAnnotationGroups.ts`; delegate `apps/chat/src/hooks/conversation/useConversationAnnotationPool.ts` after extracting persisted annotations. Use existing grouping rather than cloning it.

- [x] 9.3 Implement/export `libs/chat-shared/src/conversation-transfer/conversation-transfer-queue.ts`; delegate only job-row conversion in `apps/chat/src/utils/conversation-transfer.ts`. Retain translation-key resolvers and the existing file-manager mapper unchanged.

## 10. A2 — Audio upload compatibility

- [x] 10.1 Extend `libs/chat-hooks/src/conversation/useTranscribeAudio/tests/useTranscribeAudio.spec.ts` with preserve/default and normalize policies, codec MIME, bytes/name/lastModified preservation, already-normalized input, abort/size validation and one upload across retries.

- [x] 10.2 Add the optional uploadMimeTypePolicy to `libs/chat-hooks/src/conversation/useTranscribeAudio/useTranscribeAudio.ts`. Keep the parent's current default and metadata normalization; document the opt-in normalization policy.

## 11. D — Reset-time compatibility

- [x] 11.1 Extend `libs/chat-hooks/src/usage/tests/usage-reset-time.spec.ts` with frozen spring/autumn DST examples for current-offset and reset-instant, omitted-options compatibility, unchanged ISO/epoch boundary and invalid/throwing Intl handling.

- [x] 11.2 Add the optional policy argument in `libs/chat-hooks/src/usage/usage-reset-time.ts` without changing the legacy default or shortened formatter behavior. Keep locale/translation from the host and usage-dashboard free of raw timestamp logic. Update `libs/chat-hooks/README.md` and relevant usage documentation for explicit policy selection.

## 12. Package proof, boundaries and handoff (depends on 2–11)

- [x] 12.1 Extend `tools/reusable-workflows-consumer-fixture/scripts/run.mjs`, reusing `libs/chat-hooks/e2e-fixtures/harness.mjs`, to pack/install the touched roots and complete dependency/peer closure outside the workspace. Import every new public API, check B5's subpath and both compatibility options, exercise two instances plus JSON/incremental fake transports, and typecheck/bundle without aliases, overrides or ancestor-module fallback. Add `libs/chat-hooks/src/tests/remaining-reuse-public-api.spec.ts` for the public contract smoke cases reused by the fixture.

- [x] 12.2 Verify dependency isolation in `libs/chat-hooks`, `libs/quotations` and `libs/chat-shared`: no hardcoded API routes, configured clients, server-api imports, app contexts, routing/session/env, telemetry/SDK setup or persisted host schemas; no feature hooks/components in chat-hooks. Generated-client types/operation signatures are allowed only within the existing narrow chat-hooks exception. Do not widen ESLint constraints. Verify public declaration/build entries and dependency manifests.

- [x] 12.3 Finish `libs/chat-hooks/README.md`, `libs/quotations/README.md`, `libs/chat-shared/README.md`, `tools/reusable-workflows-consumer-fixture/README.md` and `docs/architecture.md` with ownership and exports.

- [x] 12.4 Run exactly one final `npm run verify:full`, `npm run build:quiet` because exports/bundles changed, and the isolated consumer target. Ensure each parent adapter consumes the common implementation and all checkboxes describe real completion. Do not publish packages automatically.
