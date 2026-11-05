# Design

## Context

See `proposal.md` for the problem. Current flow on load of a conversation that ends in an unresolved empty placeholder (`apps/chat/src/pages/Conversation/Conversation.tsx` calls `resumeIfAwaitingGeneration`):

```
load -> isAwaitingGenerationResume(result)
     -> path added to streamingPaths (typing indicator, Regenerate/edit/send blocked, no Stop)
     -> attach to the backend's live replay
          404 / ended without terminal event
     -> runWatch: open watch, one immediate re-check, then wait (<= 5 min)
          timeout / stream end
     -> finalCheck: one getConversation, then finish(result)
     -> path released (controls return)  <-- placeholder stays empty, unexplained
```

`finish` in `libs/chat-hooks/src/conversation/useConversationStream/generation-resume.ts` already annotates the message when the page holds generated content that the stored copy lost (`placeholderReload`, which sets `streamErrorMessage` to the persistence warning). After a reload the page holds no content, so that branch is skipped and `setConversation(result)` shows the bare placeholder.

Constraints that shape the fix:

- The backend owns persistence; the client saves only for the `401` recovery (`backend-owned-generation-persistence`).
- Attach answers `404` from a per-process registry (`generation-live-replay`), so it cannot prove nothing runs on another instance.
- Generations can legitimately run for minutes: Deep research took 6.5-9 minutes in dev, and the backend caps a run at `MAX_GENERATION_DURATION_MS` (default 30 minutes), a value the client does not know.
- A background (Core job) message is resumed through attach and is never an orphan: the job runs in DIAL Core.

## Goals / Non-Goals

**Goals:**

- A reloaded chat whose answer was lost is usable at once: it says why the message is empty and accepts Regenerate, edit and a new message.
- Reuse the existing stream-error card and retry action; no new UI component.

**Non-Goals:**

- Persisting anything, or changing `chat-api`.
- Recovering the lost text, or removing the root cause of the lost save.

## Decisions

### D1. Decide "nothing is producing the answer here" at the fallback, not at the timeout

The decision point is `runWatch` in `generation-resume.ts`, right after its immediate re-check (the code that today finishes the resume when the copy is no longer awaiting). If the re-check still returns the unresolved placeholder, the resume calls a new `showInterrupted()` and keeps waiting. The two other routes to the same state use the same helper: `watchConversation` failing to open (then `finalCheck` returns a still-unresolved placeholder), and an attach that ends without a terminal event followed by an unresolved reload.

`showInterrupted()`:

- applies only for non-background resumes (`!isBackground`) whose result ends at this resume's `messageIndex` with `isAwaitingGenerationResume(result)` true and no pending background message;
- sets a local `streamErrorMessage` (the host's interrupted text) on that message and publishes it through the same `setConversation` update the persistence branch uses, guarded by `ownsBuffer()` and `isPathDisplayed`;
- removes the path from `streamingPaths` and clears `resumingPathsRef`, so `isStreaming` and `canStopStreaming` become false.

`finish` stays the single settle point for a real result: a qualifying watch update still calls `finish(result)` with the saved answer, which replaces the interrupted message because the resume still owns the buffer. A user-started generation replaces the path's buffer, so `ownsBuffer()` is false and the late watch result changes nothing (the existing supersede guard).

Why here: this is where the client first has the two facts it can trust (attach found nothing; the stored copy is still the placeholder). The alternative of waiting for the timeout leaves QA's reported state untouched for 5 minutes.

Alternatives: set it from `Conversation.tsx` after the resume (rejected: the hook owns the state and the app would re-derive it); decide on `updatedAt` age (rejected: needs the backend's max duration on the client).

### D2. The 5-minute bound stays, with a smaller role

`GENERATION_RESUME_WATCH_TIMEOUT_MS` keeps bounding the fallback watch. Because the chat is already released, hitting it changes nothing visible. It still matters as a cap on an open SSE connection and on how long a late answer can replace the interrupted message. Not removed and not changed.

### D3. One resolved string from the host

`generationInterruptedMessage` mirrors `generationPersistenceErrorMessage`: the lib exports an English default, the app passes `t(ChatI18nKeys.GenerationInterrupted)` at both mount sites. The lib reads no language and no i18n, per the lib isolation and "No i18n inside libs" rules. Wording is deliberately soft ("may have been interrupted") because a generation on another instance can still be running.

### D4. Multiple instances: follow the repository's existing contract, add no cross-instance fencing

The deployment can run several chat-api instances, and the repository already decides what that means for a non-background generation. `backend-owned-generation-persistence` "Fencing guarantees are process-local, and storage-side fencing is not claimed" guarantees admission of one owner per `ownerKey + path` only inside one process, and `stop-generation-endpoint` stops a non-background generation only on the instance that runs it. Only the background path is made instance-independent (conditional writes with `If-Match`, Core replay on any instance, `background-responses-generation`).

This change inherits that contract and does not strengthen it. When attach finds nothing, the client cannot tell "no generation anywhere" from "a generation on another instance", so it treats the placeholder as interrupted and, if the user retries while that other generation still runs, two generations can overlap. No new mechanism is added for that: the `409` guard is process-local by design, the exposure already exists after the 5-minute bound, and the interrupted text is soft so the user is not told the answer is lost. A shared cross-instance registry is a separate, larger change and out of scope.

Alternatives: age gate on `updatedAt` (rejected: needs a threshold the client cannot know and either keeps QA waiting or misfires on 6.5-9 minute runs); keeping the chat blocked for 5 minutes (rejected: leaves the reported symptom).

### D5. No new backend or storage behaviour

The fix touches no endpoint, DTO, OpenAPI or `chat-api` code, so no generated-client or env change.

## Risks / Trade-offs

- A generation still running on another instance is labelled interrupted at once, and a user who retries can start a second one that overlaps it. The `409 "Generation is already active"` guard is a per-process registry (D4) → accepted as the repository's existing contract for non-background generations; soft wording; the background watch swaps in the real answer if it lands first. The exposure exists today after the 5-minute bound; this change widens it from 5 minutes to immediately, and the design doc records that.
- The label is not persisted, so every reload repeats the attach and re-check, then shows the label again → acceptable; it is instant now.
- A late save after the 5-minute bound is not picked up until the conversation is reloaded → the next load shows the saved answer.
- A user-started generation races the background watch → `ownsBuffer()` makes the watch inert once the path's buffer is replaced; a test covers it.
- New copy and one key in `en.json`, the only locale file → no other locale to fill.
