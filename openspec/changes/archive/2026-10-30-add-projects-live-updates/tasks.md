Slicing strategy: **contract-first, then vertical.**

1. Slice 1 fixes the BFF endpoint and the OpenAPI contract.
2. Slice 2 builds the client plumbing.
3. Slice 3 puts the hook behaviour on top.
4. Slice 4 adjusts the lib's relative time.

Each slice is verifiable on its own. Conventions come from `apps/chat-api/AGENTS.md` (§3 controllers, §5 DTOs, §6 errors, §10 logging, §11 testing).

## 1. BFF: `POST /api/v1/projects/watch`

- [x] 1.1 Add `apps/chat-api/src/projects/dto/watch-projects.dto.ts` with `WatchProjectsBodyDto { ids: string[] }`.
  - Apply `@IsArray`, `@ArrayMinSize(1)`, `@ArrayMaxSize(PROJECTS_WATCH_MAX_IDS)`, `@ArrayUnique`, `@IsString({ each: true })`, and the `IsProjectId({ each: true })` rule `ProjectIdParamDto` uses, with `@ApiProperty` and an example (no `uniqueItems` in the schema: the generator would type `ids` as a `Set`).
  - Put `PROJECTS_WATCH_MAX_IDS = 1000` (and the frame bound) in `apps/chat-api/src/projects/constants/projects-watch.constants.ts`; export `IsProjectId` from `project-id-param.dto.ts` so it can validate each array element.
- [x] 1.2 Add `apps/chat-api/src/projects/dto/project-watch-event.dto.ts`: `ProjectWatchEventDto { id, action, timestamp, etag? }` and the string enum `ProjectWatchAction` (`CREATE`, `UPDATE`, `DELETE`) in `apps/chat-api/src/projects/dto/project-watch-action.enum.ts`, all with `@ApiProperty`.
- [x] 1.3 Add `mapResourceEventToProjectEvent(event, watchedIds: ReadonlyMap<string, string>)` to `apps/chat-api/src/projects/projects.mapper.ts`.
  - Decode and normalise `event.url` with `safeDecodeURIComponent` and `StringUtils.stripTrailingSlashes`, then match it exactly.
  - Return `null` for a miss, a file URL, an unknown action or a missing timestamp.
- [x] 1.4 Add `apps/chat-api/src/projects/watch/projects-watch.service.ts` (`ProjectsWatchService`) and register it in `apps/chat-api/src/projects/projects.module.ts`.
  - It parses each id with `parseProjectId` and builds Core URLs `projects/{bucket}/{encodePlainDialResourcePath(path)}`.
  - It calls `dialClient.client.subscribeToResources` once, with bearer headers, `Accept: text/event-stream`, `parseAs: 'stream'` and the request signal, and maps a non-OK response through `handleDialSdkError` with a single `warn` that carries the status.
  - It yields mapped events from an incremental, size-bounded SSE frame decoder over Core's body.
- [x] 1.5 Add the `watchProjects` handler to `apps/chat-api/src/projects/projects.controller.ts`.
  - Decorators: `@Post('watch')`, `@HttpCode(200)`, `@ApiProduces('text/event-stream')`, `@ApiOperation`, and an `@ApiResponse` for 200/400/401/403, plus 502/503 from `@ApiDialCoreErrors()`.
  - Use `@Res()` with `startSseResponse`, `writeSseChunk`, `waitForDrain` and a 15 s `SSE_KEEPALIVE_PAYLOAD` from `apps/chat-api/src/common/utils/sse.ts`.
  - Abort and clear the timer on `res.on('close')`, mirroring `watchConversation` in `apps/chat-api/src/conversations/conversation.controller.ts`.
  - The class-level `FeatureGuard` and `@RequireFeature(FeatureKey.ProjectsEnabled)` already apply.
- [x] 1.6 Add `ProjectsWatch = 'projects_watch'` to `SseSubscriptionKind` in `apps/chat-api/src/telemetry/runtime-metrics.ts`, track the stream with it, and list the kind in `apps/chat-api/src/telemetry/tests/runtime-metrics.spec.ts`, `docs/observability.md` and the dashboard 03 description.
- [x] 1.7 Unit tests:
  - `apps/chat-api/src/projects/tests/projects.mapper.spec.ts`: an encoded URL, a trailing slash, a file URL dropped, an unknown id dropped, `DELETE` without an etag.
  - `apps/chat-api/src/projects/watch/projects-watch.service.spec.ts`: a single subscribe call with every URL, Core 400 and 403 mapped with one warn, heartbeat comments skipped, frames split across chunks, an oversize frame skipped, abort propagated.
