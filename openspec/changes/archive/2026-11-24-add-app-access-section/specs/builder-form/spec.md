# Spec Delta

## ADDED Requirements

### Requirement: Access section building blocks
`libs/builder-form` SHALL export `AccessField` and `AccessModal` with their props, label, colour and style types, plus the entry type they edit. They SHALL be driven only by props: the content options with each option's allowed access, the current value and a change callback, pre-translated `*Labels` with English defaults, `*Colors` as CSS variables with fallbacks, and optional class-name overrides. They SHALL NOT import `react-i18next`, routing, the generated API client, app code, or any DIAL Core knowledge (resource type names, URL grammar, `{current-user}`, endpoint paths); mapping to and from the stored format is owned by the host. They SHALL be documented in the library README and listed in its public-class table where they expose `dial-*` classes.

#### Scenario: Consumer imports the Access blocks
- **WHEN** a consumer writes `import { AccessField, AccessModal } from '@epam/ai-dial-builder-form'`
- **THEN** the import resolves and the prop types are defined

#### Scenario: Library stays host-agnostic
- **WHEN** `libs/builder-form/src/**` is searched for DIAL Core resource URLs or the string `current-user`
- **THEN** none are found
