## Context

Scheduled tasks reuse the existing completion payload, skill catalog, and deployment capabilities. The BFF adapts task DTOs to the external Scheduler; task execution belongs to Scheduler, with the existing offline-credentials identity.

Reusable validation and form presentation live in `scheduled-tasks`, checked request preparation and reverse mapping in `chat-hooks`, and skill selection in `skills`. App adapters provide deployment data, feature flags, translations, catalog content, and metadata. The `scheduled-tasks-reuse-contract` specification defines these ownership boundaries.

The change extends create, edit, detail, and conversation-summary surfaces with one optional skill while preserving recurrence, authentication, and instruction-only tasks.

## Goals / Non-Goals

**Goals:** One optional skill across create, edit, detail, reusable summary, persistence, and execution; shared validation matching chat; public library APIs usable by external hosts; instruction-only compatibility.

**Non-goals:** Multiple skills, new contexts/endpoints, skill management, changing schedule timing or offline authentication, replacing Scheduler, and a general redesign of chat selection.

## Decisions

### 1. Use the ordinary completion skill contract

A scheduled task carries one selected skill in the first user message of its completion payload:

```text
Scheduled task skillUrl
  -> Scheduler properties.payload.messages[0].custom_content.skills[0].url
  -> ordinary DIAL completion user-message custom_content.skills[0].url
```

Scheduler preserves the message-level extension in storage and detail responses and forwards it when executing the task. Instructions stay in the same message's `content`; a skill-only task uses `content: ""` without synthetic instructions. Replacing the completion payload without the extension removes the saved skill.

Execution uses the existing offline-credentials identity to access the skill resource. No separate skill execution API, Quick App configuration, or local task worker is introduced.

### 2. Put reusable behavior in existing libraries

| Owner | Responsibility / public contract |
| --- | --- |
| `libs/chat-shared` | Pure `isSkillSelectionUnsupported(skillUrl, isSkillsSupported)` helper: a nonempty selected reference requires explicit `true`. No deployment types, flags, lookup, or translated text. |
| `libs/skills` | Controlled `SkillSelectorField`: `value?: string`, `onChange(value: string \| undefined)`, `displayName?`, `isSkillsSupported`, `isDisabled?`, `isInvalid?`, `labelledById`, `describedById?`, translated `labels`, and `renderCatalogContent(onSelect, onClose)`. Accept host-resolved `favorites`, favorite/details callbacks, and an optional `renderOverlay` for mobile presentation. Own only popup visibility/focus and the search query. Reuse `SkillCatalogModal`; leave catalog data/lookup to the host. Export types and normal per-instance style hooks. |
| `libs/skills` existing hook | Use the same predicate with `selectedSkillId`, keeping its public API and enabled-flow behavior. Do not tie compatibility to catalog loading; preserve an unresolved selection with a fallback chip. |
| `libs/scheduled-tasks` | Optional opaque `skillSelector`, `skillLabelId`, `skillErrorId`, optional `labels.skillLabel`, `values.skillUrl?: string`, and `errors.skillUrl?: string`. The library owns field label/error markup and the minimum save guard. The host supplies the same label/error IDs to the selector. |
| `libs/scheduled-tasks/validation` | Add `isSkillsSupported?: boolean` to validation options, `SkillUnsupported` and `InstructionsOrSkillRequired` string-enum codes. When a skill exists, omitted/false support fails closed. Existing instruction-only callers need no new option. |
| `libs/chat-hooks/scheduled-tasks` | Extend existing checked preparation and DTO/form mapping. Preserve skill references independently of catalog resolution. Reuse configured-client signatures and normal generated methods. |
| `apps/chat` | Read feature/deployment/skill contexts, resolve display values, inject catalog rendering, translate codes, configure API clients, handle routing/errors. A small `ScheduledTaskSkillField` adapter wires the reusable field. Existing pages retain draft/error/submission state. |
| `apps/chat-api` | Validate authoritative model/agent capabilities and adapt DTOs to the external Scheduler payload. |

This avoids both an app-only control that consumers must copy and a scheduler library that imports catalog/deployment integration. `skills` does not depend on `scheduled-tasks`; the latter does not depend on `skills`. The small shared predicate avoids a UI import in validation. Follow `AGENTS.md` Library isolation, `.claude/rules/libs.md`, and `.claude/rules/lib-styling.md`; no new exception, package, or global provider is needed.

The selector's selected value is always the form draft's URL. Do not synchronize two selection stores using effects or hydrate the current uncontrolled chat hook as a second source. The field uses the same UI-kit Input as the model/agent selector. It opens a searchable favorites dropdown; Browse opens the existing skills-only catalog. The task-form adapter supplies resolved favorites and the favorite toggle callback, omits the optional details callback to hide the hover tooltip and View details action, and composes the same panel in the existing mobile bottom-sheet shell through `renderOverlay`. The trailing clear action removes selection without opening a popup. Removal is an explicit keyboard/touch-accessible button. Saved values can display immediately, before metadata loads.

