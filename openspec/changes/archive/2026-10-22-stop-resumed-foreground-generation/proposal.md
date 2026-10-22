# Proposal

## Why

After a page refresh in the middle of a generation, the user can see the answer continue to stream but cannot stop it — unless the deployment happens to run as a DIAL Core background job. For every other deployment (Anthropic, Gemini, applications, orchestrators, OpenAI models without the `openaiResponses` interface) the Stop control is hidden for the whole resume, so a long answer cannot be cancelled and the input stays blocked until it finishes. Stop is available for some deployments and not for others, and nothing in the feature description says so. The backend already knows the generation id and can already stop the generation; the resumed page is simply never told the id.

## Problem

- `POST /api/v1/conversations/completions/stop` addresses a generation by `generationId` (`apps/chat-api/src/conversations/conversation-generation.service.ts:517`, `abort(ownerKey, path, generationId)`). The id is minted by the browser when it sends the message and is held only in `activeGenerationIdsRef` (`libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts:1120`). A refresh loses it.
- For a background generation the id survives in the stored message (`backgroundGeneration.generationId`), which is why `handleStop` has a fallback for it (`useConversationStream.ts:1125`) and `canStopStreaming` is `true` for it (`:1202`).
- For a non-background generation the id exists only in the BFF registry entry (`GenerationEntry.generationId`, `conversation-generation.service.ts:124`). `attach()` (`:478`) returns the assembled message and the emitter but not the id, and the `snapshot` event carries only the message (`apps/chat-api/src/conversations/conversation.controller.ts:639`). The resume therefore has nothing to send, and `generation-resume-on-refresh` deliberately hides Stop in this case ("Stop is not exposed while resuming without a local generation id", from the original refresh-resume fix, #7558).
- This was an explicit scope limit of the July fix, not a technical blocker. `attach` itself was added later.

## What Changes

- **Backend:** `ConversationGenerationService.attach()` also returns the registry entry's `generationId`; the registry-based attach path emits it on the `snapshot` event as an optional `generationId` field. The background attach path (`writeBackgroundAttach`) is unchanged — its id still comes from the stored `backgroundGeneration` marker. `POST /completions/stop` is unchanged.
- **Frontend (`libs/chat-hooks`):** the resume reads `generationId` from the `snapshot` event, records it per path inside `useConversationStream`, and marks the path stoppable. `handleStop` gains a third id source after the local id and the background marker. Replayed chunks that arrive after the user pressed Stop are ignored for this id exactly as they already are for a background id. The id is dropped when the resume settles.
- The id is consumed only for a resume started through the public `resumeIfAwaitingGeneration` entry point. The two internal resumes that share the same code — stream recovery (Stop stays available, local id) and the opted-in `409` conflict handover (`canStopStreaming` stays `false`) — keep the behavior their specs already define. Setting and clearing the attach-supplied id never touches the stoppable state of a path that has an active local generation.
- The attach terminal event `stopped` already ends the resume through the existing reload (`generation-resume.ts`, `sawTerminal` → `finalCheck`), so no new terminal handling is needed.
- No new route, no change to stored messages, no change to DIAL Core.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `generation-live-replay`: the `snapshot` event of a registry-served attach carries the generation's `generationId` (the attach requirement's event shape is updated and a new requirement defines the field).
- `generation-resume-on-refresh`: Stop is exposed while resuming a non-background generation when attach supplied a `generationId`; it stays hidden only when no id is known (attach unavailable, watch fallback).
- `chat-hooks-conversation-stream`: the hook consumes the attach-supplied id for `canStopStreaming` and `handleStop`, and ignores replayed chunks after Stop for that id. The existing "Stop is available for a resumed background generation" requirement is modified so its "non-background resume keeps today's Stop behavior" clause no longer contradicts the new behavior.

## Alternatives considered

