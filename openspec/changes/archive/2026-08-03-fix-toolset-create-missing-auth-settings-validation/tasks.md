## 1. DTO fix

- [x] 1.1 Add `@IsDefined()` to `authSettings` on `ToolsetBodyDto`
      (`apps/chat-api/src/toolsets/dto/toolset-body.dto.ts`), ordered before
      `@ValidateNested()` / `@Type(() => ToolsetAuthSettingsBodyDto)`.
- [x] 1.2 Confirm the Swagger `@ApiProperty` metadata for `authSettings` still reflects a
      required field (no change expected, verify only).

## 2. Tests

- [x] 2.1 Add a unit test for `ToolsetBodyDto` validation asserting an omitted `authSettings`
      produces a validation error naming `authSettings`.
- [x] 2.2 Add/extend a `ToolsetsController`/`ToolsetsService` test (e.g. supertest against
      `POST /api/v1/toolsets`) asserting an omitted `authSettings` body returns 400 and that
      `ToolsetsService`/DIAL Core is never invoked (e.g. via a spy assertion).
- [x] 2.3 Confirm the existing `authSettings: {}` case (400 naming `authenticationType`) and
      the existing "Missing endpoint field" test still pass unchanged.

## 3. Verification

- [x] 3.1 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`. (One
      unrelated flaky failure in `scheduled-tasks.controller.spec.ts` reproduced in
      isolation as passing — pre-existing, untouched by this change.)
- [x] 3.2 Verify the repro from issue #7570 — `POST /api/v1/toolsets` with
      `{"name": "<any>", "endpoint": "https://example.com/mcp", "transport": "HTTP"}` now
      returns 400 (not 503). Exercised via the `toolsets.controller.spec.ts` supertest
      integration test (real `ValidationPipe` config, stubbed session — the route's auth
      guard would reject an unauthenticated live request before validation runs, so a
      live-server manual repro can't isolate this case any better than the integration test
      already does).
