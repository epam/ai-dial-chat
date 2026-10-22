# Design

## Context

See `proposal.md` for the motivation. Current state that shapes the approach:

- **Stop is addressed by id.** `POST /api/v1/conversations/completions/stop` takes `{ generationId, path, content? }`. For a non-background generation the handler stops it from the registry alone, matching principal + path + `generationId` (`ConversationGenerationService.abort`, which refuses a mismatching id so a stale Stop cannot cancel a newer generation on the same path). For a background generation it locates the pending message by the same id and stops it through DIAL Core.
- **The id is client-minted.** The browser creates a UUID per send (`startStream`), keeps it in `activeGenerationIdsRef`, and sends it as `generationId` on `/completions`. The background marker stores that same client UUID (`backgroundGeneration.generationId`); DIAL Core's own id is the separate `responseId`. So "generation id" already means one thing on both paths.
- **Attach hands the id to no one.** The registry entry holds `generationId`, but `ConversationGenerationService.attach()` returns only `{ assembledMessage, emitter }`, and the controller's registry-served attach writes `{ type: 'snapshot', message }`. A refreshed page therefore has the message but not the id.
- **The hook is already shaped for a third id source.** `handleStop` resolves `localGenId ?? findResumedBackgroundGenerationId(conversationRef.current)`, `canStopStreaming` is `stoppablePaths.has(path) || (isStreaming && <background id>)`, and the resume treats attach terminal events (`stopped` included) as the trigger for the existing reload (`sawTerminal` → `finalCheck`).
- **Library boundary.** `libs/chat-hooks` already owns the attach event shape (`GenerationAttachEvent` in `generation-resume.ts`) and receives the stream through the injected `transport.attachToGeneration`. Reading one more field from that stream adds no host knowledge; nothing about routes, auth or flags enters the lib.

## Goals / Non-Goals

**Goals:**

- A refreshed page that attached to a non-background generation can stop it, with the same Stop control, label and keyboard behavior as for a live generation.
- Reuse the existing Stop endpoint, its id fence, and the hook's Stop plumbing; add the smallest possible contract surface (one optional field).
- Keep every other resume outcome (watch fallback, background, local generation) unchanged.

**Non-Goals:**

- Anything the proposal lists as a non-goal (watch-fallback Stop, cross-instance Stop, changes to background eligibility or the message shape).
- Re-designing how the resume settles, or making attach work across BFF instances.

## Decisions

### D1. Send the id on the `snapshot` event, not as a new event type or a header

The registry-served `snapshot` becomes `{ type: 'snapshot', message, generationId }`.

- **Why on `snapshot`:** it is the first event and is emitted synchronously in the same step that reads the registry entry (`attach()` documents that no `await` may sit between reading and subscribing). Putting the id there means the client has it before any chunk and never holds a message without an id.
- **Alternatives:** a separate `{ type: 'generation', generationId }` event adds an ordering rule and a state where the message exists without an id; a response header would have to cross the transport abstraction (`attachToGeneration` returns a byte stream) and would need new plumbing in every host; both rejected.
- **Compatibility:** the field is optional and additive. The only parsers are the hook's `readSseEvents` JSON decode and any external consumer of the documented stream, which ignore unknown fields.

### D2. Return the id from `attach()` rather than re-reading the registry in the controller

`GenerationAttachment` gains `generationId` filled from the entry in the same synchronous read as `assembledMessage`. This keeps the single-read invariant and avoids a second lookup that could observe a replaced entry (a regenerate that reuses the path). The change is additive: how `attach(ownerKey, path)` addresses an entry, when it returns `undefined`, and the entry lifecycle are untouched, which is what `generation-registry` ("the two public, client-addressed operations SHALL keep their existing behaviour") protects.

### D3. The hook records the id per path and reuses `stoppablePaths`

