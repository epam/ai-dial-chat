# Proposal

## Why

Issue #9370: after a long generation (Deep research) ends in a rate-limit or save error and the page is reloaded, the chat shows "Thinking" with no Send, Regenerate or Stop, and nothing ever explains what happened. QA reproduced it on dev several times, with the same screenshot each time.

**Problem.** When the backend's terminal save is lost, the stored conversation keeps the start-state placeholder (an empty assistant message). On load the client reads that placeholder as a generation still running (`isAwaitingGenerationResume`), so:

1. For up to `GENERATION_RESUME_WATCH_TIMEOUT_MS` (5 minutes) the path is held in the streaming state: typing indicator, Regenerate, edit and send are blocked, and Stop is hidden because this tab holds no generation id. This is what QA's screenshots show.
2. When the watch gives up, the path is released and the controls come back, but the assistant bubble stays empty with no explanation. `finish` in `generation-resume.ts` only annotates the message when the page holds generated content to keep; after a reload it holds none.

Dev logs (2026-11-03..05) show how placeholders get orphaned: terminal saves rejected with `401 "Bad Authorization header"` after 6.5-7 minute runs (the token captured at start expired; documented in `apps/chat-api/README.md`), and one batch of generations cut off together (a probable pod restart). PRs #9360 and #9524 recover the `401` case for the tab that started the generation, and that recovery works. It cannot help a reloaded tab, a closed tab, or any other cause, so the orphaned placeholder still reaches users.

## What Changes

**Solution.** When a resume finds that nothing is producing the answer here, the hook stops blocking the chat and shows the placeholder as interrupted. "Nothing is producing the answer here" is decided on evidence the client already has: attach found no generation (`404` or failure) and the conversation re-read still ends in the unresolved placeholder.

- The hook releases the path from the streaming state, so Regenerate, edit, starters and sending work immediately.
- The empty message shows a local, display-only `streamErrorMessage`; the existing error card renders with its "Try again" action.
- The existing watch keeps running in the background up to its 5-minute bound. If the real answer arrives, it replaces the interrupted message. If the user sends first, the new generation supersedes the watch.
- New hook option `generationInterruptedMessage` (English default next to `DEFAULT_GENERATION_PERSISTENCE_ERROR_MESSAGE`); the app fills it with `t()`.
- The 5-minute bound stays; it now limits only the background wait. Nothing is written to storage.

## Non-goals

- No client or backend save of the placeholder: the backend owns persistence and the client save stays limited to the `401` recovery (`backend-owned-generation-persistence`).
- No change when attach is serving a live generation, and none for pending background messages; they keep resuming through attach.
- No graceful-shutdown work and no terminal-write retry in `apps/chat-api`: the observed failures are `401`, which a retry with the same token cannot fix.
- No cross-instance fencing: a non-background generation stays process-local by the repository's existing contract (`backend-owned-generation-persistence`), so a retry while a generation runs on another instance can overlap it. Recorded as an accepted limitation in the design.
- No fix for the root `401` (token lifetime versus generation length) and no way to recover the lost answer text.

## Acceptance criteria

- A conversation loaded with an unresolved empty placeholder, where attach finds nothing, shows the interrupted message with a working "Try again" and an accepting input without waiting.
- A generation that completes while the background watch runs replaces the interrupted message with the saved answer.
- Sending while the watch runs starts a new generation, and a later watch result never overwrites it.
- Attach-served resumes, pending background messages, and placeholders that carry content behave exactly as before.
- Reloading shows the stored placeholder again and runs the same resume (the display is not persisted).

## Alternatives considered

| Option                                                                  | Verdict                                                                                                                                                         |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release and mark at fallback, keep watching in the background (chosen)  | Fixes QA's scenario, no storage write, reuses the error card                                                                                                    |
| Mark only after the existing 5-minute wait                              | Rejected: leaves QA's "Thinking, no buttons" screenshot unchanged for 5 minutes                                                                                 |
| Gate on the placeholder's `updatedAt` plus the backend max duration     | Rejected: the client does not know `MAX_GENERATION_DURATION_MS` (default 30 minutes); an orphan would wait that long                                            |
| Client save of a failed answer for every status                         | Rejected: the backend is specified to make no second write and a non-`401` write may already have landed                                                        |
| Graceful shutdown or backend terminal-write retry                       | Rejected: not the observed cause (`401`) and a different, larger change                                                                                         |

## Rollback

Not breaking: the new option is optional with a default, and no stored data changes. Revert the commit to restore the 5-minute block.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `generation-resume-on-refresh`: a placeholder nothing is producing is shown as interrupted without blocking the chat; the awaiting-resume streaming state and the watch timeout requirement are adjusted to match.
- `chat-hooks-conversation-stream`: the hook accepts `generationInterruptedMessage` for that state.

## Impact

- `libs/chat-hooks`: `generation-resume.ts` (`runWatch`, `finish`), `useConversationStream.ts` (option), `README.md`. The lib receives a resolved string; it learns nothing about the host, `/api` routes or i18n.
- `apps/chat`: `pages/Conversation/Conversation.tsx` and `pages/ApplicationEditor/setup/AppPreviewChat.tsx` pass the string; `constants/translation-keys.ts` and `i18n/locales/en.json` gain one key (`chat.generationInterrupted`). Only `en.json` exists, so there are no other locale files to fill.
- Closest existing pattern: the `placeholderReload` branch in `finish` and the `generationPersistenceErrorMessage` option.
- Specs: the two capabilities above. No endpoint, OpenAPI or `chat-api` change.
