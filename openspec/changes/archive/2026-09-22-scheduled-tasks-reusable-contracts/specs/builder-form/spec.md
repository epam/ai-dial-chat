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


## MODIFIED Requirements

### Requirement: BuilderFormContainer — page shell
`BuilderFormContainer` SHALL render a full-height scrollable page shell: a header (back control, title, cancel/submit action pair, with a `role="status"` region announcing `labels.submittingLabel` while `isSubmitting` is `true`) above a three-column body — `left`, the main column (`children`), and `metadata`. Side columns are full width on mobile and a fixed 400 px on desktop; supplying `left` without `metadata` reserves an empty end column of the same width so the main column stays optically centered. The container SHALL hold no state of its own; all strings, disabled flags, and callbacks are host-supplied.

#### Scenario: Default responsive shell

- **WHEN** a host provides left content and main children without layout overrides
- **THEN** side columns span the available width below 1280px and occupy 400px from 1280px, with a matching reserved end column when metadata is absent
- **AND** the header and mobile footer expose one visible action pair at their respective breakpoints, independent of host utility CSS.

### Requirement: AvatarPickerModal is host-wired
`AvatarPickerModal` SHALL render the host-supplied `FileManagerModal` component restricted to a single image attachment up to `maxFileSizeBytes`, with `allowedMimeTypes` and `bucket` supplied by the host. It SHALL NOT import a file-manager implementation, talk to a backend, or resolve a storage identifier itself; `onAttach` hands the picked file to the host, which resolves it to a DIAL resource URL and closes the modal. All strings SHALL be pre-translated through `labels`.

#### Scenario: Host handles a selected image

- **WHEN** the supplied file manager reports a selected image within the host-provided restrictions
- **THEN** the modal forwards the attachment to the host callback, and the host owns URL resolution and closing the modal.
