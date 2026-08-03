## Context

`ToolsetBodyDto` (`apps/chat-api/src/toolsets/dto/toolset-body.dto.ts`) is shared by
`POST /api/v1/toolsets` (create) and `PATCH /api/v1/toolsets/:toolsetName` (update). Its
`authSettings` field uses `@ValidateNested()` + `@Type(() => ToolsetAuthSettingsBodyDto)`
with no decorator asserting the property is present. class-validator's `@ValidateNested()`
only validates a value that exists; an omitted key produces no error. `ToolsetsService`
assumes `authSettings` is always a defined object when it builds the DIAL Core payload
(`toDialAuthSettings`), so an omitted field throws a `TypeError` that is caught generically
and mapped to a 503, masking the real problem (a bad request) as an upstream outage.

## Goals / Non-Goals

**Goals:**
- Reject a `POST /api/v1/toolsets` (and `PATCH`) request whose body omits `authSettings`
  with a 400 that names the missing field, before any service/DIAL Core code runs.
- Keep the existing behavior for `authSettings: {}` (400 naming `authenticationType`)
  unchanged.

**Non-Goals:**
- Changing whether `authSettings` is required on update (`PATCH`) semantics beyond making
  omission consistently a 400 — no behavior change is proposed for partial-update semantics
  since the same DTO scenario already requires the field.
- Any change to `ToolsetsService`'s DIAL Core call shape, caching, or error-mapping logic for
  genuine DIAL Core failures.

## Decisions

- **Add `@IsDefined()` to `authSettings`, ahead of `@ValidateNested()`.** class-validator
  runs decorators in declaration order and short-circuits nested validation only when the
  base decorator already reports failure for that property is not automatic — but
  `@IsDefined()` reports its own violation independently while `@ValidateNested()` still
  simply no-ops on `undefined`. Both are cheap to keep, and `@IsDefined()` gives an explicit
  "authSettings should not be null or undefined" message rather than relying on incidental
  side effects of `@ValidateNested()`. Alternative considered: `@IsNotEmptyObject()` — rejected
  because it would also need to tolerate a partially-specified object mid-validation, which
  `@ValidateNested()` already handles; `@IsDefined()` is the minimal, precise fix for "key
  missing entirely."
- **No `catch` added in `ToolsetsService.createToolset`/`toDialAuthSettings` for
  `authSettings` being `undefined`.** Once the DTO guarantees presence, defensive handling in
  the service for an impossible state would be dead code. This matches the project's
  guidance against validating conditions that cannot occur past the DTO boundary.

## Risks / Trade-offs

- [Risk] `PATCH` requests that legitimately omit `authSettings` to leave it unchanged (if any
  such usage exists) would start failing. → Mitigation: confirmed via
  `openspec/specs/toolset-write-api/spec.md` and `ToolsetBodyDto`'s `@ApiProperty` (not
  `@ApiPropertyOptional`) that `authSettings` is already documented/typed as required on this
  shared DTO; no partial-update contract currently permits omitting it, so no legitimate
  caller is affected.
