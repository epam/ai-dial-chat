## Context

Three conversation-input surfaces (`ConversationRoute.tsx`, `Conversation.tsx`, `ConversationView.tsx`) independently implement attachment upload, audio transcription, model selector i18n labels, and chat settings form config. Separately, `apps/chat-api` registers `ThemeController` and `ThemeService` directly on `AppModule` rather than wrapping them in a domain module, unlike every other backend domain (`DeploymentsModule`, `ModelsModule`, etc.).

This is a pure internal-consistency refactor: no REST contract, OpenAPI spec, or UI-visible behavior changes. The work spans two independent apps (`apps/chat`, `apps/chat-api`) but is bundled into one OpenSpec change because it was scoped together as PR-1 of a larger refactor effort and the pieces are small and low-risk enough to land together.

## Goals / Non-Goals

**Goals:**

- Eliminate the ~300 lines of duplicated attachment-upload, audio-transcription, model-selector-label, and chat-settings-config wiring across the three conversation surfaces by extracting four hooks under `apps/chat/src/hooks/conversation/`.
- Wrap `ThemeController`/`ThemeService` in a `ThemesModule` so `apps/chat-api` has one consistent per-domain module pattern.
- Preserve all currently observable behavior: uploads, transcription, settings, and model selector still work identically from a user's perspective, and `/api/v1/themes/*` routes/responses are unchanged.

**Non-Goals:**

- Extracting `useConversationInputSurface` or splitting `ConversationView` into subcomponents (tracked separately as Phase 3.1).
- Adopting `useDialFileManagerState` in `ConversationView` (deferred — out of scope for this change).
- Splitting `useDialFileManager` into listing/upload/mutation hooks (Phase 3.2 / PR-5).
- Changing conversation send/edit/regenerate logic in `useConversationHandlers`.
- Any change to `ThemeController`, `ThemeService`, their DTOs, routes, or Swagger docs.
- Any change to lib packages (`conversation-input`, etc.) — new hooks live in `apps/chat` only, per library isolation rules.

## Decisions

### D1 — Four separate hooks, not one combined hook

Split into `useAttachmentUpload`, `useAudioTranscription`, `useModelSelectorLabels`, `useChatSettingsFormConfig` instead of one `useConversationInputSurface` mega-hook.

- **Why:** Each concern has an independent lifecycle and different consumers (e.g. `useConversationHandlers.ts` only needs attachment upload, not audio or settings). Smaller hooks are independently testable and each maps to exactly one duplicated concern identified in the proposal.
- **Alternative considered:** A single combined hook (`useConversationInputSurface`) was considered but rejected for this change — it's explicitly the target of the later Phase 3.1 consolidation, which also needs to fold in ConversationView subcomponent boundaries. Building it now would be premature and would need rework once that phase starts.

### D2 — `useChatSettingsFormConfig` takes a discriminated-union options object

`{ mode: 'local'; values; onValuesChange; deploymentFeatures? } | { mode: 'conversation'; conversation; onConversationChange; deploymentFeatures? }`.

- **Why:** `ConversationRoute` (new chat, no persisted conversation yet) and `ConversationView` (existing conversation) have genuinely different data sources for settings values and different save targets. A discriminated union keeps the surface-specific `onSave` wiring in the caller while sharing all label/i18n/feature wiring inside the hook, rather than forcing an artificial common shape or two separate hooks that would re-duplicate the shared label logic.
- **Alternative considered:** Two separate hooks (`useChatSettingsFormConfigLocal` / `useChatSettingsFormConfigConversation`) — rejected because the i18n label wiring (the actual duplicated logic) is 100% shared; only the values source and save callback differ.

### D3 — `useAttachmentUpload` owns the network-error notification, `useConversationHandlers` passes a callback

`useAttachmentUpload({ bucket, onNetworkError? })` performs the offline-detection + debounced batching itself, and calls the optional `onNetworkError(filenames)` callback for UI notification. `useConversationHandlers` passes a `showNetworkError` callback into the hook rather than reimplementing the debounce/offline-detection logic itself.

- **Why:** The debounce and offline-detection logic is the actual duplicated code; the notification UI (toast copy, i18n) differs slightly today only because it was copy-pasted, not because the surfaces need different behavior. Centralizing detection/debouncing in the hook and leaving only the notification callback in callers removes the duplication while keeping each caller's presentation layer decoupled from upload internals.
- **Alternative considered:** Push notification UI into the hook directly (hook calls `useNotification()` itself) — rejected because `useConversationHandlers` is a plain hook without guaranteed access to the same notification context wiring conventions used in page components; keeping the callback boundary avoids coupling the hook to a specific notification call site.

### D4 — `ThemesModule` follows the existing `DeploymentsModule` pattern exactly

`@Module({ controllers: [ThemeController], providers: [ThemeService] })`, imported into `AppModule`; `exports: [ThemeService]` only added if another module actually needs it (none currently does, so it is omitted initially).

- **Why:** Consistency with every other backend domain lowers cognitive load for anyone navigating `apps/chat-api/src/*`; `themes/` was flagged in the docs as the reference domain example (`apps/chat-api/AGENTS.md` cites `themes/theme.controller.ts`), so it should also be structurally consistent with the domains it's used as a reference for.
- **Alternative considered:** Leaving `ThemeService` exported preemptively "in case something needs it later" — rejected per the project's no-speculative-code guidance; add the export when a real consumer appears.

## Risks / Trade-offs

- **[Risk]** Behavioral drift during extraction (e.g. subtly changing debounce timing or error-tagging logic while moving code) → **Mitigation:** migrate logic verbatim where possible, extend `useConversationHandlers.spec.ts` and add new co-located specs (`useAttachmentUpload.spec.ts`, etc.) asserting the same behavior before and after; run `nx test @epam/chat` after each hook extraction, not just at the end.
- **[Risk]** Removing `ThemeController`/`ThemeService` registration from `AppModule` breaks route resolution or DI if done incompletely → **Mitigation:** existing `theme.controller.spec.ts` / `theme.service.spec.ts` plus `nx build chat-api` catch wiring errors immediately; land this as its own task after frontend tasks so a build break is easy to isolate.
- **[Trade-off]** Bundling two logically separate workstreams (attachment/audio/labels/settings hooks, ThemesModule) into one OpenSpec change increases the diff size for a single review → accepted per the proposal's original PR-1 scoping; each workstream still lands as an independently verifiable task (see tasks.md) so review and rollback can be done per-slice even within one change.

## Migration Plan

No deployment migration is required (internal refactor, no data or API contract changes). Implementation proceeds as incremental slices, each independently verified:

1. `useAttachmentUpload` → migrate `ConversationRoute` + `useConversationHandlers` → verify.
2. `useAudioTranscription` → migrate `ConversationRoute` + `Conversation` → verify.
3. `useModelSelectorLabels` → migrate `ConversationRoute` + `ConversationView` → verify.
4. `useChatSettingsFormConfig` → migrate `ConversationRoute` + `ConversationView` → verify.
5. `ThemesModule` extraction in `apps/chat-api` → verify.
6. Full `nx affected` verification across `@epam/chat` and `chat-api`.

Rollback is trivial per-slice: each task is a self-contained commit: revert the specific commit if a slice regresses, since no slice depends on data migration or external state.

## Open Questions

None — scope, ownership, and reference implementations for every workstream are already identified in the proposal and confirmed against the current codebase.
