## Context

`ConversationService` (`apps/chat-api/src/conversations/conversation.service.ts`) is 1595 lines and backs `ConversationController` for CRUD, listing, bulk deletion, publish-adjacent metadata, and SSE-based completion streaming (`streamCompletion`, `watchConversation`, `relayModelCompletion`). Its spec file is 2790 lines. Three responsibilities have already been split out into their own injectable services — `ConversationGenerationService` (in-memory registry), `ConversationNamingService` (LLM title generation, depends on `ConversationPersistencePort`), and `ConversationPublishService` (publish to folder) — but the core CRUD/listing/streaming logic remains monolithic.

The backend already has a precedent for this exact kind of split: `2026-07-16-split-files-service` (archived) decomposed a similarly-sized `FilesService` into a thin facade (192 lines) plus focused sub-services, with the controller taking ownership of the Express `Response`/stream wiring that had previously leaked into the service layer. This design reuses that pattern for conversations.

## Goals / Non-Goals

**Goals:**
- Break `ConversationService` into `ConversationPersistenceService`, `ConversationListingService`, `ConversationLifecycleService`, and `ConversationStreamingService`, each independently unit-testable.
- Remove `express.Response` / SSE wiring from service code; `ConversationController` owns the HTTP/SSE boundary, services return plain data or an abstract stream/event representation.
- Reduce `ConversationService` to a facade under ~200 lines that preserves the exact public method signatures `ConversationController` and `ConversationNamingService` already call, so no caller changes.
- Split `conversation.service.spec.ts` (2790 lines) into per-service spec files, mirroring the new folder structure.

**Non-Goals:**
- No REST contract, DTO, or OpenAPI changes — identical request/response shapes.
- No frontend changes.
- No further decomposition of `ConversationGenerationService`, `ConversationNamingService`, or `ConversationPublishService` beyond constructor-injection rewiring.
- No behavior changes to caching, TTLs, or logging semantics.

## Decisions

**Facade + sub-services, not a full rewrite.** `ConversationService` keeps its current public method names and signatures and simply delegates to injected sub-services. Alternative considered: replace `ConversationService` entirely and update `ConversationController` to call four services directly. Rejected — that would touch the controller's constructor and every call site simultaneously, increasing the diff surface and rollback risk for a change that has no external behavior delta. Keeping the facade means the controller diff is near-zero and each extraction step ships independently.

**Service boundaries follow data lifecycle, not method count.** Persistence (get/save primitives), listing (read + enrichment), lifecycle (mutations: create/delete/rename/duplicate/pin), and streaming (SSE) are natural seams because each has a distinct set of dependents: `ConversationNamingService` only needs persistence; the controller's list endpoints only need listing; bulk-delete endpoints only need lifecycle. Alternative considered: split by HTTP verb (reads vs. writes) — rejected because streaming is technically a "read" but has an entirely different transport shape (SSE vs. JSON) and needed its own boundary regardless.

**`ConversationPersistencePort` stays as the DI seam.** `ConversationPersistenceService` implements the existing port interface; `ConversationNamingService` is rewired to depend on the new implementation via the port, not the concrete class. This preserves the existing dependency-inversion boundary instead of introducing a new one.

**Streaming service returns an abstraction, controller owns `@Res()`.** `ConversationStreamingService.streamCompletion(...)` returns an async iterable / observable of SSE events instead of writing to `Response` directly (mirrors `FilesArchiveDownloadService` → controller pattern from `split-files-service`). The controller subscribes and writes `res.write(...)` / sets SSE headers. This is the one place where the facade's delegation isn't a 1:1 signature passthrough — `ConversationController` needs a small update to consume the new return type. This is the accepted scope exception to the "controller changes near-zero" decision above, since it's the actual bug (HTTP concern in service layer) the refactor is meant to fix.

**Migrate service-by-service with the monolith intact until the last step.** Each extraction (persistence → listing → lifecycle → streaming) is added as a new provider called by the still-existing facade, verified with `npm exec nx test chat-api` after each slice, before the corresponding logic is deleted from the monolith. Alternative considered: extract all four in one big-bang change — rejected, matches the incremental-slice policy in `AGENTS.md` and keeps any regression bisectable to a single slice.

## Risks / Trade-offs

- [Behavioral drift during spec relocation] Moving `describe` blocks from the 2790-line spec into per-service files risks silently dropping assertions or fixture setup → Mitigate by relocating blocks verbatim first, running the full suite, and only refactoring test structure in a separate pass after parity is confirmed.
- [SSE event-shape mismatch] Changing `streamCompletion`/`watchConversation` to return an abstraction instead of writing to `Response` directly risks altering chunk framing, flush timing, or error propagation on the wire → Mitigate by keeping the abstraction as thin as possible (async iterable of the exact same event objects previously written) and adding a contract test that diffs raw SSE bytes before/after for a fixed fixture conversation.
- [Hidden coupling between "sections"] Some monolith methods may implicitly share private helpers or caching state across the proposed boundaries (e.g. a private cache used by both listing and lifecycle) → Mitigate by grepping for private method/field usage across the whole file before assigning it to a boundary, and promoting genuinely shared helpers to a small shared utility rather than duplicating them.
- [DI wiring gaps] `ConversationNamingService` and `ConversationPublishService` depend on conversation service internals; missing a rewire could throw at Nest bootstrap → Mitigate by running `npm exec nx build chat-api` (which fails fast on DI resolution errors) after each provider registration change.

## Migration Plan

Same order as `proposal.md`'s "What Changes": scaffold providers → extract persistence → extract listing → extract lifecycle → extract streaming + move SSE glue to controller → facade cleanup/dead-code removal → verification. Each step is a separate commit/slice gated on `npm exec nx test chat-api`, `npm exec nx lint chat-api`, and (for DI/module changes) `npm exec nx build chat-api`. No feature flag or staged rollout is needed since there is no external behavior change — rollback is a straight revert of the offending slice's commit.

## Open Questions

- Should the SSE event abstraction returned by `ConversationStreamingService` be a plain `AsyncIterable<SseEvent>` or wrap `rxjs` `Observable` (already a NestJS dependency elsewhere in the codebase)? Default to `AsyncIterable` for simplicity unless implementation surfaces a concrete need for `Observable` operators (retry, takeUntil on client disconnect).
