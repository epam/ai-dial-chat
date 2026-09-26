## Context

The backend saves an empty assistant before streaming and attempts exactly one terminal save. `finalize` currently catches write failures and reports the model outcome anyway. `useConversationStream.onComplete` discards its live buffer and blindly reloads storage; `generation-resume.finalCheck` does the same for attached clients. The transport waits for EOF, rather than treating upstream `[DONE]` as durable completion, so an error frame after `[DONE]` is supported.

`CookieSessionStrategy.authenticateSession` refreshes a near-expiry access token at request admission. `ConversationController` captures `user.at`, and `streamCompletion` reuses it for the terminal save. A token valid at admission can expire during a long generation. Dockerfile runs this same compiled backend with Node; it supplies neither a generation recovery worker nor different persistence logic. This is code evidence of a possible trigger, not evidence about the user's production incident.

## Goals / Non-Goals

Goals: preserve received output, distinguish generation from persistence success, cover initial and attached SSE consumers, and prove reachability through actual HTTP/SDK calls. Non-goals are the proposal's auth-refresh, retry, durable-recovery, and unrelated-writer exclusions.

## Decisions

1. Use existing stream-error envelopes. The backend emits `{error: {type: 'conversation_save_failed', message: <safe fallback>}}` after a terminal-save rejection; the registry emits an attach `error` event with `errorType: 'conversation_save_failed'`. Persistence failure overrides a stopped/done notification without issuing another write. Log the original failure server-side; never send raw SDK errors, credentials, paths, or response bodies to the browser. Preserve the registry's lease checks and finalization timeout semantics.
2. Add a typed persistence error to the headless transport, with an optional `generationPersistenceErrorMessage` hook parameter. Apps pass a translated warning explaining that the answer is retained on screen but may disappear after reload. No i18n, SDK configuration, storage paths, or app context enters a lib. Existing message error rendering is reused on mobile/desktop/RTL; inspect its accessible error announcement rather than adding a new UI surface.
3. Keep a generation's accumulated message until terminal reconciliation succeeds. If a terminal reload returns the unresolved empty assistant at the buffered index, preserve the complete buffered message (including attachments/stages/annotations/state) and warn. Successful nonempty server results remain authoritative. The current generation/path guards remain in force; resume callbacks additionally check their buffer ownership so a late attach cannot overwrite a newer local generation. Explicit persistence errors preserve the live message without reloading an older stored snapshot. Buffers remain local to the mounted hook and are replaced by a new generation; no durable storage/cache is introduced.
4. Do not retry terminal writes. The existing spec requires at most one attempt because a rejected HTTP request can be ambiguous about commit and another writer may already have advanced the conversation. Failure is visible and copyable; durable recovery needs its own conditional-write design.
5. Prove the defect with a loopback HTTP DIAL stand-in, installed `DialClientService`/SDK, real persistence/streaming/registry and Nest controller. The stand-in accepts the initial PUT, streams text/stages, and rejects the terminal PUT with HTTP 401/503. Assert stored placeholder, wire error, registry release, and successful-save control. Unit tests separately prove rendered hook state retention and legacy-server fallback. No real account, secret, or production storage is touched.

## Risks / Trade-offs

- A hard reload or process loss can still lose unsaved content: the warning must say so; this fix does not claim durable recovery.
- `[DONE]` precedes persistence in the existing wire protocol: app clients wait for EOF; add a transport regression that consumes an error after `[DONE]`.
- A newer generation or navigation can race a reload: retain existing guards and cover resume ownership as well.
- A permanently pending write still follows the registry's existing finalization timeout; this change handles rejected writes and stale terminal reads, not distributed fencing.
- Fallback defaults allow independently embedded hosts to upgrade without a new required prop. Hosts can translate through the optional parameter.

## Migration Plan

Deploy backend and frontend together as usual; no configuration, schema, Dockerfile, or REST DTO change. Older frontends understand the ordinary error frame; newer frontends also protect against older backends returning a placeholder. Update architecture, SSE API prose, and hook README in the same change. Rollback is code-only.

## Open Questions

The production failure status and token age are unknown without incident logs. The integration fixture proves a reachable failure contract, not a specific deployed IdP/Core policy. Follow `apps/chat-api/AGENTS.md` for implementation conventions.
