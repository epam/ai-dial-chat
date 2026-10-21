Slicing: vertical — each endpoint from DTO to test on its own, then one OpenAPI/client pass.

## 1. Declare / remove an external service

- [x] 1.1 `apps/chat-api/src/external-services/dto/external-service-definition.dto.ts` (`ExternalServiceDefinitionBodyDto`, `ExternalServiceAuthSettingsBodyDto`) and `ExternalServiceDefinitionParamsDto` in `dto/get-external-service.dto.ts`. Verification: `npm exec nx test chat-api -- src/external-services`.
- [x] 1.2 `toDialExternalServiceDefinition` in `external-services.mapper.ts`; `putExternalService` / `deleteExternalService` in `external-services.service.ts`; `PUT`/`DELETE :appId/:serviceId` in `external-services.controller.ts` with Swagger. Verification: as 1.1.
- [x] 1.3 Unit tests `tests/external-services-definition.service.spec.ts` and supertest `tests/external-services-definition.controller.spec.ts` (happy path, every exception, validation incl. path traversal, feature off). Verification: as 1.1.

## 2. Version-checked application update

- [x] 2.1 `If-Match` header on `PATCH` (`applications.controller.ts`, `ApiHeader` + `412`), forwarded in `ApplicationsService.updateApplication`; `etag` on `UpdatedApplicationDto`. Verification: `npm exec nx test chat-api -- src/applications`.
- [x] 2.2 `etag` on `ApplicationDetailsDto` from `getCustomApplication` in `deployments/details/deployments-details.service.ts`. Verification: `npm exec nx test chat-api -- src/deployments`.
- [x] 2.3 Tests `applications/tests/applications-if-match.spec.ts` (service + supertest); the three `applications.controller.spec.ts` assertions take the new argument. Verification: as 2.1.

## 3. Withdraw one invitation

- [x] 3.1 `ShareInvitationService.withdrawInvitation`, `ShareService.withdrawInvitation`, `DELETE invitations/:invitationId` in `share.controller.ts`. Verification: `npm exec nx test chat-api -- src/share`.
- [x] 3.2 Tests `share/tests/share-withdraw-invitation.spec.ts` (service + supertest, invalid id). Verification: as 3.1.

## 4. OpenAPI and generated client

- [x] 4.1 `npm run openapi`, `npm run openapi:check`; build and lint `chat-api-client`. Verification: `openapi:check` passes. — Done; generation needs the chat-api env exported and a reachable OIDC issuer (it boots AppModule).
- [x] 4.2 `npm exec nx lint chat-api`, `npm exec nx build chat-api`. — Lint: 0 errors (13 warnings, none in touched files); build green.

## 5. Follow-ups (out of scope)

- [ ] 5.1 Tighten `serviceId` on the existing GET/signin/signout routes to one path segment, as the write routes now do.

## 6. Close

- [ ] 6.1 `npm run verify:full`. — Not run here. `nx test chat-api` in this worktree: 5024 passed, 216 failed; the same 216 fail on clean development in the same setup (config/conversations/prompts/skills/toolsets/deployments specs), so they are environmental. To run in CI.
