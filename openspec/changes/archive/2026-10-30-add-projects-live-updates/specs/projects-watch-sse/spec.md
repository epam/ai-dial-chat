## ADDED Requirements

### Requirement: POST /api/v1/projects/watch streams project-level DIAL Core events as SSE

The backend SHALL expose a versioned endpoint in the projects domain (`apps/chat-api/src/projects/projects.controller.ts`, handler `watchProjects`):

| Field | Value |
|---|---|
| Method | `POST` |
| Path | `/api/v1/projects/watch` |
| Auth | global `SessionGuard` and `CsrfGuard`, plus `FeatureGuard` with `@RequireFeature(FeatureKey.ProjectsEnabled)` (roles from `PROJECTS_ENABLED_ROLES`) |
| Request content type | `application/json` |
| Response content type | `text/event-stream` (`@ApiProduces('text/event-stream')`) |

**Request body (`WatchProjectsBodyDto`, `apps/chat-api/src/projects/dto/watch-projects.dto.ts`):**

```json
{ "ids": ["projects/a1b2c3/marketing/q4-launch", "projects/public/handbook"] }
```

**Success response:** `200`. The stream opens with the `: init` comment and carries a `: keepalive` comment every 15 seconds. Each event is one `data:` line holding a `ProjectWatchEventDto` (`apps/chat-api/src/projects/dto/project-watch-event.dto.ts`):

```text
: init

data: {"id":"projects/a1b2c3/marketing/q4-launch","action":"UPDATE","timestamp":1761560100000,"etag":"\"c3d4\""}

: keepalive

data: {"id":"projects/public/handbook","action":"DELETE","timestamp":1761560300000}
```

`action` is the `ProjectWatchAction` string enum (`CREATE`, `UPDATE`, `DELETE`). `etag` is absent on `DELETE`.

**Error responses** (each documented with `@ApiResponse`):

| Status | When |
|---|---|
| `400` | The body fails validation, or Core rejects the subscription as unsupported |
| `401` | No valid session |
| `403` | The feature is off for the caller (`FeatureGuard`), or Core denies READ on one of the URLs |
| `502` | Core answered with an unexpected error or no stream body |
| `503` | Core is unreachable |

**Generated client:** operationId `watchProjects`, request DTO `WatchProjectsBodyDto`. Frontend callers use `projectsApi.watchProjectsRaw` and read `raw.body`, because the generated client does not parse SSE.

#### Scenario: Owner edits a listed project

- **WHEN** the caller watches `projects/a1b2c3/marketing/q4-launch`, and Core publishes an `UPDATE` for `projects/a1b2c3/marketing/q4-launch` followed by an `UPDATE` for `projects/a1b2c3/marketing/q4-launch/files/brief.md`
- **THEN** the BFF writes exactly one `data:` event, `{"id":"projects/a1b2c3/marketing/q4-launch","action":"UPDATE",…}`, and drops the file event

#### Scenario: Core sends a URL-encoded resource URL

- **WHEN** Core publishes an event whose `url` is the URL-encoded form of a watched id, possibly with a trailing `/`
- **THEN** the BFF decodes and normalises it the same way `mapSharedProject` does, matches the watched id, and emits that id

#### Scenario: Core heartbeats are not forwarded

- **WHEN** Core sends `: heartbeat` comment lines
- **THEN** no `data:` event is written for them, and the BFF's own 15-second `: keepalive` continues

### Requirement: The watch request is validated before DIAL Core is called

`WatchProjectsBodyDto.ids` SHALL be a non-empty array of unique strings, at most `PROJECTS_WATCH_MAX_IDS` (1000) long. Each id SHALL pass the same `IsProjectId` rule as `ProjectIdParamDto` (`apps/chat-api/src/projects/dto/project-id-param.dto.ts`), that is, be accepted by `parseProjectId` (`apps/chat-api/src/projects/utils/project-id.util.ts`). Any violation SHALL produce `400` without a Core call. The Core resource URL is built only from the parsed `bucket` and `path`, with `encodePlainDialResourcePath`, because both come from an already decoded id.

#### Scenario: Empty ids are rejected

- **WHEN** the body is `{ "ids": [] }`
- **THEN** the response is `400`, and `subscribeToResources` is not called

#### Scenario: Too many ids are rejected

- **WHEN** the body carries 1001 ids
- **THEN** the response is `400`

#### Scenario: Path traversal is rejected

- **WHEN** an id is `projects/a1b2c3/../other/secret`
- **THEN** the response is `400`, and `subscribeToResources` is not called

#### Scenario: Unknown body fields are rejected

- **WHEN** the body carries an extra `url` field
- **THEN** the global `ValidationPipe` (`forbidNonWhitelisted`) responds `400`

