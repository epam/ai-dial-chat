# Proposal: scheduled-task-ui-ux-mismatches

## Why

The scheduled-task surfaces drifted from the reviewed design in three visible ways (QA case 7 and follow-up findings): the create/edit form's Configuration column renders a section subtitle the design no longer carries, the delete confirmation dialog lost its 440px width cap when the bespoke modal was replaced by the shared dialog (whose `PopupSize.Sm` default caps at 400px), and the hourly repeat's Start/End boundary pickers were plain date pickers although hourly repeats need date-and-time boundaries. This change captures the already-implemented corrections as specs.

## What Changes

- The create/edit form's Configuration column renders its section heading with **no subtitle**: the `configurationSectionSubtitle` label on `ScheduledTaskCreateFormLabels`, the `scheduledTasks.create.configurationSectionSubtitle` i18n key and its enum member, and the subtitle rendering in `ScheduledTaskCreateForm` are removed. The Details column keeps its subtitle. The shared `sectionSubtitleClassName`/`sectionSubtitleText` style overrides stay (the Details subtitle still consumes them).
- The scheduled-task delete confirmation dialog is capped at **440px max width** per design, restored through `styles.popupClassName` backed by an app-level doubled-specificity stylesheet (`apps/chat/src/components/ScheduledTaskDeleteModal/ScheduledTaskDeleteModal.module.scss`) — the kit's unlayered `div .dial-sm-popup` rule caps `PopupSize.Sm` at 400px and a layered Tailwind `max-w-*` utility loses to it. Narrower viewports still shrink the dialog. The shared `ConfirmationDialog`/`shared-delete-confirmation` default stays `PopupSize.Sm` (400px).
- Hourly repeats pick exact window boundaries through the new internal `ScheduledTaskBoundaryField`: for `hourly`, the Start/End pair becomes two full-width date-and-time pickers (labels `startDateAndTimeLabel`/`endDateAndTimeLabel`) writing `YYYY-MM-DDTHH:mm` boundary values, one per row; day-based repeats keep the date-only pair sharing one row. A boundary set under one cadence keeps its shape after a repeat switch.
- (Already reflected in the main specs during the same review round, not re-specced here: the skill field's `unavailableTooltipLabel` removal — the empty unsupported skill field is disabled with no tooltip or caption.)

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `scheduled-task-create-form`: the Configuration column heading carries no subtitle and the `configurationSectionSubtitle` label/i18n key no longer exist; the hourly repeat's Start/End boundary pair becomes date-and-time pickers through the internal `ScheduledTaskBoundaryField`, with cadence-stable boundary value shapes.
- `scheduled-task-detail-page`: the scheduled-task delete confirmation dialog is capped at 440px max width (surface-specific override of the shared dialog's 400px default; narrower viewports still shrink).

## Impact

- `libs/scheduled-tasks` — `ScheduledTaskCreateForm` (subtitle removal, boundary field wiring), new internal `ScheduledTaskBoundaryField`, labels model, README.
- `apps/chat` — `useScheduledTaskFormLabels`, `translation-keys.ts`, `en.json` (removed key, hourly boundary labels), `ScheduledTaskDeleteModal` + its module stylesheet (440px cap).
- `tools/scheduled-tasks-consumer-fixture` — labels fixture updated for the removed label.
- No API, dependency, or feature-flag changes; no new i18n keys beyond the already-added hourly boundary labels.
