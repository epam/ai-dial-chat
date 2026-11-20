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

## ADDED Requirements

### Requirement: A taken name in a direct-write folder is reported before Save

While the committed destination of the Save panel is a folder that takes a direct write into an org unit, the panel SHALL ask the backend, through the existing target check of `catalog-publish-api`, whether a resource already exists at `public/{folder}/{name}` for the name this save would write, and when one does SHALL disable Save and show the reason `resourceSavePanel.targetTaken` ("“{{name}}” already exists in {{folder}}. Choose another folder or save as a new version.") for "Keep version", or `resourceSavePanel.targetTakenVersion` ("Version {{version}} of “{{name}}” already exists in {{folder}}. Choose another folder or version.") for "Save as new version". The name asked is the resource's own: for "Keep version" the stored name (the check is asked without a version), for "Save as new version" the name carrying the typed version, asked only once the typed version matches the version pattern and differs from the current one and 400 ms after the last keystroke. The check SHALL run once per change of the committed destination and once per settled change of a valid new version; an answer that arrives after the destination or version changed SHALL be discarded. It SHALL NOT run for a Personal destination, a folder created in this session, or a destination that sends a publication request. A failed check SHALL leave Save enabled: the refusal after the save remains the safety net and is reported as before. The check reads the target with the caller's own rights, so a copy the caller cannot read is reported as free. The reason SHALL be exposed through the same disabled-destination reason the panel already shows (RTL: logical properties only; accessibility: the reason is linked to the destination with `aria-describedby`).

#### Scenario: Name already taken

- **GIVEN** a unit folder that already holds the application under its stored name
- **WHEN** the user chooses that folder with "Keep version"
- **THEN** Save is disabled and the reason names the application and the folder

#### Scenario: Free folder

- **WHEN** the user chooses a unit folder that holds no such name
- **THEN** Save stays enabled

#### Scenario: New version already taken

- **GIVEN** the folder holds `{name}__2.0.0`
- **WHEN** the user chooses "Save as new version" and types `2.0.0`
- **THEN** Save is disabled with the reason; typing `2.1.0` re-enables it

#### Scenario: Invalid version is not asked

- **WHEN** the typed version does not match the version pattern
- **THEN** no check is sent

#### Scenario: Check fails

- **WHEN** the target check request rejects
- **THEN** Save stays enabled and a taken name is still reported after the save

#### Scenario: Stale answer

- **WHEN** an answer arrives after the user chose another folder
- **THEN** it is ignored

#### Scenario: No check outside a direct-write folder

- **WHEN** the destination is under Personal or sends a publication request
- **THEN** no check is sent
