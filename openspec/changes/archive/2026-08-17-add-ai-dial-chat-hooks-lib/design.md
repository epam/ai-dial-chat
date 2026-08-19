## Context

`apps/chat` is the only place AI DIAL chat UI logic currently lives. Partner/external teams building bespoke chat frontends against the AI DIAL backend cannot reuse any of it without depending on the full app (its Redux-equivalent contexts, `server-api` layer, and `@epam/ai-dial-ui-kit` UI). This change starts a new publishable library, `libs/ai-dial-chat-hooks`, that will hold framework-level, headless React hooks with no AI-DIAL-app coupling, and lands its first hook.

Candidates considered before selecting `useConversationScroll` (see proposal for full comparison):

| Candidate | Verdict | Why |
|---|---|---|
| `useConversationScroll` (`apps/chat/src/hooks/conversation/useConversationScroll.ts`, 356 lines) | **Selected** | Chat-domain-specific (autoscroll/anchor behavior every custom chat UI needs), already has a single non-React import and it is type-only (`Message` from `@epam/ai-dial-chat-shared`), self-contained API (7 return values, 3 params), existing test coverage to carry over. |
| `useConversationStream` + `chat-stream.api.ts` + `apply-chunk.ts` (SSE streaming, 447+162+188 lines) | Rejected for now | Highest ultimate value, but the hook pulls in `ClientChannelContext`, `GenerationContext`, `OverlayContext`, `server-api/chat-stream.api.ts`, `server-api/conversations.api.ts`, and DIAL-specific bucket-qualified paths + a generation-resume/watch-SSE protocol. Publishing a good public API here means designing a new contract, not a mechanical move — proposed as the **next** hook once this change establishes the lib's conventions. |
| `useBreakpoint` / `useIsMobile` (`apps/chat/src/hooks/breakpoint/useBreakpoint.ts` vs `libs/chat-shared/src/hooks/useIsMobile.ts`) | Rejected as flagship | Pure and zero-dep, but a generic viewport utility, not chat logic — doesn't demonstrate the library's value proposition to external consumers. Also currently duplicated with inconsistent thresholds (769px min-width vs 768px max-width) — real bug, but an internal `chat-shared` cleanup, not a `chat-hooks` launch feature. |
| `useLocalStorage` (`apps/chat/src/hooks/useLocalStorage.ts`) | Rejected as flagship | Pure but fully generic; no chat-domain value to showcase. |
| `useDialFileManagerTabConfig` (`apps/chat/src/hooks/files/useDialFileManagerTabConfig.ts`) | Rejected | Coupled to `@epam/ai-dial-react-file-manager`'s tab model, `@epam/ai-dial-ui-kit`'s `TabModel`, and `AppConfigContext`. Not a generic primitive. |
| `useCodeCopy` / `useStreamedMarkdownContent` / `useTableScroll` (already in `libs/chat-shared/src/hooks/`) | Out of scope | Already extracted into an existing lib; not an `apps/chat`-to-new-lib extraction. Reconciling `chat-shared/src/hooks` into `ai-dial-chat-hooks` is a follow-up, not part of this change. |

## Goals / Non-Goals

**Goals:**
- Stand up `libs/ai-dial-chat-hooks` as a new Nx-publishable library mirroring the existing `libs/chat-shared` project shape (package.json, tsconfig triad, vite lib build, vitest, eslint flat config, `nx` `publishable` tag).
- Extract `useConversationScroll` with its behavior unchanged for `apps/chat`, generalizing its one type dependency so the hook has zero imports from any `@epam/ai-dial-*` package.
- Ship a public, documented, stable hook API (`useConversationScroll`) that a team with no AI DIAL backend or app code can use against a plain array of `{ id }`-shaped messages.
- Preserve `apps/chat`'s current scroll/anchor/spacer behavior exactly — this is a relocation plus a generic-type widening, not a rewrite.

