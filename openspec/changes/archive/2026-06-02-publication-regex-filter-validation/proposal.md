## Why

When users create a publication filter with `condition=regex`, there is no validation of the regex expression format. Users can save invalid regex patterns (e.g., pure whitespace or syntactically broken expressions), which causes silent failures at runtime when the filter is applied server-side. Validation at input time prevents misconfigured publications from reaching production.

## What Changes

- The `RegexParamInput` component gains real-time regex syntax validation using the native `RegExp` constructor.
- The save/add button in `TargetAudienceFilterComponent` is disabled when the regex expression is syntactically invalid.
- An inline error message is shown below the regex input field when the pattern is invalid.
- Pure-whitespace-only input is treated as invalid (currently accepted as a valid regex).
- No changes to backend API, data model, or existing filter types.

## Non-goals

- Semantic validation of what the regex matches (e.g., whether it matches any known users) — only syntax is validated.
- Validation of existing saved rules loaded from the server.
- Any changes to the `Equal` or `Contain` filter functions.

## Capabilities

### New Capabilities

- `regex-filter-validation`: Client-side validation of regex syntax in the publication filter UI, with inline error display and disabled save state for invalid patterns.

### Modified Capabilities

<!-- No existing spec-level requirements are changing. -->

## Impact

- **Components**: `apps/chat/src/components/Chat/Publish/RegexParamInput.tsx`, `apps/chat/src/components/Chat/Publish/TargetAudienceFilterComponent.tsx`
- **Tests**: `apps/chat/src/components/Chat/__tests__/TargetAudienceFilter.test.tsx` (new test cases for invalid regex)
- **Store domain**: No Redux state changes required — validation is purely UI-side.
- **No new API routes** required.
