## Why

`POST /api/v1/toolsets` (and the equivalent `PATCH` update path) validates `authSettings`
with `@ValidateNested()` + `@Type(() => ToolsetAuthSettingsBodyDto)` but no decorator that
asserts the property itself is present. class-validator only recurses into
`@ValidateNested()` when the value exists, so an entirely omitted `authSettings` passes DTO
validation silently. The request then reaches `ToolsetsService`, which reads
`authSettings.authenticationType` on `undefined`, throws a `TypeError`, and that error is
caught and mapped by `handleDialFetchError` to a `503 DIAL Core is currently unavailable` —
a misleading response, since DIAL Core was never called. This was reported against issue
#7570 while automating its QA coverage and violates the existing `toolset-write-api` spec
scenario "Invalid create body", which requires a 400 (not a 503) whenever the body fails DTO
validation.

## What Changes

- Add a presence-validation decorator (`@IsDefined()` or equivalent) to `authSettings` on
  `ToolsetBodyDto` so an omitted `authSettings` fails DTO validation and responds 400 instead
  of reaching `ToolsetsService`.
- Add a regression scenario to the `toolset-write-api` spec covering an omitted
  `authSettings` field, mirroring the existing "Missing endpoint field" scenario.
- Add/extend unit tests for `ToolsetBodyDto` and the `createToolset` controller/service path
  to cover the omitted-`authSettings` case.

## Capabilities

### Modified Capabilities

- `toolset-write-api`: the "Create toolset endpoint" requirement gains an explicit rule that
  `authSettings` must be present in the request body, with a new scenario asserting the 400
  response when it is omitted.

## Impact

- `apps/chat-api/src/toolsets/dto/toolset-body.dto.ts` — add the presence decorator to
  `authSettings`.
- `apps/chat-api/src/toolsets/tests/` — new/updated unit tests.
- `openspec/specs/toolset-write-api/spec.md` — new scenario via delta spec.
- No API contract or OpenAPI shape change: `authSettings` was already documented as required
  via `@ApiProperty`; this only makes runtime validation match that contract.
