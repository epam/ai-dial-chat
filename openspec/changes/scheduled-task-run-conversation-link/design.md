## Context

DIAL Scheduler's `GET .../schedules/{id}/runs` now includes `conversation_id` on
each result — a full DIAL Core resource path under
`conversations/{bucket}/.scheduler/{scheduleId}/{runId-or-model-slug}`. The BFF
(`apps/chat-api/src/scheduled-tasks/`) currently drops this field entirely:
`UpstreamScheduleRun`, `fromUpstreamRun`, and `ScheduledTaskRunDto` only carry
`id`/`status`/`start_time`/`end_time`. On the frontend,
`ScheduledTaskRunHistoryList` (`libs/scheduled-tasks`) already supports a
global `onRunClick` prop that makes every row clickable, but
`ScheduledTaskDetailPage` never passes it, and the existing spec
(`scheduled-task-detail-page`, "Row click is a no-op in this iteration")
explicitly documents that today's list-runs response carries no conversation
id — this change is exactly the follow-up that requirement anticipated.

Separately, `scheduled-task-unread-tracking` already ships the backend
persistence (`.client_data/.viewed-scheduled-task-conversations.json`) and the
`isUnread` flag on `GET /api/v1/conversations/list` items, consumed today only
by `libs/conversation-panel`'s `ConversationRow` (a small dot before the
avatar). This change is purely a second consumer of that existing signal —
we are not adding a new unread source of truth, only exposing the same
boolean in a second visual location (History rows).

Marking a conversation viewed on open is also already solved once, globally:
`useActiveConversationSync` (`@epam/ai-dial-chat-hooks`) is wired into
`ConversationPanelView`, which `apps/chat/src/app/app.tsx` mounts outside the
route `<Routes>` block — so it is present on every page, including the
Scheduled Task Detail page. `app.tsx` derives `activeConversationId` purely
from the current pathname; whenever it changes and matches a loaded
conversation-list item, the hook's own effect calls
`markConversationViewed(activeItem.id)` — its source comment already names
"clicking a history panel row" as one of the triggers this was built to
support. So the only thing this change's `onRunClick` needs to do is
navigate; marking viewed follows automatically as a side effect of the URL
change, through the same path a sidebar click or direct URL open already
takes.

## Goals / Non-Goals

**Goals:**

- Map upstream `conversation_id` through the BFF as `conversationId` on
  `ScheduledTaskRunDto`, tolerating its absence/`null` on older or in-progress
  runs.
- Make a History row clickable/keyboard-activatable if and only if it has a
  `conversationId` — never all rows unconditionally, never based on any other
  field.
- Show the existing conversation-panel unread-dot visual on a History row
  when `ScheduledTaskRunItem.isUnread` is `true`, computed by the host from
  the existing conversation-list `isUnread`, not from a new API.
- On activation, navigate to the run's conversation via `getConversationRoute`
  — the same navigation the conversation panel already uses — so the dot in
  both places clears together once the app's existing active-conversation
  sync marks the newly active conversation viewed.

**Non-Goals:**

- No new unread-tracking endpoint, storage file, or context — reuse
  `ConversationsContext`'s existing `isUnread` field and
  `markConversationViewed` exactly as-is.
- No redesign of History row chrome, pagination, or skeleton states.
- No new feature flag — this rides inside the existing
  `scheduledTasksEnabled`-gated detail page.
- No opening the conversation in a new tab/overlay/preview pane — plain
  in-app navigation via `navigate()`.
- No single-run detail endpoint (`GET .../runs/{runId}`) — out of scope, as
  already stated in `scheduled-tasks-api`.

## Decisions

### Decision 1: `conversationId` is optional and independently nullable at every layer

Upstream `conversation_id` can be absent (older runs), or present with a
`null`/missing value on `missed` or long-`in_progress` runs. Rather than
coercing this into a required field with a sentinel, every layer keeps it
`string | undefined` (BFF: `string | null | undefined` at the DTO boundary,
per the existing `class-validator` `@IsOptional()` convention used elsewhere
in this DTO family — see `endTime`/`durationSeconds`). The mapper
(`fromUpstreamRun`) normalizes `null` to `undefined` before it reaches the
DTO, matching the existing `is_deleted ?? false`-style normalization already
used in this module, except here the correct default is "no value" rather
than a boolean default, because there genuinely is no conversation when the
field is absent.

**Alternative considered:** default to an empty string so the prop is always
a `string`. Rejected — `''` is a falsy-but-truthy-shaped value that a naive
`if (run.conversationId)` check happens to handle correctly today, but it
invites a future bug if someone switches to `!= null`. Keeping it
`undefined` end-to-end is the same pattern the rest of this DTO family
already uses.

