## Context

Two independent issues were found in the Skill editor while working the original "Remove does nothing" bug report:

1. `libs/skill-editor/src/components/SkillEditor/SkillEditor.tsx` originally required a confirmation popup before removing a supporting file/folder node. Product feedback after the first fix (which made that popup actually visible) was that the confirmation step itself is unwanted friction and should be dropped — Remove should act immediately, like the neutral (non-danger) styling in the Figma reference (node `559:22061`) already implies.
2. `apps/chat/src/pages/SkillEditor/hooks/useSkillEditorSubmit.ts`'s `handleSubmitEdit` always used `SkillEditorI18nKeys.SaveSuccessTitle` ("Skill created") for its post-save notification title, even though it already correctly used an edit-specific `message` (`UpdateSuccess`). Only the message varied by mode; the title didn't.

## Goals / Non-Goals

**Goals:**
- Remove a supporting file/folder from the tree immediately on the Remove action, with no confirmation step.
- Show "Skill updated" (not "Skill created") as the notification title after a successful edit-mode save.

**Non-Goals:**
- Reintroducing any confirmation UX for removal (explicitly rejected by product feedback).
- Changing the notification *message* body — `CreateSuccess`/`UpdateSuccess` were already correct; only the *title* was wrong.
- Any other Skill editor copy/behavior changes.

## Decisions

- **Remove `pendingRemovePath` state and the `ConfirmationPopup` block entirely** from `SkillEditor.tsx`, rather than keeping the state and skipping the popup — the state existed only to gate the popup, so with the popup gone it's dead. `getContextMenuItems`'s Remove action now calls a `handleRemoveNode(path)` helper directly, which invokes `fileActions.onRemoveNode` and resets `selectedPath` to `SKILL_MANIFEST_PATH` if the removed node was selected (preserving that side effect from the old `onConfirm` handler).
- **Drop the now-dead `removeConfirmTitle`/`removeConfirmMessage`/`removeConfirmLabel`/`removeCancelLabel` label props** from `SkillEditorLabels` (and their i18n keys/host wiring) rather than leaving them unused — an unread prop is a silent lie in the public API.
- **Add a new `UpdateSuccessTitle` i18n key** ("Skill updated") rather than reusing/renaming `SaveSuccessTitle` — `SaveSuccessTitle` ("Skill created") is still correct for the create path; the two modes need two distinct keys, matching how `CreateSuccess`/`UpdateSuccess` already work for the message body.

## Risks / Trade-offs

- [Risk] Removing the confirmation step means a misclick permanently drops a supporting file with no undo → Mitigation: this is an explicit, deliberate UX decision (product feedback), and the file is only removed from the in-memory editor state until the form is saved — a user can still Cancel out of the whole form without persisting the removal.

## Migration Plan

Not applicable — component-local state/UI removal plus a new i18n key, no data migration, no rollout sequencing.
