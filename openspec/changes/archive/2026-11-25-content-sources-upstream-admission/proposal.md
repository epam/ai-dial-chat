# Proposal

Tracked in epam/ai-dial-chat#9993 (Closes #9993).

## Why

`ContentSourcesController.run()` (`apps/chat-api/src/content-sources/content-sources.controller.ts:221`) takes a slot from `ContentSourcesAdmissionService` (`content-sources-admission.service.ts:4-6`: 4 in flight per principal, 32 per process, constants) before `ContentSourcesService` looks at its cache, and answers 429 at once when no slot is free. A fresh cache hit costs no upstream call but spends the same slot as a cold GitHub/GitLab fetch. A rendered document whose images load in parallel therefore gets 429 for some images, and a browser `<img>` cannot tell 429 from 404, so they render broken. All tabs of one user share the 4 slots.

Meanwhile `upstream-fetch.ts` has no bound of its own: 32 admitted requests, each assembling a listing with an upstream concurrency of 4 (`content-sources.service.ts:43`), can issue on the order of 128 concurrent upstream calls. Single-flight only merges identical keys. The limit throttles cheap requests and bounds expensive ones only indirectly. Launchpad is about to render repository images with plain `<img loading="lazy">` and load feed documents in parallel, which makes this visible on every page.

## Problem

- Cache hits are rejected with 429 although they do no upstream work.
- 429 is immediate: there is no wait, even for a moment.
- Upstream concurrency per GitHub/GitLab host and token is unbounded.
- The constants cannot be tuned per deployment.

## Solution

Bound upstream work, not HTTP requests.

- **No admission in the controller.** A fresh cache hit never takes a slot and never answers 429.
- **Upstream semaphore.** Every call made through `upstream-fetch` (tree, file, commits) takes a slot from a FIFO semaphore keyed by the source's `baseUrl` + `credentialId`. The default is 8 concurrent calls and a queue of 64 waiters. A waiting call fails with 503 when `CONTENT_SOURCES_TIMEOUT_MS` passes before it starts, and with 429 only when the queue is full. A slot is released on success, upstream error, timeout and client abort.
- **Stale when a refresh cannot start.** An expired entry whose refresh cannot get a slot (queue full or wait timeout) is served stale when a stale value exists, and counted in `dial.chat.content_sources.stale_served`. This reuses the existing stale-if-error path.
- **Per-user fairness on misses only.** A request that has to start upstream work after single-flight counts against a per-principal (`providerId:sub`) limit, default 8. Above it the answer is 429 without an upstream call. A request that joins an in-flight load does not count again.
- **Client abort.** A request whose client disconnects stops consuming the shared load. The last consumer to leave removes a queued call or aborts a running one, as `ConversationTitleCacheService` already does (`apps/chat-api/src/conversations/listing/conversation-title-cache.service.ts:120`). So an abandoned page of lazy images does not hold the queue full for the next page.
- **Listing assembly** keeps its concurrency of 4 per listing and draws from the same semaphore.
- **Configuration.** `CONTENT_SOURCES_UPSTREAM_CONCURRENCY` (8), `CONTENT_SOURCES_UPSTREAM_QUEUE_SIZE` (64) and `CONTENT_SOURCES_PRINCIPAL_MISS_CONCURRENCY` (8) become validated ints in `apps/chat-api/src/config/env/integrations.env.ts`. The process-wide ceiling of 32 is removed because the semaphore makes it redundant (design.md decision 6).
- **Telemetry.** The result categories stay. A new bounded category, `upstream_queue_full`, tells a full queue apart from the per-principal `admission_rejected`, and `client_closed` keeps aborted requests out of `unavailable`. A new histogram records upstream queue wait time, labelled by configured source id and a bounded outcome.

Closest models: the gate in `ConversationTitleCacheService` (FIFO handoff, wait timeout, consumer-owned abort, queue-outcome histogram), the client-abort wiring in `CustomApiController` (`apps/chat-api/src/custom-api/custom-api.controller.ts:291`), and env fields as in `CONTENT_SOURCES_TIMEOUT_MS` (`integrations.env.ts:66-71`).

### Alternatives considered

