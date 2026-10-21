## Why

Custom-runner editors that live behind their own `ai-dial-chat-bff` instance (the DIAL Loop editor, like
Quick Apps today) reach DIAL Core only through this BFF. Three Core operations they need have no BFF
endpoint yet, so those editors either lose the feature or would have to keep a second, direct-Core
path with a token in the page — the thing the BFF exists to remove:

- declaring and removing an external service on an application (Core
  `PUT`/`DELETE /v1/applications/{appId}/external-services/{id}`) — an editor's per-project Teams bot,
  agent API keys and connector services;
- a version-checked application update (Core honours `If-Match` on `saveCustomApplication`, but
  `PATCH /api/v1/applications/{applicationName}` neither forwards it nor tells the caller the version);
- withdrawing one share invitation (Core `DELETE /v1/invitations/{id}`) — `POST /api/v1/share/revoke`
  revokes every share of a resource at once.

## What Changes

- `PUT /api/v1/external-services/{appId}/{serviceId}` and `DELETE /api/v1/external-services/{appId}/{serviceId}`:
  declare / remove an application's external service, proxying `putExternalService` /
  `deleteExternalService` of `@epam/ai-dial-typescript-sdk`.
- `PATCH /api/v1/applications/{applicationName}` accepts an optional `If-Match` header and forwards it to
  `saveCustomApplication`; a stale version answers `412`. The response and
  `GET /api/v1/deployments/{deployment}/details` (for applications) carry the stored version as `etag`.
- `DELETE /api/v1/share/invitations/{invitationId}`: withdraw one invitation, proxying `deleteInvitation`.
- OpenAPI and the generated `@epam/ai-dial-chat-api-client` regenerated.

## Non-goals

- No change to Chat's own UI or to existing callers: `If-Match` is optional, every new endpoint is new.
- No generic proxy to non-DIAL upstreams (a runner passthrough is a separate decision).

## Alternatives considered

Keep the editors' direct-Core path for these three (baseline) — rejected: it keeps a token in the page
and Core CORS for the editor origin. A generic Core passthrough — rejected: it bypasses the BFF's typed,
validated contract. Typed endpoints over the existing SDK operations (picked) follow
`apps/chat-api/src/external-services/external-services.controller.ts` and the skills `If-Match`
contract (`apps/chat-api/src/skills/skills.controller.ts`, `apps/chat-api/src/common/utils/conditional-headers.ts`).

## Impact

- `apps/chat-api/src/external-services/` (controller, service, mapper, DTOs, tests);
  `apps/chat-api/src/applications/` (update path, DTO, tests); `apps/chat-api/src/deployments/details/`
  (etag on application details); `apps/chat-api/src/share/` (withdraw invitation).
- `libs/chat-api-client` regenerated (new operations `putExternalService`, `deleteExternalService`,
  `deleteInvitation`; `etag` on `UpdatedApplicationDto` and `ApplicationDetailsDto`).
- No user-visible strings, no i18n, no UI. The external-service endpoints sit behind the existing
  `liveChatInteraction` feature, like their GET/signin/signout siblings.

## Acceptance criteria

- Each new endpoint proxies its SDK operation with the caller's session token, maps Core errors through
  `apps/chat-api/src/common/dial/dial-error.mapper.ts`, and has unit + supertest coverage including
  validation rejections.
- A `PATCH` with a stale `If-Match` answers `412` and writes nothing; without `If-Match` it behaves as today.
- `npm run openapi:check` passes; `chat-api-client` builds and lints.

## Rollback

Additive and backward compatible: revert the commit; callers that do not send `If-Match` or call the
new routes are unaffected either way.
