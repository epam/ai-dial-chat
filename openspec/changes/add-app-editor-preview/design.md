## Context

`AppsEditor` (`apps/chat/src/pages/AppsEditor/AppsEditor.tsx`) has two steps: General (creates the app via `POST /api/v1/applications`) and Settings (`SettingsStep` → `AppEditorIframe`, an `<iframe>` pointed at `schema.editorUrl`, driven by a `postMessage` protocol — `AppsEditorEvent.TriggerSave` in, `SaveSuccess`/`SaveError`/`UpdatedSuccess`/`ReadyToInteract` out; see `apps/chat/src/types/apps-editor.ts`). `EditorHeader` (`apps/chat/src/components/EditorHeader/EditorHeader.tsx`) renders title/steps nav on the left and Cancel/Save on the right; it is shared with `ToolsetEditor` today only insofar as both editors *could* use it, but `ToolsetEditor` in fact uses its own `ToolsetEditorHeader` and never imports `EditorHeader` — so it is safe to add an app-specific `onPreview` prop without affecting toolsets.

Real conversations are rendered by `ConversationView` (`apps/chat/src/components/ConversationView/ConversationView.tsx`) inside `Conversation.tsx` (`apps/chat/src/pages/Conversation/Conversation.tsx`), backed by `useConversationStream` + `useConversationHandlers`, both keyed by a persisted `conversationId`/path (SSE watch via `conversations/watch`, `getConversation`/`saveConversation` calls). Sending a message goes through `POST /conversations/completions` (`apps/chat-api/src/conversations/conversation.controller.ts:191` → `conversation.service.ts` `streamCompletion`, ~line 1220-1509), which requires the conversation to already exist at `path`, saves a "start state" before calling the model, and `finalize()`s (saves the completed/partial message) after. None of this is reusable as-is for a chat that must never be persisted.

## Goals / Non-Goals

**Goals:**
- Let an app author, from inside the Settings step of the Apps editor, save their in-progress app and immediately chat with it live, without the chat ever appearing in their conversation history.
- Keep the model fixed to the application under edit — no model picker in the preview pane.
- Preserve preview chat messages across toggling Preview ↔ Settings within one editor session; discard them when the editor unmounts.
- Add a stateless backend completion primitive that can be reused by future ephemeral/non-persisted chat surfaces, not just this one.

**Non-Goals:**
- Persisting or resuming preview conversations across page reloads or navigation away from the editor.
- Supporting attachments, addons, system prompt/temperature configuration, or any other `ConversationInput`/`chatSettings` feature beyond plain text send/receive in the preview pane (can be revisited later; `ConversationView` still accepts these props, we simply won't wire optional ones we don't need).
- Adding preview to `ToolsetEditor` or any other editor.
- Building a generic "compare mode" or multi-preview-tab system — one preview pane per editor session.

## Decisions

