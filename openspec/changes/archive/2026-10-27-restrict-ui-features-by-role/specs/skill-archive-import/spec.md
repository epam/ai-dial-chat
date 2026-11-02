## MODIFIED Requirements

### Requirement: Catalog "Upload" entry imports a Skill archive or a standalone manifest

When skill creation permission passes, the Catalog Create dropdown's "Upload" entry (child of the "Skill" submenu, see `catalog-create-options`) SHALL open the "Upload skill" dialog (`apps/chat/src/components/SkillArchiveUploadDialog`, a host adapter over `@epam/ai-dial-skills`' `SkillArchiveUploadDialog`, which renders the ui-kit `FileDropzone`) whose accepted-file hint is `SKILL_ARCHIVE_ACCEPT` (`'.zip,.md'`, `apps/chat/src/constants/skills.ts`). The picked or dropped file SHALL be uploaded to the BFF's import endpoint through `apps/chat/src/hooks/skills/useSkillArchiveImport.ts` (host adapter over the headless `useSkillArchiveImport` controller in `@epam/ai-dial-chat-hooks`), and — on success — the host SHALL raise the Skill-created success notification, refresh `SkillsContext`, and close the dialog, so the newly created Skill appears in the Catalog without a manual page reload. The `accept` attribute is a browser-level hint only; the BFF, not the picker, is the authority on whether a given upload is accepted.

The app adapter SHALL consult the same skill creation decision as the catalog menu before opening the dialog, accepting a selected/dropped file, and dispatching an import request. Denied, loading, or unavailable permission SHALL block all three actions. Losing permission SHALL close an idle dialog, and an already-open picker or stale callback MUST NOT dispatch a new request. The reusable import controller SHALL receive guarded callbacks without learning about roles, app config, or auth. Existing skill editing/file replacement flows SHALL remain unaffected. Requests already sent are not retroactively revoked by this UI policy. Successful import scenarios below assume creation permission passes.

Before submitting, the client SHALL perform a filename pre-check as a UX shortcut, not a security control: a selected file whose name ends in `.md` (case-insensitive) but is not exactly `SKILL.md` (case-sensitive) SHALL be rejected locally with `SkillArchiveSelectionRejectionReason.UnsupportedFilename` (rendered as `SkillArchiveImportI18nKeys.ErrorUnsupportedFilename` under the drop area), without calling the import endpoint. A drop whose files `accept` excluded SHALL be rejected the same way. Any other file (including any `.zip`, or a file named exactly `SKILL.md`) SHALL be submitted to the BFF.

#### Scenario: Selecting a valid archive creates a Skill and refreshes the Catalog
- **WHEN** a user selects a well-formed Skill ZIP archive through the "Upload" file picker
- **THEN** the archive is uploaded, a Skill is created, `SkillsContext.refetchSkills()` is called, and the new Skill appears in the Catalog

#### Scenario: Selecting a valid standalone SKILL.md creates a Skill and refreshes the Catalog
- **WHEN** a user selects a file named exactly `SKILL.md` with valid YAML frontmatter through the "Upload" file picker
- **THEN** the file is uploaded, a Skill containing only that manifest file is created, `SkillsContext.refetchSkills()` is called, and the new Skill appears in the Catalog

#### Scenario: A Markdown file with the wrong name is rejected before any request is sent
- **WHEN** a user selects a file named `skill.md` (wrong case) or `readme.md` (wrong name) through the "Upload" file picker
- **THEN** the dialog shows the unsupported-filename error immediately and does not call the import endpoint

#### Scenario: Re-selecting the same file re-triggers the upload
- **WHEN** a user selects the same file a second time immediately after a prior selection, whether the prior attempt was an archive or a standalone manifest
- **THEN** the ui-kit `FileDropzone` resets its hidden file input's value after the first selection so the native `onChange` event fires again and the upload (or the local filename pre-check) is re-attempted

#### Scenario: A second upload cannot start while one is in progress
- **WHEN** a user triggers "Upload" while a previous import (archive or standalone manifest) for this user is still in flight
- **THEN** `openDialog` and `handleFilesSelected` are no-ops while the request is in flight, so no second concurrent import starts

#### Scenario: A failed import is shown in the still-open dialog
- **WHEN** the import request for a selected file fails with any status (e.g. `400` for a non-ZIP or a ZIP without `SKILL.md`, or `502`/`503` from an upstream timeout)
- **THEN** the "Upload skill" dialog, which stayed open with its drop area disabled and a spinner shown while the request ran, remains open and renders the classified error message under the drop area, with the drop area enabled again so another file can be picked
- **AND** only an unmapped/generic failure additionally raises an error toast, because that toast carries the request trace id

#### Scenario: Closing the dialog mid-upload aborts the request
- **WHEN** the user closes the "Upload skill" dialog while an import request is still in flight
- **THEN** the request is aborted, its eventual outcome is ignored, and "Upload" reopens the dialog immediately in its idle state

#### Scenario: Denied skill creation never sends an import
- **WHEN** skill creation is denied and a file selection or upload callback is invoked
- **THEN** no ZIP or standalone-manifest import request is dispatched

#### Scenario: Permission changes while the picker is open
- **WHEN** the picker was opened with permission but config now denies creation before file selection
- **THEN** selecting the file does not dispatch an import and the idle dialog closes