- `createResumeIfAwaitingGeneration` takes two new optional dependencies, `rememberResumedGenerationId(path, generationId)` and `forgetResumedGenerationId(path, generationId)`, in the same style as `onReloadError`/`onReloadSuccess` (callbacks into the owning hook; no new context, no new prop on any component). `forget` is compare-and-clear: it removes the entry only while it still holds that exact id, so a late `forget` from a resume that lost the path to a newer one cannot erase the newer owner's id. The resume calls `forget` at most once per id.
- `useConversationStream` implements them with a `resumedGenerationIdsRef: Map<path, id>` and `setPathStoppable(path, true/false)`. `canStopStreaming` needs no change because it already ORs in `stoppablePaths`. `handleStop` resolves `localGenId ?? findResumedBackgroundGenerationId(...) ?? resumedGenerationIdsRef.get(path)`; the precedence keeps the existing two sources first, which is what the spec requires.
- **Ownership guard.** `stoppablePaths` is also owned by locally started generations (`releaseActiveGeneration` clears it). The implementation therefore sets and clears the path's stoppable state for an attach-supplied id only when `activeGenerationIdsRef` has no entry for that path, and never clears a state it did not set. Otherwise forgetting the attach id could drop the Stop of a live local generation.
- **Scope guard.** `resumeGeneration` is shared by three callers: the public `resumeIfAwaitingGeneration`, `startStream`'s stream recovery, and the opted-in 409 handover. Two existing requirements constrain the latter two: Stop stays `true` throughout recovery, and `canStopStreaming` is `false` throughout a conflict handover. The attach id is therefore consumed only when the resume is started through the public entry point. The public wrapper sets a new internal resume option (`trackAttachGenerationId`); recovery and handover do not, so their behavior is byte-for-byte what their specs state. A Stop for the conflict handover is a separate product decision and is recorded as a follow-up, not folded in here.
- **Alternative — keep the id on the buffered message** (`BufferedGeneration`): rejected; it is cleared on paths that should not drop Stop, and mixing a transient transport id into message state invites it being persisted by a later save.

### D4. Ignore replayed chunks after Stop for the attach-supplied id

`applyAttachChunk` already skips chunks while `isStoppedByUser()` is true; that check currently reads only the background id. It will also consult the attach-supplied id, because the backend aborts upstream asynchronously and a few chunks can still arrive before the terminal `stopped` event. `handleStop` already adds the id to `stoppedGenerationIdsRef` before sending, and `finish`/`finalCheck` already remove ids on settle; the new id joins both.

### D5. Forget the id whenever the attach does not remain the owner of the resume

The id is cleared (subject to the ownership guard in D3) when `finish` runs, when `finalCheck` fails, and when `runAttach` returns without a terminal event (the hook then proceeds to `runWatch`). In the watch fallback nothing proves the generation is still running on this instance, so Stop stays hidden — the behavior the spec already describes — instead of advertising a Stop that would likely return 404.

### D6. Stop semantics on the backend are unchanged

`/completions/stop` already stops a non-background generation from the registry, persists the assembled partial with `wasStoppedByUser`, and notifies attach subscribers with `stopped`. `content` (the text the client showed) is accepted and ignored on this path today; the resumed page passes it as it already does for background Stop, with no behavior change. A Stop that arrives while the entry is already finalizing or cancelling returns 404, which the hook's existing benign-404 handling treats correctly because its "is the generation still live" probe sees the resume settle within the grace window.

### D7. Docs

`docs/architecture.md` states that attach is looked up by path "rather than `generationId` (a freshly-opened tab has no `generationId` to send)". That sentence must now say that attach also tells the client the id so Stop works after a refresh. The attach description in the OpenAPI document and `libs/chat-hooks/README.md` (resume and Stop paragraph) are updated in the same change; `npm run validate:docs` and `npm run validate:specs` cover link and path drift.

## Risks / Trade-offs

- **[Another tab of the same user can now stop a generation it did not start]** → Already true for background generations and consistent with the principal model (attach and Stop share the same principal check); no new exposure. Noted in the spec.
- **[A refresh that lands on another BFF instance]** → Attach returns 404 there and the hook falls back to the watch flow, so no id is known and Stop stays hidden. Not a regression; the cross-instance case is an explicit non-goal.
- **[A few replayed chunks after Stop]** → Ignored by D4; the final reload applies the saved partial.
- **[Stop pressed at the instant the generation finishes]** → Backend returns 404; handled by the existing benign-404 logic, no error toast.
- **[Older frontend against a newer backend, or the reverse]** → Ignored field, or Stop hidden as today (spec scenarios).
- **[Registry entry is a background one without a saved marker yet]** → The attach is served from the registry and the id is still the one `abort` accepts, so Stop works in that window as well.

## Migration Plan

No data migration and no flag. Deploy backend and frontend independently in either order; each side degrades to today's behavior without the other. Rollback is a revert of either side.

## Open Questions

- None that change the specs, approach or tasks. Whether the same field is worth emitting on the background attach for symmetry is deliberately deferred: the stored marker already carries the id and nothing needs it.
