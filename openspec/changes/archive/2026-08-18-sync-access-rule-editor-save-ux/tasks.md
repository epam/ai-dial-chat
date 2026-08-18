## 1. Verify shipped code matches the updated spec

- [x] 1.1 Confirm `PublishAccessRuleEditor.tsx`'s Save button is only gated by the `disabled` prop, never by validation state (already true on branch `publish-review`, commit `cad7cbf2f`).
- [x] 1.2 Confirm `hasAttemptedSave` surfaces the "required field" / "add at least one target" / regex inline errors described in the modified spec scenarios (already true).
- [x] 1.3 Confirm `PublishAccessRuleEditor.spec.tsx` asserts the click-to-validate behavior (Save enabled, `onSave` not called, inline error shown) for the no-source, zero-targets, and invalid-regex cases (already true).

## 2. Sync documentation

- [x] 2.1 Write the `publish-access-rules-editor` delta spec replacing the disabled-until-valid scenarios with click-to-validate scenarios (this change's `specs/publish-access-rules-editor/spec.md`).
- [x] 2.2 Run `openspec validate sync-access-rule-editor-save-ux --strict` and fix any structural issues before archiving (passed: "Change 'sync-access-rule-editor-save-ux' is valid").

## 3. Archive

- [x] 3.1 Run `/opsx:archive` once this change is approved, so `openspec/specs/publish-access-rules-editor/spec.md` is updated in place and this change moves to `openspec/changes/archive/`.
