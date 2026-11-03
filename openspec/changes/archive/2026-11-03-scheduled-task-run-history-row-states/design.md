## Context

QA reopened issue #9297 because the History run rows don't match the design's "Run item states" frame. The frame has six states: Default (in progress), Default, Hover, Selected, Not read and Error. A failed row has an accordion that shows the failure text under the row. The design mockup is attached to the issue comment.

What the code does today, in `libs/scheduled-tasks/src/components/ScheduledTaskRunHistoryList/ScheduledTaskRunHistoryList.tsx`:

- Status icon at the start: already correct.
- Unread dot in a fixed `size-3` end slot, and a semibold timestamp for unread rows: already correct.
- Current-run highlight (`currentRunId` → `.currentRun`): this is the design's "Selected" state.
- Hover and focus styling only on rows that have a `conversationId` and `onRunClick` (`.interactiveRow`).
- Rows are capped at `max-w-[328px]`. The design's pill spans the full card width.
- `errorText` shows only in a kit `Tooltip` around the status icon, and is appended to the row's `aria-label`. There is no chevron and no inline details.

The list renders on two surfaces:

1. The detail page: `ScheduledTaskDetailView` → `ScheduledTaskHistorySection` → list. The app container is `apps/chat/src/pages/ScheduledTaskDetailPage/ScheduledTaskDetailPage.tsx`.
2. The task conversation's sources panel: `ScheduledTaskConversationHistorySection` → list. The app container is `apps/chat/src/components/ConversationSourcesPanel/TaskHistorySection/TaskHistorySection.tsx`.

`mapScheduledTaskRunDtoToItem` (`apps/chat/src/utils/map-scheduled-task-run-dto.ts`) already passes the Scheduler's `errorText`. No data work is needed.

Constraints:

- Lib isolation (AGENTS.md): host knowledge stays in the app. The lib decides whether a row is expandable only from `status` + `errorText`.
- Strings come through `*Labels` props, colors through `*Colors` props and CSS vars, typography through `*ClassName` defaults.
- Use the 2.0 kit components.
- Mobile-first, RTL, WCAG 2.1 AAA.

## Goals / Non-Goals

**Goals:**

- Pixel parity with the states frame on both surfaces, in light and dark, LTR and RTL.
- Failed runs expand in place, with keyboard, ARIA and reduced-motion support.
- A failed run that has a conversation can still be opened, through a link inside the expanded panel. Decided with the user.
- Purely additive lib API.

**Non-Goals:**

- Changes to the API or DTOs.
- Remembering expanded state across reloads.
- Expandable details for `Missed`, `InProgress` or `Success` runs.
- Changing unread derivation or navigation targets.

## Decisions

### D1 — A native disclosure button, not the kit `Accordion` (decided by the slice-1 spike)

An expandable row renders `<li>` containing a native `<button type="button" aria-expanded aria-controls>` header, followed by a details wrapper. The wrapper uses the same mechanism as the kit `Accordion`:

- a CSS grid whose `grid-template-rows` moves from `0fr` to `1fr` over 200ms, with no transition under `prefers-reduced-motion: reduce`;
- an inner `min-h-0 overflow-hidden` cell;
- `inert` while collapsed;
- a `role="region"` element labelled by the header's `id`.

Ids come from `useId()`.

**Why not the kit `Accordion`.** The planned approach was `<Accordion caretPosition={AccordionCaretPosition.End}>`. The spike read the kit source (`@epam/ai-dial-ui-kit` 0.16.0-dev.67, `components/New/Accordion/Accordion.js`) and found two things that props can't change:

- **The caret.** It is a fixed `IconChevronRight` that points right when collapsed (left in RTL) and turns down when expanded. The design uses a down chevron when collapsed and an up chevron when expanded.
- **Fixed spacing and type.** The content always sits inside a `pt-3` wrapper, which puts a 12px gap between the row and its details where the design has about 4px. The title span is forced to `dial-body-text text-primary`.

Overriding these would mean hiding the kit caret with CSS and adding negative margins. That depends on kit internals and breaks on the next upgrade. Section 4.3 of tasks.md records the gaps for the kit repo.

### D2 — The list owns expanded state locally

`useState<Set<string>>` lives inside `ScheduledTaskRunHistoryList`. It doesn't need a context or host state:

- the state is pure view state;
- both hosts want the same behavior;
- the existing contract says the list "holds no fetching or pagination logic", not "no state".

Because the state is keyed by run id, it survives "Show more" appends and items being re-created. A controlled `expandedRunIds`/`onExpandedChange` prop pair was considered and deferred: no host needs it yet, and adding it later is non-breaking.

### D3 — "Expandable" is `Error` + non-empty `errorText`

`Error` is the only status the Scheduler gives a reason for. An `Error` row with no text would open to an empty panel, so it renders as a regular row with no chevron. A row that is expandable is never also the row-level navigation button. That avoids nesting interactive controls.

### D4 — Navigation moves into the panel for expandable rows

The user's choice. When `conversationId` is set and `onRunClick` is supplied, the region renders a kit `LinkButton` with `label={labels.openConversationLabel ?? 'Open conversation'}`. The new label is optional on `ScheduledTaskRunHistoryListLabels`, and each wrapper passes it through as an optional field.

