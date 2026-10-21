Slicing: vertical — each endpoint from DTO to test on its own, then one OpenAPI/client pass.

## 1. Declare / remove an external service

- [x] 1.1 `apps/chat-api/src/external-services/dto/external-service-definition.dto.ts` (`ExternalServiceDefinitionBodyDto`, `ExternalServiceAuthSettingsBodyDto`) and `ExternalServiceDefinitionParamsDto` in `dto/get-external-service.dto.ts`. Verification: `npm exec nx test chat-api -- src/external-services`.
- [x] 1.2 `toDialExternalServiceDefinition` in `external-services.mapper.ts`; `putExternalService` / `deleteExternalService` in `external-services.service.ts`; `PUT`/`DELETE :appId/:serviceId` in `external-services.controller.ts` with Swagger. Verification: as 1.1.
- [x] 1.3 Unit tests `tests/external-services-definition.service.spec.ts` and supertest `tests/external-services-definition.controller.spec.ts` (happy path, every exception, validation incl. path traversal, feature off). Verification: as 1.1.

## 2. Withdraw one invitation

- [x] 2.1 `ShareInvitationService.withdrawInvitation`, `ShareService.withdrawInvitation`, `DELETE invitations/:invitationId` in `share.controller.ts`. Verification: `npm exec nx test chat-api -- src/share`.
- [x] 2.2 Tests `share/tests/share-withdraw-invitation.spec.ts` (service + supertest, invalid id). Verification: as 2.1.

## 3. OpenAPI and generated client

- [x] 3.1 `npm run openapi`, `npm run openapi:check`; build and lint `chat-api-client`. Verification: `openapi:check` passes. — Done; generation needs the chat-api env exported and a reachable OIDC issuer (it boots AppModule).
- [x] 3.2 `npm exec nx lint chat-api`, `npm exec nx build chat-api`. — Lint: 0 errors (13 warnings, none in touched files); build green.

## 4. Follow-ups (out of scope)

- [ ] 4.1 Tighten `serviceId` on the existing GET/signin/signout routes to one path segment, as the write routes now do.

## 5. Close

- [ ] 5.1 `npm run verify:full`. — Not run here. `nx test chat-api` in this worktree: 216 failed; the same 216 fail on clean development in the same setup (config/conversations/prompts/skills/toolsets/deployments specs), so they are environmental. To run in CI.
