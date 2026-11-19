# Spec Delta

## MODIFIED Requirements

### Requirement: Save panel main view

The panel SHALL be `StandaloneSaveToFolderPanel` from `@epam/ai-dial-publish-panel`, an end-edge `SideDrawer` that behaves as a modal dialog. Its title is an `h1` reading "Save {resource type}". The main view SHALL render, in order:

1. the entity summary (`ResourceSummary`): icon, type badge, name, and current version for versioned resources;
2. a **Save to folder** section showing the committed destination as the kit `FolderName` — the file manager's folder icon, then the root label and folder segments joined with " / " in a secondary text color, truncated with the full path in a tooltip — followed by a small ghost **Change** action;
3. for versioned resources only (applications, toolsets), a **Version** section rendered as the kit `RadioGroup` with a visible legend:
   - "Keep version {current}", selected by default;
   - "Save as new version", which reveals a required Version input;
4. for an application, while the committed destination is under the Organization root, a **Dependencies** section (below);
5. a footer with Cancel and Save.

Prompts SHALL render no Version section. The panel SHALL NOT render a Versions history list.

The **Dependencies** section is informational and SHALL NOT change `isSubmitDisabled` or any submit behavior. For a schema-form application it lists the private dependencies of the current form values, worded as dependencies that are saved or published together with the application (the `Published` appearance and the `publish.dependenciesPublished*` keys of the application's Publish panel). For an application with an embedded editor (for example a Quick App) it shows one neutral sentence and no list, because the current values exist only inside the editor: `resourceSavePanel.dependenciesEmbeddedNote`, "The prompts, skills, toolsets and applications this application uses will be saved to the folder together with it." For every other resource, and for a Personal destination, it renders nothing.

While the committed destination is a unit folder the user may write to, and the application has an uploaded icon, and the user lacks `write` on `files` in that unit, the panel SHALL also show a non-blocking notice under the destination: `resourceSavePanel.iconNotCopiedNotice`, "The application's icon will not be copied to this folder: you have no write access to files in it." Save stays enabled.

The initial destination SHALL be the Personal root with the resource's current folder (`parseResourceFolderPath(id)` from `@epam/ai-dial-chat-hooks`).

i18n keys:

- `ResourceSavePanelI18nKeys.Title` (with `{type}`), `SaveToFolderHeading`, `ChangeFolder`, `KeepVersion` (with `{version}`), `SaveAsNewVersion`, `NewVersionLabel`, `NewVersionPlaceholder`, `PersonalRoot`;
- `ResourceSavePanelI18nKeys.DependenciesEmbeddedNote` (`resourceSavePanel.dependenciesEmbeddedNote`) and `ResourceSavePanelI18nKeys.IconNotCopiedNotice` (`resourceSavePanel.iconNotCopiedNotice`);
- `EditorI18nKeys.VersionLabel` for the Version heading;
- `ButtonsI18nKeys.Save`, `ButtonsI18nKeys.Cancel`.

RTL: logical properties only. Accessibility: the note and the notice are plain text in the panel's reading order; none is a live region, because both are present when the destination is chosen, not announced after it.

#### Scenario: Default state for a versioned resource
- **WHEN** the panel opens for Quick App `Design Review Agent` at version `1.0.0` in the Personal root
- **THEN** the summary shows the name with `1.0.0`, Save to folder reads "Personal", and "Keep version 1.0.0" is selected

#### Scenario: Default state for a prompt in a folder
- **WHEN** the panel opens for a prompt whose id is `prompts/{bucket}/Work/AI/Summarize`
- **THEN** Save to folder reads "Personal / Work / AI" and no Version section is rendered

#### Scenario: No history or dependencies
- **WHEN** the panel is open for any resource with a Personal destination
- **THEN** no Versions history list and no Dependencies section is rendered

#### Scenario: Schema-form application to an Organization folder
- **WHEN** the destination is under the Organization root and the form values refer to a private skill
- **THEN** the Dependencies section lists that skill with the "published together" wording

#### Scenario: Quick App to an Organization folder
- **WHEN** the destination is under the Organization root and the application is a Quick App
- **THEN** the Dependencies section shows the neutral sentence and no list

#### Scenario: Icon cannot be copied
- **GIVEN** an application with an uploaded icon and a user without `write` on `files` in the unit
- **WHEN** the committed destination is a folder in that unit
- **THEN** the icon notice is shown and Save is enabled