The app adds one key: `ScheduledTasksI18nKeys.DetailHistoryOpenConversationLabel = 'scheduledTasks.detail.historyOpenConversationLabel'`, English "Open conversation". Both hosts use the same key. The existing "Open"-style strings in `en.json` say other things ("Search chats", "Preview {{name}}"), so there is nothing in `ButtonsI18nKeys` to reuse.

### D5 — Remove the tooltip and the error text from the accessible name

Leaving the tooltip and adding the panel would show the text twice. With the error text still in the header's name, a screen reader would also read it twice.

The header's name becomes `status timestamp duration [— Unread] [— Current run]`, set as the disclosure button's `aria-label`. The details are read when the user expands the row; that is the normal disclosure pattern.

The `errorText` JSDoc on `ScheduledTaskRunItem` and both README passages that mention the tooltip are updated to match.

### D6 — End slot precedence: chevron, then dot

Only one glyph fits the 12px slot. For a failed run the chevron is the more useful one, because it shows that the row opens. On an unread failed run, the semibold timestamp and the name suffix still carry the unread state.

The chevron is a Tabler `IconChevronDown` at `DIAL_ICON_SIZE.SM` with `DIAL_KIT_ICON_STROKE`, marked `aria-hidden`. It sits centred in the same `size-3` end slot as the dot, so timestamps stay aligned, and the 16px glyph overflows into the pill's `px-3` padding. When the row is expanded it turns 180° (`rotate-180`, `motion-reduce:transition-none`), so it points up, as in the design. It is not mirrored in RTL.

### D7 — New style surface (all optional, defaults keep today's tokens)

| Prop | CSS var | Default |
| --- | --- | --- |
| `colors.errorDetailsTextColor` | `--strhl-error-details-text` | `var(--text-secondary, #57647a)` |
| `rowExpandedBackground` | `--strhl-row-expanded-bg` | `var(--bg-control-accent-alpha-active, #2764d933)` |
| `colors.chevronIconColor` | `--strhl-chevron-icon` | `var(--text-secondary, #57647a)` |
| `typography.errorDetailsClassName` | — | `'dial-tiny-text'` |

`chevronIconColor` was added during apply. The chevron is drawn by the lib rather than the kit (D1), so its color has to come from a `*Colors` field like every other lib color.

Hover moves from `.interactiveRow` only to every interactive row, including the disclosure header. Static rows keep no hover. The `max-w-[328px]` cap is dropped, so the pill fills the card as in the design; the History card and sources panel already limit width.

`ScheduledTaskHistorySection` forwards the new `rowExpandedBackground` and the error-details typography next to the existing `row*` fields. `ScheduledTaskConversationHistorySection` forwards no styles today and keeps the defaults.

### D8 — RTL and a11y

- RTL: logical utilities only (`px-3`, `ps-*`, `text-start`). The details region's start inset equals icon width + gap, so the text starts at the timestamp's edge. The chevron is an up/down glyph and is not mirrored.
- Focus-visible equals hover plus the existing outline token.
- Contrast of the error details text: see Risks.

## Risks / Trade-offs

- **The lib now owns a small disclosure, not the kit `Accordion`.** It could drift from the kit's animation. → It copies the kit's mechanism exactly (a 200ms `grid-template-rows` transition, `inert`, a labelled region, `motion-reduce`). Section 4.3 of tasks.md records the kit gaps, so the lib can switch back once `Accordion` accepts a caret slot and content spacing.
- **The error details text uses `--text-secondary` (about 6.2:1).** The design shows it grey. That passes AA, but is below AAA 7:1 for 12px text. → It is supplementary detail, which the a11y rule treats as secondary text, and hosts can override it with `errorDetailsTextColor`. Flag it in review. If a11y review rejects it, switch the fallback to `--text-primary`.
- **Losing the row-level click on failed runs that have a conversation** might surprise users who learned the old behavior. → The "Open conversation" link sits directly in the expanded panel, and the trade-off was agreed with the user.
- **Existing tests assert the tooltip and the error text in the `aria-label`** (`ScheduledTaskRunHistoryList.spec.tsx`, "shows errorText in a tooltip…" and "makes the tooltip trigger focusable…"). → Replace them with accordion tests. This is an intended behavior change, not a regression.
- **Animation cost.** One height transition per toggled row, with no JS measurement in the kit path. That is negligible for page sizes of about 20 rows.

## Migration Plan

- One PR, lib and app together. Every new lib prop is optional, so it is not breaking for other hosts. The only visible difference is error text moving from a tooltip to an inline panel.
- Rollback: revert the PR. There is no data, API or persisted-state migration.

## Open Questions

- Should the conversation link also mark the run as viewed? Today `onRunClick` does that through the host's existing navigation path. We assume yes, with no change, because the link calls the same `onRunClick`.
- Exact pixel values (pill height and radius, gap between icon and text) come from the frame. If the Figma file is reachable during apply (the Figma MCP needs authorization in this environment), confirm them there. Otherwise match the PNG in the issue comment.
