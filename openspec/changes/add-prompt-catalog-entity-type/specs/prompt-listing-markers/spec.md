# Spec: DIAL folder markers are excluded from prompt listings

## ADDED Requirements

### Requirement: Prompt listings drop `.dial_folder` markers

Prompt listings SHALL exclude `.dial_folder` marker paths. DIAL Core writes a `.dial_folder` marker file to keep an otherwise-empty folder alive; it is a storage artefact, not a prompt, so reading it as one yields a broken entry in every listing.

`isHiddenPromptPath` (`apps/chat-api/src/prompts/utils/prompt-mapper.util.ts`) SHALL report whether any segment of a path equals `HIDDEN_FILE` (`.dial_folder`). The check MUST be segment-exact, not a substring test, so a prompt legitimately named `my.dial_folder-notes` survives.

The filter SHALL be applied in:

- `PromptsPersonalService.listPrompts` — before any prompt body is read, so markers cost no round-trips
- `PromptsPersonalService.getSharedPrompts` — a shared folder's marker is shared with it
- `PromptsPublicService.listPublicPrompts`
- `PromptsFolderService.renameFolder` — a marker cannot be read as a prompt, so copying it to the new path would fail the whole rename; it is skipped and left behind

The prompts module's own `.folder` sentinel SHALL keep its existing meaning: it is still used to derive folders that contain no prompts.

This matches the established precedent in `conversation-listing.service.ts`, `deployments-listing.service.ts`, and `toolset-mapper.util.ts`.

#### Scenario: A marker beside a prompt is dropped from the personal list

- **WHEN** DIAL Core returns metadata for `Work/.dial_folder` and `Work/summarize`
- **THEN** the response's `prompts` contains only `Work/summarize`
- **AND** no read is attempted for the marker path

#### Scenario: A marker in a shared folder is dropped from `sharedWithMe`

- **WHEN** `getSharedResources` returns `prompts/owner-bucket/Shared/.dial_folder` and `prompts/owner-bucket/Shared/review`
- **THEN** `sharedWithMe` contains only the prompt

#### Scenario: Markers are dropped from the public list

- **WHEN** the public bucket contains markers at the root and inside `Templates/`, plus one real prompt
- **THEN** only the real prompt is returned

#### Scenario: Folders derived from surviving prompts are unaffected

- **WHEN** `Work/AI/` holds a marker and one prompt
- **THEN** the derived folders are `Work` and `Work/AI`

#### Scenario: A prompt whose name merely contains the marker text is kept

- **WHEN** a prompt is named `my.dial_folder-notes`
- **THEN** it appears in the listing
