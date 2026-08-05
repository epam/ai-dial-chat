## Context

Iteration 1 shipped the Scheduled Tasks list shell (`ROUTES.ScheduledTasks`, `libs/scheduled-tasks`'s `ScheduledTasks` component) behind `scheduledTasksEnabled`. The list's **New task** button is still a no-op (`ScheduledTasksPage.tsx:40`).

The companion change `add-scheduled-tasks-api` defines the BFF create contract consumed by this change:

```typescript
// BFF POST /api/v1/scheduled-tasks body (camelCase)
{
  displayName: string;
  trigger: { date: string } | { cron: { fields: Record<string, string> } };
  model: string;      // deployment id
  prompt: string;     // → properties.payload.messages[0].content
  stream?: boolean;   // default true
}
```

Upstream mapping (`service_id: dial-oauth`, `target_type: chat_completion`, fixed `properties.url` / `api_version`) stays server-side — the form never collects those fields.

Navigation and `returnUrl` handling follow `ToolsetEditor` / `AppsEditor`. The form layout is pattern-aligned with existing editors (single-step header, `@epam/ai-dial-kit` inputs).

## Goals / Non-Goals

**Goals:**

- Wire **New task** → `/scheduled-tasks/new?returnUrl=...` and implement a create form whose fields match `CreateScheduledTaskBodyDto`.
- Map schedule UX (once vs recurring + time) to `trigger.date` or `trigger.cron.fields` in `ScheduledTaskCreatePage` — not inside the lib.
- On valid submit, call `createScheduledTask()` from `apps/chat/src/server-api/scheduled-tasks.api.ts`; success → toast + navigate to `returnUrl`; failure → error notification, stay on form.
- Keep `libs/scheduled-tasks` free of routing, i18n, API, deployments context, and feature-flag imports.

**Non-Goals:**

- Edit flow (`/scheduled-tasks/:id/edit`) — separate change (will reuse form component with `PUT`).
- List cards or populating the list after create — list shell still shows empty state until a list-data change lands.
- Pause/resume/delete, credentials/OBO sign-in flows.
- `target_type: rest | responses` or `service_id: dial-api-key`.
- Pixel-perfect visual parity with a dedicated create mock — deferred; layout follows existing editor patterns.

## Decisions

### Route shape: nested `/scheduled-tasks/new` (unchanged)

Single-step create nested under the list IA. Rejected alternatives: flat `/scheduled-task-editor` (overkill for one step), modal over list (harder to extend).

### Single-step header, not multi-step `EditorHeader`

Same decision as before: title + Cancel + Create, no `DialSteps` nav.

### Form fields aligned with BFF DTO (replaces placeholder name/description/schedule)

| Form field | BFF field | Notes |
|------------|-----------|-------|
| Display name | `displayName` | Required; reuse `EditorI18nKeys.NameLabel` / `NameRequired` |
| Schedule type | drives `trigger` shape | `once` → datetime picker; `recurring` → frequency + time |
| Run at (once) | `trigger.date` | ISO 8601 built in page from date + time inputs |
| Frequency (recurring) | `trigger.cron.fields` | Daily / Weekly / Monthly — see mapping below |
| Time (recurring) | part of cron fields | `hour`, `minute` from `HH:mm` |
| Day of week (weekly only) | `trigger.cron.fields.day_of_week` | Required when frequency is Weekly |
| Day of month (monthly only) | `trigger.cron.fields.day` | Required when frequency is Monthly; default `*` if product prefers "every day of month" — use explicit day picker per UX |
| Model | `model` | Deployment picker; options from `useDeployments()` at app edge, passed as `{ id, label }[]` prop |
| Prompt | `prompt` | Required textarea |
| Stream | `stream` | Toggle, default `true`; visible in the form |

**Removed:** `description` — not in `CreateScheduledTaskBodyDto`; do not collect or send.

### Cron mapping (app edge, `ScheduledTaskCreatePage`)

Page helper converts form values → BFF `trigger`:

- **Once:** `{ date: new Date(runAtLocal).toISOString() }` (must be in the future — validate client-side).
- **Daily** at `09:00`: `{ cron: { fields: { hour: '9', minute: '0' } } }`
- **Weekly** Monday at `09:00`: `{ cron: { fields: { day_of_week: '1', hour: '9', minute: '0' } } }` — exact day numbering MUST be confirmed against scheduler OpenAPI during implementation; document the chosen convention in code comment.
- **Monthly** on day 15 at `09:00`: `{ cron: { fields: { day: '15', hour: '9', minute: '0' } } }`

If upstream rejects a cron field name, fix the mapper in the page (or a small `apps/chat/src/utils/scheduled-task-trigger.ts` helper) without changing the lib.

### Submit: real API call (replaces UI-only toast)

`ScheduledTaskCreatePage.handleSubmit`:

1. Validate all required fields + trigger mapping.
2. Set `isSubmitting = true`.
3. `await createScheduledTask({ displayName, trigger, model, prompt, stream })` from `server-api`.
4. On success: `showNotification` success + `navigate(returnUrl)`.
5. On failure: `showNotification` error (use API message when present) + `isSubmitting = false`, preserve form values.

No optimistic list update.

### Model picker at app edge

`useDeployments()` (or existing deployment list hook used by catalog/model selector) resolves `{ id, displayName }[]` in the page and passes `modelOptions` + `selectedModelId` into the lib as props. Lib renders a `DialDropdown` or select pattern — no deployment fetch inside lib.

### Component contract

`ScheduledTaskCreateForm` props (lib):

- `texts`, `values`, `errors`, `modelOptions`, `onFieldChange`, `onCancel`, `onSubmit`, `isSubmitting?`, optional `styles`
- `values`: `{ displayName, scheduleType, runAt?, frequency?, time, dayOfWeek?, dayOfMonth?, modelId, prompt, stream }`
- Create disabled when `isSubmitting` or required fields invalid (page can also disable via validation before enabling button)

### Dependency on `add-scheduled-tasks-api`

This change MUST NOT merge until:

- `POST /api/v1/scheduled-tasks` is implemented and feature-gated
- `npm run openapi && npm run openapi:check` pass
- `apps/chat/src/server-api/scheduled-tasks.api.ts` exports `createScheduledTask`

List/get/update endpoints from the same API change are not required for this form slice.

## Risks / Trade-offs

- **Cron field names may differ from Postman examples** → mapper isolated in app utils; confirm against live scheduler OpenAPI before merge.
- **Create succeeds but list still empty** → expected until list-data UI change; success copy should not imply the card appears immediately.
- **OBO consent may be missing** → schedule may fail at run time, not at create; out of scope — optional info callout deferred.

## Migration Plan

Additive: new route, lib component, i18n keys, one handler change on list page, server-api consumer. Rollback reverts create UI only.

## Open Questions

- Exact `day_of_week` numbering in scheduler cron (0–6 vs 1–7, Sunday vs Monday start) — resolve from scheduler `openapi.json` during implementation.
- Whether the create form should expose **Stream** as a visible toggle or hide it with default `true` — **Resolved:** visible toggle shipped with default `true`.
