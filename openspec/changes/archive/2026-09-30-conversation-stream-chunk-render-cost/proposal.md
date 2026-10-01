## Why

Issue #9176 reports platform degradation during regenerate in a long, imported
conversation. The work done for each SSE chunk grows with the conversation
length and with the size of the app. It should stay close to "re-render the
one message that is streaming". Today every chunk causes three kinds of
re-render:

- The whole `App` re-renders, along with every consumer of the sources-sidebar
  context.
- The sources derivation is recomputed over all messages, even while the
  sidebar is closed.
- Every `ConversationMessageItem` re-renders. That includes the markdown of
  every earlier message, because several props change identity on each chunk.

## Problem

1. **`SourcesSidebarContext` carries per-chunk data next to stable callbacks.**
   - Its value is `{ isOpen, handleOpen, handleClose, messages, setMessages, conversationModelId, setConversationModelId }`
     (`apps/chat/src/context/SourcesSidebarContext.tsx:12-71`).
   - `ConversationPage` publishes `conversation.messages` into it after every
     chunk commit (`apps/chat/src/pages/Conversation/Conversation.tsx:243-254`).
     This triggers a second render pass.
   - Only `ConversationSourcesPanel` reads `messages`. The other consumers only
     need stable callbacks or `isOpen`, yet all of them re-render on every
     chunk:
     - `App` (`app.tsx:156`);
     - `ConversationView` (`:426`);
     - `useAttachmentCanvasResolvers` (`:92`) and every component that uses it.
2. **Sources are derived even when nobody can see them.**
   - `ConversationSourcesPanel` is mounted on conversation routes whether the
     sidebar is open or not (`app.tsx:474`).
   - It always calls `useConversationSources(messages)`, which is an O(n) walk
     of all messages.
   - It re-renders its sections inside a collapsed, `inert` `SidebarPanel`.
3. **`memo(ConversationMessageItem)` is defeated on every chunk.** In the list
   in `ConversationView.tsx:969-1087`, these props are new on every render:
   - `onDialFileSystemClick`, an inline arrow;
   - `editMenuOverlays`, an inline array.

   These callbacks change on every chunk because their dependencies include
   the conversation or its messages:
   - `onStartEdit`, `onEditMessage` and `onRegenerateMessage` in the view;
   - `onRateMessage`, through `handleRateMessage`;
   - `onSelectStarter`, through `handleButtonSelect`.

   The last two come from `useConversationHandlers`, which closes over
   `conversation`
   (`libs/chat-hooks/src/conversation/useConversationHandlers/useConversationHandlers.ts:284-293, 414-421, 496, 634-642`).
   So all N items re-render on every chunk. Only the streaming (last) item's
   `msg` actually changes.
4. **Chunks are applied one network read at a time.**
   `useConversationStream.onChunk` calls `setConversation` for every read
   (`libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts:413-446`).
   A fast stream can therefore commit more often than the display refreshes.

## Solution

- **Split the sidebar context.** `SourcesSidebarContext` keeps the stable
  controls and `isOpen`. A new `SourcesSidebarDataContext`, in the same
  module, carries `messages` and `conversationModelId`. It is read through
  `useSourcesSidebarData()`.
  - `SourcesSidebarProvider` renders both contexts, so the provider wrappers
    do not change: `main.tsx` and the specs that use the real provider keep
    working as they are.
  - `ConversationSourcesPanel` is the only reader of the data hook.
- **Derive sources only while open.** `ConversationSourcesPanel` passes a
  stable empty list to `useConversationSources` while the sidebar is closed.
- **Stabilize message-item props.**
  - `ConversationView` memoizes `onDialFileSystemClick` and `editMenuOverlays`.
  - It reads the latest messages and typing state through a ref inside
    `handleStartEdit`, `handleEditMessageWithAnchor` and
    `handleRegenerateMessageWithAnchor`.
  - `useConversationHandlers` reads `state.conversationRef.current` instead of
    closing over `conversation` in `handleRegenerateMessage`,
    `handleRateMessage`, `handleButtonSelect` and `handleEditMessage`. This
    follows its own precedent in `handleConfirmDelete`.
- **Batch chunk commits per frame, opt-in.**
  - `useConversationStream` gains an optional `batchChunksPerFrame` parameter,
    default `false`.
  - When it is enabled, chunks still accumulate synchronously into the
    per-path buffer. Only the display write is coalesced to one
    `setConversation` per animation frame.
  - The pending frame is flushed before completion, error, stop, supersede,
    path change and unmount.
  - `apps/chat` enables it.

Models to follow:

