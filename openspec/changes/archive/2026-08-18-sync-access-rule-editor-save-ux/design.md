## Context

`PublishAccessRuleEditor`'s Save-button UX was already changed and shipped on branch `publish-review` (commit `cad7cbf2f`): the button is always enabled, and an invalid Save click now sets an internal `hasAttemptedSave` flag that surfaces inline `invalid`/`error` props on the `Select`/`TagInput`/`Input` fields instead of disabling the button. Code, styling, and tests are already merged and passing (211/211, lint/typecheck clean). This design covers only the resulting spec-text update — there is no code to design.

## Goals / Non-Goals

**Goals:**

- Rewrite the affected Requirement/Scenario blocks in `openspec/specs/publish-access-rules-editor/spec.md` so they describe the shipped click-to-validate behavior instead of the old disabled-until-valid behavior.
- Keep the rest of the spec (rule model, add/remove/clear, REGEX length cap, 20-rule/20-target caps, disabled-while-submitting) untouched, since none of that changed.

**Non-Goals:**

- No frontend code, test, or styling changes — `PublishAccessRuleEditor.tsx` and its spec file are already correct and are not touched by this change.
- No re-litigation of whether click-to-validate is the right UX — that decision was already made and implemented; this change only documents it.

## Decisions

- **Spec wording keeps "SHALL" normative language** but replaces "disable the Save action" with "Save remains enabled; activating it does not call `onSave` and shows \<field\> inline error" — matching how the rest of the spec already phrases inline-error scenarios (e.g. the existing REGEX inline-error text) so the delta reads consistently with untouched requirements.
- **`hasAttemptedSave` is treated as an implementation detail, not a spec-level concept.** The spec describes observable behavior (Save stays clickable; clicking while invalid shows errors and does not save) rather than naming the internal state variable, consistent with how the rest of the spec avoids naming component internals.
- **Colors/labels additions get one sentence, not new requirements.** `targetsHintLabel`, `requiredFieldError`, `targetsRequiredError`, and the `PublishAccessRuleEditorColors` field churn (`border` removed; `selectBorder`/`selectBorderOpen`/`selectBorderFocus` added; `background` fallback changed) are additive styling/label plumbing that supports the behavior change but isn't independently spec-worthy, per the existing spec's pattern of not enumerating every label/color prop.

## Risks / Trade-offs

- [Spec drift recurring if a future PR changes this UX again without a matching spec update] → Mitigation: none beyond normal review process; this change doesn't introduce new tooling, it just closes the current gap.