### Requirement: The BFF subscribes once per request through the SDK and owns the stream lifecycle

`ProjectsWatchService` (`apps/chat-api/src/projects/watch/projects-watch.service.ts`) SHALL call `DialClientService.client.subscribeToResources` exactly once per request, with all requested URLs. It passes the caller's bearer headers, `Accept: text/event-stream`, `parseAs: 'stream'`, and an `AbortSignal` tied to the client connection. It SHALL decode Core's SSE frames incrementally (CR, LF and CRLF line endings, comment lines, multi-line `data:`) with a bounded per-frame size. A malformed frame or a non-JSON payload is skipped and logged at `debug`.

The controller SHALL open the response with `startSseResponse`, write events with `writeSseChunk` and `waitForDrain`, and write `SSE_KEEPALIVE_PAYLOAD` every `SSE_KEEPALIVE_INTERVAL_MS`. These helpers come from `apps/chat-api/src/common/utils/sse.ts`. Its lifecycle SHALL work as follows:

- When the client disconnects, the BFF aborts the Core request and clears the keepalive timer.
- When Core ends the stream or errors after the response has opened, the BFF ends the response.
- When a drain times out, the BFF closes the stream.
- The stream is counted with `trackSseSubscription(SseSubscriptionKind.ProjectsWatch)` in `apps/chat-api/src/telemetry/runtime-metrics.ts`.

Logs carry the outcome, the status and the id count, never ids, URLs, tokens or event payloads.

#### Scenario: Client disconnect closes the Core subscription

- **WHEN** the browser aborts the request while the stream is open
- **THEN** the `AbortSignal` passed to `subscribeToResources` is aborted, and the keepalive timer is cleared

#### Scenario: Older Core rejects project subscriptions

- **WHEN** Core answers the subscribe call with `400` ("resource type is not supported")
- **THEN** no SSE headers are sent, the response is `400` mapped by `handleDialSdkError`, and one `warn` with the status is logged

#### Scenario: A project became unreadable

- **WHEN** Core answers `403` because one requested URL lacks READ access
- **THEN** the response is `403`, and no stream is opened

### Requirement: The frontend watches the listed projects through the generated client

`apps/chat/src/server-api/projects.api.ts` SHALL export `watchProjects(ids: string[], signal?: AbortSignal): Promise<ReadableStream<Uint8Array>>`. It calls `projectsApi.watchProjectsRaw({ watchProjectsBodyDto: { ids } }, { signal })` and rejects when the response has no body. `apps/chat/src/hooks/projects/projects-client.ts` SHALL forward it as `ProjectsApiClient.watchProjects`, which `libs/chat-hooks/src/project/projects-api-client.ts` declares as optional.

`libs/chat-hooks` SHALL decode the stream with an internal SSE reader at `libs/chat-hooks/src/shared/read-sse-events.ts`. The former module-private `readSseEvents` of `libs/chat-hooks/src/conversation/useConversationStream/generation-resume.ts` moves there, and both callers use it. The reader is not exported from the package entry points. Each `data:` payload is parsed into a `ProjectWatchEvent`. A payload without a string `id`, a known `action` and a numeric `timestamp` is ignored.

#### Scenario: Wrapper returns the raw stream

- **WHEN** `watchProjects(['projects/public/handbook'], signal)` is called
- **THEN** `projectsApi.watchProjectsRaw` is called once with that body and signal, and the response body stream is returned

#### Scenario: A host without watch support

- **WHEN** a `ProjectsApiClient` without `watchProjects` is passed to `useProjects`
- **THEN** no watch is attempted, and the hook behaves exactly as before this change

### Requirement: Live updates add no new UI surface

Live updates SHALL reuse the existing Projects page UI unchanged:

- **i18n:** they introduce no user-visible strings and no i18n keys.
- **RTL:** none. No new markup or icons are added, so there is nothing to mirror.
- **Accessibility:** no announcement is made per event. When a `DELETE` changes the number of listed projects, the existing visually hidden status region (`LiveRegion` in `Projects`) announces the new `labels.resultCountLabel(count)`, as it does for any count change. Re-sorting a card does not move keyboard focus.
- **Gating:** live updates fall under the existing `projectsEnabled` feature (`PROJECTS_ENABLED`, `PROJECTS_ENABLED_ROLES`). No new flag is added.
- **Telemetry:** the BFF metric `SseSubscriptionKind.ProjectsWatch` (`projects_watch`) is the only one added; the frontend adds no analytics events.
- **Caching:** no cache is introduced. Each open Projects page holds its own stream and list state.

#### Scenario: Remote delete announces the new count

- **WHEN** three projects are listed and a `DELETE` for one of them arrives
- **THEN** the status region text changes to the two-project count, and no other region or toast appears
