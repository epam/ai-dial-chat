## 1. Backend and contract slice

- [x] 1.1 Add bounded title projections/cache, fast metadata listing and the validated title endpoint in `apps/chat-api/src/conversations/`, including encoded-path and write-race protection. Verification: focused listing, title-service/cache and controller integration specs through Nx.
- [x] 1.2 Regenerate OpenAPI and `libs/chat-api-client` using `npm run openapi`; inspect generated operation names and run `npm run openapi:check`, client lint/build, and backend checks. Verification: generated `getConversationTitles` has typed request/response and no message payload.

## 2. Progressive frontend slice

- [x] 2.1 Extend the app's generated conversations adapter and existing `ConversationsContext` with cancellable sequential title batches and stale-response protection. Verification: focused background-title hook, context and API adapter specs through Nx.
- [x] 2.2 Add host-agnostic title-progress/search-continuity props and translated accessible feedback to the shared panel; preserve mobile/desktop and RTL behavior. Verification: conversation-panel tests for pending empty search, retained opened matches and query changes; review library boundaries and README.

## 3. Documentation and verification

- [x] 3.1 Update `docs/architecture.md`, authoritative conversation specs and affected library README. Verification: `npm run validate:docs`, `npm run validate:specs`, OpenSpec validation.
- [x] 3.2 Run changed-slice checks and one full verification attempt, plus required affected builds, then review correctness, architecture, security, performance and responsive/documentation parity. Fix findings and record any environment or pre-existing failures without misreporting completion.

## Verification results (2026-10-28)

- Full workspace typecheck, lint and formatting passed.
- Full test attempt completed: Chat, Chat API and conversation-panel suites passed. The only failed target was the unchanged `@epam/ai-dial-attachment-canvas:test`: eager JS size 69,234 bytes exceeds 66,500; package unpacked size 255,254 bytes exceeds 242,000. These budget failures remain outside this change.
- Backend, generated API client and conversation-panel builds passed.
- Focused frontend regression suites passed 281 tests; final hook/context rerun passed 70. Backend focused cache/title/controller suites passed 112 tests before the final type-only return correction; the subsequent full backend suite passed.
- OpenAPI contract check, documentation validation, specification references and strict OpenSpec change validation passed.
- Correctness, architecture, security, performance, accessibility and shared mobile/desktop/RTL behavior reviewed. Race findings fixed and covered by regression tests. No live Core latency measurement or browser visual verification was performed.
- Full test log: `tmp/agent-logs/2026-10-28T15-47-01-076Z-test-full.log` (local, ignored).
