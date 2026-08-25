## Why

Branch `publish-review` (commit `cad7cbf2f`) already shipped and tested a UX change to `PublishAccessRuleEditor`'s Save button: it is no longer disabled while the in-progress rule is invalid. Instead, clicking Save while invalid now surfaces inline field errors and does not call `onSave`, but the button itself stays enabled throughout. `openspec/specs/publish-access-rules-editor/spec.md` still documents the old disabled-until-valid contract in three places, so the spec no longer matches the shipped behavior. This change brings the spec back in sync — no new frontend work, just a documentation update for behavior that is already implemented, tested (211/211 passing), linted, and typechecked.

## What Changes

- Replace the "Save is disabled with no source selected" and "Save is disabled with zero targets" scenarios with scenarios describing the new click-to-validate flow: Save stays enabled, a click while invalid shows a "This field is required." / "Add at least one target." inline error and does not call `onSave`.
- Update the REGEX requirement's normative text and its "Invalid regex shows an inline error and blocks save", "Empty regex is treated as invalid", and "Oversized regex is rejected before parsing" scenarios to drop the "disables Save" claim in favor of "Save click has no effect (onSave is not called) and the inline error is shown."
- Add a short note that Save is now only disabled by the host's `isSubmitting`/`disabled` prop, never by validation state alone.
- Note in passing (not as new requirements) that `PublishAccessRuleEditorLabels` gained `targetsHintLabel`, `requiredFieldError`, `targetsRequiredError`, and that `PublishAccessRuleEditorColors` dropped `border` in favor of `selectBorder`/`selectBorderOpen`/`selectBorderFocus` with `background`'s fallback changed to `--bg-layer-base` — incidental styling/label additions accompanying the behavior change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `publish-access-rules-editor`: the single-rule editor's Save-button requirement changes from "disabled until the rule is structurally/validly complete" to "always enabled (except while the host disables the section); an invalid Save click shows inline errors and does not call `onSave`".

## Impact

- `openspec/specs/publish-access-rules-editor/spec.md` — spec text updated to match already-shipped code.
- `libs/publish-panel/src/components/PublishAccessRuleEditor/PublishAccessRuleEditor.tsx` — already implemented, no further change.
- `libs/publish-panel/src/components/PublishAccessRuleEditor/tests/PublishAccessRuleEditor.spec.tsx` — already updated, no further change.
- No backend, API, or other capability impact.
