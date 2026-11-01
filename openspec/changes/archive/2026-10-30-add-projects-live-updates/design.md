## Context

The Projects page loads once. `useProjects` in `libs/chat-hooks/src/project/use-projects.ts` calls `ProjectsApiClient.listProjects` inside an effect keyed on a reload token, and the result never changes until Retry. The BFF assembles the list in `ProjectsService.listProjects` (`apps/chat-api/src/projects/projects.service.ts`) from three Core sources (personal bucket, public bucket, `share/list`).

DIAL Core gained project resource events in commit `50b387b8` (epam/ai-dial-core#2179, on Core `development`, unreleased; latest tag `0.49.3`). The facts below were checked in the Core source (`ResourceOperationController.subscribe`, `ResourceTopic`, `ComplexResourceService.publishEvents`, `ShareService`):

- **Request:** `POST /v1/ops/resource/subscribe` with `{"resources":[{"url":"projects/{bucket}/{path}"}]}`. Only exact resource URLs are accepted: a folder URL is a `400`, and there is no prefix or bucket subscription. There is no limit on the number of URLs. One bad URL fails the whole request: `400` for an unsupported type or a folder, `403` for a URL without READ access. Subscribing before the resource exists is allowed.
- **Stream:** `200 text/event-stream`. Each event is a `data: {json}` line with no `event:` or `id:` field. A `: heartbeat` comment arrives about every 60–90 s. Core never ends the stream; it lives until the client closes it.
- **Event:** `ResourceEvent {url, action: CREATE|UPDATE|DELETE, timestamp, etag?, senderPodId, metadata?}`.
  - `url` is URL-encoded and carries the encrypted bucket.
  - `timestamp` is read at publish time. It is not the marker's `updatedAt`, though it differs from it only by milliseconds.
  - `etag` is the aggregate project etag and is absent on `DELETE`.
  - `metadata` is null for projects.
- **Order:** for each write, the project event comes first, then events for changed files under `{project}/files/...`. Unchanged files emit nothing.
- **Events never published:** none for sharing, accepting an invitation or revoking a share; none for grouping folders. A rename is a `CREATE` on the new URL plus a `DELETE` on the old URL, with nothing linking them.
- **Permissions:** READ is re-checked for every event. An event the caller may no longer read is dropped silently and the stream stays open.
- **Rolling upgrades:** pods on an older Core release publish no project events.

The repo already relays one Core resource subscription: the conversation watch (`apps/chat-api/src/conversations/conversation.controller.ts` `watchConversation`, `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts` `watchConversation`). It calls the SDK's `subscribeToResources` with `parseAs: 'stream'`, and the controller relays bytes using `apps/chat-api/src/common/utils/sse.ts` (`startSseResponse`, a 15 s `: keepalive`, `waitForDrain`). The browser reads it with fetch and `getReader()` (`apps/chat/src/server-api/conversations.api.ts` `watchConversation` → `watchConversationRaw`). Bounded reconnect exists only in `apps/chat/src/context/ClientChannelContext.tsx`.

## Goals / Non-Goals

**Goals:**

- Listed projects stay current while the page is open: a newer `updatedAt` re-sorts the card and refreshes its relative time, and a deleted project disappears.
- One Core subscription per open Projects page, closed when the page closes.
- Degrade to today's behaviour without user-visible errors when Core cannot subscribe.

**Non-Goals:** the proposal's non-goals apply: no discovery of unlisted, renamed or newly shared projects, no dates for shared projects in the initial list, no file-level events, nothing for the view page, and no visible "updated" UI.

## Decisions

### D1. The BFF parses Core's stream and emits project-level events by id

`POST /api/v1/projects/watch` opens one `subscribeToResources` call for every requested id. It decodes Core's SSE frames and writes back only the events whose decoded URL equals one of the requested project ids, translated to:

```json
{ "id": "projects/{bucket}/{path}", "action": "UPDATE", "timestamp": 1761560100000, "etag": "\"c3d4…\"" }
```

- **Matching:** the BFF builds a `Map` from each subscribed project id to itself. For an incoming event it applies `safeDecodeURIComponent` and `StringUtils.stripTrailingSlashes` to the URL, the same normalisation `mapSharedProject` in `apps/chat-api/src/projects/projects.mapper.ts` uses, and looks the result up. A miss is dropped. That covers every `/files/...` event and anything unexpected. Because the lookup is exact, the BFF never parses file paths and never forwards Core URLs.
- **Dropped fields:** `senderPodId` and `metadata` are not forwarded.
- **Alternative rejected:** relaying bytes as the conversation watch does. The browser would then need Core's URL encoding and bucket form to map events to cards, and it would receive one event per changed file, which can be hundreds on a re-upload.
- **Cost:** the BFF holds a small frame decoder per stream. It reuses the line rules of the existing readers (CR/LF/CRLF, comment lines, multi-line `data:`) and has a per-frame byte cap.

### D2. Request contract and validation

- **Body:** `WatchProjectsBodyDto { ids: string[] }`.
  - `@ArrayMinSize(1)`, `@ArrayMaxSize(PROJECTS_WATCH_MAX_IDS = 1000)`, and `@ArrayUnique`.
  - Every element is validated with `IsProjectId`, the rule `ProjectIdParamDto` uses (`apps/chat-api/src/projects/dto/project-id-param.dto.ts`), which accepts only what `parseProjectId` (`apps/chat-api/src/projects/utils/project-id.util.ts`) parses. Any failure is a `400` before Core is called.
- **Why POST:** a GET query string cannot carry 1000 ids. POST matches the conversation watch, and the generated client's CSRF middleware adds `X-CSRF-Token`.
- **The cap:** 1000 equals one listing page of a source (`PROJECTS_PAGE_SIZE`). The hook subscribes to at most the first 1000 ids in its current list order. Larger lists are unusual, and their tail stays a snapshot.

### D3. Lifecycle and degradation

- **Before any byte is written:**
  - a Core non-2xx (`400` unsupported type on an older Core, `403` when a project became unreadable between listing and subscribe) is mapped by `handleDialSdkError` to a typed HTTP exception;
  - the BFF logs one `warn` with the status only, never ids or URLs.
- **Once the stream is open:**
  - the BFF writes `: init` and a `: keepalive` every 15 s (`SSE_KEEPALIVE_INTERVAL_MS`), and Core heartbeats are not forwarded;
  - client disconnect aborts the Core request, as the conversation watch does;
  - a drain timeout closes the stream;
  - the stream counts as `SseSubscriptionKind.ProjectsWatch` in `apps/chat-api/src/telemetry/runtime-metrics.ts`.
- **In the hook:**
  - A failure to open (any non-2xx, or a network error) turns live updates off for this page visit. There is no retry loop, so an older Core costs one request per visit.
  - A stream that opened and later ends or errors is reconnected on the `ClientChannelContext` schedule `[1000, 2000, 4000, 8000, 16000]` ms. Live updates stop after the last attempt.
  - **After a successful reconnect, the hook refreshes the list silently.** It keeps showing the current cards and swaps in the new result without the loading state, because events published during the gap are otherwise lost. This is not periodic polling: it happens only after a dropped stream. Any newly listed projects appear then as a side effect.
  - Unmount, `enabled` turning `false`, or a changed id set aborts the stream.

### D4. Applying events (state owned by `useProjects` in `libs/chat-hooks`)

`useProjects` keeps the loaded `ProjectItem[]` and applies events as a pure reducer, `applyProjectEvent(items, event)` in `libs/chat-hooks/src/project/project-events.ts`:

- `UPDATE` or `CREATE` for a listed id: set `updatedAt = max(updatedAt ?? 0, event.timestamp)`, and return the same array when nothing changed. A `CREATE` for a listed id means the project was deleted and re-created at the same URL.
- `DELETE` for a listed id: remove the item.
- Anything for an unlisted id: ignore it.
- Out-of-order events from different Core pods are safe because `updatedAt` only moves forward. A late `UPDATE` cannot bring back a deleted project, because removed ids are no longer listed.

**When the hook resubscribes:** only when the set of listed ids changes through a load, a retry or a silent refresh. A `DELETE` does not resubscribe: the extra URL keeps streaming nothing useful and is closed with the stream. The subscription key is the sorted id list joined into one string, so re-renders with the same set never reconnect.

**Memoisation:** the returned `projects` array keeps its reference until an event changes it. `retry` and the internal refresh are wrapped in `useCallback`.

### D5. Host/lib boundary

- `ProjectsApiClient` gains an optional `watchProjects(ids, signal): Promise<ReadableStream<Uint8Array>>`.
  - `apps/chat/src/server-api/projects.api.ts` implements it with the generated `projectsApi.watchProjectsRaw` and returns `raw.body`, following `conversations.api.ts` `watchConversation`.
  - `apps/chat/src/hooks/projects/projects-client.ts` forwards it.
- `libs/chat-hooks` decodes the frames. The module-private `readSseEvents` moves from `src/conversation/useConversationStream/generation-resume.ts` to an internal `src/shared/read-sse-events.ts`. Both the generation resume and the projects watch import it. It is not added to the package exports.
- For live updates `libs/projects` gains no new prop. (The pin toggle folded in during apply adds `onTogglePin` and `labels.pinLabel`; pinning is done by the app through `UserConfigContext`.) `Projects` takes its `now` snapshot again whenever the `projects` prop reference changes (`useMemo(() => Date.now(), [projects])` instead of `useState`), so a card updated live shows the right relative time. With no events the reference never changes and the behaviour is the same as today.
- No lib constructs `/api` paths, reads flags, or knows about Core.

### D6. Authorization

- **Guards:** the endpoint carries the same guards as the rest of the projects domain. That is the global `SessionGuard` and `CsrfGuard`, plus `FeatureGuard` with `@RequireFeature(FeatureKey.ProjectsEnabled)`, which is also limited by `PROJECTS_ENABLED_ROLES`.
- **Access:** the BFF adds no permission check of its own. Core requires READ on each URL at subscribe time and re-checks it for every event, using the caller's bearer token captured when the stream opened, as the conversation watch does.
- **Token lifetime:** a token that expires mid-stream makes Core drop events. The stream reconnects through `SessionGuard`, which refreshes the token, the next time it drops. This is accepted.

### D7. No cache

There is no new cached data. The page's list stays in component state, and the stream is not shared between tabs: each open Projects page holds its own stream.

## Risks / Trade-offs

- [Core has no release with project events yet] → silent degradation (D3); the `apps/chat-api/README.md` projects section states the minimum Core version once one is tagged.
- [One unreadable project fails the whole subscribe with `403`] → live updates turn off for that visit, and the next load resubscribes with the fresh list. Per-source subscriptions were rejected because they triple the streams and still fail as a whole.
- [Rolling Core upgrade: old pods publish no events] → a missed event leaves that card stale until the next reload. Core documents the gap and does not mitigate it.
- [Long-lived streams per open page] → one Core and one BFF connection per open Projects page. Keepalive and drain bounds come from the existing SSE helpers, and the new metric kind makes the count visible.
- [The event `timestamp` is not the stored `updatedAt`] → it differs by milliseconds. It is only rendered as a relative time and compared with `max`, never used for equality.
- [Proxy idle limits below 15 s] → none known. The keepalive interval is the same as for the existing watch.
- [Shared-project file events may be filtered out by Core's share check] → irrelevant here, because D1 drops all file events.

## Migration Plan

Additive. Deploy the BFF and frontend together; the endpoint is unused until the page calls it. To roll back, revert the change. Hosts without `watchProjects` already behave as before.

## Open Questions

- Should the minimum Core version be enforced (for example by skipping the request when Core reports an older version), or is one failed request per visit acceptable? The design assumes acceptable.
- Once the separate shared-dates change lands, revisit whether a live `UPDATE` for a shared project needs more than the timestamp, such as `author`.