**Non-Goals:**
- Extracting `useConversationStream`/SSE logic (tracked as an explicit follow-up in the proposal).
- Reconciling or moving anything out of `libs/chat-shared/src/hooks` in this change.
- De-duplicating `useBreakpoint`/`useIsMobile` (tracked as a follow-up).
- Publishing the library to a real npm registry/CI release pipeline setup beyond mirroring `chat-shared`'s existing `publish` nx target definition (no new release infra work).
- Any change to `apps/chat`'s user-visible scroll behavior.

## Decisions

### 1. Generic message shape instead of a bespoke DTO

`useConversationScroll` only ever reads `messages.length` and (indirectly, through caller-supplied index) message *position*, never message content or any DIAL-specific field. Decision: change the `Params` shape from `messages: Message[]` to `messages: T[]` with `T` unconstrained (the hook does not need even an `id` field — it only needs the array and its length to detect growth/reset). This is the minimal generic surface, avoids inventing a shared "message" interface in the new lib, and lets `apps/chat` pass its existing `Message[]` with zero mapping.

Alternative considered: define a `ChatMessageLike { id: string | number }` interface in the new lib and require `T extends ChatMessageLike`. Rejected — the hook never reads `id`, so requiring it would be an unnecessary constraint on the public API and the first thing that would need loosening the moment a consumer's message type doesn't have that exact field name.

### 2. Package/build conventions mirror `libs/chat-shared`, not a new pattern

Reuse the exact same `tsconfig.json` / `tsconfig.lib.json` / `tsconfig.spec.json` / `vite.config.mts` / `eslint.config.mjs` structure as `libs/chat-shared`, adjusting only the project name (`@epam/ai-dial-chat-hooks`), Vite `lib.entry`/`name`, and `rollupOptions.external` (only `react`, `react-dom`, `react/jsx-runtime` — no `@epam/ai-dial-ui-kit`, since this lib must never depend on it). Rationale: this repo already has one working, review-tested publishable-lib template; inventing a second pattern for the same purpose (a small, dependency-light TS/React lib) adds maintenance surface for no benefit.

Register the new path alias in `tsconfig.base.json`: `"@epam/ai-dial-chat-hooks/*": ["./libs/ai-dial-chat-hooks/*"]`, following the existing `@epam/ai-dial-chat-shared/*` entry.

### 3. `peerDependencies: { react }` only — no runtime dependency on any `@epam/*` package

