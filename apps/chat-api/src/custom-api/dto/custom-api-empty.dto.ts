/*
 * Deliberately empty DTO bound to `@Query()` on the custom API GET handler.
 * The global `ValidationPipe` runs with `whitelist: true` and
 * `forbidNonWhitelisted: true` (main.ts), so any query key — including a
 * `parameters` field — fails validation with 400 before the handler body
 * runs, since this class declares no property to whitelist. A nonempty
 * request body is rejected separately, by a manual check in the controller
 * rather than a `@Body()`-bound DTO — see custom-api.controller.ts for why.
 * See openspec/changes/archive/2026-10-02-add-configured-core-api-operations/design.md §3.
 */
export class CustomApiEmptyQueryDto {}