### 1. New stateless backend endpoint: `POST /api/v1/conversations/preview-completions`
Sibling to `/conversations/completions` in the same `apps/chat-api/src/conversations/` domain (same controller/module, following `apps.md`/NestJS conventions — versioned route, `@Throttle`, `@ApiOperation`/`@ApiResponse` per status code). It:
- Accepts a new `PreviewCompletionDto`: `model: string` (the app's deployment id), `messages: PreviewMessageDto[]` (the full client-held transcript: `{ role: MessageRole; content: string }[]`, validated with `@ValidateNested({ each: true })` + `@ArrayMaxSize` to bound payload size), and `generationId?: string` (for logging/correlation only — no server-side registry).
- Reuses the existing message/body-assembly logic and the `this.client.sendChatCompletionRequest(model, { body, headers, params, parseAs: 'stream', signal })` + SSE-relay loop already in `conversation.service.ts` (~lines 1284-1340 body assembly, ~1391-1465 model call/relay), extracted into a shared private method (e.g. `buildCompletionRequestBody` / `relayCompletionStream`) so both endpoints call the same core, avoiding duplicated SSE-parsing logic.
- Does **not** call `getConversation`, `saveConversation`, `finalize()`, or `ConversationGenerationService` — no DIAL Core storage read/write, no generation registry entry, no 409 "generation already active" semantics (each preview call is independent).
- Stops mid-generation via the client aborting its `fetch` (`AbortController`/`signal`); the NestJS handler forwards that same signal into `sendChatCompletionRequest`, which is already the established abort mechanism for the existing endpoint's outbound stream — no `/preview-completions/stop` endpoint is needed.
- Authorization: same as `/completions` — requires an authenticated session (`req.user` as `SessionUser`); no additional role check, since it uses the same DIAL Core credentials the user already has for the deployment. Rate-limited more conservatively than `/completions` (e.g. `{ limit: 30, ttl: 60000 }`) since a caller can trivially loop it without the natural pacing of a persisted, single-active-generation conversation.

**Alternative considered**: reuse `/conversations/completions` by creating a real (but hidden) conversation record and deleting it after. Rejected per explicit product decision — the user chose to keep the preview chat genuinely invisible/non-persisted rather than accept a create+delete round trip through DIAL Core storage for every preview session.

### 2. Frontend: dedicated ephemeral hook instead of reusing `useConversationStream`/`useConversationHandlers`
New `usePreviewCompletion` hook (`apps/chat/src/hooks/conversation/usePreviewCompletion.ts`) owns:
- In-memory `messages: MessageType[]` state (no `Conversation` persistence fields needed beyond what `ConversationView` requires).
- `sendMessage(content)`: appends a user message, calls a new thin `server-api` function `streamPreviewCompletion` (`apps/chat/src/server-api/preview-completion.api.ts`, modeled on `chat-stream.api.ts` but POSTing to `/conversations/preview-completions` with `{ model, messages, generationId }` instead of `{ path, ... }`), and applies streamed chunks to the last assistant message via the existing `applyChunkToMessages` util.
- `stop()`: aborts the in-flight `AbortController`.
- `isAssistantTyping` derived from whether a stream is in flight.

This hook is intentionally not shared with `useConversationStream` — the two diverge enough (no path, no watch/resume, no server-persisted reload on complete) that forcing a shared abstraction would add conditional branches to code whose entire value is being simple and side-effect-free.

### 3. `AppsEditor` save-then-preview orchestration
`AppsEditor` gets a `pendingSaveAction: 'save' | 'preview' | null` piece of state (in addition to the existing `isSaving`). `handlePreview` sets `pendingSaveAction = 'preview'` and calls the same `settingsStepRef.current?.triggerSave()` the Save button uses. The existing `onSaveSuccess`/`onSaveError` callbacks passed to `SettingsStep`/`AppEditorIframe` branch on `pendingSaveAction`:
- `'save'` (existing behavior): navigate to `returnUrl`.
- `'preview'`: set `isPreviewing = true` instead of navigating; do not unmount `AppEditorIframe` (see Decision 4).
- On error, both cases show the existing `saveError` notification and stay put; `pendingSaveAction` resets to `null`.

`isPreviewing` also drives which node renders under `EditorHeader` (chat vs. `SettingsStep`) and disables Cancel/Save (there is nothing to save while the settings form isn't mounted/visible).

### 4. Keep `AppEditorIframe` mounted (hidden, not unmounted) while previewing
`SettingsStep` renders both `AppEditorIframe` (visually hidden via `hidden`/`display:none`, not unmounted) and the new `AppPreviewChat`, toggling visibility based on `isPreviewing`. Rationale: the iframe's own internal app state (any unsaved-in-iframe UI state, `isLoading`, its `message` listener) survives round-trips into and out of preview without a reload flash. The cost is one always-mounted iframe for the lifetime of the Settings step, which is already the case today minus the toggle.

**Alternative considered**: unmount/remount the iframe on each preview exit. Rejected — causes a visible reload/flash and re-fetch of `editorUrl` every toggle, with no benefit since the iframe's own state was already saved before entering preview.

### 5. Preview chat model binding and no model picker
`AppPreviewChat` builds a minimal in-memory `Conversation` shape for `ConversationView`'s props: `model: { id: appId }` (the same `appId` `AppsEditor` already threads through `SettingsStep`/`AppEditorIframe`), `messages` from `usePreviewCompletion`.

**Correction found during implementation**: `ConversationView` does not currently expose `deployments`/`modelPickerOverlay` as props at all — it resolves them itself from `useDeployments()` and always passes them to `ConversationInput`. Omitting them is not something a caller of `ConversationView` can do today. `ConversationView` (`apps/chat/src/components/ConversationView/ConversationView.tsx`) gains a new optional prop, `isModelFixed?: boolean`. When `true`: `deployments` and `modelPickerOverlay` passed to `ConversationInput` become `undefined`, `selectedDeploymentId` is pinned to `initialModelId`, and `onDeploymentChange` becomes `undefined`. This still relies on the existing `ModelSelectorControl` behavior (`if (!deployments) return null;`) to hide the picker, but the wiring happens inside `ConversationView` rather than by the caller simply not passing props.

### 6. Icon choice
Use `IconEye` (open preview) / `IconEyeOff` (exit preview) from `@tabler/icons-react`, matching the icon library used everywhere else in the codebase (`AGENTS.md` §Libraries: "@tabler/icons-react: Icon set — use for all icons, no inline SVGs"). Both are direction-symmetric — no `rtl:scale-x-[-1]` mirroring needed (confirmed against `.claude/rules/rtl.md` §Directional icons: only icons with inherent left/right meaning require mirroring).

### 7. i18n
New keys under a dedicated `AppsEditorI18nKeys` block (existing enum in `apps/chat/src/constants/translation-keys.ts`): `PreviewButton`, `ExitPreviewButton`, `PreviewChatPlaceholder` (composer placeholder), `PreviewChatAriaLabel` (nav/region aria-label), added to `en.json` and every other locale file including `ar.json` (RTL) per `AGENTS.md` §Adding a new locale.

## Risks / Trade-offs

- **[Risk]** Duplicated-looking but diverging completion logic between `/completions` and `/preview-completions` could drift over time (e.g. a future change to request-body assembly applied to one but not the other). → **Mitigation**: extract the shared body-assembly + SSE-relay code into one private method/util used by both controller methods at implementation time (Decision 1), not two independent copies.
- **[Risk]** A user could hammer `/preview-completions` in a loop with large `messages` payloads (no persisted conversation to naturally bound history size). → **Mitigation**: `@ArrayMaxSize` on `messages`, a tighter `@Throttle` limit than `/completions`, and a `@MaxLength` per message content field (mirroring `SendCompletionDto`'s `@MaxLength(4000)`).
- **[Risk]** Keeping `AppEditorIframe` always mounted while hidden means its `message` event listener keeps running during preview; a stray postMessage from the iframe while hidden (e.g. an errant `SaveSuccess`) could fire the same success handler unexpectedly. → **Mitigation**: guard the `handleMessage` effect (or the `AppsEditor` callbacks it invokes) so `SaveSuccess`/`SaveError` are ignored while `isPreviewing` is true, since no save can legitimately be in flight from a hidden iframe.
- **[Trade-off]** Preview messages are lost on navigation away/unmount, with no draft-recovery. Accepted per explicit scope decision (Non-Goals) — a true "preview session," not a persisted scratch conversation.

## Open Questions

- Confirm final route name `POST /api/v1/conversations/preview-completions` (vs. a different resource grouping, e.g. under `applications/` instead of `conversations/`) during implementation review — placed under `conversations` here because it reuses conversation completion internals, but it has no conversation identity.
- Confirm whether `AppPreviewChat` needs a lightweight "New chat" affordance to reset the in-memory transcript within a session, or whether "reset by exiting the editor" is sufficient for v1 (current scope assumes the latter).
