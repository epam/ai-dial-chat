## Context

Publication filters support three match functions: `Equal`, `Contain`, and `Regex`. For the `Regex` function, the user types a pattern into `RegexParamInput`. Currently, no syntax validation is performed — the field accepts any string including whitespace-only values. Invalid patterns are silently passed to the backend and fail at evaluation time.

The fix is entirely client-side: validate the pattern string using `new RegExp()` before enabling the save/add action, and surface an error message inline when the pattern is invalid.

Relevant files:
- `apps/chat/src/components/Chat/Publish/RegexParamInput.tsx` — the text input component
- `apps/chat/src/components/Chat/Publish/TargetAudienceFilterComponent.tsx` — owns save-button enabled state via `getPreparedFilterParams()`
- `apps/chat/src/components/Chat/__tests__/TargetAudienceFilter.test.tsx` — existing unit tests

## Goals / Non-Goals

**Goals:**
- Validate regex syntax in the browser using the native `RegExp` constructor (no extra libraries).
- Show an inline error message when the pattern is syntactically invalid.
- Disable the save/add button while the pattern is invalid or empty/whitespace.
- Treat whitespace-only input as invalid (empty regex).

**Non-Goals:**
- Semantic validation (does the regex match expected values?).
- Validation of rules already saved to the server.
- Changes to the `Equal` or `Contain` filter paths.
- Redux store changes.

## Decisions

### Decision: Use native `RegExp` constructor for validation

`new RegExp(pattern)` throws a `SyntaxError` when the pattern is syntactically invalid. This is zero-dependency and consistent with how DIAL Core evaluates the pattern server-side (also ECMA-262 regex). The alternative — shipping a third-party regex parser — adds bundle weight for no additional accuracy.

### Decision: Validate in `RegexParamInput`, propagate validity via callback

`RegexParamInput` is the single place that knows the current pattern text. Adding an `onValidityChange?: (valid: boolean) => void` prop keeps validation co-located with the input. `TargetAudienceFilterComponent` already gates the save button on `getPreparedFilterParams()` returning a non-empty result; it can additionally check a `isRegexValid` local state flag derived from the callback.

Alternative considered: validate inside `getPreparedFilterParams()` directly — this would work but couples validation logic to the save path and makes it harder to show the error message close to the input.

### Decision: Show error below the input field, not in a toast

Inline error messages are already used elsewhere in the publication form. A toast would obscure other UI and requires dismissal. The error text should be short and actionable: `"Invalid regular expression"`.

## Risks / Trade-offs

- **Browser `RegExp` vs server regex engine**: DIAL Core may use a different regex flavor. Risk is low — both use ECMA-262 syntax. → No mitigation needed.
- **Whitespace trimming**: Trimming the value before `new RegExp()` means `" "` (space) is treated as empty/invalid. This matches the stated requirement. → Documented behavior.

## Migration Plan

No data migration needed. The change is purely additive UI validation. No API or store changes. Deploy as a standard frontend release.
