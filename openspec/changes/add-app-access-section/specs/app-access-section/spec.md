# Spec Delta

## Purpose

Lets an app author declare which of the user's DIAL resources the app may read or write on the user's behalf, from the builder's Metadata area, and keeps that declaration faithful to what DIAL Core stores.

## ADDED Requirements

### Requirement: Access section under Metadata
The builder SHALL render an **Access** section directly below the Metadata fields of an app definition that has Access enabled (Quick Apps first). The section SHALL show a title, a one-sentence description ("What this app can reach. Shown to users before they install."), a `Configure` button, and one chip per configured entry labelled `<Content>: <Access>` (for example `Files: Read`, `Prompts: Read&Write`). Each chip SHALL have a remove control that deletes that entry from the form state without opening the modal. With no entries, the section SHALL show no chips. The state SHALL be owned by the builder form host and passed to the section as a value with a change callback; the section SHALL hold no state of its own beyond the open/closed modal.

#### Scenario: Chips reflect the configured entries
- **WHEN** the form value holds Files with Read and Prompts with Read&Write
- **THEN** two chips `Files: Read` and `Prompts: Read&Write` are shown below the description

#### Scenario: Removing a chip
- **WHEN** the author activates the remove control of the `Files: Read` chip
- **THEN** that entry is removed from the form value and the other chip stays

#### Scenario: Definition without Access
- **WHEN** an app definition does not enable Access
- **THEN** no Access section is rendered and the saved application carries no `resource_dependencies` change

### Requirement: Configure modal
`Configure` SHALL open a modal titled "Access" with one card per draft entry. A card SHALL contain a `Select content` dropdown, a `Select access` dropdown and a delete button. The modal SHALL edit a draft copy: `Save` SHALL apply the whole draft to the form value and close the modal, `Cancel` and the close control SHALL discard it. When the last card has both fields filled, an empty card SHALL appear below it; exactly one trailing empty card SHALL exist at all times, and it SHALL NOT be saved. Deleting the trailing empty card SHALL be a no-op. A card with only one of the two fields filled SHALL be dropped on `Save` and SHALL NOT produce an entry.

#### Scenario: Placeholder card appears after filling the last card
- **WHEN** the author selects both content and access in the last card
- **THEN** a new empty card is added below it

#### Scenario: Save applies the draft
- **WHEN** the author fills two cards and presses `Save`
- **THEN** the form value holds exactly two entries and the modal closes

#### Scenario: Cancel discards the draft
- **WHEN** the author adds a card and presses `Cancel`
- **THEN** the form value is unchanged

#### Scenario: Half-filled card is not saved
- **WHEN** the author selects content in a card but no access and presses `Save`
- **THEN** no entry is created for that card

### Requirement: Content and access options
The content dropdown SHALL offer Files, Projects, Skills, Prompts, Conversations, Applications and Toolsets. The access dropdown SHALL offer `Read` and `Read&Write` for Files, Projects, Skills, Prompts and Conversations, and only `Read` for Applications and Toolsets. Each content type SHALL be selectable in at most one card (types already used by another card SHALL be disabled in the dropdown). Changing a card's content to a type that does not allow its selected access SHALL reset the access to `Read`. The option list and each option's allowed access SHALL be supplied by the host, not defined by the component library.

#### Scenario: Applications and Toolsets are read-only
- **WHEN** the author selects Applications
- **THEN** the access dropdown offers only `Read`

#### Scenario: Content already used is disabled
- **WHEN** one card holds Files
- **THEN** Files is disabled in the dropdown of every other card

#### Scenario: Switching to a read-only type resets access
- **WHEN** a card holds Files with Read&Write and the author changes its content to Toolsets
- **THEN** its access becomes `Read`

### Requirement: Mapping to resource dependencies
Each saved entry SHALL map to one DIAL Core `resource_dependencies` entry `{ kind: "dial.resourceLink", link_id, target: { url }, access, required: false }`, where `url` is `<type>/{current-user}/` with `<type>` one of `files`, `projects`, `skills`, `prompts`, `conversations`, `applications`, `toolsets`, and `access` is `["READ"]` for Read and `["READ","WRITE"]` for Read&Write. `link_id` SHALL be generated, unique within the application, and SHALL stay the same for an entry that is edited but keeps its content type. The mapping SHALL never produce `write` for `applications` or `toolsets`. Loading SHALL be the inverse: an entry whose `url` is `<type>/{current-user}/` for a listed type, `required` false or absent, and `access` equal to Read or Read&Write, SHALL be shown as an editable entry.

#### Scenario: Read&Write for Files
- **WHEN** the author saves Files with Read&Write
- **THEN** the application carries `{ kind: "dial.resourceLink", link_id: <generated>, target: { url: "files/{current-user}/" }, access: ["READ","WRITE"], required: false }`

#### Scenario: Round trip
- **WHEN** an application with that entry is opened in the builder
- **THEN** a `Files: Read&Write` chip is shown and saving without changes sends the same entry with the same `link_id`

