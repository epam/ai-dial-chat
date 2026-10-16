# Tasks

Slicing strategy: vertical — the validator and one DTO working end to end first (Bedrock conversation share), then the remaining DTOs, then the integration checks. Read `apps/chat-api/AGENTS.md` before starting. Relative imports are extensionless.

## 1. Validator

- [x] 1.1 Add `apps/chat-api/src/common/validators/dial-resource-id.validator.ts` exporting `isDialResourceId`, the `IsDialResourceId` decorator and its message constant, implementing the algorithm in design.md (model: `safe-resource-id.validator.ts`; use a local segment decoder that, unlike `safeDecodeURIComponent` in `apps/chat-api/src/common/utils/uri.ts`, still decodes ASCII escapes when a segment contains a non-UTF-8 byte). Verify: `npm exec nx lint chat-api` passes and the spec in 1.2 imports it.
- [x] 1.2 Add `apps/chat-api/src/common/validators/dial-resource-id.validator.spec.ts` covering each scenario of `dial-resource-id-validation`: Bedrock `…-v1:0` conversation id, prompt with spaces and comma, `%20` and `%2F` ids, `Wait.. what`, literal and encoded traversal (`..`, `%2e%2e`, `..%2F`), leading `/`, empty segment, `\ { } " ? #`, newline, `%7B`/`%5C`/`%0A`, malformed `%zz`, non-string/empty. Verify: `npm run test:file -- apps/chat-api/src/common/validators/dial-resource-id.validator.spec.ts`.

## 2. Share DTOs

- [x] 2.1 In `apps/chat-api/src/share/dto/create-share-link.dto.ts` replace `@IsValidFilePath()` with `@IsDialResourceId()` on `itemId` (drop the now-unused import). Add a `CreateShareLinkDto` validation spec `apps/chat-api/src/share/tests/create-share-link.dto.spec.ts` (pattern: `revoke-shared-access.dto.spec.ts`) asserting the Bedrock conversation id, a model id (`gpt-4o`) and a prompt id are accepted and `../` / empty / `{` are rejected. Verify: `npm run test:file -- apps/chat-api/src/share/tests/create-share-link.dto.spec.ts`.
- [x] 2.2 Same swap in `discard-shared-catalog-item.dto.ts`, `revoke-shared-access.dto.ts` and `share-recipients.dto.ts` (keep `@IsCatalogResourcePath()`, the skill-file `@Matches` and `@MaxLength(2048)`). Extend `discard-shared-catalog-item.dto.spec.ts`, `revoke-shared-access.dto.spec.ts` and `share-recipients.dto.spec.ts` in `apps/chat-api/src/share/tests/` with the Bedrock conversation id (accepted) and keep their existing traversal/prefix rejections green. Verify: `npm run test:file -- apps/chat-api/src/share/tests/discard-shared-catalog-item.dto.spec.ts` and the two sibling specs.
- [x] 2.3 Add a controller-level case in `apps/chat-api/src/share/tests/share.controller.spec.ts` (supertest): `POST /api/v1/share` with the Bedrock conversation id reaches `ShareService.createShareLink` (no `400`), and with `applications/b/../x` returns `400` without calling the service. Verify: `npm run test:file -- apps/chat-api/src/share/tests/share.controller.spec.ts`.

## 3. Integration checks

- [x] 3.1 Run `npm run verify:changed`, then `npm run openapi:check` (contract must be unchanged) and `npm run validate:specs`.
- [x] 3.2 Add a `createShareLink` case to `apps/chat-api/src/share/invitation/tests/share-invitation.service.spec.ts` for the Bedrock conversation id: `getConversation` receives the sub-path encoded (`%3A`), `shareResource` receives the canonical `itemId` with the literal `:` unchanged, and the returned invitation URL is built from it. Verify: `npm run test:file -- apps/chat-api/src/share/invitation/tests/share-invitation.service.spec.ts`.
- [ ] 3.3 Run `npm run verify:full` once to close the change.
