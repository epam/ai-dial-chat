## MODIFIED Requirements

### Requirement: Toolset name path parameter validation

The `:toolsetName` path parameter MUST be validated to prevent path-traversal and injection, while still accepting the `/`-separated custom-toolset path format (`toolsets/{bucket}/{path}`).

Validation MUST be applied to the value after route-parameter URL-decoding (the framework decodes `%XX` sequences before the DTO validator runs), so a percent-encoded traversal payload decodes to its literal form before the checks below run.

Allowed characters: word characters, `. - : @ / ( )`, or a valid percent-encoded byte (`%XX`). In addition, no `/`-delimited path segment of the (decoded) value MAY be empty, `.`, or `..`.

Any value that fails either check SHALL cause the BFF to return `400 Bad Request` before making any upstream call.

#### Scenario: Valid toolset name passes validation

- **WHEN** the path param is `my-toolset`, `folder.toolset-v1`, `@org/toolset:tag`, or the percent-encoded custom-toolset path `toolsets%2Fbucket%2Ffolder%2Ftoolset-name`
- **THEN** the request proceeds to upstream proxying

#### Scenario: Invalid toolset name is rejected

- **WHEN** the path param contains whitespace, `;`, or other disallowed characters
- **THEN** the BFF returns `400 Bad Request` without calling DIAL Core

#### Scenario: Percent-encoded traversal payload is rejected

- **WHEN** the path param is `..%2Fetc%2Fpasswd`, which decodes to the path segments `..`, `etc`, `passwd`
- **THEN** the BFF returns `400 Bad Request` without calling DIAL Core, because the `..` segment is disallowed even though `/` itself is an allowed character
