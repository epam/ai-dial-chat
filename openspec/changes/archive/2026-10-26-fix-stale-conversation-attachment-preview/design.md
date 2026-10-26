# Design

## Context

`useOpenAttachmentCanvas` already takes an optional `shouldCommit` guard, consulted before every canvas write that follows an awaited resolver (spec `attachment-canvas-workflow`). Only `useDialFilePreview` passes it, with a per-instance generation counter. `ConversationView` and `ConversationSourcesPanel` pass nothing, so every in-flight request commits. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- One shared "latest request wins" guard used by all app callers of the canvas.
- No lib changes.

**Non-Goals:**
- Cancelling fetches or parsing (`AbortSignal`); possible follow-up.
- Debouncing clicks.

## Decisions

- **Shared hook `useLatestCanvasRequest` in `apps/chat/src/hooks/attachment/`.** Returns `() => ShouldCommitCanvas`: each call takes a new generation and returns a guard that is true only while that generation is the latest and the calling component is mounted. The generation counter is module-level because the app has exactly one canvas, so "latest" must hold across hook instances (sources panel vs. conversation vs. file manager); mounted state stays per instance. Alternative: per-instance counters (current `useDialFilePreview` behavior), rejected because a click in one component would not supersede a pending one from another.
- **Sources-panel fallback is gated on the guard.** `openAttachmentCanvas` resolves `false` both for "cannot preview" and "superseded". The handlers check the guard after the await and return early when superseded, so only a genuine failure downloads or opens a tab.
- **The guard is taken at click time, before any resolver runs.** Taking a generation bumps the counter even for previews that commit synchronously (an image), so a pending slower request becomes stale the moment a newer click happens.
- **`useDialFilePreview` adopts the hook** in place of its private `generationRef`/`isMountedRef`; behavior for its own spec stays the same.

## Risks / Trade-offs

- [Module-level counter is shared mutable state] → it only ever increases and holds no data; tests need no reset because they compare generations, not absolute values.
- [I/O of superseded clicks still runs] → known and documented in `attachment-canvas-workflow`; blob and text caches share an in-flight fetch for the same URL only when the file's ETag could be read; otherwise each click fetches separately.
- [Possible shared-conversation amplifier, unverified] if the metadata (ETag) request fails for files in a shared conversation, the cache is bypassed on every click, making the load heavier. Does not change the fix; check during manual verification.
