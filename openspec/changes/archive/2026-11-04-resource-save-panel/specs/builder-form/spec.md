## ADDED Requirements

### Requirement: MetadataForm can render the Version field read-only
`MetadataForm` (`libs/builder-form/src/components/MetadataForm/MetadataForm.tsx`) SHALL accept `isVersionReadOnly?: boolean` (default `false`) and `versionReadOnlyTooltip?: string`, declared on `MetadataFormProps` in `libs/builder-form/src/models/metadata-form-props.ts`. They mirror `isNameReadOnly` / `nameReadOnlyTooltip`:

- the Version input renders with the native `readOnly` attribute, so it stays focusable and assistive tech announces it as read-only (unlike Name, which `isNameReadOnly` renders disabled);
- the tooltip is passed to the kit `Input` as `tooltipText`;
- typing reports no `onChange`, and `onVersionBlur` is not called.

Both props are forwarded unchanged to `DeploymentCreationForm` (`libs/builder-form/src/models/deployment-creation-form.ts`), which owns the default.

The tooltip default is the English `'The version is changed with "Save as new version"'`. The lib reads no i18n, and the host passes the translated string. RTL impact: none beyond the existing field, since the tooltip placement uses logical sides.

#### Scenario: Read-only version
- **WHEN** `MetadataForm` renders with `isVersionReadOnly`
- **THEN** the Version input is read-only, keeps its value, and fires no `onChange` on typing

#### Scenario: Default is editable
- **WHEN** `isVersionReadOnly` is omitted
- **THEN** the Version input is editable, as before