### Decision 2: Clickability is derived per-row from `conversationId`, not from a page-level flag

`ScheduledTaskRunHistoryList` already accepts a single `onRunClick` for the
whole list (used by no current caller). Rather than adding a second prop to
gate it, the row's own interactive state becomes
`Boolean(item.conversationId) && Boolean(onRunClick)`. This keeps the
existing prop shape (one callback, not per-row callbacks) while making the
per-row behavior data-driven, and it means an old/missed run row is provably
inert even if a future caller passes `onRunClick` unconditionally — the
library, not the host, is the single place that enforces "no id, no click".

**Alternative considered:** have the host filter or pre-mark items before
handing them to the lib (e.g. an `isClickable` flag computed by the page).
Rejected — that duplicates logic the lib can derive from data it already
has (`conversationId`), and it's the kind of derived boolean the "every
declared prop must be read" / no-redundant-state conventions warn against.

### Decision 3: `onRunClick` receives the whole `ScheduledTaskRunItem`, not just an id

Signature: `onRunClick?: (run: ScheduledTaskRunItem) => void`. The host needs
both `id` (for potential future analytics/telemetry, not in scope here) and
`conversationId` (for navigation) — passing the full item avoids a second
lookup back into the page's own `items` array and matches the existing
pattern of passing whole DTOs/items to callbacks elsewhere in this lib family
(e.g. `onActiveChange`, `onDelete` in `ScheduledTaskDetailView`). The lib
still guarantees it only calls this when `conversationId` is present, so the
host does not need to re-check for `undefined` before navigating — but the
type keeps `conversationId` optional on `ScheduledTaskRunItem` itself since
that field can genuinely be absent for other rows in the same list.

### Decision 4: Unread state is resolved once per render by the host, not fetched by the lib

`ScheduledTaskDetailPage` computes `isUnread` for each run by matching
`run.conversationId` against `ConversationsContext`'s already-loaded
conversation list via `conversationIdsMatch` (existing utility, already
built to handle the `conversations/` prefix and encoding differences between
list-API ids and resource-path ids). No new fetch, no new subscription — the
conversation list is already loaded by the time a user is looking at
scheduled tasks (both live under the authenticated app shell). A run whose
`conversationId` has no match in the list (e.g. the conversation was deleted,
or the list page hasn't loaded yet) resolves to `isUnread: false` — no dot,
not an error state.

**Alternative considered:** have `useScheduledTaskRuns` itself join against
the conversation list internally. Rejected — that hook lives in
`apps/chat/src/hooks/scheduled-tasks/` and is already scoped to fetching
runs; mixing in a second context's data inside a single-purpose data hook
would couple two independently-evolving data sources for no benefit over
doing the join at the one render site (`ScheduledTaskDetailPage`) that
already has both pieces of data.

### Decision 5: The unread dot is a small copy of the ConversationRow markup, not a shared component

`libs/conversation-panel`'s dot markup (12×12 reserved slot,
`size-[5.33px] rounded-full`, `--text-accent` token) is copied into
`ScheduledTaskRunHistoryList`'s row rather than extracted into a new shared
lib or imported cross-lib. `libs/scheduled-tasks` must not depend on
`libs/conversation-panel` (see AGENTS.md library-isolation rule — nothing
licenses an inter-lib dependency here, and the two libs have no existing
peer relationship). The visual is small enough (a handful of Tailwind
classes plus one CSS var) that duplicating it is cheaper and lower-risk than
introducing a new shared-UI lib or a peer dependency edge between two
otherwise-unrelated feature libs. `unreadDotColor` is exposed through the
existing `buildCssVars` pattern this lib's components already use, defaulting
to `var(--text-accent)` — the same token, so the two dots stay visually
identical without a code dependency.

The accessible-name mechanism differs from `ConversationRow`'s, though: that
component has no `aria-label` on its row, so a nested `sr-only` span reaches
assistive technology on its own. `ScheduledTaskRunHistoryList`'s `<li>`
already carries an explicit `aria-label` (status + timestamp, extended with
`currentRunLabel` for the current run), and per the ARIA accessible-name
algorithm an element's own `aria-label` overrides all descendant text —
so a nested `sr-only` span here would be silently unreachable. The unread
label is instead folded into that same `aria-label` as an appended suffix,
the same way `currentRunLabel` already is.

**Alternative considered:** extract the dot into `libs/chat-shared` and have
both libs import it. Rejected as disproportionate for a single non-decision:
`chat-shared` currently holds types/interfaces (per AGENTS.md), not
presentational components, and introducing that precedent is a bigger change
than this proposal's scope.

### Decision 6: Reuse the existing "Unread" i18n key end-to-end

