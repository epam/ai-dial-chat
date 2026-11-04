## MODIFIED Requirements

### Requirement: The frontend watches the listed projects through the generated client

`apps/chat/src/server-api/projects.api.ts` SHALL export `watchProjects(ids: string[], signal?: AbortSignal): Promise<ReadableStream<Uint8Array>>`. It calls `projectsApi.watchProjectsRaw({ watchProjectsBodyDto: { ids } }, { signal })` and rejects when the response has no body. `apps/chat/src/hooks/projects/projects-client.ts` SHALL forward it as `ProjectsApiClient.watchProjects`, which `libs/chat-hooks/src/project/projects-api-client.ts` declares as optional.

`libs/chat-hooks` SHALL decode the stream with an internal SSE reader at `libs/chat-hooks/src/shared/read-sse-events.ts`. The former module-private `readSseEvents` of `libs/chat-hooks/src/conversation/useConversationStream/generation-resume.ts` moves there, and both callers use it. The reader is not exported from the package entry points.

Each `data:` payload is parsed into a `ProjectWatchEvent` (`libs/chat-hooks/src/project/project-events.ts`), which is `Pick<ProjectWatchEventDto, 'id' | 'action' | 'timestamp' | 'etag'>`:

- A payload without a string `id`, a known `action` and a numeric `timestamp` is ignored.
- `etag` is kept when it is a string and left out otherwise. `applyProjectEvent` ignores it.

The connect / read / reconnect loop SHALL live in one internal helper, `runProjectWatch` (`libs/chat-hooks/src/project/project-watch-stream.ts`), which is not exported from the package entry points. It takes the client's `watchProjects`, the ids, an `AbortSignal`, an event handler and an `onReconnected` callback. It applies the policy below, and both `useProjects` and `useProjectWatch` (see the `project-view-live-updates` capability) use it:

- the `WATCH_RECONNECT_DELAYS_MS` backoff;
- `onReconnected` after a successful reopen;
- unavailable for the visit after a failed first open, or after the delays are exhausted.

The Projects page behaves exactly as before.

#### Scenario: Wrapper returns the raw stream

- **WHEN** `watchProjects(['projects/public/handbook'], signal)` is called
- **THEN** `projectsApi.watchProjectsRaw` is called once with that body and signal, and the response body stream is returned

#### Scenario: A host without watch support

- **WHEN** a `ProjectsApiClient` without `watchProjects` is passed to `useProjects`
- **THEN** no watch is attempted, and the hook behaves exactly as before this change

#### Scenario: Event etag is kept

- **WHEN** the payload `{"id":"projects/a/p","action":"UPDATE","timestamp":1,"etag":"\"c3d4\""}` is parsed
- **THEN** the event's `etag` is `"c3d4"` with its quotes

#### Scenario: One reconnect policy for both hooks

- **WHEN** the stream of `useProjects` or of `useProjectWatch` drops and the reopen succeeds
- **THEN** each calls its own silent refresh once, through the same `runProjectWatch` helper
