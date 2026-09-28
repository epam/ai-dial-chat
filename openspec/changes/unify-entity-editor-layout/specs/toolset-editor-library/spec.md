## MODIFIED Requirements

### Requirement: EditorLayout composition
`ToolsetEditor` SHALL use `EntityEditor` from `@epam/ai-dial-builder-form` as its outer shell. `EntityEditor` in turn composes `EditorLayout` with a Metadata `EditorSection` and a Setup `EditorSection`. `ToolsetEditor` passes:

- `metadata`: `MetadataForm` with every field.
- `setup`: the internal `SettingsForm`.
- `submitLabel`: the resolved Create or Save label.
- `onCancel`, `onBack` and `isSubmitting`.

The metadata values, touched state and validation codes SHALL come from `useMetadataForm` (with `validateVersionPattern: true`, unchanged). The endpoint and auth validation stays in `ToolsetEditor`.

On mobile the two sections SHALL stack vertically (Metadata first). The lib SHALL NOT render a footer button bar, a wizard indicator or a preview pane.

#### Scenario: Both sections visible at desktop width
- **WHEN** the editor renders at desktop width
- **THEN** the Metadata section (left) and Setup section (right) are both visible simultaneously

#### Scenario: Sections stack on mobile
- **WHEN** the editor renders at mobile width
- **THEN** Metadata renders above Setup, both reachable by scrolling, with no tab or step navigation

#### Scenario: Shell comes from EntityEditor
- **WHEN** `libs/toolset-editor/src/**` is searched for direct `EditorLayout` or `EditorSection` usage
- **THEN** none are found, and the shell renders through `EntityEditor`

### Requirement: GeneralForm shared surface
The Metadata field set SHALL live in `@epam/ai-dial-builder-form` as `MetadataForm` (see `builder-form`). `@epam/ai-dial-toolset-editor` SHALL keep exporting `GeneralForm`, `GeneralFormProps` and `GeneralFormLabels` with their current props, marked `@deprecated`. `GeneralForm` SHALL be a thin wrapper that renders `MetadataForm` and supplies `avatarPicker.resolveAttachedIconUrl` through `dialFileToAttachment` from `@epam/ai-dial-chat-hooks`. It SHALL contain no field markup or picker state of its own.

Every host concern stays injected:

- `bucket` (storage bucket)
- `FileManagerModal` (host file-manager modal component)
- `resolveIconUrl` (icon URL resolution)
- `allowedMimeTypes` / `maxFileSizeBytes` (avatar restrictions)
- `availableLocaleOptions` (locale choices)

The form SHALL NOT resolve the current user, import a file-manager implementation or build locale options itself. Its labels SHALL be an object whose `form` and `avatarPicker` groups are each optional and are replaced as a whole when supplied.

#### Scenario: Avatar picking goes through the host file manager
- **WHEN** a user clicks "Add avatar" and picks a file
- **THEN** the file is resolved through the host-supplied `FileManagerModal` and bucket, and the resulting URL is reported through `onChange({ iconUrl })`

#### Scenario: Deprecated wrapper renders the shared component
- **WHEN** a consumer imports `GeneralForm` from `@epam/ai-dial-toolset-editor`
- **THEN** it renders `MetadataForm` from `@epam/ai-dial-builder-form` with the same fields, labels and avatar behaviour as before
