# Proposal

## Why

Today every generation lives inside one BFF process: `ConversationGenerationService` keeps the growing assistant message in an in-memory registry entry (`apps/chat-api/src/conversations/conversation-generation.service.ts:122-168`, keyed by `ownerKey::path` at line 216), attach/replay reads that local snapshot, Stop aborts a local `AbortController`, and the terminal save writes from that memory. The Responses branch sends `stream: true, store: false` with no background mode (`apps/chat-api/src/conversations/generation/responses.adapter.ts:110-125`). As a result a BFF restart loses the answer, attach/Stop only work on the instance that started the generation, and each generation holds its full text in BFF memory for its whole lifetime (issue epam/ai-dial-chat#8947).

DIAL Core 0.48.0 (containing epam/ai-dial-core#1958) runs Responses jobs in the background itself, tracks them in its own job store, enforces owner-only retrieve/cancel/delete by the caller's user bucket, and lets any caller with a valid token for the same user retrieve, replay, or cancel the job later. That lets Chat move generation ownership to Core for eligible deployments and make the BFF almost stateless for that path — without adding Redis, a queue, or stored credentials.

## Problem

- **Memory:** the whole answer is accumulated in BFF memory for the generation's lifetime (registry `assembledMessage`, `generation-live-replay` requirement "Backend retains in-flight assistant message content").
- **Single-instance ownership:** attach, Stop, and finalization only work on the originating pod; a restart or a request routed to another pod loses the answer or returns 404 (`generation-live-replay`, `stop-generation-endpoint`).
- **Stop does not stop the model job:** it aborts the local fetch; Core's cancel endpoint is never called (`docs/responses-api-integration.md` "User-initiated stop").

## Solution

For **eligible** deployments only, start the Responses request with `background: true, store: true, stream: true` and treat DIAL Core as the owner of the running job:

- **Eligibility:** new server-only flag `features.responsesBackgroundEnabled` (`RESPONSES_BACKGROUND_ENABLED`, default `false`) **and** the existing `features.responsesApiEnabled` **and** the existing deployment capability `features.responsesApi` **and** the deployment's Core `interfaces` includes `openaiResponses`. The Core author confirmed that `openaiResponses` in `interfaces` means the deployment fully supports background, store, replay and cancel (today: OpenAI models only). Other deployments keep today's Responses or Chat Completions path unchanged.
- **Durable association in the conversation file:** the assistant message carries the existing `responseId` (now saved right after `response.created`, not only at the end) plus a new `backgroundGeneration` marker (`generationId`, `status`, `startedAt`). No second store.
- **Option C finalization:** the originating BFF keeps reading the Core stream after the browser leaves (as today), passes chunks through without accumulating them, and at the terminal event fetches the final answer once via `GET /openai/v1/responses/{id}` and saves it with an `If-Match` conditional write. The message itself is the fence: a save only applies while the message is still `pending` with the same `generationId`.
- **Recovery on open (safety net):** any BFF instance that sees a `pending` background message on attach recovers it through Core with the user's current token — live replay from the start, or retrieve-and-finalize if the job already ended, or mark it failed if Core no longer knows it. A `pending` message that never received a `responseId` and is older than 2 minutes is marked interrupted; the job is never resubmitted.
- **Stop via Core:** any instance saves the text the client has shown (posted with Stop as the optional `content`) as stopped, responds, then calls Core cancel (and ends its own relay when it runs one). If Core refuses to cancel ("not supported"), the message stays stopped and the rest of the job is ignored. Stop also becomes available after a page refresh for background messages: the frontend reads `generationId` from the stored message.
- **Placeholder gates the job:** the background job is created only after the placeholder save succeeds. On a version conflict the request gets `409`; on a storage error it continues on the stateless Responses path. No job has started, so this is not a resubmission.
- **Cleanup:** after a successful final save the BFF deletes the Core response (best effort).
- **Protecting the pending message:** the message is identified by `backgroundGeneration.generationId`, not by position. While it is `pending`, only the BFF may change its answer fields: client saves through `PUT /api/v1/conversations` keep the stored answer fields (client-owned fields such as `rating` still apply), the BFF naming writer writes with `If-Match`, and copies (duplicate/import/publish) turn a `pending` message into `failed` so they never share a live job.
- **One pending generation per conversation:** any new send/regenerate/edit while a background message is `pending` gets `409`, as today with an active generation.
- **Restarts:** a graceful shutdown or rolling deploy detaches running relays (no cancel, no write); another instance finishes them on the user's next attach.
- **Access:** attach and Stop for background messages are scoped per DIAL user (own bucket + Core ownership), so another session or device of the same user can resume and stop.
- **Flag rule:** the flag only decides how a *new* generation starts. Recovery, attach, Stop and finalization of an *existing* `pending` background message always work, so turning the flag off never strands in-flight jobs.

## Alternatives considered

| Option | Correctness | Complexity / delivery risk | Security / performance | Rollback | Verdict |
|---|---|---|---|---|---|
| **Baseline — keep today's in-memory path** | Loses answers on restart; single-instance attach/Stop | None | Whole answer in BFF memory | n/a | Rejected: does not meet #8947 |
| **A — Core background, BFF stops reading when the tab closes, lazy finalize only** | Answer saved only when the user returns; lost if they return after Core's job TTL (1 day) | Smallest | No memory accumulation | Env flag | Rejected: visible regression vs today (shared/other-device views stay "pending") |
| **C — Core background, BFF keeps reading, lazy finalize as safety net** (chosen) | Normal case saved on time; restart recovered on next open | Small–medium; reuses today's "keep reading after disconnect" | No accumulation; one pass-through connection per running answer (same as today) | Env flag; recovery keeps working when off | **Chosen** |
| **B — BFF-owned background worker (Redis + sweeper + stored refresh tokens / offline credentials)** | True user-absent finalization | New infrastructure, largest security surface | Stores long-lived credentials | Harder | Rejected by product decision: no BFF-owned Redis |

Replay alternatives (from start vs `starting_after` cursor), eligibility alternatives (own allowlist vs `interfaces`), and association-store alternatives are recorded in `design.md`.

## What Changes

- **New** capability `background-responses-generation`: eligibility, start, early association, pass-through relay, Core-sourced finalization with conditional write, recovery on attach, interrupted-start handling, Stop via Core cancel, max-duration and shutdown detach (no cancel), one pending generation per conversation, client-save protection of the pending message, copy normalization, per-user access, Core response deletion, telemetry.
- **New** server-only feature key `features.responsesBackgroundEnabled` / env `RESPONSES_BACKGROUND_ENABLED` (default `false`), following the `features.responsesApiEnabled` precedent (`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts:250-252`).
- **New** optional `backgroundGeneration` field on the persisted assistant message (`apps/chat-api/src/conversations/dto/conversation-message.dto.ts:90` next to `responseId`; `libs/chat-shared/src/models/chat.ts:129`).
- **Modified** Responses request: `store: true, background: true` on the background path only; `store: false` stays for the stateless Responses path.
- **Modified** `responseId`: also the recovery key for background messages, persisted immediately after `response.created`.
- **Modified** attach endpoint: a `pending` background message with no local registry entry is replayed through Core instead of returning 404.
- **Modified** Stop endpoint: a `pending` background message is stopped through Core cancel on any instance.
- **Modified** persistence fencing: background-path writes use `If-Match` + the message marker; client saves of an existing conversation and rename also use `If-Match` (see below); non-background generation writes keep today's unconditional writes.
- **Modified** frontend resume detection (`libs/chat-hooks/src/conversation/useConversationStream/generation-resume.ts:27-38`): a message whose `backgroundGeneration.status` is `pending` is awaiting resume even though it already has a `responseId`; a stream whose reload still shows `pending` resumes instead of settling; Stop is available for a resumed background message (`useConversationStream.ts:747` today requires a locally started generation).
- **Modified** max-duration and shutdown handling: on the background path both detach the relay instead of aborting and finalizing.
- **Modified** `PUT /api/v1/conversations` (same contract): a stored `pending` background message's server-owned fields are preserved, a stale body cannot undo a finished background answer, and every save of an existing conversation is written with `If-Match` (re-read on conflict). The only new error is `503` after 3 conflicts in a row; a failed read keeps today's unconditional save.
- **Modified** naming writer: conditional write (`If-Match`).
- **Modified** duplicate/import/publish: `pending` background messages are copied as `failed`.
- **New** app-edge SDK wrapper in `apps/chat-api` for `getResponseItem` with `stream=true` (the installed `@epam/ai-dial-typescript-sdk@0.2.0-dev.11` types `query?: never`; one isolated cast, following the existing `createResponse` cast isolation in `responses.adapter.ts:201`), plus `cancelResponseItem` / `deleteResponseItem`.
- **Docs:** `docs/responses-api-integration.md`, `docs/architecture.md`, `apps/chat-api/README.md`, `apps/chat-api/.env.template`.
- **Not changed:** Chat Completions path; the stateless Responses path; the browser SSE protocol for `/completions` and `/completions/attach` (snapshot → chunks → one terminal event).

## Capabilities

### New Capabilities

- `background-responses-generation`: lifecycle of a generation that DIAL Core runs as a background Responses job — eligibility, association, finalization, recovery, Stop, cleanup, and telemetry.

### Modified Capabilities

- `responses-api-generation`: request flags differ on the background path (`store`/`background`); `responseId` becomes a recovery key persisted early.
- `generation-live-replay`: attach no longer returns 404 for a `pending` background message without a local registry entry.
- `stop-generation-endpoint`: Stop of a `pending` background message goes through Core cancel on any instance.
- `backend-owned-generation-persistence`: storage-side fencing (`If-Match`) is used for background-path writes; the start save gates the background job; the single-terminal-write rule is scoped to the non-background paths.
- `generation-registry`: the max-duration timer detaches (no cancel, no write) on the background path.
- `chat-hooks-conversation-stream`: resume detection treats a `pending` background message (at any position) as awaiting resume; a stream ending on `pending` resumes; Stop is available for resumed background messages.
- `generation-resume-on-refresh`: the awaiting-resume predicate covers `pending` background messages; Stop is exposed while resuming them.
- `generation-principal-ownership`: background-path isolation is per DIAL user instead of per principal key.
- `feature-flags-service`: new `FeatureKey.ResponsesBackgroundEnabled`.
- `config-registry-and-env-provider`: new `features.responsesBackgroundEnabled` registry entry.

## Non-goals

- No BFF-owned Redis, queue, cron, or stored refresh tokens / offline credentials (Option B).
- No universal migration: models without `openaiResponses` in `interfaces` keep today's paths. No Chat-side allowlist.
- No `previous_response_id` / server-side conversation state (Core rejects it on POST).
- No new Responses capabilities beyond today's (tools, non-image attachments, reasoning display remain out of scope per `docs/responses-api-integration.md` "Current Support Scope").
- No `starting_after` cursor replay in the browser protocol.
- No automatic resubmission of a generation whose start was interrupted.
- No change to Core, the Core OpenAPI file, or the SDK repo in this change. Follow-up, outside this change: once Core adds the `stream` / `starting_after` / `include` query params on `GET /openai/v1/responses/{response_id}` and a typed `ResponsesApiRequest` to `docs/open_api_core.yaml`, regenerate `epam/ai-dial-typescript-sdk`, bump `@epam/ai-dial-typescript-sdk` in `apps/chat-api/package.json`, and remove the cast in `core-responses.client.ts`.
- No elimination of bounded transport buffers (SSE backpressure stays as today).
- No change for non-background conversations when the user changes the model mid-answer (today's final write drops the status message and a refresh does not resume, because the final write in `conversation-streaming.service.ts` truncates after the answer's index). Follow-up, outside this change: track it as a separate issue.
- No conditional writes for frontend saves of non-background conversations.

## Acceptance criteria

- The spike on the dev environment (Core ≥ 0.48.0, an OpenAI deployment) confirms: background create with streaming and fast `response.created`; `GET ?stream=true` replays from the start both while running and after completion; `GET` after cancel returns partial output; the job continues after the originating request ends; the SDK cast actually sends `?stream=true`.
- With `RESPONSES_BACKGROUND_ENABLED=false` the outbound Core requests and persisted conversations are identical to today, except that existing `pending` background messages are still recoverable and stoppable.
- An eligible generation survives: browser refresh, tab close, attach on another BFF instance, and BFF restart — with no missing or duplicated content in the browser and exactly one final persisted answer.
- BFF heap does not grow with answer length on the background path (no per-generation assembled text); verified with long outputs, concurrent generations, absent clients and slow readers.
- Stop persists the available partial answer with `wasStoppedByUser` from any instance; Stop/completion races and regenerate never let an older job overwrite a newer message.
- Rating still works on a message whose Core response was deleted.
- `npm exec nx test chat-api`, `lint`, `build`, `npm exec nx test chat-hooks`, and `npm run validate:docs` pass.

## Rollback / backward compatibility

Not breaking. The new message field is optional and absent on every existing conversation; readers that do not know it ignore it. Rollback = set `RESPONSES_BACKGROUND_ENABLED=false` and restart: new generations go back to today's paths immediately, while recovery/Stop/finalize for already-running background jobs keeps working because it is keyed on the message, not the flag. A full code rollback leaves at most some messages `pending`; the pre-change frontend shows them as finished-empty (they carry `responseId`), which is the only data-visible residue and is bounded by the number of in-flight jobs at rollback time.

## Impact

- **Backend (`apps/chat-api`):** `conversations/streaming/conversation-streaming.service.ts`, `conversations/generation/responses.adapter.ts`, `conversations/conversation.controller.ts` (attach/stop), `conversations/persistence/conversation-persistence.service.ts` (conditional write), `conversations/dto/conversation-message.dto.ts`, `conversations/conversation-naming.service.ts` (conditional write), `conversations/lifecycle/conversation-lifecycle.service.ts` (copies), the `saveConversation` path in `conversations/conversation.service.ts`, `conversations/conversation-generation.service.ts` (max-duration/shutdown detach), `deployments/details/deployments-details.service.ts` (read `interfaces` via `getDeploymentInfo`, `/v1/deployments/{id}`, only when the flags are on), `app-config/**`, `config/environment.config.ts`, new background module files under `conversations/generation/`.
- **Frontend / libs:** `libs/chat-hooks` resume predicate, re-resume after a `pending` reload, and Stop for resumed background messages; `libs/chat-shared` message model gains the optional field. Both stay host-agnostic: they read a data field on the DIAL conversation shape and know nothing about Core endpoints, flags, or tokens — all Core calls stay in `apps/chat-api`.
- **Shared libs call-out (scope):** touches two published libs (`chat-shared`, `chat-hooks`) with an additive, optional field and a predicate change.
- **API / OpenAPI:** no new BFF routes; `ConversationMessageDto` gains the optional `backgroundGeneration`, `StopCompletionDto` gains the optional `content` (the text shown so far), and publish and Stop document new `409`/`503` responses → regenerate `chat-api-client` via `npm run openapi`.
- **Dependencies:** requires DIAL Core ≥ 0.48.0 in any environment where the flag is enabled. SDK stays `0.2.0-dev.11`.
- **i18n:** no new user-visible strings expected — interrupted/expired generations reuse the existing stream-error banner and Retry. If implementation needs a new message, keys are added to `en.json` and every locale.
- **Security review:** authorization for retrieve/replay/cancel/delete is enforced by Core per user bucket; the BFF only ever forwards the caller's own token and never sees Core per-request keys. Background attach/Stop isolation widens from per-session to per-user (see `design.md` Authorization).
