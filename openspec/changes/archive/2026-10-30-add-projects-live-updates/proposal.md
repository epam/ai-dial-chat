## Why

The Projects page (`/projects`) is a snapshot: it loads `GET /api/v1/projects` once and never changes until the user reloads or presses Retry. When a project is edited in another tab, by its owner, or through a shared copy, the card keeps its old "last updated" time and its old position under the default **Newest** sort, and a deleted project stays on screen until the next reload. DIAL Core now publishes resource events for projects (`POST /v1/ops/resource/subscribe`, Core commit `50b387b8`, PR epam/ai-dial-core#2179), so the page can follow changes to the projects it shows instead of going stale.

## What Changes

- **New BFF stream `POST /api/v1/projects/watch`** behind the existing `projectsEnabled` feature guard. The body names the project ids the page shows; the BFF opens one Core resource subscription for their URLs and streams back project-level events (`UPDATE`, `CREATE`, `DELETE`) keyed by project id, with the event time and etag. Events for files inside a project are dropped in the BFF. It follows the conversation watch relay (`apps/chat-api/src/conversations/conversation.controller.ts:453`, `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts:296`), except that the BFF parses Core's frames instead of relaying bytes, because only the BFF knows how a Core resource URL maps to a project id.
- **`useProjects` follows the stream.** After a successful load it opens the watch for the ids it has. An `UPDATE` or `CREATE` for a listed project moves that card's `updatedAt` forward. A `DELETE` removes the card. The hook resubscribes when its id set changes, reconnects with a bounded backoff when an open stream drops, and refreshes the list silently (no spinner) after a reconnect so that events missed during the gap are not lost.
- **Silent degradation.** If Core rejects the subscription (a Core release without project events answers `400`, and a project the caller can no longer read makes Core answer `403` for the whole request) or the stream cannot be opened, the page behaves exactly as today. Nothing is shown to the user, and no feature flag is added.
- **Folded in during apply, on request.** Two Projects-page changes were made in the same branch and are specified here so the main spec stays true:
  - the list page now follows the Figma frames `1:1396`, `1:1462`, `1:2973` and `1:3020` ("DIAL Chat 2.0 — Projects"): `dial-h1-text` title, accent sort control, a one-row mobile toolbar, a visually hidden title and a floating **New project** button on mobile;
  - the pin sits in a card's top inline-end corner, and with the new optional `onTogglePin` it is a toggle that pins and unpins from the list through `UserConfigContext`.
- **Relative times stay true.** The `Projects` lib takes its "now" snapshot whenever its `projects` prop changes instead of only at mount. Otherwise a card updated live would read "now" for the rest of the visit.

### Non-goals

- **Discovering projects the page did not list.** Core accepts exact resource URLs only (a folder or bucket URL is a `400`), and sharing, accepting an invitation or revoking a share publishes no event. So a project created in another tab, shared with the user, or renamed (Core sends `DELETE` for the old URL and `CREATE` for the new one, with nothing linking them) appears only after a reload or Retry. Periodic polling and refetching on tab focus were considered and rejected for this change.
- **Dates of shared projects in the initial list.** Core's `share/list` returns no `createdAt` or `updatedAt`, so shared cards start undated. That is fixed in a separate change. Until then a shared card gains a date from its first live `UPDATE`.
- File-level changes, the project view page (`/projects/:id`) and project conversations.
- Toasts, badges or any visible "updated" marker.

## Alternatives considered

| Option | Correctness | Cost | Verdict |
| --- | --- | --- | --- |
| A. Do nothing (baseline) | Stale until reload | None | Rejected: this is the defect. |
| B. Poll `GET /api/v1/projects` every N seconds while visible | Catches everything, including new projects, with N seconds of lag | One three-source Core listing per user every N seconds, even when nothing changed | Rejected: the load grows with users, not with changes. |
| C. Relay Core's SSE bytes to the browser, as the conversation watch does | Same as D | Leaks Core resource URLs (encrypted bucket, URL encoding) and every file event to the browser, and puts the URL-to-id mapping in the frontend | Rejected: the mapping is BFF knowledge. |
| **D. BFF parses the Core subscription and emits project-level events by id** | Covers edits and deletes of listed projects; new or renamed projects need a reload | One long-lived Core stream per open Projects page | **Picked.** |

## Capabilities

### New Capabilities

- `projects-watch-sse`: the `POST /api/v1/projects/watch` BFF endpoint (request validation, the Core subscription, mapping and filtering events, keepalive, lifecycle, degradation) and the frontend client that consumes it.

### Modified Capabilities

- `projects-page-ui`: the "app owns project data through useProjects" requirement gains live updates (apply events, resubscribe, reconnect with a silent refresh, degrade). The card requirement changes to compute relative times from a snapshot that refreshes when the projects change, and to place the pin marker, or the pin toggle, in the card's top inline-end corner. The mobile-first layout requirement and the New project requirement change to the Figma mobile layout (one-row toolbar, visually hidden title, floating New project button).

## Impact

- **BFF (`apps/chat-api`):** the `projects` domain gets a watch endpoint, a request DTO, an event mapper next to `projects.mapper.ts`, and a new `SseSubscriptionKind`. It reuses `common/utils/sse.ts` and the SDK's `subscribeToResources` (installed `@epam/ai-dial-typescript-sdk` `0.2.0-dev.15` already has it). The OpenAPI document changes, and `libs/chat-api-client` is regenerated.
- **Frontend:**
  - `apps/chat/src/server-api/projects.api.ts` and `apps/chat/src/hooks/projects/projects-client.ts` gain `watchProjects`.
  - `libs/chat-hooks/src/project/projects-api-client.ts` and `use-projects.ts` get the optional `watchProjects` and the event handling.
  - `libs/projects/src/components/Projects/Projects.tsx` refreshes its `now` snapshot.
  - **Scope flag (shared lib):** `libs/chat-hooks` gets an internal SSE frame reader, moved out of the module-private `readSseEvents` in `src/conversation/useConversationStream/generation-resume.ts` so both callers share it. It is not exported from the package.
- **Library isolation:** `libs/projects` stays presentational. It still receives `ProjectItem[]` and knows nothing about streams. Its only new props are `onTogglePin` and `labels.pinLabel`; pinning itself stays in the app (`UserConfigContext`). `libs/chat-hooks` accepts the already-configured client and never builds a URL. The `/api/v1/projects/watch` path lives only in the generated client and `apps/chat/src/server-api`.
- **DIAL Core dependency:** live updates need a Core build that contains `50b387b8`. It is on Core `development` and not yet in a release (latest tag `0.49.3`). Older Core degrades as described above. During a rolling Core upgrade, pods on the old release publish no project events. Core documents this gap and does not mitigate it.
- **i18n:** no new keys. The pin toggle reuses `buttons.pin` and `projects.actions.pinError`.
- **Docs:** `docs/architecture.md` (projects endpoint table, SSE streaming section), `docs/observability.md` (the `projects_watch` metric kind), `apps/chat-api/README.md` (projects endpoints and the minimum Core version), `libs/chat-hooks/README.md` (live updates) and `libs/projects/README.md` (pin toggle, mobile layout, colour and typography defaults).
- **Rollback and compatibility:** additive and non-breaking. The new endpoint is optional for clients: a host whose `ProjectsApiClient` has no `watchProjects` keeps today's behaviour. Reverting the change removes the endpoint and the hook branch, with no data migration.

## Acceptance criteria

- Editing a listed project (for example adding a context file) from another tab moves its card's relative time to "now" within a few seconds, and under **Newest** it moves to the top, without a reload.
- Deleting a listed project elsewhere removes its card. The status region announces the new count.
- Against a Core without project events, the page loads and works as today. The browser console shows no unhandled errors, and the BFF logs one warning per page visit.
- Unmounting the page closes the BFF stream and the Core subscription (proved by a test on the abort path).
- The BFF rejects a body with no ids, too many ids, or an id that is not a project id (including path traversal) with `400`, and never calls Core for it.
- `npm run openapi:check`, `npm run validate:docs` and `npm run validate:specs` pass. The `chat-api`, `chat-hooks`, `projects` and `chat` lint, test and typecheck targets pass.