| Option                                                                       | Verdict                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Raise the constants (for example 16/64)                                   | Rejected. Cache hits would still spend slots, a large enough image page would still get 429, and upstream fan-out would grow to about 256 calls.                                                                                                |
| B. Keep request admission but skip it on a fresh hit (peek the cache first)  | Rejected. Expired entries, single-flight joiners and nested listing loads still count as requests, and upstream concurrency stays unbounded. It also needs a second cache read per request.                                                    |
| C. One process-wide upstream semaphore                                       | Rejected. A slow or throttled host (a GitLab instance under load, a GitHub token at its rate limit) would starve every other host. Hosting providers limit per token, so `baseUrl` + `credentialId` is the unit that matches upstream quotas. |
| D. **Semaphore per `baseUrl` + `credentialId`, plus per-principal miss fairness** | **Chosen.** It bounds the cost that is actually scarce, lets cache hits through, and matches upstream quotas.                                                                                                                                   |

## Non-goals

- No cross-replica coordination. Limits stay per process, like single-flight.
- No stale-while-revalidate. TTL semantics, cache keys and stores are unchanged: an expired entry is still refreshed synchronously, and stale is served only when that refresh fails or cannot start.
- No change to endpoints, the OpenAPI document (`npm run openapi:check` stays clean), error mapping or path safety. The api-client is not regenerated, so Launchpad needs no package bump.
- No rate limiting by request count. `@nestjs/throttler` is out of scope.
- No new user-visible strings and no frontend change.

## Acceptance criteria

- 20 concurrent cached asset requests from one principal all succeed, with zero upstream calls.
- 20 cold asset requests with concurrency 8 never exceed 8 concurrent upstream fetches for one `baseUrl` + `credentialId`, and all succeed within the timeout.
- A full queue answers 429 (`upstream_queue_full`). A wait longer than `CONTENT_SOURCES_TIMEOUT_MS` answers 503.
- An expired entry is served stale, and `stale_served` is incremented, when its refresh cannot get a slot.
- A principal's 9th concurrent cache-miss request answers 429 (`admission_rejected`) without an upstream call. Requests joining an in-flight load do not count.
- A slot is released after success, an upstream error, a fetch timeout and an abort, and a queued call whose last consumer disconnects leaves the queue.
- A listing never runs more than 4 upstream calls at once, and its calls count against the shared semaphore.
- The three env vars are validated at boot with the defaults above and listed in `environment-composition.spec.ts`.
- `npm run openapi:check` reports no change. The `content-sources-api` and `content-sources-config` specs, the chat-api README "Behavior and limits" and `.env.template` describe the new behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `content-sources-api`: "Per-user throttling" is replaced by upstream admission (semaphore, bounded queue, 429/503, stale when a refresh cannot start) and per-user cache-miss fairness. "Telemetry metrics" gains the `upstream_queue_full` and `client_closed` categories, and a new "Upstream queue wait metric" requirement adds the queue-wait histogram.
- `content-sources-config`: "Runtime limits" gains the three admission env vars and their defaults.

## Impact

- **Code (`apps/chat-api/src/content-sources/`)**: a new keyed FIFO semaphore and an upstream gate service used by both providers. `ContentSourcesAdmissionService` becomes a per-principal miss limiter that the service uses. The controller no longer admits; it passes the principal and an abort signal. The cache service's single-flight becomes consumer-owned, with an abort signal per consumer. `ProviderContext` gains `signal`. `ContentSource` gains the non-secret `credentialId`. The listing constant `CONTENT_SOURCES_UPSTREAM_CONCURRENCY` is renamed `CONTENT_SOURCES_LISTING_CONCURRENCY` so it does not clash with the env var. Telemetry gains one histogram and two result categories.
- **Config**: three optional ints in `integrations.env.ts`, `environment-composition.spec.ts`, `.env.template`, and the chat-api README env table.
- **API**: no contract change. The 429 and 503 status codes already exist. Requests that used to get 429 now succeed or wait.
- **Libs, frontend, i18n**: none. Nothing under `libs/*` changes, and there are no new strings.
- **Rollback / compatibility**: not breaking. It is a server-only behavior change with additive env vars. To revert, revert the commit. To approximate the old strictness without a deploy, set `CONTENT_SOURCES_PRINCIPAL_MISS_CONCURRENCY=4` and `CONTENT_SOURCES_UPSTREAM_QUEUE_SIZE=0`.
