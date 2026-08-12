## ADDED Requirements

### Requirement: mapDialHttpStatus maps 405, 412, and 422 explicitly
`mapDialHttpStatus` (`apps/chat-api/src/common/dial/dial-error.mapper.ts`) SHALL map DIAL Core status `405` to `MethodNotAllowedException`, `412` to `PreconditionFailedException`, and `422` to `UnprocessableEntityException`, instead of falling through to the generic `>= 500` `BadGatewayException` branch (which previously caught nothing for these three codes and fell to the final catch-all `BadGatewayException` at the function's end). Every other previously-mapped status (`400`, `401`, `403`, `404`, `409`, `413`, `429`, `5xx`) SHALL remain mapped exactly as before this change.

This is required by the skills domain, whose verified DIAL Core operations (`downloadSkillFolder`, `uploadSkillFolder`, `uploadSkillFile`, `deleteSkillFile`, `deleteSkillGroupingFolder`, and others) declare real `405`/`412`/`422` responses in their OpenAPI schema, but is a shared-mapper change available to every `chat-api` domain, not skills-specific code.

#### Scenario: 405 maps to MethodNotAllowedException
- **WHEN** any caller invokes `mapDialHttpStatus(405, context, logger)`
- **THEN** the function throws `MethodNotAllowedException`, not `BadGatewayException`

#### Scenario: 412 maps to PreconditionFailedException
- **WHEN** any caller invokes `mapDialHttpStatus(412, context, logger)`
- **THEN** the function throws `PreconditionFailedException`, not `BadGatewayException`

#### Scenario: 422 maps to UnprocessableEntityException
- **WHEN** any caller invokes `mapDialHttpStatus(422, context, logger)`
- **THEN** the function throws `UnprocessableEntityException`, not `BadGatewayException`

#### Scenario: Existing status mappings are unchanged
- **WHEN** `mapDialHttpStatus` is called with any of `400`, `401`, `403`, `404`, `409`, `413`, `429`, or a `5xx` status
- **THEN** the exact same exception subtype it threw before this change is thrown again, verified by the pre-existing `dial-error.mapper.spec.ts` regression suite passing unmodified

#### Scenario: handleDialSdkError and handleDialFetchError inherit the new mappings automatically
- **WHEN** `handleDialSdkError` or `handleDialFetchError` resolves a `405`, `412`, or `422` status through `mapDialHttpStatus`
- **THEN** they throw the newly mapped exception without requiring any change to their own implementation, since both already delegate final status-to-exception mapping to `mapDialHttpStatus`
