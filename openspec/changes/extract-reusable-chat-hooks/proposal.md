## Why

`libs/ai-dial-chat-hooks` was created to be the canonical home for chat-UI hook
behavior that is reusable outside `apps/chat` (see `useConversationScroll` and
the archived `add-ai-dial-chat-hooks-lib` change). Today it holds exactly one
hook. Everything else that behaves the same way — pure browser/React
mechanics, or an async state machine that only needs a small injected
operation to be host-agnostic — still lives under `apps/chat/src/hooks` and
gets copied by hand whenever another team builds a chat interface on top of
DIAL. Extracting the genuinely reusable pieces now, following the
`useConversationScroll` pattern (generic type params, dependency-inverted
callbacks, headless, `react`-only), stops that copying without touching
`apps/chat`'s observable behavior.

## What Changes

- Move `usePageFileDrag` to `libs/ai-dial-chat-hooks` unchanged (params/return
  are already generic); `apps/chat` imports it from
  `@epam/ai-dial-chat-hooks`.
- Extract `useViewportWidth` and `usePanelMaxWidth` to the library, turning the
  hardcoded `MIN_CONTENT_AREA_WIDTH` into a required parameter supplied by
  `apps/chat`. Author the first unit tests for these two hooks (none exist
  today).
- **Scope decision**: both DIAL-Core-backed chat applications this library is
  meant to serve call the same generated `@epam/ai-dial-chat-api-client` against the
  same DIAL Core API, so the library boundary is widened to allow depending
  on that generated client and on the small hand-written domain-wrapper
  functions around it (equivalent to today's `apps/chat/src/server-api/*.api.ts`
  call shape). Each hook still receives the *configured* generated-client API
  instance as a parameter — base URL, auth headers, and CSRF handling stay
  app-owned; only the request/response shape and the hook's own state machine
  move into the library. Contexts, routing, auth/session, i18n, and UI-kit
  component rendering remain excluded, unchanged from the original scope.
- Move `useShareLink` to the library as a hook that calls an injected,
  already-configured share-link API instance directly (no bespoke app
  fetcher indirection); `CreateShareLinkDtoResourceKindEnum` is imported from
  `@epam/ai-dial-chat-api-client` and `ShareLinkAccess`/`ShareLinkData` from the
  already-host-agnostic `@epam/ai-dial-share` package.
- Move `useShareRecipientsCount` to the library the same way, with its status
  enum now library-owned (renamed/re-exported; `apps/chat` maps to its
  existing call sites).
- Move `useAttachmentUpload` to the library, inlining the upload call against
  an injected files-API instance; `Attachment`/`AttachmentErrorReason` come
  from the already-shared `@epam/ai-dial-chat-shared`.
- Move `useConversationSources` to the library as-is, depending directly on
  `@epam/ai-dial-chat-shared`'s `Message`/`DisplayAttachment`/`MessageRole`
  and the already-host-agnostic `@epam/ai-dial-quotations`/
  `@epam/ai-dial-source-panel` packages, since these shapes are identical
  across any DIAL-Core-backed consumer.
- Move `useAttachmentAction` to the library, including `isDialFileId` (a pure
  `files/`-prefix check) as a library-owned function. Its companion
  `resolveDialFileDownloadUrl` hardcodes `apps/chat`'s own `/api/v1/files/download`
  BFF route — an app-owned REST path, not DIAL Core protocol — so it stays
  app-owned; the hook accepts it as an injected `resolveDownloadUrl`
  parameter instead.
- Document, in `design.md`, the audit outcome for every other inventoried
  hook. Several groups that were previously `keep app-owned` purely because
  of the generated-client/server-api boundary are now recorded as **strongly
  recommended next changes** rather than closed decisions:
  `useConversationHandlers`/`useConversationStream` (need context/routing
  values passed as injected parameters — a larger redesign, not a mechanical
  move), the file-manager subsystem, and
  `useConversationExport`/`useConversationImport` (both still gated on
  notification/i18n callback injection). Hooks whose exclusion was never
  about DTOs/server-api — `useOperationNotification`, `useAuthRedirect`,
  `useNavigationItems`, `useNavigationUserProfile`,
  `useCitationMarkdownComponents`, `useGridEditingScroll` — keep their
  original `keep app-owned` verdict unchanged.
