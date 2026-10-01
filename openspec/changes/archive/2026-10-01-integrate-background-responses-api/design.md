# Design

## Context

See `proposal.md` (Why / Problem). Facts the design depends on, verified in the local `ai-dial-core` checkout (`development`, contains epam/ai-dial-core#1958, first shipped in 0.48.0) and in this repo:

**DIAL Core (paths relative to `server/src/main/java/com/epam/aidial/core/server/`)**

- Routes are unscoped: `POST /openai/v1/responses` (deployment from body `model`), `GET|DELETE /openai/v1/responses/{id}`, `POST /openai/v1/responses/{id}/cancel` (`data/RouteTemplate.java:36-47`). There is no `input_items` route.
- Core stores an id mapping with `initiatorBucket` (the JWT `sub`'s user bucket, or the API-key project) and rejects retrieve/cancel/delete from another bucket with `403` (`controller/ResponseItemController.java:158-168`). A refreshed token with the same `sub` works; there is no time limit other than retention.
- Core tracks background jobs itself (`service/BackgroundJobService.java`, Redis scheduler) and accounts cost once, against the initiator. Job TTL is 1 day, id-mapping TTL is 30 days, and body retention is up to the adapter (`aidial.settings.json:136-146`).
- GET passes the query string through to the adapter (`ResponseItemController.java:211-213`), so `stream=true` / `starting_after` work only if the adapter supports them. DELETE returns `409` while the job is active.
- `interfaces` (with `openaiResponses`) is returned by `GET /v1/deployments/{id}` and the listing (`controller/DeploymentController.java:190-220, 373-419`), not by `getModel`/`getApplication`, which the BFF's `deployments-details.service.ts:239,321` uses today.
- The Core author confirmed that `openaiResponses` in `interfaces` means full background support (today: OpenAI models only). The code sets it whenever a Responses endpoint is configured, so this is a platform agreement, not an enforced check.

**This repo**

- Registry, snapshot and local attach live in `apps/chat-api/src/conversations/conversation-generation.service.ts`. The relay/finalize flow is `conversations/streaming/conversation-streaming.service.ts:441-744`, and the Responses adapter is `conversations/generation/responses.adapter.ts`.
- Persistence is `conversations/persistence/conversation-persistence.service.ts:97-150` and is unconditional today. The SDK's `saveConversation` accepts `If-Match`, and read/save return `ETag`.
- Messages have no ids and are addressed by index. `responseId` already exists (`conversation-message.dto.ts:90`, `libs/chat-shared/src/models/chat.ts:129`), and rating sends it to Core (`libs/chat-hooks/.../useConversationHandlers.ts:392`, `apps/chat-api/src/rate/rate.service.ts:46`). Core's rate endpoint forwards to the deployment and does not look up the stored response (`controller/RateResponseController.java`).
- The frontend's `hasGeneratedPayload` treats `responseId != null` as "finished" (`libs/chat-hooks/src/conversation/useConversationStream/generation-resume.ts:27-38`).
- SDK `@epam/ai-dial-typescript-sdk@0.2.0-dev.11` is generated from Core's `docs/open_api_core.yaml`. `getResponseItem` is typed `query?: never` (the spec declares no query params), but the runtime forwards `init` to `openapi-fetch` (`dist/index.js:785`). `response_id` is not encoded.

## Goals / Non-Goals

**Goals:**
- A background path that keeps no per-generation answer text in BFF memory and works across instances and restarts, using only DIAL Core and the conversation file.
- Byte-identical behavior for the other paths when the new flag is off.
- An unchanged browser SSE protocol, so the frontend change is one predicate.

**Non-Goals:**
- Cursor-based replay; Chat-side allowlists; BFF-owned job storage; finalizing without any user request after the originating instance is gone (see proposal Non-goals).

## Decisions

### D1 — Core owns the job; the originating BFF keeps reading (Option C)

The originating instance relays the Core stream to its end even after the client leaves (today's behavior), then finalizes. Recovery on the next attach is the safety net for restarts, crashes, or an expired token on the final save.
- **Alternatives:** A (stop reading on disconnect, lazy finalize only) regresses what shared/other-device viewers see. B (Redis + stored credentials) was rejected by product decision.
- **Consequence:** "finalization independent of browser presence" holds while the originating instance lives. After a crash it holds on the user's next open, within Core's 1-day job TTL.

### D2 — The association lives in the assistant message

We reuse `responseId` and add `backgroundGeneration { generationId, status, startedAt }`, with `status` as a string enum `BackgroundGenerationStatus { Pending = 'pending', Completed = 'completed', Stopped = 'stopped', Failed = 'failed' }` shared through `libs/chat-shared`.
- **Alternative:** a separate per-conversation state file, which means two writes to keep in sync, cleanup, and two reads on recovery.
- Grouping the new fields in one optional object keeps them clearly scoped to the background path and makes "is this a background message" a single presence check.
- `ConversationMessageDto` gets a nested DTO class with `@ApiProperty` metadata so the field appears in the OpenAPI schema and generated client. Request bodies don't validate nested messages today (`SaveConversationBodyDto` uses `@IsObject`, and `ConversationResponseDto` has no `@ValidateNested`), so no 400 risk exists either way; the DTO is for the schema, not for validation.
- **Identity:** messages have no ids, so `backgroundGeneration.generationId` is the background message's identity. Every background read, precondition and write locates the message by it and replaces it **in place**, keeping messages after it (a model-changed status message appended mid-answer by `useDeploymentChangeEffect.ts:54`). Today's final write truncates after the index (`conversation-streaming.service.ts:620`); the background path does not copy that.
- **Field ownership:** server-owned = `content`, `custom_content`, `responseId`, `backgroundGeneration`, `streamErrorMessage`, `wasStoppedByUser`; client-owned = everything else (e.g. `rating`). Background writes touch only server-owned fields; client saves touch only client-owned fields of a pending message (D14).

### D3 — Interrupted start: fail after 120 s, never resubmit

Core has no job listing, so a job created before the `responseId` save is unfindable. On attach or Stop, a `pending` message without `responseId` older than `BACKGROUND_START_TIMEOUT_MS = 120_000` (a code constant) is saved as `failed`. Within the window, attach answers 404, so the frontend's existing watch/backoff keeps waiting. The orphaned Core job runs to completion or expiry, and its cost is accepted.

### D4 — Replay from the beginning through Core

Attach sends a `snapshot` of the stored placeholder, then relays `GET ...?stream=true` from the first event through the same normalizer as the live stream. The frontend already seeds from the snapshot and then reloads on the terminal event (`chat-hooks-conversation-stream` "Resume detection after a hard refresh mid-generation"), so no protocol change is needed.
- **Alternative:** a `starting_after` cursor. It needs new chunk metadata and hook state, and a hard refresh would still need a full replay.
- **Attach on the originating instance:** it also uses Core replay (one code path) instead of subscribing to the local relay.

### D5 — Stop through Core; the message is the fence; Stop after refresh; `cancelled` means stopped

Stop reads the conversation, checks `pending` + `generationId`, writes `stopped` with `wasStoppedByUser` and the text the client posts with Stop, responds `204`, and only then calls cancel, without waiting for it. Writing first means the originating relay and any attach find the message finished and skip, so an empty `cancelled` result can never overwrite the Stop. No cross-instance signalling is needed; when the stopping instance also runs the relay, it aborts it so the tab stops receiving tokens. A failed stopped write returns `503` and does not cancel. A Stop that reaches the registry before the placeholder exists aborts the relay, which then saves the message as `stopped` rather than leaving it `pending`.
- If cancel is rejected (future translator/interceptor deployments), we still write `stopped`.
- When a relay's or attach's own write is skipped because the message already holds a terminal status, that stream sends its client the event matching the **stored** status. So the tab that pressed Stop sees `stopped`, not `error`, even when Stop ran on another instance.
- Stop after a refresh: today `handleStop` needs `activeGenerationIdRef`, which only a locally started generation sets (`useConversationStream.ts:747`). For a resumed message with `backgroundGeneration`, the hook uses its `generationId`, so Stop is available after a refresh, navigation, or on another device of the same user.
- Stop on a `pending` message without `responseId` always writes `stopped` (the user's intent), regardless of the 120 s rule, which applies to attach only.
- Race: Stop on instance B cancels, and instance A's relay ends first. To keep the user from seeing an error, **every** writer maps a retrieved Core status `cancelled` to `stopped` + `wasStoppedByUser`. Only the Stop endpoint cancels an active job (the only other cancel — after a skipped `responseId` save — happens once the message has already left `pending`), so all writers agree and it doesn't matter who writes first.
- On `/completions`, the originating relay never sends a typed terminal event derived from storage (that stream's client parses `{type:'stopped'}` as a chunk, `create-chat-stream-api.ts:174-199`). Whenever the outcome comes from storage (skipped write, failed write, detach, shutdown), it ends the stream cleanly, and the client's reload-after-complete shows the stored state or resumes a `pending` one. `/attach` keeps its typed events.
- The spike showed that DIAL Core's JSON retrieve has **no** partial output for a running or cancelled job, and that cancel is unreliable (once ignored, once an error). Stop first read the partial text from Core's replay (1 s idle / 3 s cap). Manual testing on dev showed the replay starts from the first event at the job's own pace (its first event came about 3 s late, with no text), so Stop always waited 3 s and then saved an empty answer, even over a job that had already finished. **Chosen instead:** the client posts the text it has shown as the optional `StopCompletionDto.content`; the backend writes `stopped` with it before cancelling, responds right away, and cancels without waiting. This is exact (it is what the user saw, like the stateless path) and fast, and it removes the replay read. The field is used only on the background path; other paths keep the backend's assembled answer. It writes only into the caller's own conversation, which a normal save could change anyway. Writing first still means the originating relay and any attach see a finished message and skip. Alternatives rejected: a longer replay wait (slow, and still dependent on Core's pacing); responding first and reading the replay in the background (the client would briefly see `pending` again); an empty stopped answer (visible regression).

### D6 — Eligibility = both flags + `interfaces` has `openaiResponses`

The new flag `features.responsesBackgroundEnabled` follows the `features.responsesApiEnabled` pattern (`config-registry.constants.ts:250-252`, `environment.config.ts:880`). Background is a sub-mode of Responses, so it needs both flags: `RESPONSES_API_ENABLED=false` still turns off all Responses usage.
- `interfaces` comes from `getDeploymentInfo` (`GET /v1/deployments/{id}`, already in the SDK at `dist/index.js:671`). It's fetched only when both flags are on, and cached as `deployments:interfaces:<sub>:<deployment>` with the details TTL, invalidated with `invalidateDetailsCache`.
- **Also requires `features.responsesApi === true`**, so the existing rule "Responses only when the deployment reports the capability" (`responses-api-generation`) is never bypassed. For OpenAI deployments both signals are expected to be true.
- **Alternative:** add `interfaces` to every details response. That adds a Core call to UI details requests that don't need it.
- **Alternative:** a Chat allowlist. The Core author confirmed the signal, so an allowlist would drift from Core config.

### D7 — Flag scope: new starts only

Attach recovery, Stop, finalize and delete dispatch on the message's `backgroundGeneration`, never on the flag, so turning the flag off leaves no job stranded.

### D8 — Conditional writes on the background path only

A new `saveConversationIfMatch(bucket, path, conversation, etag)` on the persistence port returns `{ isSaved: true, conversation } | { isSaved: false }` (`412`). **Every** background write after the placeholder (`responseId`, final, stopped, failed, expired, interrupted) does read → check "still `pending` with this `generationId`" → conditional save, with at most 3 attempts on `412`. The naming writer (`conversation-naming.service.ts:333-349`) re-reads and writes the **whole** conversation, so it also switches to `If-Match` with bounded retry; otherwise it could write back a stale `pending` copy after the final answer landed. This is what makes parallel writers on different instances safe: exactly one terminal state is persisted and none is replaced. A second finalizer's `DELETE` getting `404` counts as success. The placeholder write uses the ETag of the conversation read at request start, so a concurrent start gets `412`, then `409`, and no Core job (E4). On a `412` for the placeholder, the BFF re-reads: a `pending` background message means a real concurrent start (`409`); anything else (typically the naming writer) means rebuild the placeholder on the new version and retry, bounded to 3. Independently of versions, any new generation (send/regenerate/edit) on a conversation that contains a `pending` background message gets `409`, the same as today's one-active-generation rule; this replaces the earlier "cancel on regenerate/edit" idea, which would have left orphans in send mode. If the placeholder save fails for any other reason, the request continues on the stateless Responses path. No job exists yet, so this is not the forbidden resubmission; it keeps today's resilience to a short storage error. Non-background generation writes stay unconditional, and the single-terminal-write rule is scoped to them (`backend-owned-generation-persistence` delta). Client saves and rename become conditional (D14). Every conditional writer (placeholder, pending-message updates, client save, rename, naming) goes through one persistence helper, `updateConversation` (read → update → `If-Match` save via the existing `buildIfMatchHeaders`, re-read on `412`, bounded to 3), so the retry rule lives in one place. The placeholder's first attempt reuses the version read at request start (`getConversationWithStoredVersion`), so a background start costs no extra read. Stop and attach consult storage only when this instance has no non-background generation for the path, so non-background chats keep today's registry-only Stop and attach.
- Where Core returns no ETag (to be verified in the spike), the background path can't be fenced safely. If so, stop and ask before proceeding.

### D9 — Finalization reads the final answer from Core once

On the stream's terminal event, `GET /openai/v1/responses/{id}` → normalize `output` (text from `message` items' `output_text` parts only, so reasoning is never saved; `responseId`; error/incomplete mapping reused from `responses.adapter.ts` terminal handling) → conditional write. The normalizer is the transient final-result processing the issue allows.

### D10 — Registry use on the background path

The originating instance still registers a lightweight entry: `generationId`, `AbortController` for the relay, timers, and **no** `assembledMessage`. This keeps the existing shutdown and max-duration machinery and the process-local 409, and removes the snapshot.
- Shutdown (`onModuleDestroy`, `conversation-generation.service.ts:285-297`) detaches background entries the same way: no cancel, no write, clean stream end. Otherwise a rolling deploy would persist every running job as failed.
- At `MAX_GENERATION_DURATION_MS` the relay is detached, not cancelled (E2), and the client stream ends without a terminal event (`generation-registry` delta). Today a clean stream end makes the client reload and settle (`create-chat-stream-api.ts:370`), so the hook gets a new rule: if the reload still shows `pending`, it resumes through attach instead of settling. The same rule covers a final save that failed and left the message `pending`.

### D11 — SDK use at the app edge

A new `apps/chat-api/src/conversations/generation/core-responses.client.ts` wraps `getResponseItem` (JSON and `stream=true`), `cancelResponseItem` and `deleteResponseItem`, with `encodeURIComponent(responseId)` and the caller's bearer headers. It holds the single documented cast for `params.query`. Raw `fetch` is not needed because the SDK runtime forwards the query.
- **Follow-up:** once Core adds the `stream`/`starting_after`/`include` query params and a typed `ResponsesApiRequest` to `docs/open_api_core.yaml`, regenerate the SDK in `epam/ai-dial-typescript-sdk`, bump `apps/chat-api/package.json`, and delete the cast.

### D12 — Cleanup and cancellation side effects

After an applied terminal write we call `DELETE` best-effort (E1). Stop is the exception: its write happens while the job still runs, so it deletes only after the cancel reports a finished job. A `404` means another finalizer already deleted it, so it counts as success. A `409` means the job is still active, which happens only after an unsupported cancel. We log it and leave it to Core's TTL. There is no cancel-on-regenerate/edit any more: those requests get `409` while a message is `pending` (D8). Conversation delete does **not** cancel either: `deleteConversations`/`deleteAllConversations` (`conversation.controller.ts:782-842`) receive only ids, and reading each conversation to find pending jobs isn't worth it. The orphaned job finishes in Core, and its finalization finds no conversation and skips. Rating after delete is verified on the target deployment (spike 1.6) rather than asserted, because it depends on the deployment's rate endpoint.

### D13 — Telemetry

We add counters/log events per outcome (`finalized_origin`, `finalized_recovery`, `stopped`, `cancel_unsupported`, `expired`, `interrupted_start`, `save_failed`, `detached_max_duration`, `detached_shutdown`, `delete_failed`, `placeholder_fallback`) next to the existing `dial.chat.completion.response.terminations` instrumentation. Ids only, never content or principal.

### D14 — Client saves cannot change a pending background message

All frontend full-body saves go through `PUT /api/v1/conversations` (`conversation.controller.ts:212-235`): rating (`useConversationHandlers.ts:384`), overlay prompt/temperature (`useActiveConversationBridge.ts:67,79`), generic changes (`Conversation.tsx:213`), status messages (`Conversation.tsx:310`), settings (`ConversationRoute.tsx:446`); message delete (`useConversationHandlers.ts:330`) is already blocked while streaming. None of them knows `backgroundGeneration`, which the client never receives during a live stream, so without protection a rating on an older message mid-answer would strip the marker and the final write would be skipped: the answer would be lost, a regression against today's "server's final write wins".
- **Chosen:** the save handler reads the stored conversation (with ETag). If it contains a `pending` background message, it puts back that message's server-owned fields from storage (re-inserting it at its stored position if the body dropped it), keeps the body's client-owned fields for it, and saves with `If-Match` (bounded retry). Same `200` + `ConversationResponseDto`; callers ignore the body and the hook's reload-after-complete shows the final state.
- **Alternatives:** block every frontend save while pending (7+ call sites, overlay hosts outside our control, other tabs/devices not covered); return `409` (every caller would need error handling, and normal actions would fail).
- Every client save of an existing conversation is conditional (`If-Match` on the version read, bounded retry), even without a pending message: otherwise a start that saves its placeholder between the read and the write would be overwritten and its answer lost. A stale body that lacks the pending message gets the stored messages up to it put back, so it cannot drop the question either. A new conversation or storage without an `ETag` keeps the unconditional save.
- Rename also writes with `If-Match` and re-reads on `412`, for the same reason as naming (D8).

### D15 — Copies never share a live job

Duplicate (`conversation-lifecycle.service.ts:344` copies `...sourceData`) and import write `pending` background messages as `failed` with `streamErrorMessage: ''`. Otherwise recovery on the copy would finalize and delete the original's Core response, and the original would then expire as failed. Import arrives as a client `PUT`, so it relies on the rule that a client body can never create a `pending` marker.

Publish is copied by DIAL Core itself (`createPublication`), so its copy can't be rewritten; a published copy with a `pending` message would show a generating indicator to every viewer until it timed out, every time it's opened. Publish therefore answers `409` ("The answer is still being generated. Publish the conversation after it finishes.") while the conversation has a `pending` background message. The frontend already shows a rejected publish's server message in its publish-error notification (`usePublishErrorNotification.ts`), so no frontend change is needed; the message is English-only, like other server-provided publish errors. Alternatives rejected: do nothing (a stuck public copy); hide the Publish action in the UI (does not cover the overlay or API callers).

### Authorization (for security review)

- **Routes:** no new BFF routes. `/completions`, `/completions/attach` and `/completions/stop` keep their existing auth (cookie or header principal, CSRF for cookie).
- **Reads:** the BFF only reads conversations from the caller's own bucket, so a `responseId` can only come from the caller's own file.
- **Core calls:**
  - Every Core call carries the caller's current bearer token. Core re-checks ownership per user bucket and answers `403` for any other user, which the BFF maps to `404`.
  - No token, refresh token, per-request key or `DIAL_API_KEY` is stored or used for these calls.
  - Core's per-request keys for the background job are minted, stored encrypted and invalidated by Core. They never reach the BFF.
- **Isolation widens from per-session to per-user on the background path:** today `generation-principal-ownership` isolates by principal key (cookie `sid` or `h:provider:sub`), so another session of the same user cannot attach or stop. For background messages the BFF authorizes by the caller's own bucket plus Core's per-user ownership, so any authenticated client of the same DIAL user (another session, device, or bearer client) can attach and stop. A different user still gets `404`. This is intentional (stop from another device) and must be confirmed in security review.
- **The `responseId` is not a secret:** it appears in exports and shared copies. A recipient can't use it, because Core ownership is by the initiator's bucket.

## Risks / Trade-offs

- [The OpenAI adapter doesn't support `GET ?stream=true` replay, or returns no partial output after cancel] → The spike runs first. If replay is missing, attach falls back to polling `GET` until terminal (answer appears at the end, no progressive rendering) and we ask the user before accepting. Partial output uses fallback F1 (D5).
- [Core doesn't return `ETag` / honor `If-Match`] → The spike verifies it. Without it, stop and redesign the fence with the user.
- [The first text arrives later than on the stateless path] → Observed in manual testing on dev (`gpt-4.1-nano`): a background job waits in the provider's queue between `response.queued` and `response.in_progress` (about 3 s) before any text. DIAL Core proxies the streaming request directly and the BFF relays each event as it arrives, so the delay comes from the upstream's background mode, not from Chat. Accepted as the cost of an answer that survives refresh, tab close, and restarts; it is one reason the flag defaults to `false`.
- [Known limitations, accepted for this change] → Documented in `docs/responses-api-integration.md` ("Known limitations"): a resumed tab can keep showing "generating" after Stop until Core ends a job that ignored the cancel; a message stays `pending` while Core keeps refusing the retrieve (`403`/error/`409`), blocking new sends until the user reopens it and stops it; an attach in the first moments of a start, before the entry is marked background, is served from the registry and shows an empty answer until it completes. Each is rare or depends on Core, and fixing it needs a new mechanism beyond this change.
- [`openaiResponses` is set on a deployment whose adapter isn't really background-capable (misconfiguration)] → The operator turns off `RESPONSES_BACKGROUND_ENABLED`. The design doc records the dependency on the Core agreement.
- [The originating instance dies and the user never returns within 1 day] → The answer is lost and the message becomes `failed` on the next open. Accepted by the D1 choice.
- [A long job outlives the user's access token] → The final save fails and the message stays `pending`. The next open recovers it with a fresh token.
- [Orphaned Core jobs from interrupted starts or unsupported cancels cost tokens] → Rare, bounded by Core's TTL, and counted in telemetry.
- [A pre-change frontend (partial rollback) sees `pending` messages as finished-empty] → Bounded to in-flight jobs at rollback time.
- [Two DIAL Core writes per generation more than today (placeholder `responseId` update, conditional retries)] → Small, and only on the background path.
- [A client save on a pending conversation costs an extra read (the stored ETag and pending check)] → Only the save endpoint pays it; it is one `getConversation` per save.
- [Model change mid-answer on the non-background path still loses the status message and does not resume after refresh] → Pre-existing; a follow-up outside this change (see Non-goals in `proposal.md`).

## Migration Plan

1. Deploy with `RESPONSES_BACKGROUND_ENABLED=false` (the default). No behavior change.
2. On dev (Core ≥ 0.48.0, OpenAI deployment), run the spike checks, then enable the flag on dev and run the verification matrix (tasks §9).
3. Enable per environment. Roll back by setting `RESPONSES_BACKGROUND_ENABLED=false` and restarting. In-flight jobs keep finalizing through recovery.

## Open Questions

- The final names of the outcome counters, if the existing metric naming convention in `apps/chat-api` suggests a better shape. This doesn't change behavior.
