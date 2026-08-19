## Why

The Skill create/edit form had two file/notification bugs: clicking "Remove" on an attached supporting file required a confirmation dialog that turned out to be unwanted friction (and was, separately, invisible due to a missing prop), and saving an edited skill always showed the create-mode "Skill created" success notification instead of an update-specific one.

## What Changes

- Remove the removal-confirmation step entirely from `libs/skill-editor`'s `SkillEditor` component: clicking "Remove" on a supporting file/folder node now removes it immediately, with no confirmation popup.
- Restyle the Remove context-menu item to match the Figma reference (plain/neutral icon+label, not the red "danger" treatment it had before).
- Fix `apps/chat/src/pages/SkillEditor/hooks/useSkillEditorSubmit.ts` so a successful edit-mode save shows an "Skill updated" success notification title, distinct from create mode's "Skill created" — it was hard-coded to the create-mode title in both paths.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `skill-editor-library`: The "Adding and removing supporting files and folders" requirement changes from requiring a confirmation step before removing a committed entry to removing it immediately on the Remove action, with no confirmation.
- `skill-editing`: The "Edit-specific labels and success notification" requirement is tightened to make explicit that the edit-mode success notification's title (not just its message) must be distinct from create mode's, closing the gap that let both paths render the same "Skill created" title.

## Impact

- `libs/skill-editor/src/components/SkillEditor/SkillEditor.tsx`: drop the `pendingRemovePath` state and `ConfirmationPopup` rendering; `getContextMenuItems`'s Remove action now calls the removal (and selection-reset) logic directly. Remove item restyled to a neutral icon/label per Figma (node `559:22061`).
- `libs/skill-editor/src/models/skill-editor-props.ts`: drop the now-unused `removeConfirmTitle`/`removeConfirmMessage`/`removeConfirmLabel`/`removeCancelLabel` label fields from `SkillEditorLabels`.
- `apps/chat/src/pages/SkillEditor/SkillEditor.tsx`: drop the now-unused label wiring for the removed confirmation copy.
- `apps/chat/src/pages/SkillEditor/hooks/useSkillEditorSubmit.ts`: `handleSubmitEdit`'s success notification now uses a new `UpdateSuccessTitle` i18n key instead of reusing `SaveSuccessTitle`.
- `apps/chat/src/constants/translation-keys.ts` / `apps/chat/src/i18n/locales/en.json`: add `updateSuccessTitle` ("Skill updated"); remove the now-unused `removeConfirmTitle`/`removeConfirmMessage`/`removeConfirmLabel`/`removeCancelLabel` keys.
- No API, DTO, or routing changes.