| Option | Verdict |
|---|---|
| **A. Optional `generationId` on the attach `snapshot` event (chosen)** | Smallest change; the id is already in the registry entry and the principal check on attach is the same one Stop applies; Stop keeps its existing fence against stopping a newer generation. Additive and backward compatible. |
| B. Stop by path without an id | Rejected. Loses the fence: a late Stop from a stale page could cancel a newer generation on the same path (`abort` checks `entry.generationId !== generationId`). Needs an endpoint contract change. |
| C. Persist the id in every assistant message, like `backgroundGeneration` | Rejected. `background-responses-generation` says messages from non-background paths SHALL NOT carry `backgroundGeneration`; it adds a storage write per generation; and it still would not help on another BFF instance because the registry is in memory. |
| D. Leave as is and document the limitation | Conservative baseline. Leaves Stop deployment-dependent with no way for a user to cancel a long resumed answer. |

## Non-goals

- No Stop in the watch fallback (attach unavailable or ended without an event): no id is known there and the BFF may no longer run the generation.
- No cross-instance Stop for non-background generations. The registry is per instance; Stop works exactly where attach works, as before. A Stop that hits another instance returns 404 and is handled by the existing "benign 404" logic.
- No Stop for the opted-in `409` conflict handover (a reload that joins a generation started elsewhere). Its spec says `canStopStreaming` is `false` throughout; exposing Stop there is a separate product decision and a follow-up.
- No change to background generations, their eligibility (`openaiResponses` in Core `interfaces`), or DIAL Core.
- No change to the persisted message shape or the `StopCompletionDto`.

## Acceptance criteria

- With `RESPONSES_BACKGROUND_ENABLED=false` (or any non-background deployment), refreshing mid-generation shows the Stop control; activating it sends `POST /completions/stop` with the registry generation id, the generation ends as stopped, the partial answer is persisted with `wasStoppedByUser`, and the resumed UI settles.
- Chunks replayed after Stop are not applied to the displayed message.
- Background generations behave as before (Stop uses `backgroundGeneration.generationId`).
- Stream recovery keeps Stop available throughout with the local id, and the `409` conflict handover keeps `canStopStreaming` `false`, even when the attach `snapshot` carries an id.
- Forgetting the attach-supplied id never clears the Stop of a path that has an active local generation.
- When attach is unavailable (watch fallback) the input stays blocked and Stop stays hidden, as before.
- An older frontend ignores the new field; a newer frontend against a backend without it keeps today's behavior.
- `chat-api` and `chat-hooks` tests, lint and build pass; `npm run openapi` output is committed; `npm run validate:docs` passes.

## Rollback / backward compatibility

Not breaking. The new event field is optional and additive; the SSE event contract is otherwise unchanged. Revert = remove the field on the backend (frontend falls back to hiding Stop) or revert the frontend (backend field is ignored).

## Scope notes

- **Shared libs:** touches `libs/chat-hooks` only on the hook side. The lib already owns the attach event shape (`GenerationAttachEvent`, `generation-resume.ts:151`); it reads a data field from a transport stream and knows nothing about Core, flags or tokens. No host adapter or prop is added. `ConversationView` already receives `canStopAssistant`; no change.
- **State ownership:** stays inside `useConversationStream` (a per-path id ref plus the existing `stoppablePaths` state). No new context.
- **i18n / RTL / a11y:** no new strings; the existing Stop control, label and keyboard behavior are reused.
- **Closest precedents:** `findResumedBackgroundGenerationId` and its use in `handleStop` and `canStopStreaming` (`useConversationStream.ts:266`, `:1125`, `:1202`) for the id fallback; `applyAttachChunk`/`isStoppedByUser` in `generation-resume.ts` for ignoring chunks after Stop.

## Impact

- `apps/chat-api`: `conversations/conversation-generation.service.ts`, `conversations/conversation.controller.ts` (attach), the attach description in the OpenAPI document; tests next to them.
- `libs/chat-hooks`: `useConversationStream/generation-resume.ts`, `useConversationStream/useConversationStream.ts`, tests, `README.md`.
- `libs/chat-api-client/openapi.json`: description text only (the SSE stream is not typed).
- Specs: the three capabilities above.
