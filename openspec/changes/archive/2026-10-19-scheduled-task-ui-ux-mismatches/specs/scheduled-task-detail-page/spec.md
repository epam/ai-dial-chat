# Delta: scheduled-task-detail-page

## ADDED Requirements

### Requirement: Delete confirmation dialog is capped at the design's 440px width

The scheduled-task delete confirmation dialog SHALL be capped at a **440px maximum width**, overriding the shared `ConfirmationDialog`'s `PopupSize.Sm` default (400px, owned by the `shared-delete-confirmation` spec and unchanged by this requirement). The cap SHALL be applied by `ScheduledTaskDeleteModal` passing `styles.popupClassName` down to the shared dialog chain (`ScheduledTaskDeleteConfirmation` → `ConfirmationDialog` → the kit `Popup`'s `className`), backed by `apps/chat/src/components/ScheduledTaskDeleteModal/ScheduledTaskDeleteModal.module.scss`:

- Because the ui kit caps popup widths with unlayered `div .dial-sm-popup` rules (max-width 400px), a layered Tailwind `max-w-*` utility loses to them regardless of class order; the stylesheet therefore pins the cap with a doubled class selector (`.modal.modal { max-width: 440px; }`), which raises the rule above the kit's deterministically without `!important` or kit-internal class names.
- The rule is a cap, not a fixed width: the kit's `.dial-popup` is `width: 100%`, so narrower viewports still shrink the dialog below 440px.

The regression SHALL be guarded by a unit test asserting the dialog element carries the stylesheet's class (`apps/chat/src/components/ScheduledTaskDeleteModal/tests/ScheduledTaskDeleteModal.spec.tsx`). No new state, i18n, routing, feature gating, or observability is introduced; RTL/direction impact: none — a max-width cap is direction-agnostic.

#### Scenario: The dialog carries the 440px cap class

- **WHEN** the delete confirmation dialog renders
- **THEN** the dialog element's class list includes the `ScheduledTaskDeleteModal.module.scss` class applied through `styles.popupClassName`, pinning the shared dialog's maximum width at 440px

#### Scenario: Narrower viewports still shrink the dialog

- **WHEN** the delete confirmation dialog renders in a viewport narrower than 440px
- **THEN** the dialog's width follows the viewport (the kit popup is width 100% with the 440px rule acting only as a cap)
