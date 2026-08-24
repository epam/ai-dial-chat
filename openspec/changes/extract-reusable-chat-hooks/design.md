## Context

`libs/ai-dial-chat-hooks` exists to hold headless, `react`-only chat-UI hook
behavior (see `useConversationScroll` and the archived
`openspec/changes/archive/2026-08-17-add-ai-dial-chat-hooks-lib/`). Everything
else reusable still lives under `apps/chat/src/hooks`, organized by concern
(layout/browser mechanics, sharing/notifications, conversation/attachments,
the file-manager subsystem, auth/navigation). Per `AGENTS.md` §"Library
isolation" and `openspec/config.yaml:90`, the library must never import from
`apps/*` or embed host-owned integration details: REST paths, `server-api`
wrappers, generated API clients, app contexts, auth/session/cookies, env
vars, feature flags, routing, analytics/logging transport, persistence
keys/schemas, deployment/provider details, i18n, or UI-kit components.

This design covers the full inventory named in the proposal's investigation
scope: every hook/utility under `apps/chat/src/hooks/{usePageFileDrag.ts,
use-viewport-width.ts, usePanelMaxWidth.ts, files/, useShareLink/,
useShareRecipientsCount/, useOperationNotification.ts, conversation/,
conversation-sources/, attachment/, useConversationExport.ts,
useConversationImport.ts, citations/, auth/, navigation/}`, plus the
existing `apps/chat/src/hooks/breakpoint/useBreakpoint.ts` and
`libs/chat-shared/src/hooks/useIsMobile.ts` for the viewport/breakpoint
duplication check requested in scope.

### Widened dependency boundary (revision)

The first pass of this design treated `@epam/ai-dial-chat-api-client` (the generated
DIAL Core client) and the hand-written domain wrappers around it
(`apps/chat/src/server-api/*.api.ts`) as hard excludes, matching
`AGENTS.md`'s library-isolation list verbatim. That list exists to keep a lib
from silently absorbing *one specific host's* integration details. It is
being read more narrowly here: this library's chartered consumers are
DIAL-Core-backed chat applications, and the generated client's DTOs and
operation signatures are identical for any such consumer — they are not one
app's private integration detail the way a base URL, an auth cookie, or a
`NotificationContext` is. Per an explicit product decision, the boundary is
therefore redrawn as:

- **Now allowed in `libs/ai-dial-chat-hooks`**: `@epam/ai-dial-chat-api-client`
  types and operation signatures; the request/response handling logic that
  today lives in `apps/chat/src/server-api/*.api.ts` (moved into the hook
  itself, since it is a thin, DTO-shaped wrapper with no host-specific
  behavior beyond invoking the client).
- **Still excluded, unchanged**: the *configured* client instance (base
  URL, auth headers, CSRF token handling — `apps/chat/src/server-api/base.ts`
  and `api-client.ts`), React contexts, routing, auth/session/cookies, env
  vars, feature flags, i18n, and UI-kit component rendering.

The seam this creates: every extracted hook that needs to call DIAL Core
accepts an **already-configured generated-client API instance** as a
parameter (e.g. a `ShareApi`, `FilesApi`) rather than importing
`apps/chat/src/server-api/api-client.ts` or a bespoke fetcher callback. The
host application is still fully responsible for how that instance is built
(base path, interceptors, CSRF, auth-error handling) — only the *shape* of
the calls and the hook's own state machine move into the library. This is a
narrower, single-parameter seam than the original per-hook `fetcher`/`fetch`
callback design, and it is why `useShareLink`/`useShareRecipientsCount` in
this revision are recorded as **move as-is**, not **split into headless core
+ app adapter**.

This widening is scoped to `@epam/ai-dial-chat-api-client` plus the small set of
already-published, host-agnostic packages the audit already found in several
hooks' dependency lists (`@epam/ai-dial-chat-shared`, `@epam/ai-dial-share`,
`@epam/ai-dial-quotations`, `@epam/ai-dial-source-panel`,
`@epam/ai-dial-attachment-canvas`) — it does **not** extend to React
contexts, routing, auth/session, i18n, or UI-kit component rendering, which
remain on `AGENTS.md`'s exclusion list unchanged. Because this is a real,
intentional deviation from `AGENTS.md`'s literal generated-client exclusion
(currently scoped only to `libs/chat-api-client/`), `AGENTS.md` §"Library
isolation" should be amended in the same change to name
`libs/ai-dial-chat-hooks` as a second, narrowly-scoped exception — mirroring
how the generated-client exception is already documented for
`libs/chat-api-client/` — so the rule and the code do not silently diverge.

## Goals / Non-Goals

**Goals:**

- Decide, with an explicit and auditable verdict, which of the ~30 inventoried
  files can move to `libs/ai-dial-chat-hooks` as headless behavior, and which
  must stay app-owned — for every file, not a sampled subset.
