## Context

This is the per-chunk path today, for a displayed conversation that is
streaming:

1. `useConversationStream.onChunk` applies the chunk to the per-path buffer and
   calls `setConversation` (`useConversationStream.ts:413-446`).
2. `ConversationPage` re-renders. `ConversationView` re-renders with new
   `messages`. Several message-item callbacks change identity because their
   dependencies include `conversation` or `messages`, so all N
   `ConversationMessageItem`s re-render and re-run their markdown.
3. After commit, `Conversation.tsx:243-254` calls `setMessages(conversation.messages)`.
   `SourcesSidebarContext` changes, and its consumers re-render in a second
   pass:
   - `App` (the whole shell);
   - `SourcesSidebarToggle`;
   - `ConversationView` again, through `handleClose` and
     `useAttachmentCanvasResolvers`;
   - `ConversationSourcesPanel`, which walks all messages in
     `useConversationSources` even while closed.

Facts that constrain the design:

- `restoreBufferedMessage` replaces only `messages[messageIndex]`
  (`buffered-generation.ts:38-47`). Every earlier message object keeps its
  identity across chunks. A stable item-prop set is therefore enough for
  `memo` to skip all but the streaming item.
- `totalCount` does not change during a stream. `isAssistantTyping` flips
  only at the start and end.
- The four `vi.mock`s of `SourcesSidebarContext` return only the members each
  test needs. Of them, only `ConversationSourcesPanel.spec.tsx` returns
  `messages`/`conversationModelId`.
- The real-provider wrappers are `main.tsx`, `Header.spec.tsx` and
  `SkillEditorPreview.spec.tsx`. They keep working if the provider name is
  unchanged.
- `useConversationStream.spec.ts` asserts state synchronously right after
  `act(() => onChunk(chunk))`, and uses fake timers in places. That is why
  batching is opt-in.

## Goals / Non-Goals

**Goals:**

- A chunk re-renders the page, the view and the streaming message item, and
  nothing else in the message list or the app shell.
- Sources are derived only while the sidebar is open.
- Optionally, the display commits at most once per frame while chunks still
  land in the buffer immediately.

**Non-Goals:**

- Virtualizing the message list, or changing the item `key`.
- Changing `ConversationMessageItem` internals.
- Reworking `useConversationSources` or its return shape.

## Decisions

### D1. Split `SourcesSidebarContext` into controls and data, one provider

In `apps/chat/src/context/SourcesSidebarContext.tsx`:

- **Controls context.** Value
  `{ isOpen, handleOpen, handleClose, setMessages, setConversationModelId }`,
  memoized on those fields. Every field except `isOpen` is stable.
- **Data context.** Value `{ messages, conversationModelId }`, memoized on
  those two fields.
- **Provider.** `SourcesSidebarProvider` nests both providers.
- **Hooks.** `useSourcesSidebar()` returns the controls, and
  `useSourcesSidebarData()` returns the data. Each throws outside the
  provider, following `ThemeContext`.

This follows the repo's context rules: the value is wrapped in `useMemo`, and
the guard hook throws. `ConversationSourcesPanel` switches to reading both
hooks. No other consumer changes, because none of them reads `messages`.

Rejected alternative: a selector-based single context
(`useSyncExternalStore`). It adds a store layer for a problem two contexts
solve directly.

### D2. Skip the sources derivation while closed

`ConversationSourcesPanel` calls
`useConversationSources(isOpen ? messages : EMPTY_MESSAGES)`, where
`EMPTY_MESSAGES` is a module-level `[]`.

- The hook's memo keys on the `messages` reference, so while the sidebar is
  closed the derivation is a no-op.
- Opening the sidebar passes the live array and derives once, on that
  render.
- Nothing reads the derived lists while the sidebar is closed. The toggle
  reads only `isOpen`/`handleOpen`, and the panel body is `inert` and
  zero-width.

The spec already allows the closed panel to be collapsed rather than
unmounted.

### D3. Stabilize message-item props

In `ConversationView.tsx`:

- **The two inline props.**
  - `onDialFileSystemClick`: a `useCallback` for opening the file manager,
    passed as `isAttachmentsAllowed ? openDialFileManager : undefined`.
  - `editMenuOverlays`: `useMemo(() => (editSkillMenuOverlay ? [editSkillMenuOverlay] : undefined), [editSkillMenuOverlay])`.
- **Callbacks that depend on per-chunk values.** `handleStartEdit`,
  `handleEditMessageWithAnchor` and `handleRegenerateMessageWithAnchor` read
  `messages` and `isAssistantTyping` from a `latestRef`. The ref is assigned
  in a layout effect, so it is committed before any user event can fire.
  These values are then removed from those callbacks' dependencies.

In `libs/chat-hooks` `useConversationHandlers`:

- `handleRegenerateMessage`, `handleRateMessage`, `handleButtonSelect` and
  `handleEditMessage` read `state.conversationRef.current` at call time.
  `conversation` is dropped from their dependencies (spec delta
  `chat-hooks-conversation-handlers`).