### 3. One content rule and immediate capability feedback

Required name/model/schedule checks remain. Valid content is `prompt.trim()` or a nonempty skill URL. A selected skill requires the selected deployment's `features.skillsSupported === true`, for both models and agents. Clearing instructions is allowed with a skill; removing the last skill makes blank instructions invalid again.

The application resolves support for **the draft model ID**, not chat's globally selected model. Loading/missing capability is not permission to save with a skill. Recompute the skill error on model/skill/capability changes, using shared validation; use the same options in final checked preparation. Pass the localized error to the field and the form. The form disables save for that error and empty content, and submit handlers independently refuse invalid writes. Do not clear a selected skill on model changes.

Retain a server skill error across unrelated rerenders. Clear it when deployment support changes, then apply current local capability validation. When support becomes true, the user can retry without changing the selected model or losing draft values; false or unresolved support continues to block saving. This behavior also applies when the selector is hidden by the feature flag.

The exact shared unsupported message remains: `Selected model does not support skills. Remove the skill or select different model to proceed.` Reuse `skillSelector.unsupportedTooltipLabel` for inline feedback, selector state, and mapped server rejection. Existing chat uses the same shared predicate within its current enabled-flow gate.

### 4. Additive wire contract with non-destructive updates

Request DTOs keep `prompt: string` required (empty string allowed only with an effective skill), and add `skillUrl?: string | null`. Response DTOs add `skillUrl?: string` (absent means no skill when the payload is known; a sparse list row does not establish absence).

| Operation / value | Meaning |
| --- | --- |
| POST omitted or null | No skill; nonblank instructions required. |
| POST/PUT nonempty string | Select/replace one skill. |
| PUT omitted | Preserve the saved skill, supporting older clients and feature-disabled edits. |
| PUT null | Explicitly remove the skill; instructions must then be nonblank. |

New checked create preparation omits an unset skill. New checked update preparation sends `null` for a deliberately cleared form value, because edit hydration has already loaded the authoritative task. Feature-disabled hosts preserve that loaded value; they must not reconstruct values from visible inputs. Existing unchecked mapper signatures stay compatible but document full-draft/validated-input preconditions.

Validate a skill as a DIAL resource reference using the existing skill-path validation convention, rejecting empty/whitespace-only strings, wrong types, control characters, traversal, and arbitrary external URLs. Do not apply an HTTP-only URL validator to `skills/{bucket}/{path}`. Preserve valid Unicode, spaces, and encoded segments with the same canonicalization as chat; no arbitrary fetching of user-supplied URLs. Measure the 1024-character path limit after decoding without rewriting the supplied reference; retain safety checks against the raw input so encoding cannot bypass them.

For PUT, load authoritative task data before merging the skill (never use a list row), then validate the effective configuration. Reuse `DeploymentsLookupService.resolveDeploymentItem` with the session token and existing bucket resolution, through the existing deployments module contract; it handles model IDs, application IDs, and ambiguous IDs. Require mapped `features.skillsSupported === true`. Missing capability produces `BadRequestException` with a typed error DTO and string-enum code `scheduledTaskSkillUnsupported`; absent/inaccessible deployments and lookup transport failures retain typed 404/403/502/503 semantics. No Scheduler write or list-cache invalidation follows a rejected validation. Do not trust capability booleans from the browser. Follow `apps/chat-api/AGENTS.md` sections 3–6 and 9.

Use a distinct code `scheduledTaskInstructionsOrSkillRequired` for empty effective content. Error DTO fields are `statusCode`, `message`, `error`, `code`, and `field` (`skillUrl` or `prompt`). Client adapters map these codes to localized field messages; network/other failures retain existing notifications and trace IDs. A model-lookup 404 during save must not trigger the edit page's existing whole-page task-not-found branch: distinguish it with `scheduledTaskDeploymentUnavailable`, preserving the draft. No new endpoint is introduced.

### 5. Persist and execute a message-level skill

The BFF mapper emits:

```json
{
  "properties": {
    "payload": {
      "model": "skills-capable-model",
      "messages": [{
        "role": "user",
        "content": "",
        "custom_content": { "skills": [{ "url": "skills/public/daily-summary" }] }
      }]
    }
  }
}
```

This is a fragment; all current Scheduler properties, service ID, and trigger stay intact. Encode resource path segments through the server's existing `encodeDialResourcePath`, exactly as conversation streaming does. Omit the extension when absent; never put it at completion-root `custom_content` or send UI names/metadata. Read the same nested field back. No local task-run worker or alternate completion implementation is added.