`ConversationPanelI18nKeys.UnreadIndicatorLabel` /
`conversationPanel.unreadIndicatorLabel` already exists and is passed into
`libs/conversation-panel` as a plain string per the no-i18n-in-libs rule.
`ScheduledTaskDetailPage` resolves the same key and passes it into the new
`unreadIndicatorLabel` field of `ScheduledTaskRunHistoryListLabels` — no new
locale entry.

### Decision 7: `onRunClick` only navigates — marking viewed is not a second explicit call

`ScheduledTaskDetailPage`'s `onRunClick` handler calls
`navigate(getConversationRoute(run.conversationId))` and nothing else.
Marking the conversation viewed is **not** a second call the page makes
itself. `apps/chat/src/app/app.tsx` mounts `ConversationPanelView` outside
the route `<Routes>` block, so it — and the `useActiveConversationSync` hook
it wires up (`@epam/ai-dial-chat-hooks`) — is present on every page,
including this one. `app.tsx` derives `activeConversationId` purely from the
current pathname; `useActiveConversationSync`'s second effect already calls
`markConversationViewed(activeItem.id)` whenever that id changes and matches
a loaded conversation-list item — using `conversationIdsMatch` internally,
so it does the exact same id-normalization work correctly without the page
duplicating it. The hook's own source comment already names "clicking a
history panel row" as one of the triggers it was built to support, which is
exactly this feature.

**Alternative considered (and initially the plan, corrected during
implementation):** have the page resolve the matching conversation-list item
itself and call `markConversationViewed(matchedItem.id)` directly after
navigating. Rejected once the existing hook was found — calling it directly
from the page would either duplicate `conversationIdsMatch` resolution
logic already centralized in `useActiveConversationSync`, or, if the page
instead passed `run.conversationId` as-is, risk a silent no-op since
`markConversationViewed`'s own lookup is an exact `id` match and
`run.conversationId` carries a `conversations/` prefix the list item's `id`
does not. Relying on navigation alone is simpler and reuses the
already-correct centralized logic.

## Risks / Trade-offs

- **[Risk]** Upstream `conversation_id` format (full resource path including
  `conversations/` prefix and `.scheduler/{scheduleId}/{runId}` segment) must
  match exactly what `conversationIdsMatch`/`toPanelConversationId` already
  normalize for the conversation list and route matching. → **Mitigation**:
  no new normalization logic is introduced; this change is exercised against
  the same utility already proven against list-API ids and route ids, and
  mapper/matching tests explicitly cover both a `conversations/`-prefixed id
  and a bare path.
- **[Risk]** A run's `conversationId` can point to a conversation that was
  since deleted or is not yet loaded in `ConversationsContext`, silently
  producing `isUnread: false` for a run that might otherwise be unread. →
  **Mitigation**: accepted trade-off — the History panel's dot is a
  convenience signal, not the source of truth (the conversation panel itself
  remains authoritative), and this matches how a match-miss already
  degrades gracefully elsewhere in the codebase.
- **[Risk]** Regenerating `@epam/ai-dial-chat-api-client` after the DTO change
  could pick up unrelated drift if the OpenAPI source has other pending
  changes. → **Mitigation**: run `npm run openapi:check` before committing
  and diff the generated client to confirm only the expected
  `conversationId` addition appears.
- **[Trade-off]** Copying ~10 lines of dot markup instead of sharing a
  component means the two dots could visually drift if one is edited without
  the other. → **Mitigation**: both read the same `--text-accent` CSS token
  by default, so a design-system-level color change still propagates to both
  without code changes; only a structural change (size, shape) would need a
  manual second edit, and that's an acceptable, low-frequency cost for
  avoiding a lib-to-lib dependency.

## Migration Plan

Additive, backward-compatible change — no data migration, no flag flip, no
rollback plan beyond a normal revert:

1. Backend: add `conversationId` mapping, regenerate OpenAPI +
   `chat-api-client`, verify `npm run openapi:check`.
2. Lib: extend `ScheduledTaskRunItem`, `ScheduledTaskRunHistoryListLabels`,
   and `ScheduledTaskRunHistoryList`'s row rendering; update
   `libs/scheduled-tasks/README.md`.
3. App: thread `conversationId` through the mapper, compute `isUnread` in
   `ScheduledTaskDetailPage`, wire `onRunClick` to
   `navigate(getConversationRoute(...))` (marking viewed follows
   automatically via the existing `useActiveConversationSync`).
4. Ship all three together (single change) — a partial deploy (e.g. BFF
   without the frontend) is harmless since the added DTO field is optional
   and ignored by older frontend builds.

## Open Questions

- None outstanding — the field semantics, matching utility, navigation
  target, and unread source are all already-established patterns this
  change extends rather than invents.