### Requirement: Entries the editor cannot represent are preserved
An entry that does not satisfy the loading rule (a fixed bucket such as `files/public/policies/`, a path below the bucket root, `required: true`, `write` only, a content type the host does not offer, or a second entry for a type already shown) SHALL be kept in the form state untouched and sent back unchanged on save, at its original position: an edited entry is replaced in place, a removed one is dropped, a new one is appended last, and no entry moves. It SHALL be shown as a read-only chip with no remove control and SHALL NOT appear in the modal.

#### Scenario: Admin-authored entry survives a user edit
- **WHEN** the application holds `files/public/policies/` (READ) and the author adds `Prompts: Read` and saves
- **THEN** the saved list holds the policies entry unchanged and the new prompts entry

#### Scenario: Unchanged list keeps its order
- **WHEN** the stored list is `[files(read), policies]`, the author opens the modal and saves without changes
- **THEN** nothing is sent for Access and a later save would still send `[files, policies]` in that order

#### Scenario: Read-only chip
- **WHEN** a preserved entry is shown
- **THEN** its chip has no remove control and the modal does not list it

### Requirement: Approval notice
While at least one entry (configured or preserved) exists, the section SHALL show an informational (blue) section message stating that the access takes effect only after the application is published and an administrator approves it. When editing an application that was already saved with entries, the message SHALL also state that saving changes can remove an earlier approval. The text SHALL come from host-supplied labels.

#### Scenario: Notice follows the entries
- **WHEN** the author removes the last entry
- **THEN** the approval notice is no longer shown

### Requirement: Saving and errors
Access SHALL be saved by its own step that runs after the app definition's own create or update has succeeded, for every definition that enables Access, and only when the section differs from its loaded baseline (a normalised, order-preserving comparison, access compared as a set). The step SHALL send the full mapped list. After a create it SHALL run against the created application. The definition's save SHALL NOT be undone when the Access step fails. Clearing all configured entries while preserved entries exist SHALL send only the preserved ones. When DIAL Core refuses the change because user-authored resource dependencies are not allowed (the refusal depends on the caller not being an administrator, not on who owns the bucket), the refusal SHALL NOT block the save: the rest of the save, including a publication or organisation-unit write started from the Save panel, SHALL complete without the new list, the Access draft SHALL be kept, and the builder SHALL show a dedicated warning that the access was not saved because only administrators can change it, never a generic failure. Any other failure of the Access step (network, server error) SHALL abort the save and show its error.

#### Scenario: Untouched section is omitted
- **WHEN** the author edits the description only
- **THEN** the update request carries no `resourceDependencies`

#### Scenario: Core refuses the change
- **WHEN** a non-administrator saves a changed list and Core answers 403 for that reason
- **THEN** the rest of the save completes without the new list, the author sees the warning that the access was not saved because only administrators can change it, and the Access draft is kept

#### Scenario: Refusal does not block a publication
- **WHEN** a non-administrator changes Access and saves into an Organization folder through the Save panel, and Core refuses the Access step for that reason
- **THEN** the application is saved and the publication request is created without the new list, and the warning is shown

#### Scenario: Refusal after create
- **WHEN** a new application is created with Access entries and Core refuses the Access step for that reason
- **THEN** the application is created and saved as usual without the new list, the warning is shown and the Access draft is kept

#### Scenario: Other failure of the Access step aborts the save
- **WHEN** the Access step fails for a reason other than that refusal, for example a network error
- **THEN** the save is aborted before anything is published, the error is shown once and the Access draft is kept

#### Scenario: Escape discards the modal draft
- **WHEN** the author presses Escape in the modal after editing a card
- **THEN** the modal closes, the draft is discarded and focus returns to the Configure button

#### Scenario: Deleting the trailing card does nothing
- **WHEN** the author activates delete on the trailing empty card
- **THEN** the card list is unchanged

### Requirement: Internationalisation, direction and accessibility
Every user-visible string of the section SHALL be a translation key filled by the host (`appsEditor.access.*`: `title`, `description`, `configure`, `selectContent`, `selectAccess`, `contentFiles`, `contentProjects`, `contentSkills`, `contentPrompts`, `contentConversations`, `contentApplications`, `contentToolsets`, `accessRead`, `accessReadWrite`, `removeEntry` (interpolates the entry label), `deleteCard`, `announceAdded`, `announceRemoved`, `loading`, `loadFailed`, `approvalNotice`, `approvalResetNotice`, `adminOnlyError`); Retry, Cancel, Save and Close SHALL reuse the shared button keys and the modal title SHALL reuse `title`; the component library SHALL carry English defaults only. The section and modal SHALL use logical (start/end) layout and SHALL be direction-agnostic otherwise. The modal SHALL trap focus and close on Escape (discarding the draft); chips' remove controls and card controls SHALL be keyboard operable with accessible names including the entry they act on; adding and removing an entry SHALL be announced through a polite live region.

#### Scenario: Stored list is loading or fails to load
- **WHEN** an existing application is opened and its stored list has not arrived, or the request failed
- **THEN** the section shows a loading indicator, or an error message with a retry action, instead of the chips and Configure button, and a save sends nothing for Access

#### Scenario: Remove control name
- **WHEN** a screen reader focuses the remove control of the `Files: Read` chip
- **THEN** its accessible name identifies the Files entry

#### Scenario: RTL layout
- **WHEN** the interface language is right-to-left
- **THEN** the Configure button, chips and card controls mirror without physical left/right classes
