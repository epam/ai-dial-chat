## Why

`libs/chat-hooks` already proves the extraction pattern for viewport, sharing,
and attachment-derivation hooks (see the archived
`extract-reusable-chat-hooks` change), but the next tier of reusable behavior
— attachment validation, conversation export/import, streaming/resume, and
the send/regenerate/edit/rate orchestration — still lives only in
`apps/chat/src/hooks`. That behavior is exactly what any DIAL-Core-backed
chat interface needs to reimplement from scratch today: a validated upload
queue, a resumable SSE completion stream, and the message-mutation state
machine around it. Extracting it now — with the same dependency-inversion
discipline already applied to the smaller hooks — lets other DIAL chat UIs
reuse tested behavior instead of hand-copying it, without changing what
`apps/chat` does today.

## What Changes

- Extract `useAttachmentValidation` into `@epam/ai-dial-chat-hooks` as a
  MIME/size validation state machine that takes resolved allowed-MIME-type
  data and reports rejected files through a structured, translation-free
  `onValidationError(event)` callback instead of a translated notification.
  **Compatibility note**: add the debounce-timer cleanup-on-unmount the
  current app hook is missing, called out explicitly as an extraction-time
  correctness fix.
- Extract `useConversationExport` and `useConversationImport` as one
  conversation-transfer capability sharing job-queue primitives (status,
  cancellation, retry, dismissal), accepting minimal
  `Pick<ConversationsApi, …>` / `Pick<FilesApi, …>` interfaces from
  `@epam/ai-dial-chat-api-client` and callback seams for bucket/path
  resolution, post-import refresh, host-error classification, and
  save/download delivery. Job identity becomes library-owned structured
  codes/params; the app adapter renders translated text and toasts from them.
- Extract `useConversationStream` behind a library-owned
  `ConversationStreamTransport` interface that covers start-completion,
  stop-request, resume-watch, and reload — never a hardcoded `/api` path,
  CSRF handling, or a `server-api` import. Generation lifecycle, optional
  client-channel, and optional overlay-notification capabilities become
  injected, individually-optional parameters instead of direct context
  reads.
- Extract `useConversationHandlers` orchestration (send, regenerate,
  edit/cancel/resubmit, delete/confirm, rate, starter submission) built on
  top of the library's existing `useAttachmentUpload` and the newly
  extracted `useConversationStream`, with `DeploymentsContext`, routing, and
  configured API clients replaced by resolver callbacks and injected client
  interfaces. Splits the current monolithic hook into smaller composed
  primitives behind a compatible public facade rather than publishing one
  559-line hook with a large injected-dependency bag.
- Correct the pre-existing `libs/chat-hooks/README.md` claim that `react` is
  the package's only dependency (it already isn't, per
  `libs/chat-hooks/package.json`'s peer dependencies) in the same change that
  adds the new hooks' documentation.
- If reviewability requires it, split implementation into explicitly ordered
  child changes, but this proposal's `design.md` fixes the final public
  contracts and migration path for all five hooks now so no child change
  redesigns a contract another one already depends on.

## Capabilities

### New Capabilities

- `chat-hooks-attachment-validation`: debounced MIME/size validation state
  machine for attachment pickers, reporting structured rejection events
  instead of translated notifications.
- `chat-hooks-conversation-transfer`: shared export/import job-queue
  capability — queued jobs, cancellation, retry, dismissal — for moving
  conversations to/from DIAL/ZIP and JSON formats.
- `chat-hooks-conversation-stream`: resumable SSE completion-streaming state
  machine driven by a library-owned transport interface, covering start,
  stop, resume-after-refresh, and chunk application.
- `chat-hooks-conversation-handlers`: send/regenerate/edit/delete/rate/starter
  orchestration composed from the upload and streaming primitives, with
  model resolution, navigation outcomes, and API access as injected
  contracts.

### Modified Capabilities

None. `apps/chat` behavior is preserved; no existing spec's requirements
change.

## Impact

- **Affected code**: `apps/chat/src/hooks/attachment/useAttachmentValidation.ts`,
  `apps/chat/src/hooks/useConversationExport.ts`,
  `apps/chat/src/hooks/useConversationImport.ts`,
  `apps/chat/src/hooks/conversation/useConversationStream.ts`,
  `apps/chat/src/hooks/conversation/useConversationHandlers.ts`, their
  existing tests, and the supporting utilities/models/server-api wrappers
  listed in `design.md`'s per-hook audit — each either moves with its owning
  hook or gains an app-edge adapter.
- **Widened library surface**: `libs/chat-hooks/src/` gains the four hooks
  above (and any internal primitives `design.md` introduces to compose
  them), each re-exported from `libs/chat-hooks/src/index.ts` and documented
  in `libs/chat-hooks/README.md`, including the dependency-list correction.
- **New/adjusted peer dependencies**: any new host-agnostic peer dependency
  `design.md` justifies is declared in `libs/chat-hooks/package.json` and
  externalized in `libs/chat-hooks/vite.config.mts`, following
  `libs/share/package.json`'s convention.
- **App adapters**: `apps/chat` gains thin app-edge adapters (transport
  implementation for streaming, translation/notification mapping for
  validation and transfer jobs, model/navigation resolvers for handlers)
  that contain wiring only — no copied queue, validation, streaming,
  message-mutation, retry, cancellation, or orchestration logic.
- **Tests**: existing `apps/chat` spec files for the five hooks move into
  the library (fixtures updated to construct fake transport/client
  instances instead of mocking `apps/chat/src/server-api/*` or app
  contexts); `apps/chat` keeps thin tests only for the adapters themselves.
- **No backend/API endpoint changes.** If investigation surfaces a
  generated-client gap, the transport adapter stays at the app edge instead
  of expanding backend scope.