- Extract every hook whose *only* remaining blocker was the
  generated-client/server-api boundary, now that boundary is widened:
  `usePageFileDrag`, `useViewportWidth`/`usePanelMaxWidth`, `useShareLink`,
  `useShareRecipientsCount`, `useAttachmentUpload`, `useConversationSources`,
  `useAttachmentAction`.
- Preserve `apps/chat`'s observable behavior exactly; this is extraction, not
  a UX or contract change.
- Record the reasoning for every `keep app-owned` verdict, and explicitly
  distinguish two kinds of "not this change": hooks blocked only by
  context/routing/i18n/UI-kit-rendering (verdict unchanged, no near-term
  follow-up implied) versus hooks that were blocked by the
  generated-client/server-api boundary alone or in combination with an
  injectable context value (verdict recorded as a **named, recommended next
  change**, not a closed decision).

**Non-Goals:**

- Fixing the `useBreakpoint` (769px min-width, `apps/chat`) vs. `useIsMobile`
  (768px max-width, `libs/chat-shared`) inconsistency — flagged as a
  pre-existing `chat-shared` reconciliation bug, unrelated to this lib's
  charter, and left as an explicit out-of-scope follow-up.
- Extracting `useConversationStream`/`useConversationHandlers` in *this*
  change — the generated-client/server-api boundary that blocked them is now
  widened, but both hooks also read 3–4 React contexts and (for
  `useConversationHandlers`) routing directly; making those context/routing
  reads into injected parameters is a real redesign of a 447–555 line hook
  with 2+ call sites each, not a mechanical move. Recorded as the strongly
  recommended next change (see §Second-order candidates), not attempted here.
- Extracting the file-manager subsystem or
  `useConversationExport`/`useConversationImport` in *this* change — same
  reasoning: the generated-client boundary no longer blocks them, but
  `NotificationContext`/i18n calls throughout still do, and turning those
  into injected callbacks is its own scoped design effort. Recorded as
  second-order candidates.
- Extracting citations, notifications, auth, or navigation hooks — these were
  never blocked by the generated-client boundary; their verdicts are
  unchanged by this revision (i18n, UI-kit component rendering, routing, and
  auth/session are still hard excludes).
- Any change to backend endpoints, i18n strings, or RTL/directional behavior.

## Audit Matrix

Columns: (1) hook/utility, (2) source path (lines), (3) consumers, (4)
dependencies, (5) reusable behavior, (6) verdict, (7) proposed public API /
type ownership, (8) test migration plan, (9) risks / exclusion reason.

### Viewport/breakpoint duplication (investigated, not in scope to fix)

`apps/chat/src/hooks/breakpoint/useBreakpoint.ts` (`useIsMobile`, min-width
769px) and `libs/chat-shared/src/hooks/useIsMobile.ts` (max-width 768px) are
two different implementations of the same boolean, already flagged by the
archived change's design.md as "a real bug, but an internal `chat-shared`
cleanup, not a `chat-hooks` launch feature." `use-viewport-width.ts` /
`usePanelMaxWidth.ts` solve a different problem (pixel-width panel-sizing
math, not band classification) and are audited separately below — they must
not be merged with, or confused for, the breakpoint hooks.

### 1. Layout and browser mechanics

| # | Item | Path (lines) | Consumers | Dependencies | Reusable behavior | Verdict | Public API | Tests | Risks |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `usePageFileDrag` | `apps/chat/src/hooks/usePageFileDrag.ts` (90) | `ConversationView.tsx`, `NewConversationComposer.tsx` | React/browser only: `document` drag events, `File`, `DragEvent` | Whole-page drag-enter/leave/drop detection with enter-count balancing and an enable/allow gate | **move as-is** | `usePageFileDrag(isAttachmentsAllowed?, isEnabled?): { isDragging, pendingFiles, onFilesConsumed }` — unchanged signature, already generic | `apps/chat/src/hooks/tests/usePageFileDrag.spec.ts` moves verbatim | Low — global listeners assume no app-specific DOM |
| 2 | `useViewportWidth` + `usePanelMaxWidth` | `apps/chat/src/hooks/use-viewport-width.ts` (20), `usePanelMaxWidth.ts` (12) | `usePanelMaxWidth`: `app.tsx`, `ConversationSourcesPanel.tsx`; `useViewportWidth` only feeds `usePanelMaxWidth` | React/browser only: `window.innerWidth`, `resize` | Track viewport width; compute a side-panel max width given a reserved minimum content width | **generalize** | `useViewportWidth(): number`; `usePanelMaxWidth(minContentAreaWidth: number): number` — the app's `MIN_CONTENT_AREA_WIDTH = 400` becomes a caller-supplied argument instead of a lib constant | No existing test for either; author new ones in the lib (resize simulation + max-width math) | Low — trivial pure math, but must not be conflated with the breakpoint band hooks above |
| 3 | `useGridEditingScroll` | `apps/chat/src/hooks/files/useGridEditingScroll.ts` (143) | `DialFileManagerShell.tsx` | React/browser (`requestAnimationFrame`, `scrollIntoView`) + host packages `@epam/ai-dial-react-file-manager` (`FileManagerGridRow`) and `ag-grid-community` (`GridApi`, `CellEditingStartedEvent`, `IRowNode`) | "Keep the newly-edited grid row visible" double-rAF + `ensureNodeVisible` pattern | **keep app-owned** | N/A | `apps/chat/src/hooks/files/tests/useGridEditingScroll.spec.ts` stays in place | Even generalized over row type, the hook is AG-Grid-shaped, not a chat-list scrolling/anchoring primitive matching this lib's charter ("scrolling, streaming, anchoring" for chat message lists per the README). Including it would blur the library's scope; if ever generalized, it belongs next to `ai-dial-react-file-manager`, not here. |

