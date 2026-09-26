## ADDED Requirements

### Requirement: Instructions placeholder is part of the public labels contract

ScheduledTaskCreateForm SHALL accept optional labels.instructionsPlaceholder and forward it directly to its lazy markdown editor. Undefined SHALL preserve the editor default and empty string SHALL suppress the placeholder. No observer, global query or editor-private class SHALL be required.

#### Scenario: Placeholder survives lazy mounting and editor mode changes

- **WHEN** the form receives a placeholder before the editor loads and later switches preview/edit
- **THEN** the editable textarea displays the supplied placeholder whenever empty.

#### Scenario: Locale and multiple instances are independent

- **WHEN** the host changes one form's translated placeholder while another form has a different one
- **THEN** each mounted editor reflects its own latest prop without cross-instance mutation.

### Requirement: Form presentation options are forwarded through the shared shell

The form SHALL expose optional backIcon, className and typed layout customization alongside existing colors/typography/theme props. It SHALL forward backIcon through builder-form and preserve the opaque modelSelector, label linkage and unique ids. Scheduled-task defaults SHALL use a narrow back arrow and tertiary header/divider tokens.

#### Scenario: Host controls the back icon without changing SVG internals

- **WHEN** a host provides backIcon or uses the scheduler default
- **THEN** the supplied icon or default narrow arrow renders inside the existing accessible back control without changing its behavior.

#### Scenario: Configuration copy and editor theme remain host-controlled

- **WHEN** a host supplies the agreed Configuration subtitle, instructions placeholder and editor theme
- **THEN** those values render without hardcoded English copy, and no skill selector is added.

#### Scenario: Form sizing follows its own container

- **WHEN** the form is rendered with configured column sizes inside a narrow host container
- **THEN** controls fit, responsive layout falls back before overflowing, and header border retains its configured token.

### Requirement: Create and edit integrate shared validation without duplicating policy

Both app pages SHALL use the shared validator/checked preparation before API writes and map error codes through one host translation mapping. A local useScheduledTaskFormLabels(mode) SHALL own common labels/options. Form values and notifications SHALL remain app-owned. Network failure SHALL preserve edits. The library minimum disabled guard SHALL not replace full submit validation.

#### Scenario: Both submit paths reject missing recurrence day

- **WHEN** Create or Save is activated for Weekly/Monthly without its day
- **THEN** a field error is shown and neither create nor update is called.

#### Scenario: Correcting a field clears obsolete feedback

- **WHEN** a user fixes an invalid field or changes repeat mode
- **THEN** irrelevant field errors clear/recompute consistently in create and edit while other errors remain meaningful.

#### Scenario: Save failure preserves entered values

- **WHEN** a valid write request fails
- **THEN** the form preserves values, reports the host error and re-enables actions without navigation.

### Requirement: Edit loading failures are distinct from unsupported schedules

Edit state SHALL distinguish loading, ready, not-found, load-error and unsupported. Unsupported SHALL only follow a successful DTO failing reverse mapping. Task identity changes SHALL reset stale state and guard late responses. Retry SHALL reload the current task. Existing feature and returnUrl policy SHALL be preserved.

#### Scenario: Network failure offers retry

- **WHEN** loading an editable task fails with a network error or 5xx
- **THEN** a translated load error with retry appears, not the unsupported-schedule message.

#### Scenario: Successful retry and task change clear stale state

- **WHEN** an unsupported/error state is followed by loading another valid task or a successful retry
- **THEN** the valid form becomes available and stale responses cannot restore the old state.

#### Scenario: Unsupported trigger is still protected

- **WHEN** a successful response contains a trigger that cannot round-trip through the form
- **THEN** the unsupported state is shown and no lossy editable form is constructed.

