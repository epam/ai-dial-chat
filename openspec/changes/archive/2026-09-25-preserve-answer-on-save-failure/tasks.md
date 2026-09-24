## 1. Prove and correct terminal persistence signaling

Strategy: risk-first, then a client vertical slice. No automatic persistence retry or auth redesign.

- [x] 1.1 Add a real HTTP/SDK regression in `apps/chat-api/src/conversations/tests/completion-persistence.integration.spec.ts` for terminal 401/503 after streamed text/stages, plus a successful-save control; record the pre-fix failure. Verification: `npm run test:file -- apps/chat-api/src/conversations/tests/completion-persistence.integration.spec.ts` (equivalent Nx target preferred).
- [x] 1.2 Update streaming finalization and registry terminal events to report persistence failure safely for done/stop/error, retaining one write and lease semantics. Extend relevant registry/stream tests. Verification: the new integration file and `apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts`, `apps/chat-api/src/conversations/tests/attach-generation.integration.spec.ts` through Nx.

## 2. Preserve received answers in all client terminal paths

- [x] 2.1 Add typed transport handling and hook preservation on explicit failure and placeholder reload; protect normal and resumed generations against stale ownership, and retain successful server enrichment. Keep app contracts out of libs. Verification: `libs/chat-hooks/src/conversation/tests/create-chat-stream-api.spec.ts`, `libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.spec.ts`, and `libs/chat-hooks/src/conversation/useConversationStream/tests/generation-resume.spec.ts` through Nx.
- [x] 2.2 Pass an app-localized unsaved-answer warning through the optional hook parameter in Conversation and AppPreviewChat. Add the English resource key (the app currently ships only en.json; RTL locales use its configured fallback); check existing alert rendering and mobile/RTL parity. Verification: relevant app tests and typecheck, with no new layout or styling.

## 3. Documentation and verification

- [x] 3.1 Update `docs/architecture.md`, the `libs/chat-hooks/README.md` public contract, and backend SSE API documentation; update OpenAPI artifacts only if their endpoint description changes. Record HTTP reproduction evidence and operational limitations in this change. Verification: `npm run validate:docs` and `openspec validate preserve-answer-on-save-failure --strict`.
- [x] 3.2 Run `npm run verify:changed` once after the completed slice and exactly one `npm run verify:full`; review correctness, readability, architecture, security, performance, responsive parity and docs. Record failures accurately, resolve change-related failures, and mark tasks only when implemented.