- Flag the pre-existing `useBreakpoint` (769px min-width, `apps/chat`) vs.
  `useIsMobile` (768px max-width, `libs/chat-shared`) inconsistency as an
  out-of-scope follow-up; this change does not touch either implementation.

## Capabilities

### New Capabilities

- `chat-hooks-viewport-layout`: headless hooks for whole-page file-drag
  detection and viewport-width-driven panel-width computation, published from
  `@epam/ai-dial-chat-hooks`.
- `chat-hooks-sharing`: hooks for the share-link request lifecycle and the
  share-recipients-count lazy lookup, both calling an injected, pre-configured
  generated-client API instance.
- `chat-hooks-attachments`: hooks for debounced-batched attachment upload and
  default attachment-click dispatch (download / preview), including the DIAL
  file-id URL convention as a library-owned pure utility.
- `chat-hooks-conversation-sources`: a pure derivation hook that builds
  quotation sources and deduplicated attachments from a conversation's
  message list.

### Modified Capabilities

None. `apps/chat` behavior is preserved; no existing spec's requirements
change.

## Impact

- **Affected code**: `apps/chat/src/hooks/usePageFileDrag.ts`,
  `apps/chat/src/hooks/use-viewport-width.ts`,
  `apps/chat/src/hooks/usePanelMaxWidth.ts`,
  `apps/chat/src/hooks/useShareLink/useShareLink.ts`,
  `apps/chat/src/hooks/useShareRecipientsCount/useShareRecipientsCount.ts`,
  `apps/chat/src/hooks/conversation/useAttachmentUpload.ts`,
  `apps/chat/src/hooks/conversation-sources/useConversationSources.ts`,
  `apps/chat/src/hooks/attachment/useAttachmentAction.ts`, and their call
  sites (`ConversationView`, `NewConversationComposer`, `app.tsx`,
  `ConversationSourcesPanel`, `ShareConversationPopoverContainer`,
  `SharePopoverContainer`, `ConversationPanelView`,
  `ConversationMessageItem`, `useConversationHandlers`).
- **Widened library dependency boundary**: `libs/ai-dial-chat-hooks` gains a
  dependency on the generated `@epam/ai-dial-chat-api-client` package (types and
  operation signatures only — never a configured client instance or base
  URL/auth setup, which stay app-owned) and on the already-published
  host-agnostic packages `@epam/ai-dial-chat-shared`, `@epam/ai-dial-share`,
  `@epam/ai-dial-quotations`, `@epam/ai-dial-source-panel`, and
  `@epam/ai-dial-attachment-canvas`. `react` remains the only *runtime*
  dependency with app-specific configuration; the client-configuration
  concern is passed in per call, not imported.
- **New library surface**: `libs/ai-dial-chat-hooks/src/` gains
  `usePageFileDrag`, `useViewportWidth`, `usePanelMaxWidth`, `useShareLink`,
  `useShareRecipientsCount`, `useAttachmentUpload`, `useConversationSources`,
  and `useAttachmentAction`, each re-exported from
  `libs/ai-dial-chat-hooks/src/index.ts` and documented in
  `libs/ai-dial-chat-hooks/README.md`.
- **Tests**: existing `apps/chat` spec files for the extracted hooks move
  into the library (fixtures updated to construct a fake generated-client API
  instance instead of mocking `apps/chat/src/server-api/*`); `apps/chat`
  keeps a thin test only where it still constructs/configures the client
  instance passed in.
- **No backend/API endpoint changes.** `apps/chat`'s i18n strings and RTL
  behavior are unaffected — none of the seven extracted hooks render UI text
  or directional layout.
