# Spec Delta

## MODIFIED Requirements

### Requirement: Save panel main view

The panel SHALL be `StandaloneSaveToFolderPanel` from `@epam/ai-dial-publish-panel`, an end-edge `SideDrawer` that behaves as a modal dialog. Its title is an `h1` reading "Save {resource type}". The main view SHALL render, in order:

1. the entity summary (`ResourceSummary`): icon, type badge, name, and current version for versioned resources;
2. a **Save to folder** section showing the committed destination as the kit `FolderName` — the file manager's folder icon, then the root label and folder segments joined with " / " in a secondary text color, truncated with the full path in a tooltip — followed by a small ghost **Change** action;
3. for versioned resources only (applications, toolsets), a **Version** section rendered as the kit `RadioGroup` with a visible legend:
   - "Keep version {current}", selected by default;
   - "Save as new version", which reveals a required Version input that starts empty;
4. for versioned resources only, a **Versions history** section (`resource-version-history`), the last section of the body;
5. a footer with Cancel and Save.

Prompts and skills SHALL render no Version section and no Versions history section. The panel SHALL NOT render a Dependencies section.

The initial destination SHALL be the Personal root with the resource's current folder (`parseResourceFolderPath(id)` from `@epam/ai-dial-chat-hooks`).

i18n keys:

- `ResourceSavePanelI18nKeys.Title` (with `{type}`), `SaveToFolderHeading`, `ChangeFolder`, `KeepVersion` (with `{version}`), `SaveAsNewVersion`, `NewVersionLabel`, `NewVersionPlaceholder`, `PersonalRoot`, plus the keys of the Versions history section;
- `EditorI18nKeys.VersionLabel` for the Version heading;
- `ButtonsI18nKeys.Save`, `ButtonsI18nKeys.Cancel`.

RTL: logical properties only.

#### Scenario: Default state for a versioned resource
- **WHEN** the panel opens for Quick App `Design Review Agent` at version `1.0.0` in the Personal root
- **THEN** the summary shows the name with `1.0.0`, Save to folder reads "Personal", "Keep version 1.0.0" is selected, a Versions history section is the last section of the body, and no Dependencies section is rendered

#### Scenario: Default state for a prompt in a folder
- **WHEN** the panel opens for a prompt whose id is `prompts/{bucket}/Work/AI/Summarize`
- **THEN** Save to folder reads "Personal / Work / AI" and no Version section is rendered

#### Scenario: No history or dependencies
- **WHEN** the panel is open for a prompt or a skill
- **THEN** no Versions history section and no Dependencies section is rendered

### Requirement: New version input validation

When "Save as new version" is selected, Save SHALL stay disabled until the input holds a version that matches the shared version rule (`resource-version-pattern`) and differs from the current version. The error text SHALL be wired through the kit `Input` `error` prop (`aria-invalid` and `aria-describedby`). It shows after blur or a submit attempt.

When the backend answers 409 (the version already exists in the target folder), the input SHALL show `ResourceSavePanelI18nKeys.VersionExists`, and the panel SHALL stay open with nothing else persisted.

i18n keys: `ResourceSavePanelI18nKeys.VersionInvalid`, `VersionUnchanged`, `VersionExists`.

#### Scenario: Text version passes the format check
- **WHEN** the user selects "Save as new version" and types `beta-2`
- **THEN** no format error is shown and Save is enabled

#### Scenario: Invalid version is rejected
- **WHEN** the user types a version containing a space, ending with a dot, containing `__`, starting with `_`, or longer than 64 characters
- **THEN** the input shows "VersionInvalid" after blur and Save is disabled

#### Scenario: Unchanged version is rejected
- **WHEN** the user selects "Save as new version" and types the current version `1.0.0`
- **THEN** the input shows "VersionUnchanged" after blur and Save is disabled

#### Scenario: Existing version is rejected by the backend
- **WHEN** the user saves as new version `1.1.0` and the backend answers 409
- **THEN** the input shows "VersionExists", the panel stays open, and the old version is unchanged
