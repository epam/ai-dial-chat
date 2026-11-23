## Purpose

Lets a host decide the column layout of every list that holds attachment cards (message attachments, the sources panel, project context and outputs) through class names, without the shared libs knowing which host asks or offering a column-count prop.

## ADDED Requirements

### Requirement: Each attachment list accepts a class name merged after its default layout classes

Every list that holds attachment cards SHALL accept an optional class name that is merged after the list's default layout classes with the workspace class-merging helper (`mergeClasses`), so a conflicting utility from the host replaces the default and everything else is kept. The options SHALL be:

- `AttachmentGroup`: `styles.listClassName`, on the `role="list"` element that holds the cards. It SHALL override both the wrapping flex row and the fixed 5-column grid used at or above the collapse threshold.
- `FilesSection` in `@epam/ai-dial-source-panel`: `listClassName`, on its `role="list"` grid. `ConversationSourcesPanel` SHALL expose `styles.filesListClassName` and pass it to both its uploaded-files and generated-files sections.
- `ProjectOutputs` in `@epam/ai-dial-projects`: `styles.listClassName`, on the outputs list, in both the collapsed and the expanded state.
- `ProjectView` in `@epam/ai-dial-projects`: `styles.contextListClassName`, on the context files list.
- `ProjectCreateForm` in `@epam/ai-dial-projects`: `styles.contextListClassName`, on the context files list shown on the create and edit pages.

The libs SHALL NOT take a column-count prop or choose a layout for any host.

#### Scenario: Group list replaces the flex row

- **WHEN** `AttachmentGroup` has two attachments and `styles.listClassName` is `'grid grid-cols-3'`
- **THEN** the list has the classes `grid` and `grid-cols-3` and no `flex`

#### Scenario: Group list replaces the 5-column grid

- **WHEN** `AttachmentGroup` has at least the collapse-threshold number of attachments and `styles.listClassName` is `'grid-cols-3'`
- **THEN** the list has `grid-cols-3` and not the default 5-column template

#### Scenario: Sources panel files list

- **WHEN** `FilesSection` is rendered with `listClassName` `'grid-cols-2'`
- **THEN** its list has `grid-cols-2` and not the default auto-fill template

#### Scenario: Outputs list

- **WHEN** `ProjectOutputs` is rendered with `styles.listClassName` `'grid grid-cols-3'`
- **THEN** its list has `grid` and `grid-cols-3` and no `flex`

#### Scenario: Project context lists

- **WHEN** `ProjectView` or `ProjectCreateForm` is rendered with `styles.contextListClassName`
- **THEN** the class names appear on the context files list after its default classes

### Requirement: Message bubbles forward attachment group styles

`MessageBubbleStyles` in `@epam/ai-dial-conversation-messages` SHALL accept `attachmentGroupStyles?: AttachmentGroupStyles`, and `UserMessageBubble` and `AssistantMessageBubble` SHALL pass it to the message's `AttachmentGroup` as its `styles`. In `UserMessageBubble` the group's `className` SHALL be merged after the bubble's own `max-w-[640px]`, so a host's `max-w-*` or `w-*` replaces it; the other fields (`colors`, `typography`, `listClassName`) SHALL be forwarded unchanged.

#### Scenario: User message forwards list and group classes

- **WHEN** `UserMessageBubble` has an attachment and `styles.attachmentGroupStyles` is `{ listClassName: 'grid-cols-3', className: 'max-w-full' }`
- **THEN** the attachment list has `grid-cols-3`
- **AND** the group has `max-w-full` and not `max-w-[640px]`

#### Scenario: Assistant message forwards list classes

- **WHEN** `AssistantMessageBubble` has an attachment and `styles.attachmentGroupStyles` has `listClassName` `'grid-cols-3'`
- **THEN** the attachment list has `grid-cols-3`

### Requirement: Absent options leave every list unchanged

When none of the options in this capability is passed, every affected list SHALL render the same DOM and class names as before the options existed, including the 100 px tile sizes, the collapse threshold and the user bubble's `max-w-[640px]`. List roles (`list`, `listitem`) and accessible names SHALL NOT change in either case.

#### Scenario: Defaults

- **WHEN** the existing suites of `attachment-input`, `projects`, `source-panel` and `conversation-messages` run without the new options
- **THEN** they pass without modification

### Requirement: Cross-cutting constraints of the list hooks

The list options SHALL satisfy all of the following:

- **State owner:** none; the options are props read where the list renders.
- **Host knowledge:** the host passes class names; the libs hold no knowledge of any host, and no column-count or breakpoint logic.
- **i18n:** none; no user-visible string is introduced.
- **RTL and direction:** class names are the host's; the libs add no physical-direction utility.
- **Accessibility:** unchanged; list and listitem roles stay on the same elements.
- **Feature flags, endpoints, caching and telemetry:** none.
- **Memoisation:** the options are strings; a host passing a module-level constant adds no per-render cost, and the libs create no new objects.
- **Documentation:** the READMEs of the four libs SHALL document each option.

#### Scenario: Documented options

- **WHEN** the READMEs of `attachment-input`, `projects`, `source-panel` and `conversation-messages` are read
- **THEN** each option in this capability appears in the README of its owning lib
