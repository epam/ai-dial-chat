## ADDED Requirements

### Requirement: Regex pattern input SHALL validate syntax in real time
When a publication filter with `condition=Regex` is active, the regex input field SHALL continuously validate the entered pattern using ECMAScript `RegExp` syntax rules and reflect the validity state immediately as the user types.

#### Scenario: Valid regex pattern enables save
- **WHEN** the user enters a syntactically valid regex pattern (e.g., `^admin.*`)
- **THEN** the save/add button SHALL be enabled and no error message is shown

#### Scenario: Invalid regex pattern disables save
- **WHEN** the user enters a syntactically invalid regex pattern (e.g., `[unclosed`)
- **THEN** the save/add button SHALL be disabled
- **THEN** an inline error message SHALL be displayed below the input field

### Requirement: Whitespace-only regex input SHALL be treated as invalid
The regex input field SHALL treat a pattern that consists entirely of whitespace characters as invalid.

#### Scenario: Whitespace-only input is rejected
- **WHEN** the user enters only whitespace characters (spaces, tabs) into the regex field
- **THEN** the save/add button SHALL be disabled
- **THEN** the input MUST NOT be saved as a filter parameter

### Requirement: Regex error message SHALL be descriptive and inline
When the regex pattern is invalid, an error message SHALL be rendered directly below the input field without requiring any user action to see it.

#### Scenario: Error message shown for invalid pattern
- **WHEN** the regex input contains a syntactically invalid pattern
- **THEN** an error message reading `"Invalid regular expression"` SHALL appear below the input
- **THEN** the error message SHALL disappear immediately when the pattern becomes valid

### Requirement: Empty regex input SHALL disable save
When the regex input field is empty, the save/add button SHALL remain disabled.

#### Scenario: Empty field keeps save disabled
- **WHEN** the regex input field is empty (no characters entered)
- **THEN** the save/add button SHALL be disabled