- [x] 1.8 Supertest integration test `apps/chat-api/src/projects/tests/projects-watch.controller.spec.ts`:
  - happy-path SSE body with `: init` and mapped events;
  - validation `400` for empty, 1001, duplicate, traversal and extra-field bodies, with no SDK call;
  - feature guard rejection;
  - Core error before the stream opens;
  - client disconnect aborting the SDK signal.
- [x] 1.9 Contract: run `npm run openapi` and `npm run openapi:check`. Build and lint `chat-api-client` (`npm exec nx build chat-api-client`, `npm exec nx lint chat-api-client`), and confirm `ProjectsApi.watchProjectsRaw` and `WatchProjectsBodyDto` are generated.

**Verification:** `npm run test:file -- apps/chat-api/src/projects/tests/projects.mapper.spec.ts apps/chat-api/src/projects/watch/projects-watch.service.spec.ts apps/chat-api/src/projects/tests/projects-watch.controller.spec.ts`, then `npm run verify:changed`.

## 2. Client plumbing: wrapper, client seam, shared SSE reader

- [x] 2.1 Move the module-private `readSseEvents` from `libs/chat-hooks/src/conversation/useConversationStream/generation-resume.ts` to `libs/chat-hooks/src/shared/read-sse-events.ts`.
  - `generation-resume.ts` imports it from there.
  - Do not add it to `libs/chat-hooks/src/index.ts` or any other entry point.
- [x] 2.2 In `libs/chat-hooks/src/project/projects-api-client.ts`:
  - add the optional `watchProjects?: (ids: string[], signal?: AbortSignal) => Promise<ReadableStream<Uint8Array>>` to `ProjectsApiClient`, with JSDoc;
  - add `ProjectWatchEvent` and `ProjectWatchAction` in `libs/chat-hooks/src/project/project-events.ts`.
- [x] 2.3 Add `watchProjects(ids, signal)` to `apps/chat/src/server-api/projects.api.ts` on `projectsApi.watchProjectsRaw`, rejecting when there is no body, following `watchConversation` in `apps/chat/src/server-api/conversations.api.ts`. Forward it in `apps/chat/src/hooks/projects/projects-client.ts`. `apps/chat/src/server-api/api-client.ts` already exports `projectsApi`.
- [x] 2.4 Architecture guard: confirm `libs/chat-hooks` changes contain no `/api` path, no client construction, no flag, i18n or app context, and that `libs/projects` imports nothing new. Confirm `npm exec nx lint chat-hooks` module-boundary rules pass.
- [x] 2.5 Unit tests:
  - `libs/chat-hooks/src/shared/tests/read-sse-events.spec.ts`: CRLF, comments, multi-line data, split chunks;
  - the existing generation-resume suite still passing;
  - `apps/chat/src/server-api/tests/projects.api.spec.ts`: the wrapper calls `watchProjectsRaw` with the body and signal and rejects without a body.

**Verification:** `npm run test:file -- libs/chat-hooks/src/shared/tests/read-sse-events.spec.ts apps/chat/src/server-api/tests/projects.api.spec.ts libs/chat-hooks/src/conversation/useConversationStream`, then `npm run verify:changed`.

## 3. Hook: apply events, resubscribe, reconnect, degrade

- [x] 3.1 Implement the pure reducer `applyProjectEvent(items, event)` in `libs/chat-hooks/src/project/project-events.ts`. It moves `updatedAt` forward with `max`, removes on `DELETE`, ignores unknown ids, and returns the same reference when nothing changed.
- [x] 3.2 Extend `useProjects` in `libs/chat-hooks/src/project/use-projects.ts`:
  - **Watch:** after a successful load, open `client.watchProjects` for the first `PROJECTS_WATCH_MAX_IDS` ids. Key the effect on the sorted, joined id set, read events through `read-sse-events`, and apply them with `applyProjectEvent`.
  - **Failure to open:** disable live updates for the visit.
  - **Dropped stream:** reconnect on `[1000, 2000, 4000, 8000, 16000]` ms. After a successful reconnect, run a silent reload that keeps `isLoading` `false` and the current list, and keeps the list on failure.
  - **Teardown:** abort on unmount, when `enabled` turns `false`, and on a key change.
  - Update the hook's JSDoc. The app adapter `apps/chat/src/hooks/projects/useProjects.ts` needs no change beyond passing the client.