### 2. Sharing and notifications

| # | Item | Path (lines) | Consumers | Dependencies | Reusable behavior | Verdict | Public API | Tests | Risks |
|---|---|---|---|---|---|---|---|---|---|
| 4 | `useShareLink` | `apps/chat/src/hooks/useShareLink/useShareLink.ts` (81) | `ShareConversationPopoverContainer.tsx`, `SharePopoverContainer.tsx` | React + generated client (`CreateShareLinkDtoResourceKindEnum`, and — post-widening — the `ShareApi`-shaped call itself, moved in from `server-api/share.api.ts`'s `shareApi.createShareLink`); `ShareLinkAccess`/`ShareLinkData` (`@epam/ai-dial-share`, already host-agnostic) | Request-lifecycle state machine: loading/error, stale-response guard via a request-id ref, re-fetch on access-list change; the DIAL `createShareLink` call shape itself | **move as-is** *(revised — see §Widened dependency boundary)* | Hook accepts an already-configured `ShareApi` instance (or equivalent generated-client interface) as a parameter, alongside the resource id/kind and initial access; returns `{ data: ShareLinkData \| null, isLoading, error, setAccess: (access: ShareLinkAccess[]) => void }`. `CreateShareLinkDtoResourceKindEnum`, `ShareLinkAccess`, `ShareLinkData` are imported directly (no longer generic-erased). `apps/chat` only supplies the configured `ShareApi` instance | `apps/chat/src/hooks/useShareLink/tests/useShareLink.spec.ts` moves to the lib with a fake `ShareApi` implementing the same interface (mock at the generated-client boundary instead of mocking `apps/chat/src/server-api/share.api.ts`) | The fake used in tests must implement the exact generated-client interface shape, not a simplified stand-in, so a real interface drift is caught |
| 5 | `useShareRecipientsCount` | `apps/chat/src/hooks/useShareRecipientsCount/useShareRecipientsCount.ts` (86) | `ConversationPanelView.tsx` | React + generated client (post-widening: the `getShareRecipientsCount` call moved in from `server-api/share.api.ts`); app enum `RecipientsCountStatus` | Per-key on-demand async lookup cache: idle/loading/resolved/unknown states, one-shot dedup via a requested-ids set, per-key invalidation; the DIAL recipients-count call shape itself | **move as-is** *(revised — see §Widened dependency boundary)* | Hook accepts an already-configured generated-client instance as a parameter and exposes `{ request, get, invalidate }` over a library-owned `RecipientsCountStatus`-equivalent enum (`Idle`/`Loading`/`Resolved`/`Unknown`), re-exported so `apps/chat` can keep its existing name via a type alias at the call site | `apps/chat/src/hooks/useShareRecipientsCount/tests/useShareRecipientsCount.spec.ts` moves to the lib with a fake generated-client instance | The "unknown on error" semantic must be preserved exactly in the library's own status enum |
| 6 | `useOperationNotification` | `apps/chat/src/hooks/useOperationNotification.ts` (77) | `CatalogView.tsx`, `ConversationPanelView.tsx`, `PublishConversationPanelContainer.tsx`, `useDialFileMutations.ts`, `useSkillArchiveImport.ts`, 3 editor components | React + i18n (`react-i18next`) + app context `NotificationContext` + app maps `ENTITY_OPERATION_NOTIFICATIONS`/`EntityOperation`/`NotifiableEntity` | Map an (entity, operation) pair to a titled toast, no-op on unmapped pairs | **keep app-owned** | N/A | `apps/chat/src/hooks/tests/useOperationNotification.spec.ts` stays | i18n and `NotificationContext` are both on the hard-exclude list; the entity/operation map is the entire value of the hook and is 100% app-owned — no residual core large enough to publish |

### 3. Conversation and attachments

| # | Item | Path (lines) | Consumers | Dependencies | Reusable behavior | Verdict | Public API | Tests | Risks |
|---|---|---|---|---|---|---|---|---|---|
| 7 | `useAttachmentUpload` | `apps/chat/src/hooks/conversation/useAttachmentUpload.ts` (65) | `NewConversationComposer.tsx`, `useConversationHandlers.ts` | React + generated client (post-widening: the `uploadFile` call moved in from `server-api/files.api.ts`); `Attachment`/`AttachmentErrorReason` (`@epam/ai-dial-chat-shared`, already shared); app util `buildUploadPath` (DIAL bucket/path convention — protocol-level, not app-specific) | Debounced batching of a burst of offline upload failures into one callback; the DIAL upload call and bucket-path convention themselves | **move as-is** *(revised — see §Widened dependency boundary)* | Hook accepts an already-configured files-API instance as a parameter; `buildUploadPath` moves in as a library-owned pure function of the DIAL bucket/path convention; `Attachment`/`AttachmentErrorReason` imported directly from `@epam/ai-dial-chat-shared` | `apps/chat/src/hooks/conversation/tests/useAttachmentUpload.spec.ts` moves to the lib with a fake files-API instance | `navigator.onLine` stays fine (browser-standard); confirm `buildUploadPath` truly has no app-specific segment (e.g. no app-chosen folder prefix) before moving it verbatim |
| 8 | `useConversationHandlers` | `apps/chat/src/hooks/conversation/useConversationHandlers.ts` (555) | `AppPreviewChat.tsx`, `Conversation.tsx` | Generated client + `@epam/ai-dial-chat-shared` (now allowed); app context `DeploymentsContext`; server-api (`chat-stream.api.ts`, `conversations.api.ts`, `rate.api.ts`) — call shape now allowed, needs to move in; routing (`react-router`, `ROUTES`) — still excluded | Optimistic message-pair creation, rating dispatch, send/regenerate/edit orchestration; the underlying save/rate/delete calls | **second-order candidate (not this change)** — see §Second-order candidates | A future design would accept the configured `ConversationsApi`/`RateApi` instances as parameters (same seam as row 4/5) plus an injected `deployments: DeploymentItem[]` value and an injected `navigate`-like callback in place of reading `DeploymentsContext`/`react-router` directly | `useConversationHandlers.spec.ts`, `handleRateMessage.spec.ts` would need a substantial rewrite around the injected-parameter shape | Routing + app context are still hard excludes; even with the generated-client boundary widened, this is a genuine redesign (12+ call sites) — recorded as the strongly recommended next change, not attempted here |
| 9 | `useConversationStream` | `apps/chat/src/hooks/conversation/useConversationStream.ts` (447) | `AppPreviewChat.tsx`, `Conversation.tsx`, `ClientChannelContext.tsx` | App contexts (`ClientChannelContext`, `GenerationContext`, `OverlayContext`) — still excluded; server-api SSE/watch/resume protocol — call shape now allowed; DIAL-specific path utils (now allowed) | Streaming/resume orchestration; the underlying stream/watch/stop calls | **second-order candidate (not this change)** — see §Second-order candidates | A future design would accept configured stream-capable client instances as parameters and take the 3 contexts' values as injected callbacks/parameters instead of reading the contexts directly | `useConversationStream.spec.ts` would need a substantial rewrite | Highest ultimate value per the archived change's own assessment, but the context/protocol redesign is real work; recorded as the top-priority next change after this one |
| 10 | `useConversationSources` | `apps/chat/src/hooks/conversation-sources/useConversationSources.ts` (78) | `ConversationSourcesPanel.tsx` | `DisplayAttachment`/`Message`/`MessageRole` (`@epam/ai-dial-chat-shared`, already host-agnostic — never actually app-owned); packages `@epam/ai-dial-quotations`, `@epam/ai-dial-source-panel` (already host-agnostic) | Pure `useMemo` derivation: dedup attachments + build quotation sources from a message array | **move as-is** *(revised — see §Widened dependency boundary)* | Hook keeps its current signature, now importing `Message`/`DisplayAttachment`/`MessageRole` directly from `@epam/ai-dial-chat-shared` instead of forcing an unconstrained generic — this hook has no server-api dependency at all, so the only change from the original audit is accepting that a shared-package DTO shape is not the same thing as an app-owned type | `apps/chat/src/hooks/conversation-sources/useConversationSources.spec.ts` moves to the lib unchanged (fixtures already use `@epam/ai-dial-chat-shared` shapes) | None material — this hook was always side-effect-free; the earlier exclusion was a conservative reading of "avoid app-specific models," not a real boundary violation |
| 11 | `useAttachmentAction` | `apps/chat/src/hooks/attachment/useAttachmentAction.ts` (97) | `ConversationSourcesPanel.tsx`, `ConversationMessageItem.tsx` | `@epam/ai-dial-attachment-canvas` (host-agnostic); `DisplayAttachment`/`AttachmentResource` (`@epam/ai-dial-chat-shared`); `parsePdfPageReference` (`@epam/ai-dial-quotations`, host-agnostic); DIAL-file-id *detection* (`isDialFileId` — a pure `files/` prefix check, genuinely protocol-level) vs. DIAL-file-id *download-URL resolution* (`resolveDialFileDownloadUrl` — **found during implementation to hardcode `/api/v1/files/download`, this app's own BFF route, not a DIAL Core endpoint; corrected to an injected callback, not inlined**) | Attachment-click dispatch (download / canvas-preview / open-in-browser); the `files/` prefix check itself | **split into headless core + app adapter** *(corrected during implementation — see the risk note in §Risks / Trade-offs)* | `isDialFileId` moves in as a library-owned pure function; the hook and its exported `downloadAttachment` helper accept a required `resolveDownloadUrl: (fileId: string) => string | undefined` parameter instead of importing `resolveDialFileDownloadUrl` — `apps/chat` passes its existing `resolveDialFileDownloadUrl` at both call sites, keeping the REST path app-owned | `apps/chat/src/hooks/attachment/tests/useAttachmentAction.spec.ts` moves to the lib with a fake `resolveDownloadUrl` in place of the real app util | The original "move as-is" verdict incorrectly treated the whole DIAL file-id URL *resolution* as protocol-level; only *detection* (`isDialFileId`) actually is — see the implementation-time correction in §Risks / Trade-offs |
| 12 | `useAttachmentValidation` | `apps/chat/src/hooks/attachment/useAttachmentValidation.ts` (78) | No external call site found in the current tree | `@epam/ai-dial-attachment-input`, i18n, app `NotificationContext`, app `DeploymentItem` | MIME-type gating against a deployment's allowed input types | **keep app-owned** (unaffected by the widened boundary) | N/A | No spec file exists | i18n + `NotificationContext` are still hard excludes; separately, no consumer was found — worth a standalone dead-code check outside this change |
| 13 | `useOpenAttachmentCanvas` | `apps/chat/src/hooks/attachment/useOpenAttachmentCanvas.ts` (287) | `app.tsx`, `ConversationSourcesPanel.tsx`, `ConversationView.tsx`, `NewConversationComposer.tsx`, `useSkillFilePreviewSync.ts` | 3 app contexts (`ConversationPanelContext`, `SourcesSidebarContext`, `ThemeContext`), app DIAL URL resolution | Content-type dispatch to a preview renderer | **keep app-owned** (unaffected by the widened boundary) | N/A | `useOpenAttachmentCanvas.spec.ts` stays | 3 app contexts are still hard excludes regardless of the generated-client change; UI-orchestration hook, not a portable primitive |
| 14 | `useConversationExport` | `apps/chat/src/hooks/useConversationExport.ts` (465) | `ConversationPanelView.tsx` | Generated client + server-api call shape (now allowed); i18n, `NotificationContext` (still excluded); DIAL bucket/path + zip-envelope format (now allowed — protocol/format-level) | Job-queue/concurrency-controlled batch export; the underlying list/get/download calls and archive format | **second-order candidate (not this change)** — see §Second-order candidates | A future design would accept configured client instances as parameters and take an injected `notify`/`translate` callback pair in place of `NotificationContext`/`useTranslation` | `useConversationExport.spec.ts` would need a partial rewrite | i18n + `NotificationContext` are the only remaining blockers; smaller lift than rows 8–9 since there's no routing or multi-context entanglement — good second candidate after the streaming hooks |
| 15 | `useConversationImport` | `apps/chat/src/hooks/useConversationImport.ts` (508) | `ConversationPanelView.tsx` | Generated client + server-api call shape (now allowed); i18n, 3 app contexts (`UserContext`, `ConversationsContext`, `NotificationContext` — still excluded); DIAL import-envelope format (now allowed) | Batch import with conflict-retry policy; the underlying save/list/upload calls and envelope format | **second-order candidate (not this change)** — see §Second-order candidates | Same shape as row 14, plus `UserContext`/`ConversationsContext` values would need injecting alongside the notify/translate callbacks | `useConversationImport.spec.ts` would need a partial rewrite | Three contexts instead of one make this a larger lift than row 14 — sequence it after `useConversationExport` |
| 16 | `useCitationMarkdownComponents` | `apps/chat/src/hooks/citations/useCitationMarkdownComponents.tsx` (146) | `ConversationMessageItem.tsx` | Renders UI-kit-adjacent `CitationDropdown` directly, calls `t()` inline, `react-markdown` `Components` type | Sentinel-injection technique for stable `react-markdown` component identity | **keep app-owned** | N/A | No dedicated spec found; only indirect coverage | Directly renders a UI component and calls i18n inline — both hard excludes; extracting would need a from-scratch API (inject a marker-render function), not a move |

### 4. File manager subsystem

| # | Item | Path (lines) | Verdict | Risks / reason |
|---|---|---|---|---|
| 17 | `useDialFileManager.ts` (251) | Composition root for #18–24 | **keep app-owned** | Coupled to `@epam/ai-dial-react-file-manager`'s tab model and `AppConfigContext` — already rejected by the archived design.md as a flagship candidate for the same reason |
| 18 | `useDialFileManagerState.ts` (53) | Modal open/close + pending-attachment state | **keep app-owned** | Payload type (`AttachResult`→`Attachment[]`) is DIAL-specific; residual generic part (boolean modal state) too small for a public API |
| 19 | `useDialFileManagerTabConfig.ts` (54) | Tab priority/reset logic | **keep app-owned** | Bound to `AppConfigContext` and UI-kit's `TabModel`; already rejected by the archived design.md's candidate table |
| 20 | `useDialFileListing.ts` (705) | Cache/fetch/search across DIAL's 3-tab listing model | **keep app-owned** | Generated client + server-api + UI-kit are hard excludes; deepest DIAL-Core-specific file audited |
| 21 | `useDialFileMetadata.ts` (81) | Single-file metadata fetch | **keep app-owned** | Server-api + UI-kit + `DialFile` type are hard excludes |
| 22 | `useDialFileMutations.ts` (861) | Copy/move/delete/rename/archive/create-folder orchestration | **keep app-owned** | Same hard excludes as #20, plus a dependency on the already-excluded `useOperationNotification` |
| 23 | `useDialFileSharing.ts` (115) | Unshare/remove-access mutations | **keep app-owned** | Same hard excludes as #20–22 |
| 24 | `useDialFileUploadBatch.ts` (388) | Batched upload concurrency + status tracking | **keep app-owned** | Same hard excludes as #20–23 |
| 25 | `dial-file-manager.model.ts` (58) | Shared constants | **keep app-owned** | Support file only; not independently reusable |
| 26 | `dial-file-manager.types.ts` (203) | Shared interfaces | **keep app-owned** | Support file only; all consumers already excluded |
| 27 | `dial-file-manager-copy-move.util.ts` (148) | Copy/move/rename DTO building | **keep app-owned** | Generated-client DTO construction is inherently app-owned |
| 28 | `dial-file-manager-mapping.util.ts` (333) | DTO→`DialFile` mapping | **keep app-owned** | Entirely generated-client/server-api-shaped, no host-agnostic residue |
| 29 | `dial-file-manager-path.util.ts` (173) | Virtual-path parsing/permission checks | **keep app-owned** | `DialFile`/`DialFileNodeType`/`DialFilePermission` types run through nearly every function; not worth carving out the few pure-string helpers |

The entire file-manager subsystem is excluded from *this* change as one
group. Post-widening, the generated-client dependency in rows 20–24
(`useDialFileListing`, `useDialFileMetadata`, `useDialFileMutations`,
`useDialFileSharing`, `useDialFileUploadBatch`) is no longer, by itself, a
blocker — but every one of those hooks also calls `useOperationNotification`
and/or reads i18n keys and `@epam/ai-dial-ui-kit`'s `NotificationVariant`
directly for user-facing toasts, and rows 17/19 are additionally coupled to
`AppConfigContext` and UI-kit's `TabModel`. Turning the notification/i18n
calls into an injected `notify`/`translate` callback pair (the same pattern
proposed for `useConversationExport`/`useConversationImport`) would unblock
rows 20–24 specifically; rows 17–19 would still need the context/UI-kit
coupling addressed separately. This is recorded as a **second-order
candidate**, sequenced after the conversation-streaming and import/export
follow-ups given its size (5 hooks, ~2,400 combined lines) — not attempted in
this change.

### 5. Auth and navigation

| # | Item | Path (lines) | Verdict | Risks / reason |
|---|---|---|---|---|
| 30 | `useAuthRedirect.ts` (135) | Login-loop-avoidance redirect policy | **keep app-owned** | Routing + auth/session (`UserContext`, `sessionStorage`) + server-api are three separate hard-exclude items at once |
| 31 | `useNavigationItems.ts` (28) | Route→nav-item mapping | **keep app-owned** | Routing + i18n + app route config are hard excludes; too small/entangled for an independent API |
| 32 | `useNavigationUserProfile.ts` (39) | Adapter reshaping `useUserProfile` for the nav-panel lib | **keep app-owned** | Already exactly the "app adapter" half of a split — no headless core remains once the adapter shape is subtracted |

## Decisions

**D1 — Ship as one change with five ordered, independently-verifiable
slices, not multiple OpenSpec changes.** Post-widening, the audit yields 7
extraction candidates (`usePageFileDrag`; `useViewportWidth`/
`usePanelMaxWidth`; `useShareLink`; `useShareRecipientsCount`;
`useAttachmentUpload`; `useConversationSources`; `useAttachmentAction`).
Splitting this across several OpenSpec changes would add process overhead
without a matching risk boundary — the repo convention (`AGENTS.md` "default
behavior") is per-slice verification within one change, which already gives
each slice its own build/lint/test gate. The larger, redesign-shaped
candidates (`useConversationHandlers`, `useConversationStream`, the
file-manager subsystem, `useConversationExport`/`useConversationImport`) are
deliberately left out of this change — see §Second-order candidates — because
each needs its own context/routing/notification-injection design, not a
mechanical move, and bundling them here would make this change's diff
unreviewable.

**D2 — Slice order is risk-first: zero-dependency hooks, then
generated-client hooks, then pure-derivation hooks.** Slice 1
(`usePageFileDrag`) has zero non-React dependencies and an existing test to
move verbatim — lowest possible risk. Slice 2
(`useViewportWidth`/`usePanelMaxWidth`) is equally low-risk but requires
writing new tests (none exist today) and a small breaking change to an
internal constant (now a parameter). Slice 3 (`useShareLink`,
`useShareRecipientsCount`) and slice 4 (`useAttachmentUpload`) introduce the
new configured-client-instance parameter seam — grouped together since they
share the same pattern — and are ordered after slices 1–2 so that pattern is
reviewed once, deliberately, rather than repeated ad hoc. Slice 5
(`useConversationSources`, `useAttachmentAction`) is ordered last: both are
"move as-is" with no new seam to design, but `useAttachmentAction`'s DIAL
file-id URL-convention reclassification (see risk below) benefits from being
reviewed after the client-instance pattern is already established and
understood.

**D3 — Hooks whose value *is* a specific DIAL DTO shape use that shape
directly; only genuinely generic utilities keep `useConversationScroll`'s
unconstrained-generic trick.** The original design forced `useShareLink`/
`useShareRecipientsCount` into unconstrained generics (`T`, `A`) to keep
`ShareLinkAccess`/`ShareLinkData`/`RecipientsCountStatus` out of the library.
Given the scope decision that both DIAL-Core-backed consumers share the same
generated-client DTOs, that indirection now adds a layer of abstraction with
no corresponding benefit — the type *is* the reusable contract, not an
implementation detail to hide. `useConversationScroll`'s trick remains the
right pattern for hooks that are genuinely data-shape-agnostic (it only ever
reads `messages.length`); it is not retrofitted onto hooks whose entire
purpose is interpreting a specific DIAL DTO.

**D4 — `useGridEditingScroll` is excluded, not generalized, despite having a
reusable behavioral core.** Its AG-Grid/`ai-dial-react-file-manager` coupling
could be parameterized away, but the resulting hook would still be
"AG-Grid-editing-scroll," not a chat-list scrolling/anchoring primitive. This
library's stated charter (per its own README) is chat-UI mechanics; stretching
it to cover an unrelated grid-editing concern would make the package's scope
unpredictable for future consumers. If ever pursued, it belongs in a
grid/file-manager-scoped package, not here — noted as an explicit exclusion
reason rather than a silent skip.

**D5 — The `useBreakpoint`/`useIsMobile` inconsistency is flagged, not
fixed, in this change.** It's a real bug (769px vs. 768px), but it lives
entirely within `apps/chat` ⟷ `libs/chat-shared`, has no relationship to
`ai-dial-chat-hooks`'s async/lookup/layout work, and the archived change
already deferred it for the same reason. Bundling an unrelated bug fix into
this extraction would mix two unrelated review concerns.

**D6 — The generated-client/server-api boundary is widened for
`libs/ai-dial-chat-hooks` specifically, by explicit product decision, and
`AGENTS.md` is amended in the same change to record the exception.** See
§Widened dependency boundary in Context for the full rationale and the exact
line drawn (generated-client types/operation-shapes and their thin domain
wrappers move in; configured-client construction, contexts, routing,
auth/session, i18n, and UI-kit rendering stay out). This decision is scoped
to this one library, not a general relaxation of `AGENTS.md`'s library
isolation rule for `libs/*`.

## Second-order candidates

These hooks are **not** part of this change's slices, but the audit's
verdict for them changed materially once D6 widened the boundary — they are
recorded here by name, in recommended order, so a future change starts from
this reasoning instead of re-auditing from scratch:

1. **`useConversationStream`** (row 9) — highest ultimate value per the
   archived change's own assessment. Needs: configured stream-capable client
   instances passed as parameters (same seam as this change's slices 3–4)
   plus `ClientChannelContext`/`GenerationContext`/`OverlayContext`'s values
   taken as injected parameters/callbacks instead of read via `useContext`.
2. **`useConversationHandlers`** (row 8) — depends on row 9's shape for the
   streaming half of its orchestration; needs `DeploymentsContext`'s value
   and a navigation callback injected in place of `react-router`.
3. **`useConversationExport`** (row 14) — smaller lift than rows 8–9 (no
   routing, one context). Needs an injected `notify`/`translate` callback
   pair in place of `NotificationContext`/`useTranslation`.
4. **`useConversationImport`** (row 15) — same shape as #3 plus two more
   contexts (`UserContext`, `ConversationsContext`) to inject.
5. **File-manager subsystem, rows 20–24 only** (`useDialFileListing`,
   `useDialFileMetadata`, `useDialFileMutations`, `useDialFileSharing`,
   `useDialFileUploadBatch`) — needs the same `notify`/`translate` injection
   as #3/#4, applied across 5 hooks (~2,400 lines). Rows 17–19
   (`useDialFileManager`, `useDialFileManagerState`,
   `useDialFileManagerTabConfig`) stay app-owned regardless — they are
   additionally coupled to `AppConfigContext` and UI-kit's `TabModel`, which
   D6 does not touch.

## Risks / Trade-offs

- **[Risk]** Making `MIN_CONTENT_AREA_WIDTH` a required parameter of
  `usePanelMaxWidth` is a signature change, not a pure move. → **Mitigation**:
  `apps/chat` passes its existing `400` constant at the single call site
  update; behavior is bit-for-bit identical, verified by the new unit tests
  added in slice 2.
- **[Risk]** Accepting a configured generated-client instance as a hook
  parameter (slices 3–4) could still leak host-specific error-handling
  behavior into the library if a hook starts special-casing a particular
  client's error shape. → **Mitigation**: hooks only call the documented
  generated-client method and handle the standard `Error`/rejection shape;
  any app-specific error interpretation (e.g. `UnauthorizedError`,
  `getApiErrorDetails`) stays in `apps/chat`'s own error-handling layer,
  called after the hook surfaces `error`, not inside the hook.
- **[Risk — found and corrected during implementation]** The original plan for
  row 11 (`useAttachmentAction`) treated the whole DIAL file-id URL
  convention as protocol-level and proposed inlining
  `resolveDialFileDownloadUrl` into the library. Reading the actual
  implementation during slice 5 showed it hardcodes `/api/v1/files/download`
  — `apps/chat`'s own BFF route, not a DIAL Core endpoint — which is exactly
  the kind of REST path `AGENTS.md` excludes. → **Correction applied**: only
  `isDialFileId` (a pure `files/`-prefix check) moved into the library;
  `resolveDialFileDownloadUrl` stays app-owned, and `useAttachmentAction`
  (plus its exported `downloadAttachment` helper) now takes it as a required
  `resolveDownloadUrl` parameter. This is recorded as a general caution for
  any future "protocol-level" classification in this library: verify the
  concrete implementation, not just the DTO/id shape, before declaring
  something host-agnostic.
- **[Risk]** `AGENTS.md` and the actual dependency graph could silently
  drift apart if the `libs/ai-dial-chat-hooks` exception (D6) is not written
  into the rule itself. → **Mitigation**: task list includes updating
  `AGENTS.md` §"Library isolation" in the same change, naming
  `libs/ai-dial-chat-hooks` as a second, narrowly-scoped generated-client
  exception alongside `libs/chat-api-client/`.
- **[Risk — found during implementation]** The lib's `vite.config.mts`
  externalizes runtime dependencies via a hardcoded `rollupOptions.external`
  array, not automatically from `package.json` peer dependencies. Adding
  `@epam/ai-dial-chat-api-client`/`@epam/ai-dial-share` to `peerDependencies`
  without also adding them to `external` silently inlines each new
  package's entire dependency tree into `dist/index.js` — observed
  concretely in slice 3: the bundle grew from ~7&nbsp;kB to ~2&nbsp;MB
  (pulling in `react-qr-code`, UI-kit editors, etc. transitively through
  `@epam/ai-dial-share`) before `external` was updated. → **Mitigation**:
  every package added to `peerDependencies` from slice 3 onward must be
  added to `external` in the same commit; verify with the build's printed
  bundle size after each slice, not just a green build.
- **[Risk]** A reviewer expects every audited hook to move, given the scope
  of the original investigation request. → **Mitigation**: this design
  records an explicit verdict and reason for all ~30 files (§Audit Matrix),
  distinguishing hooks moved now, hooks recorded as named second-order
  candidates (§Second-order candidates), and hooks whose exclusion is
  unaffected by D6.

## Migration Plan

1. Slice 1: add `usePageFileDrag` to the library, re-export it, update
   `apps/chat` imports, delete the app copy, run
   `npm exec nx build ai-dial-chat-hooks && npm exec nx test ai-dial-chat-hooks`
   and `npm exec nx affected --target=test,lint,build --base=origin/development`.
2. Slice 2: add `useViewportWidth`/`usePanelMaxWidth` to the library with new
   tests, update the two call sites to pass `400` explicitly, delete the app
   copies, same verification commands.
3. Slice 3: add `useShareLink` and `useShareRecipientsCount` to the library,
   accepting a configured generated-client instance as a parameter; port
   their tests with a fake client instance; update `apps/chat` call sites to
   construct/pass the configured instance; delete the app originals; same
   verification commands.
4. Slice 4: add `useAttachmentUpload` the same way (configured files-API
   instance as a parameter); same verification commands.
5. Slice 5: add `useConversationSources` and `useAttachmentAction` as
   direct moves (no new client-instance parameter needed); same verification
   commands.
6. Update `libs/ai-dial-chat-hooks/README.md` with one new subsection per
   hook (pattern: `useConversationScroll`'s existing subsection), in the same
   commit as each slice.
7. Update `AGENTS.md` §"Library isolation" to record the `libs/ai-dial-chat-hooks`
   generated-client exception (D6), in the same commit as slice 3 (the first
   slice that exercises it).
8. Rollback: each slice is an independent commit; reverting a slice restores
   the deleted `apps/chat/src/hooks/*` file and its import, with no
   cross-slice dependency between slices 1, 2, 3–4, and 5.

## Open Questions

- None blocking for this change's five slices. The five second-order
  candidates (§Second-order candidates) and the `useBreakpoint`/`useIsMobile`
  inconsistency (D5) are recorded as named, sequenced follow-ups rather than
  open questions here.
