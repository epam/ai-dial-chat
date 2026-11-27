# Design

## Context

See proposal.md (Why / Problem) for the motivation.

- `toUpstreamSchedulePayload(body, dialCoreUrl, dialApiVersion, serviceId)` in `apps/chat-api/src/scheduled-tasks/scheduled-tasks.mapper.ts` builds the Scheduler body. Its `dialCoreUrl` argument feeds only `properties.url`, through `buildScheduledTaskChatCompletionUrl` (`StringUtils.stripTrailingSlashes(baseUrl) + '/openai'`).
- `ScheduledTasksService.createScheduledTask` and `updateScheduledTask` (`apps/chat-api/src/scheduled-tasks/scheduled-tasks.service.ts`) each call it with `this.dialClient.baseUrl`, `this.dialClient.dialApiVersion` and the Scheduler service id. `dialClient` stays in use after the change: `dialApiVersion` is still passed, and the Scheduler route URLs are built separately by `SchedulerUpstreamClient`.
- `fromUpstreamSchedule` never reads `properties.url`, so read paths (list, get, runs, pause, resume, start, delete) are unaffected.
- `buildScheduledTaskChatCompletionUrl` is used only in the mapper and in `apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.mapper.spec.ts`. `StringUtils` is imported in the mapper only for this helper.
- This change reverses the "URL construction is extracted into buildScheduledTaskChatCompletionUrl" decision in `openspec/changes/archive/2026-08-05-fix-scheduler-chat-completion-payload/design.md`.

Backend conventions follow `apps/chat-api/AGENTS.md`. Nothing in this change touches controllers, DTOs, env or Swagger.

## Goals / Non-Goals

**Goals:**

- Create (POST) and update (PUT) bodies sent to DIAL Scheduler contain no `properties.url`.
- No dead code is left behind: the helper, the parameter and the import go.
- Tests prove that `url` is absent, so a regression cannot add it back silently.

**Non-Goals:**

- No fallback or feature flag that adds `url` back.
- No change to error mapping for Scheduler 4xx/5xx responses.
- No OpenAPI or generated-client change. The public contract never had `url`.

## Decisions

### D1. Drop the parameter instead of ignoring it

The new signature is `toUpstreamSchedulePayload(body, dialApiVersion, serviceId)`.

- *Alternative:* keep `dialCoreUrl` and leave it unused. Rejected: an unused positional string parameter invites someone to wire it back in, and lint flags unused parameters.
- All three callers (the two service methods and one controller test) are updated in the same change, so no compatibility shim is needed.

### D2. Delete `buildScheduledTaskChatCompletionUrl` entirely

The helper has no other use. Keeping it exported would be dead public surface, and the main spec would cite an identifier that still exists but no longer matters. `StringUtils` is still used elsewhere in chat-api, so only the mapper's import is removed.

### D3. Assert absence explicitly in the tests

The full `toEqual` in the mapper test already implies absence. Explicit `expect(payload.properties).not.toHaveProperty('url')` checks are added anyway, for a date trigger and a cron trigger in the mapper spec and for the POST and PUT bodies in the service spec. They state the intent and survive later loosening of the `toEqual` expectations (for example a switch to `toMatchObject`).

### D4. Spec delta uses REMOVED + ADDED for create

OpenSpec rejects a MODIFIED block that drops existing scenarios, in both `validate` and `archive`. The create requirement is therefore removed and re-added under a new name, "Create scheduled task with validated chat_completion body and no upstream url". The new block carries the same text minus the `url` bullet and the two url scenarios, plus a statement that `properties` SHALL NOT contain `url` and the scenario "Upstream properties carry no url". No other spec, doc or code refers to the old requirement name. The update requirement drops no scenario, so it stays MODIFIED.

Trade-off: at archive the re-added requirement moves to the end of `openspec/specs/scheduled-tasks-api/spec.md`. Its long description (carried over verbatim) triggers `openspec validate --strict` length warnings. Plain validation passes.

## Risks / Trade-offs

- **[Scheduler requires `url`]** If DIAL Scheduler rejects a create or update body without `properties.url` (4xx), scheduled-task create and edit break for every user. → Mitigation: verify on a live DIAL Scheduler before merge (see Migration Plan). The existing upstream error mapping (see the "Scheduler error responses carry the upstream reason and code" requirement) surfaces the rejection as a typed error, and no fallback is added. If rejected, do not merge. Revisit the premise in proposal.md (Why) instead.
- **[Old schedules keep a stored `url`]** Schedules created before this change still hold `properties.url` upstream. A PUT without `url` might be rejected, might keep the old value (a merge), or might drop it (a replace). → Mitigation: the live check covers PUT on a pre-existing schedule. Keeping or dropping the stored value are both acceptable as long as the PUT succeeds and the next run still reaches DIAL Core chat completion. A rejection blocks the merge.
- **[Runs target the wrong endpoint]** Scheduler might accept the body but resolve a different target. → Mitigation: the live check confirms that a run actually produces a conversation under `.scheduler/{scheduleId}/{runId}/`.

## Migration Plan

1. Implement and pass unit tests, lint, `openapi:check` (expect no diff) and `validate:specs`.
2. Before merge, against a live DIAL Scheduler on a dev or staging environment: (a) create a schedule, which must be accepted, then trigger a run with `POST /api/v1/scheduled-tasks/:id/run` and confirm a conversation appears; (b) edit a schedule created **before** this change, which must be accepted and must still run. Record the outcome in the PR description. This is a release gate for the reviewer, not a tracked implementation task.
3. Rollback: revert the commit. No data or config migration is needed in either direction.

## Open Questions

- Does DIAL Scheduler keep or discard a previously stored `properties.url` on PUT? The answer does not change the code. It decides only whether old schedules need a follow-up note. The live check in Migration Plan step 2 answers it.