Multiple skills remain outside this change; the authoring and wire contract accepts one reference.

List responses may remain sparse, consistent with existing upstream summary behavior. Map a skill whenever supplied, but never hydrate an edit from a summary that omitted payload. List → detail → edit uses the existing detail GET. Do not add an unbounded N+1 lookup to every list page merely to fill metadata no list card renders.

### 6. Read-only display, flags, and reusable presentation

Add optional `skillLabel`/`skillDisplayName` inputs to `ScheduledTaskDetailsSummary` and `ScheduledTaskConfigurationSection`; thread the optional localized label via `ScheduledTaskDetailViewLabels` and the resolved value via `ScheduledTaskDetailViewProps`. Model remains in its current location. Render Skill before Instructions in desktop Configuration and the mobile Configuration tab; the summary order is Model, Skill, Instructions. Empty instructions in a skill-only task do not produce an empty required-looking field.

Resolve skill metadata at the application edge, from existing own/shared/public collections and the existing skill metadata operation if necessary. Pass a display name or the full saved reference. Lookup loading, 403, 404, and unavailable metadata keep the task visible and the reference intact; metadata resolution never gates editing or compatibility checks. The detail value is plain text, not a link, so deleted/unreadable skills have no broken navigation action.

The existing `scheduledTasksEnabled` role policy continues guarding scheduler routes/endpoints. Host-side `skillUsageEnabled`, resolved through `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`, controls whether the form supplies the entire Skill slot; libraries never read those settings. This adds no new role or server authorization rule. Disabling skill selection does not hide saved read-only metadata or remove a persisted skill. Hidden saved skills still participate in capability checks; show their error in a form-level alert when the field is hidden, so a save is never silently disabled.

### 7. Strings, accessibility, styling, and lifecycle

Add `scheduledTasks.create.skillLabel` (Skill), `scheduledTasks.create.skillPlaceholder` (Choose a skill), `scheduledTasks.create.instructionsOrSkillRequired` (Choose a skill or write instructions), and `skillSelector.removeSkillLabel` (Remove skill). The existing `scheduledTasks.create.configurationSectionSubtitle` already says "Choose a skill, write custom instructions, or combine both"; retain it when enabled and add `scheduledTasks.create.instructionsOnlySubtitle` (Write custom instructions for this task) for the disabled-feature state. Reuse existing catalog loading/empty/error strings and the shared unsupported key; labels are translated in the app and injected into libs.

Use label/error IDs unique per form instance, `aria-labelledby`, `aria-describedby`, `aria-invalid`, `aria-expanded`, and visible live error/status text. Support Enter/Space open/remove, Escape dismissal, focus return, and non-hover removal. Hidden focusable content is unmounted or inert. Preserve AAA contrast, decorative icon hiding, and the shared icon stroke token.

Preserve scheduler's existing container-responsive layout and built CSS contract. New fields fit 360px containers and long raw references wrap; the app still uses named mobile/desktop breakpoints where needed. Use logical spacing and mirrored directional icons; no language reads in libs. Catalog search results retain shared `Highlight` behavior.

Memoize label/options objects and stable catalog callbacks; key async metadata/support results to the current URL/model and cancel or ignore stale responses. No new cache or telemetry system. Existing list cache key `scheduled-tasks:list:{userSub}:{epoch}:{normalizedQuery}` keeps its 30s TTL; mutations invalidate via the per-user epoch (24h TTL). Detail remains uncached. Reuse skill-context invalidation; do not introduce an independent metadata cache. Existing server request metrics and error logging suffice, without logging prompt bodies or credentials.

## Trade-offs

- Capability validation adds a model lookup for tasks with a skill, and PUT reads authoritative detail before merging. Keep these operations session-scoped and avoid per-item list enrichment or authorization caches shared across users.
- Sparse list responses remain supported. Detail GET is authoritative for edit hydration, so an omitted list field cannot erase a saved skill.
- Concurrent updates retain the existing last-write-wins behavior; this change adds no ETag contract.
- Reusable libraries receive labels, values, and callbacks from their host. The packed consumer fixture exercises this public contract without app providers.

## Migration and rollout

Deploy the BFF and generated contract before frontend and consumer releases. Existing tasks require no data migration; an absent skill remains absent. Older clients preserve saved skills by omitting `skillUrl` on PUT.

Disable selection through the existing feature flag for a frontend rollback; saved values remain visible in read-only views and preserved during editing. A rollback to older BFF code must prevent edits to skill-bearing schedules or explicitly migrate those tasks first, so stored skills are not silently dropped.