- the `handleConfirmDelete` ref read
  (`useConversationHandlers.ts:304-340`, spec
  `chat-hooks-conversation-handlers` "handleConfirmDelete reads the
  conversation ref");
- the existing rAF usage in libs (`libs/chat-shared/src/hooks/useStreamedMarkdownContent.ts:74-131`);
- `ThemeContext`'s memoized value for the new data context.

## Non-goals

- Per-navigation sidebar-list cost. It belongs to the separate change
  `conversation-panel-navigation-cost`.
- Virtualizing the message list, or changing `key={index}`.
- The item-internal `labels` object inside `ConversationMessageItem`. It
  matters only for rows that already re-render.
- Fixing the unrelated spec drift found during the investigation, recorded
  here for a follow-up:
  - `conversation-sources-sidebar` describes a `createSidebarContext` factory
    that does not exist;
  - `chat-hooks-conversation-sources` documents a stale return shape.

  The one drift this change must touch is corrected in its delta: the
  close-button scenario claims that close clears messages, while the code and
  tests preserve them.
- The stale-response race in `loadConversation`.

## Alternatives considered

- **Keep one context and memoize consumers.** Rejected. Every
  `useContext(SourcesSidebarContext)` consumer re-renders on each value
  change whatever its own `memo` is. The split is the only way to stop `App`
  from re-rendering.
- **Move `messages` out of context entirely, with the panel reading
  conversation state directly.** Rejected for now. The panel lives outside the
  conversation route, beside `<main>`, so it has no direct access to page
  state. The existing context is the established channel.
- **A custom `memo` comparator on `ConversationMessageItem` that ignores
  callbacks.** Rejected. It is fragile and silently drops legitimate callback
  updates. Stabilizing the callbacks at their source is the supported fix.
- **Always-on chunk batching.** Rejected as the default. It changes timing for
  every host of `@epam/ai-dial-chat-hooks`, and existing tests assert state
  synchronously after each chunk. Opt-in keeps the published default
  unchanged.
- **Conservative baseline: only split the context.** Rejected as
  insufficient. `App` would stop re-rendering, but all N message items would
  still re-render per chunk. That is the dominant cost in a long
  conversation.

## Acceptance criteria

- **Consumers stop re-rendering on chunks.** A `setMessages` update does not
  re-render a component that uses only `useSourcesSidebar()`. A test with a
  render counter proves this.
- **Closed sidebar does no work.** While the sidebar is closed, a messages
  update does not invoke the sources derivation. Opening the sidebar shows
  the current sources immediately.
- **One message re-renders per chunk.** With a conversation of N messages
  streaming into the last one, a chunk re-renders only the last
  `ConversationMessageItem`. A test with a render counter proves this.
- **Handlers keep their identity and use the latest data.**
  - `useConversationHandlers` callbacks keep their identity across a
    `conversation` change while `isStreaming` and the injected dependencies
    are unchanged.
  - Regenerate, rate, starter and edit still operate on the latest
    conversation.
- **Batching is opt-in and loses nothing.**
  - With `batchChunksPerFrame: true`, several chunks within one frame
    produce one displayed update, and no chunk content is lost.
  - Completion, error, stop and supersede show exactly what the
    non-batched mode shows.
  - With the default, behavior and existing tests are unchanged.
- **Verification.** `npm run verify:full` and `npm run validate:docs` pass.

## What Changes

- `apps/chat`:
  - `SourcesSidebarContext.tsx` is split into two contexts under the same
    provider, with a new `useSourcesSidebarData` hook.
  - `ConversationSourcesPanel` reads the data hook, and derives sources only
    while open.
  - `ConversationView` stabilizes the message-item props.
  - `Conversation.tsx` passes `batchChunksPerFrame: true`.
  - One spec mock is updated: `ConversationSourcesPanel.spec.tsx`.
- `libs/chat-hooks`:
  - `useConversationHandlers` callbacks read `state.conversationRef`.
  - `useConversationStream` gains the optional `batchChunksPerFrame`
    parameter, which is additive and non-breaking.
  - The README is updated for both.
- No breaking changes.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `conversation-sources-sidebar`: the panel obtains messages from the data
  hook and skips the derivation while closed. The close scenario is corrected
  to match the code: close preserves messages.
- `chat-hooks-conversation-handlers`: the handlers keep their identity across
  conversation changes by reading the conversation ref.
- `chat-hooks-conversation-stream`: an optional per-frame chunk batching
  mode, with a flush before every terminal transition.

## Impact

- **Global provider touched.** `SourcesSidebarProvider` keeps its name and
  mount point, and adds a second internal context.
- **Lib touched.** `libs/chat-hooks`:
  - the handler internals change;
  - one optional stream parameter is added.
  - No host knowledge enters the lib: the frame scheduling uses the standard
    browser `requestAnimationFrame` API, with a timer fallback where it is
    absent.
- **No new user-visible strings,** i18n keys, endpoints, feature flags, or
  RTL/a11y changes. The message log's `aria-live` behavior is unaffected: DOM
  text still updates, possibly once per frame instead of once per network
  read.
- **Rollback.** Revert the commit. Alternatively, drop
  `batchChunksPerFrame: true` in `Conversation.tsx` to disable only the
  batching.
