## MODIFIED Requirements

### Requirement: RTL

The delete surfaces SHALL introduce no physical-direction styling, so they follow the writing direction unchanged:

- No new physical-direction Tailwind classes. All classes follow the logical pattern or are symmetric.
- Toast placement is handled by `NotificationContainer`, which anchors to the bottom-end corner with logical inset utilities only, as owned by the `notification-placement` capability.
- `aria-live`, `role="alert"`, `z-*`, `bg-*` — direction-agnostic.
- No new directional icons.

#### Scenario: Delete surfaces flip with the document

- **WHEN** the file manager is rendered with `dir="rtl"`
- **THEN** the delete overlay, toasts, and menu entries mirror through logical positioning, with no physical `left-*` / `right-*` class and no mirrored icon