- [x] 3.3 Unit tests:
  - `libs/chat-hooks/src/project/tests/project-events.spec.ts`: the reducer cases.
  - `libs/chat-hooks/src/project/tests/use-projects.spec.ts`, with fake timers for the backoff:
    - an update moves `updatedAt` forward without reopening the watch;
    - an older event is ignored;
    - a delete removes the item without reopening the watch;
    - an open rejection leaves the state unchanged and is never retried;
    - a dropped stream reconnects with a silent reload (never `isLoading: true`);
    - unmount aborts the watch signal;
    - a client without `watchProjects` behaves as before.

**Verification:** `npm run test:file -- libs/chat-hooks/src/project/tests/project-events.spec.ts libs/chat-hooks/src/project/tests/use-projects.spec.ts`, then `npm run verify:changed`.

## 4. Lib: relative time follows the data

- [x] 4.1 In `libs/projects/src/components/Projects/Projects.tsx`, replace `const [now] = useState(() => Date.now())` with a snapshot recomputed when the `projects` reference changes (`useMemo(() => Date.now(), [projects])`). Update the inline comment.
- [x] 4.2 Test in `libs/projects/src/components/Projects/tests/Projects.spec.tsx`: a rerender with a new `projects` array whose item is updated "now" renders `now` in that card's `<time>`, and a rerender with the same reference keeps the earlier text.
- [x] 4.3 Architecture guard: `libs/projects` still has no stream, fetch, flag or host knowledge, and its README needs no prop change (no public API change).

**Verification:** `npm run test:file -- libs/projects/src/components/Projects/tests/Projects.spec.tsx`, then `npm run verify:changed`.

## 4b. Card: pin marker in the corner (requested during apply)

- [x] 4b.1 In `libs/projects/src/components/ProjectCard/ProjectCard.tsx`, draw the pin marker in the card's top inline-end corner (`absolute inset-e-5 top-5`, inside the `CardShell` padding), keep it after the name in reading order, and keep the first row clear of it with `pe-6`. Update the `libs/projects/README.md` sentence on the marker.

**Verification:** `npm run test:file -- libs/projects/src/components/ProjectCard/tests/ProjectCard.spec.tsx libs/projects/src/components/Projects/tests/Projects.spec.tsx`.

## 4c. Card: pin toggle on the list (requested during apply)

- [x] 4c.1 Add `onTogglePin?: (id, isPinned) => void` to `ProjectsProps` and `pinLabel?` (default `'Pin'`) to `ProjectsLabels` in `libs/projects/src/models/projects-props.ts`, forward them through `Projects` to `ProjectCard`, and render a `GhostIconButton` toggle (`aria-pressed`, above the stretched link, unpinned hidden until hover/focus where hover exists) instead of the static marker when the callback is given. Document both in `libs/projects/README.md`.
- [x] 4c.2 In `apps/chat/src/pages/ProjectsPage/ProjectsPage.tsx`, pass `onTogglePin` through `UserConfigContext` `setPinnedProject` (optimistic, rolled back on failure), report a failure with `ProjectsI18nKeys.ActionsPinError`, and pass `pinLabel: t(ButtonsI18nKeys.Pin)`; no new i18n keys.

**Verification:** `npm run test:file -- libs/projects/src/components/ProjectCard/tests/ProjectCard.spec.tsx apps/chat/src/pages/ProjectsPage/tests/ProjectsPage.spec.tsx`.

## 5. Docs and close-out

- [x] 5.1 Update `docs/architecture.md`:
  - add `POST /api/v1/projects/watch` to the projects endpoint table;
  - in the "SSE streaming" section, add the projects watch: the BFF parses Core frames, unlike the conversation watch's byte relay, and keeps the 15 s keepalive.
- [x] 5.2 Update the projects section of `apps/chat-api/README.md`: the watch endpoint, the dependency on DIAL Core with project resource events (commit `50b387b8`, after `0.49.3`), and the silent degradation on older Core.
- [x] 5.3 Update the `ProjectsApiClient` / `useProjects` sections of `libs/chat-hooks/README.md` to cover the optional `watchProjects` and the live-update behaviour.
- [x] 5.4 Run `npm run validate:docs`, `npm run validate:specs` and `npm run spec:impact`.
- [x] 5.5 Run `npm run verify:full` once, and `npm run build:quiet` because the BFF bundle and the generated client change.

## 6. Follow-ups (out of scope, not tasks of this change)

- Separate change: shared projects get `createdAt`/`updatedAt` in the initial list (one metadata read per `share/list` entry with bounded concurrency in `ProjectsService.listSharedProjects`), and the temporary debug logging there is removed.
- Ask DIAL Core for:
  - a share/invitation change event or a prefix subscription, so new and newly shared projects can appear live;
  - a fix and a test for item-level shares filtering `/files/...` events (`ShareService.lookupPermissions` parent walk).
