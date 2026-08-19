## 1. Remove the removal-confirmation step

- [x] 1.1 In `libs/skill-editor/src/components/SkillEditor/SkillEditor.tsx`, drop `pendingRemovePath` state and the `ConfirmationPopup` block; wire the Remove context-menu action to remove the node immediately (and reset `selectedPath` to `SKILL_MANIFEST_PATH` if the removed node was selected).
- [x] 1.2 Restyle the Remove context-menu item to the neutral (non-danger) icon/label treatment shown in the Figma reference (node `559:22061`).
- [x] 1.3 Drop the now-unused `removeConfirmTitle`/`removeConfirmMessage`/`removeConfirmLabel`/`removeCancelLabel` fields from `SkillEditorLabels` (`libs/skill-editor/src/models/skill-editor-props.ts`), their wiring in `apps/chat/src/pages/SkillEditor/SkillEditor.tsx`, and their i18n keys/strings (`translation-keys.ts`, `en.json`).
- [x] 1.4 Manually verify in the running app (create and edit skill forms) that clicking Remove on a supporting file removes it immediately with no confirmation dialog. Confirmed by the user as done.

## 2. Fix the edit-mode save notification title

- [x] 2.1 Add `UpdateSuccessTitle` to `SkillEditorI18nKeys` (`apps/chat/src/constants/translation-keys.ts`) and `"updateSuccessTitle": "Skill updated"` to `apps/chat/src/i18n/locales/en.json`.
- [x] 2.2 In `apps/chat/src/pages/SkillEditor/hooks/useSkillEditorSubmit.ts`'s `handleSubmitEdit`, use `SkillEditorI18nKeys.UpdateSuccessTitle` instead of `SaveSuccessTitle` for the post-save notification title.

## 3. Test coverage

- [x] 3.1 Update `libs/skill-editor`'s `SkillEditor` test suite: remove the `ConfirmationPopup` mock/assertions and replace the confirm/cancel tests with a single "removes immediately, no confirmation" test.
- [x] 3.2 Add/extend a test in `apps/chat/src/pages/SkillEditor/tests/SkillEditor.spec.tsx` asserting the edit-mode save notification's `title` is the update-specific text, not the create-mode title.

## 4. Verification

- [x] 4.1 Run `npm exec nx test @epam/ai-dial-skill-editor` and `npm exec nx lint @epam/ai-dial-skill-editor`.
- [x] 4.2 Run `npm exec nx affected -t test lint --base=origin/development-1.0` and confirm no regressions beyond the pre-existing, unrelated `GeneralForm.spec.tsx` prettier lint issue.
