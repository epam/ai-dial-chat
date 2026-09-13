## Strategy

Vertical slices: preserve selector data, correct preview identity/fallback, then verify documentation and generated contracts. The earlier implementation is retained; these tasks replace stale pre-merge assumptions.

## 1. Annotation data through normalization and persistence

- [x] 1.1 Preserve body selectors and supplied indexes in `libs/quotations/src/utils/annotation.ts`; handle malformed selectors and invalid pages without throwing.
- [x] 1.2 Add object-or-array body selector metadata/validation in `apps/chat-api/src/conversations/dto/annotation.dto.ts`; preserve selectors in server normalization and put legacy PDF regions in the same body location.
- [x] 1.3 Add regression tests in quotations `annotation.spec.ts`, backend `apply-chunk.server.spec.ts`, and `tests/annotation.dto.spec.ts` for object/array selectors, quote-only updates, and validated serialization.
- [x] 1.4 Generate OpenAPI/client from backend source using `npm run openapi`.

## 2. Citation preview identity and viewer fallback

- [x] 2.1 In `libs/chat-hooks/src/files/attachment-canvas.ts`, find the group by exact annotation membership, filter highlights by clicked PDF, and avoid nonexistent selected highlight IDs.
- [x] 2.2 Guard the default-page effect in `libs/attachment-canvas/src/components/PdfContent/PdfContent.tsx` against explicit page requests.
- [x] 2.3 Add mapper and real citation-click tests for separate markers and grouped sources in `libs/chat-hooks/src/files/tests/attachment-canvas.spec.ts` and `apps/chat/src/components/ConversationView/tests/ConversationMessageItem.spec.tsx`.
- [x] 2.4 Run focused regression tests for normalization, assembly, DTOs, mapper, PDF wrapper, and chat citations.

## 3. Remove temporary diagnostics (user follow-up)

- [x] 3.1 Remove PDF console logs, diagnostic callback/types/exports, listeners, timers, and diagnostic-only tests; retain the page-navigation fixes and their regression tests.
- [x] 3.2 Remove the diagnostic requirement and public API documentation from OpenSpec and READMEs.
- [x] 3.3 Re-run focused tests, canvas build/lint and docs/OpenSpec validation after removal.

## 4. Documentation and verification

- [x] 4.1 Update proposal/design/capability deltas and affected app/lib README contracts; document the remaining vendor auto-zoom timing risk.
- [x] 4.2 Run `npm run openapi:check`, generated-client build/lint, `npm run validate:docs`, and OpenSpec validation.
- [x] 4.3 Run `npm run verify:changed` and one `npm run verify:full`; record results and any pre-existing blockers without falsely marking them passed.
- [x] 4.4 Perform the five-axis self-review, including library isolation, compatibility and documentation accuracy.

## Verification record before diagnostic removal (2026-09-09)

- Focused `npm run test:file` run: seven files, 182 tests passed across quotations, chat-hooks, backend assembly/DTO validation, canvas and chat citations.
- Nx `build,lint` for `chat-api-client`, `@epam/ai-dial-attachment-canvas`, and `@epam/ai-dial-quotations`: passed, including their dependency tasks. OpenAPI generation/check, docs validation and strict OpenSpec validation passed.
- `verify:changed` and `verify:full`: attempted, NOT passed. Both stop at typecheck. Untouched code reports unresolved `@epam/ai-dial-mcp-apps`, the missing `stripConversationAttachments` test export, backend localized-value/spread/share typing errors and unbuilt declaration/test-config errors. Full verification additionally reports `mcp-app-sandbox`. The chained full lint/test stages therefore did not run.
- Broader targeted Nx lint also encounters existing chat-hooks peer-dependency metadata and backend share-test formatting failures. Exact-file ESLint after fixing new import-order/test-access findings only reports the existing chat module-boundary issue: `SettingsForm.spec.tsx` marks chat-hooks/chat-shared as lazy-loaded, conflicting with unchanged static imports in ConversationMessageItem and its test. Generated code has one unused-disable warning.
- Logs: `tmp/agent-logs/2026-09-09T07-24-45-028Z-typecheck-affected.log`, `tmp/agent-logs/2026-09-09T07-25-34-555Z-typecheck-full.log`, `tmp/agent-logs/2026-09-09T07-28-36-258Z-lint-pdf-files.log`; focused test logs start at `2026-09-09T07-27-54-827Z`.
- Self-review: selector/index preservation and group identity covered; callbacks optional and stable to avoid restarting viewer effects; logging remains app-owned, excludes document data, and uses bounded sampling/cleanup. No layout/i18n/accessibility changes. README/public exports and generated DTO agree. This is not a clean full-workspace verification or a confirmed vendor-race fix.

## Remaining runtime investigation

TypeScript follow-up: added explicit Vitest imports to `apply-chunk.server.spec.ts` and corrected six production-backend typecheck blockers in `common/utils/localized-value.ts`, `conversations/utils/apply-chunk.server.ts`, `files/archive/files-archive-download.service.ts`, `files/listing/files-listing.service.ts` and `share/share.service.ts`. Updated the share test's configuration type and added `common/utils/tests/localized-value.spec.ts`. Production backend and `apply-chunk.server.spec.ts` now report zero TypeScript diagnostics with their real configurations; all TS6305 errors cleared after declaration emission. Five focused test files passed (161 tests), and Nx backend lint passed. The complete backend typecheck is still red on unrelated test-project diagnostics (Vitest globals, fixture/mock signatures, imports and metadata); see `tmp/agent-logs/2026-09-09T07-56-29-207Z-typecheck-chat-api.log`. No tsconfig checks were weakened.

Removal verification: 62 tests passed across PdfContent, AttachmentCanvasBody and ConversationMessageItem; canvas Nx build/lint, docs validation and strict OpenSpec validation passed. No PDF diagnostic symbols or console prefixes remain in app/canvas source. The existing full-workspace blockers recorded above were not rechecked for this logging-only removal. Navigation fixes and the explicit-page fallback regression remain intact.

- [ ] Investigate the intermittent reset in the real PDF viewer; confirm whether the late page-1 scroll follows vendor zoom rather than a wrapper fallback before designing a synchronization fix. Do not archive this runtime investigation as solved by mocked tests.
