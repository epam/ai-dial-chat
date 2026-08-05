## MODIFIED Requirements

### Requirement: RTL and accessibility

The popup SHALL be rendered entirely by `@epam/ai-dial-react-file-manager` using logical CSS properties and the inherited `dir` attribute from `<html>`. This change SHALL NOT introduce any physical-direction Tailwind classes or app-level RTL handling. Keyboard navigation and ARIA roles within the popup SHALL remain package-owned; the app-level change here is limited to supplying translated strings, which SHALL NOT alter focus order or semantics.

#### Scenario: Popup inherits RTL layout

- **WHEN** the active language is Arabic (`dir="rtl"` on `<html>`)
- **THEN** the popup's layout mirrors correctly without any app-level RTL-specific code, since no app-level layout is introduced by this change
