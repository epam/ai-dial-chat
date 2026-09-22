## ADDED Requirements

### Requirement: Builder form back icon is a supported composition option

BuilderFormHeader and its containing public shell SHALL accept and forward optional backIcon. Undefined SHALL preserve the generic default, null SHALL omit the decorative icon, and a supplied ReactNode SHALL render without DOM interception. Existing labels/actions/styles SHALL remain compatible.

#### Scenario: A feature supplies its own back icon

- **WHEN** ScheduledTaskCreateForm supplies IconArrowNarrowLeft through the shell
- **THEN** the header renders it and preserves the existing back callback and accessible name.

#### Scenario: Legacy editors retain the default

- **WHEN** another editor does not provide backIcon
- **THEN** its header icon and navigation behavior remain unchanged.

#### Scenario: Directional defaults mirror in RTL

- **WHEN** a built-in back arrow renders under dir=rtl
- **THEN** it mirrors while preserving keyboard focus and its accessible label.