Per AGENTS.md's library isolation rule and this being an externally-consumed library, `ai-dial-chat-hooks` must not import `@epam/ai-dial-ui-kit`, `@epam/chat-api-client`, `@epam/ai-dial-chat-shared`, Redux, i18n, or any app context. `useConversationScroll`'s current single import from `@epam/ai-dial-chat-shared` is type-only and is removed by Decision 1, so after extraction the lib has exactly one dependency: `react` (peer, matching `libs/chat-shared`'s `^19.2.6` peer range), plus `vitest`/`@testing-library/react`/`jsdom` as devDependencies for the test suite. This is a stricter boundary than `chat-shared` itself (which does depend on `@epam/ai-dial-ui-kit` for its components) — `ai-dial-chat-hooks` is hooks-only and UI-framework-agnostic by design, so it should not accumulate UI-kit or markdown-rendering dependencies the way `chat-shared` has.

### 4. Move, not fork: `apps/chat` consumes the library export

Delete `apps/chat/src/hooks/conversation/useConversationScroll.ts` and its co-located test; `apps/chat`'s conversation/message-list container imports `useConversationScroll` from `@epam/ai-dial-chat-hooks` instead. This is a straight import-path change at the one call site — no wrapper, no re-export shim in `apps/chat`, since `apps/chat`'s own `Message[]` type satisfies the now-generic `T[]` parameter without any adaptation. Keeping a re-export shim was considered and rejected: `AGENTS.md`'s guidance to avoid backwards-compatibility hacks for internal, single-repo call sites applies directly — there's exactly one internal call site to update, and Nx/TS will fail the build immediately if a reference is missed, so a shim adds indirection with no safety benefit.

### 5. JSDoc and behavioral comments travel with the code, not the design doc

The hook's existing inline documentation (the top-level doc comment describing anchor/spacer behavior on lines 46–54 of the current file, and the scoped comments explaining `SPACER_CLEAR_TOLERANCE`, `SCROLL_CLAMP_TOLERANCE`, why the spacer is imperative DOM (not React state), and why unmount does not abort a stream) is preserved verbatim in the moved file. The library's `README.md` gets a *new*, consumer-facing usage example (see proposal's API section) rather than restating the inline comments.

## Risks / Trade-offs

- **[Risk]** The `armAnchor` / spacer-reservation mechanism is a fairly unusual, opinionated scroll strategy (temporary DOM spacer + scroll clamping) that external consumers may find surprising or may not need. → **Mitigation**: ship it as-is for v0 since it is exactly the tested, working behavior from `apps/chat`; document the mechanism's intent clearly in the README so consumers can decide whether to use `armAnchor` at all (it's opt-in — callers who never call it get plain bottom-follow behavior). Revisit the API surface only if real external feedback asks for a simpler mode.
- **[Risk]** SSR: `useConversationScroll` uses `useLayoutEffect`, `ResizeObserver`, and direct DOM refs, all of which are no-ops or produce a React SSR warning in a non-browser render. → **Mitigation**: document explicitly in the README that this hook is client-only (same as its current, undocumented behavior inside `apps/chat`, which is itself a pure client-rendered SPA); no new SSR guard is introduced since `apps/chat` never needed one — flagged as an open question for a future SSR-focused consumer, not solved in this change.
- **[Risk]** Publishing a public v0 API prematurely locks in behavior (spacer tolerances, threshold constants) that were tuned only for `apps/chat`'s specific message-list DOM structure. → **Mitigation**: version the library starting at `0.0.1`/pre-1.0 (matching `chat-shared`'s versioning convention) to signal the API may still shift before a 1.0 commitment.
- **[Trade-off]** Choosing the scroll hook over the higher-value SSE-streaming hook means the library's first release doesn't yet solve the hardest problem (correct SSE parsing) for external consumers. → **Accepted**: establishing working conventions (build, test, publish, docs) on a low-risk hook first, then tackling the higher-effort SSE extraction with those conventions already in place, reduces overall risk more than attempting both at once.

## Migration Plan

1. Scaffold `libs/ai-dial-chat-hooks` (config files only, no hook yet) and verify it builds/lints/tests empty via Nx, confirming the new project is wired into the workspace before any code moves.
2. Move `useConversationScroll.ts` and its test file into the new lib under `src/useConversationScroll/`, apply the generic-type widening (Decision 1), and export it from `src/index.ts`.
3. Update `apps/chat`'s single call site to import from `@epam/ai-dial-chat-hooks` and delete the old `apps/chat/src/hooks/conversation/useConversationScroll.ts` + its test file.
4. Run `apps/chat`'s full test suite and the new lib's test suite; manually verify scroll/anchor behavior in the running app (send a message, regenerate, edit-resubmit, scroll away and back) per this repo's "test the golden path in a browser" UI-change requirement.
5. Write the library `README.md` with the public API and usage example.
6. No rollback complexity beyond a normal revert: this is a pure move + generic-type change with no data migration, no backend change, and no feature flag.

## Open Questions

- Should `ai-dial-chat-hooks` eventually absorb `libs/chat-shared/src/hooks/*` (`useCodeCopy`, `useIsMobile`, `useStreamedMarkdownContent`, `useTableScroll`, `useCollapsedText`) for a single canonical "hooks" home, or should `chat-shared` keep owning hooks that are tightly bound to its own components (e.g. `useCodeCopy` pairs with `chat-shared`'s `CodeBlock`)? Left for a follow-up change once more hooks exist to judge the right boundary.
- Does the external-consumer audience need the hook to also work with virtualized message lists (e.g. `react-window`), where `contentRef`'s single wrapping element and `ResizeObserver` assumption may not hold? Not addressed in this change since `apps/chat` itself doesn't virtualize; flagged for whoever picks up a virtualization-aware consumer request.
- Exact semver/publish workflow (who cuts releases, npm registry/scope details) is inherited from `chat-shared`'s existing `tools/publish-lib.mjs` mechanism and not re-litigated here — assumed reusable as-is.