- `Conversation.tsx`'s `handleLike` depends on `handleRateMessage`, so it
  becomes stable without further change.

Why the ref is the right source. `conversationRef.current` is assigned on
every `setConversation` path in the stream and handler hooks, and by the
host's `handleConversationChange`/`addStatusMessage`. It is never behind the
rendered state, and `handleConfirmDelete` already depends on this. A user
action, being an event, always runs after a commit, so the ref is at least
as fresh as the `conversation` a closure would have seen.

Rejected alternative: pass `conversation` into each callback as an argument.
It would change the public callback signatures that hosts wire to UI.

### D4. Opt-in per-frame batching in `useConversationStream`

- **Parameter.** A new optional `batchChunksPerFrame?: boolean` on
  `UseConversationStreamParams`.
- **Scheduler.** An internal
  `createFrameScheduler(): { schedule(key, fn), flush(key), cancel(key), cancelAll() }`.
  - It uses `requestAnimationFrame`, with `setTimeout(…, 16)` as a fallback
    when `requestAnimationFrame` is unavailable.
  - It holds at most one pending task per conversation path.
  - It lives in `libs/chat-hooks/src/conversation/useConversationStream/`.
  - It has no DOM or host dependency beyond the global frame function.
- **`onChunk`.** The buffer is still updated synchronously. The display write
  is extracted into `applyDisplayWrite(conversationPath, genId, messageIndex)`.
  That function holds the current updater body and re-checks
  `isSuperseded`/`isPathDisplayed` inside it.
  - Batched: `scheduler.schedule(conversationPath, applyDisplayWrite)`.
  - Unbatched: `applyDisplayWrite` is called directly.
- **The non-buffer fallback branch.** When `onChunk` has no buffer for
  `genId`, it currently applies `applyChunkToMessages(prev.messages, …)`
  directly. With batching on, this branch writes immediately, unbatched. It
  is an edge case (no buffer entry), and deferring it would need a chunk
  queue.
- **Flush points.**
  - `scheduler.flush(path)` runs at the start of `onComplete`, `onError`,
    `recoverInterruptedStream` and `handleStop`, and before a superseding
    `startStream` for the same path.
  - `scheduler.cancel(path)` runs where the path stops being displayed.
  - `scheduler.cancelAll()` runs in the hook's unmount cleanup.
- **Resume path.** `generation-resume.ts` `applyAttachChunk` takes the
  scheduler through the existing context object, and schedules the same way.
- **Host.** `apps/chat/src/pages/Conversation/Conversation.tsx` passes
  `batchChunksPerFrame: true`.

Rejected alternatives:

- `startTransition` for chunk writes. It lowers the priority but does not
  coalesce writes, and it lets React drop intermediate states in ways that
  are harder to reason about around the completion reload.
- Always-on batching. It changes timing for every host, and breaks
  synchronous test assertions (see the proposal).

### D5. Slice order: batching last

Slices 1–3 (D1–D3) remove the per-chunk work that grows with N. Slice 4 (D4)
reduces the commit rate. It is the riskiest part, because it touches the
generation lifecycle, and it gives the least benefit once slices 1–3 land. It
ships last and independently, and a single host flag can turn it off.

## Risks / Trade-offs

- **[A test mocks `useSourcesSidebar` with `messages` and silently stops
  testing the panel]** Mitigation: `ConversationSourcesPanel.spec.tsx` moves
  `messages`/`conversationModelId` to a `useSourcesSidebarData` mock. The
  other three mocks do not return them. TypeScript will flag any remaining
  `messages` on the controls return type.
- **[A stale ref in the view handlers]** It is assigned in a layout effect,
  which commits before events can be dispatched. The handlers run only from
  user events.
- **[A handler reads a ref that is ahead of the rendered state]** The ref is
  assigned inside `setConversation` updaters, so it can be ahead of the
  rendered state by at most one pending render. That is the same guarantee
  `handleConfirmDelete` already relies on. For user actions, the newer value
  is the correct one.
- **[A batched write lands after the completion reload]** Mitigation: the
  flush runs at the start of `onComplete` (before its `await`). The scheduler
  also clears the key before running a task, so it can never run twice. There
  is a dedicated test.
- **[The frame callback is throttled in background tabs]** Chunks keep
  accumulating in the buffer, and the display catches up on the next frame
  or on the completion flush. No content is lost, only its display is
  delayed.
- **[Fake timers in tests]** Vitest's default `toFake` includes
  `requestAnimationFrame`. The new batching tests advance frames explicitly,
  and the existing tests use the default mode, which is unaffected.

## Migration Plan

- There is no data migration.
- The `libs/chat-hooks` changes are additive (an optional parameter) or
  internal (the handler dependencies). The README documents
  `batchChunksPerFrame`.
- Rollback: revert the commit. To keep D1–D3 and disable only the batching,
  remove `batchChunksPerFrame: true` in `Conversation.tsx`.

## Open Questions

- Should `batchChunksPerFrame` become the default in a later major of
  `@epam/ai-dial-chat-hooks`? This change keeps it opt-in. Revisit once other
  hosts have used it.
