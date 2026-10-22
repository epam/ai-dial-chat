# Design: scheduled-task-ui-ux-mismatches

## Context

Three corrections to the scheduled-task surfaces, all already implemented on the branch `fix/scheduled-task-ui-ux-mismatches`: the create/edit form's Configuration section subtitle removal, the delete confirmation dialog's 440px width cap, and the hourly repeat's date-and-time boundary pickers. This change captures them as specs; the implementation already exists and is verified by its own unit tests.

## Goals / Non-Goals

**Goals**: spec coverage for the three behaviors, each landing in the capability that owns the surface — `scheduled-task-create-form` (form presentation + boundary validation/mapping) and `scheduled-task-detail-page` (the delete dialog presentation).

**Non-Goals**: changing the shared `ConfirmationDialog`/`shared-delete-confirmation` default (`PopupSize.Sm`, 400px) — the 440px cap is a scheduled-task-surface override. Re-speccing the skill field's `unavailableTooltipLabel` removal (already reflected in the main specs during the same review round). Any new backend contract — no endpoint changes.

## Decisions

1. **440px cap via an app-level doubled-specificity stylesheet, not a Tailwind class.** The kit caps popup widths with unlayered `div .dial-sm-popup` rules (400px). Layered Tailwind utilities always lose to unlayered rules regardless of specificity, and a single module class only ties the kit's specificity (leaving the winner to CSS-bundle order). The doubled class `.modal.modal` (0,2,0) beats `div .dial-sm-popup` (0,1,1) deterministically, without `!important` or kit-internal class names. The class threads through the existing `styles.popupClassName` channel on the shared dialog chain — no shared-component change. *Alternative rejected*: adding a `PopupSize`/width option to the kit — a cross-package change for one surface's 40px difference.

2. **Hourly boundaries are exact picked moments; day-based boundaries stay local-day spans.** `buildCronWindowBoundary` branches on the value's own shape (`T` present → the picked instant's ISO; absent → the existing local-day start/end conversion). The reverse mapping hydrates hourly boundaries via `isoToLocalDateTime` so the editor round-trips exact moments. *Alternative rejected*: widening every boundary to date-and-time — day-based cadences are day-windowed by product definition, and widening would silently change existing schedules' semantics.

3. **Boundary shapes survive repeat switches.** A boundary set under `hourly` keeps its `YYYY-MM-DDTHH:mm` shape after switching to a day-based cadence (and vice versa); validation, mapping, and the pickers tolerate both shapes rather than clearing or coercing on switch — the user's window is never silently dropped.

4. **The subtitle removal deletes the label and its i18n key, not the style overrides.** `configurationSectionSubtitle` leaves `ScheduledTaskCreateFormLabels`, the hook, the enum, and `en.json` (a translation key cannot be removed in isolation — every consumer goes in the same change). `sectionSubtitleClassName`/`sectionSubtitleText` stay because the Details subtitle still consumes them.

## Risks / Trade-offs

- [Kit restyles its popup width rules → the doubled-class cap may need revisiting] → the cap is guarded by a unit test on the dialog element's class; a kit change surfaces as a failing test, not silent drift (that is exactly how the cap was lost once before, in the shared-dialog unification).
- [Both boundary shapes flow through validation/mapping] → the shape tolerance is stated in the spec and covered by the relocated trigger-mapping tests; the past-date comparison handles both shapes.

## Migration Plan

None — the implementation is already on the branch; this change only adds the spec record. Rollback is reverting the branch commits.

## Open Questions

None.
