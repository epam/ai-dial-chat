## 1. Add regex validation to RegexParamInput

- [x] 1.1 In `@/src/components/Chat/Publish/RegexParamInput.tsx`, add an `onValidityChange?: (valid: boolean) => void` prop and a `isInvalid?: boolean` prop to the component interface
- [x] 1.2 Implement a `isValidRegex(pattern: string): boolean` helper inside the file: trim the value, return `false` if empty, attempt `new RegExp(pattern)` and catch `SyntaxError` to return `false`, return `true` otherwise
- [x] 1.3 Call `onValidityChange` with the result of `isValidRegex` on every `onChange` event and on initial mount
- [x] 1.4 When `isInvalid` is `true`, render an inline error message `"Invalid regular expression"` below the `<input>` element using existing error text styles

## 2. Wire validity state into TargetAudienceFilterComponent

- [x] 2.1 In `@/src/components/Chat/Publish/TargetAudienceFilterComponent.tsx`, add a `isRegexValid` boolean to local state (default `true`)
- [x] 2.2 Pass `onValidityChange={(valid) => setIsRegexValid(valid)}` and `isInvalid={!isRegexValid}` to the `<RegexParamInput>` render
- [x] 2.3 Update the save/add button's `disabled` condition to also be `true` when the active filter function is `PublicationFunctions.Regex` and `isRegexValid` is `false`
- [x] 2.4 Reset `isRegexValid` to `true` when the filter function changes away from `Regex` (in the function-change handler)

## 3. Update unit tests

- [x] 3.1 In `@/src/components/Chat/__tests__/TargetAudienceFilter.test.tsx`, add a test case: entering an invalid regex pattern (e.g., `[unclosed`) keeps the save button disabled and shows the error message
- [x] 3.2 Add a test case: entering a whitespace-only value keeps the save button disabled
- [x] 3.3 Add a test case: entering a valid regex pattern after an invalid one re-enables the save button and hides the error message
- [x] 3.4 Verify the existing regex save test (lines 205–235) still passes without modification
