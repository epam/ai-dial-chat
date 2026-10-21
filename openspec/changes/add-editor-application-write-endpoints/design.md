## Context

Editors that run on their own `ai-dial-chat-bff` instance (Quick Apps, the DIAL Loop editor) hold no
token and reach Core only through the BFF. The two operations below exist in
`@epam/ai-dial-typescript-sdk` but have no BFF route. `apps/chat-api/AGENTS.md` governs the
implementation (URI versioning, thin controllers + Swagger, validated DTOs, typed HTTP exceptions) and is
not repeated here.

## Goals / Non-Goals

**Goals:** typed, validated routes over the existing SDK operations; additive and backward compatible.

**Non-Goals:** a proxy to non-DIAL upstreams; any Chat UI.

## Decisions

- **Routes beside their siblings.** Declare/remove live in `ExternalServicesController` next to
  GET/signin/signout and share its `liveChatInteraction` gate; withdraw lives next to
  `GET share/invitations/{invitationId}` and reuses `GetInvitationDto`.
- **A stricter id on the write routes.** `GetExternalServiceDto` accepts `/` (and so `..` segments once
  Express decodes `%2F`); the write routes put `serviceId` straight into Core's path, so they take
  `ExternalServiceDefinitionParamsDto` (one segment, never `.`/`..`). The read routes are left as they
  are — changing them is out of scope (follow-up task).
- **Idempotent removals.** A Core `404` on `deleteExternalService` / `deleteInvitation` answers `204`, as
  `signOut` already treats "nothing to revoke".
- **Secrets.** `clientSecret` is write-only in Swagger, forwarded to Core, never logged (the service logs
  only the id and auth type) and never in a response.

Authorization for every route is DIAL Core's, with the caller's session token: editing the application
for declare/remove, owning the invitation for withdraw.

## Risks / Trade-offs

- [Core's `putExternalService` with `client_secret` is a credential write] → validated DTO, no logging,
  covered by a test that the secret never comes back.
- [The read routes still accept multi-segment service ids] → recorded as a follow-up, not changed here.

## Migration Plan

Additive: deploy, regenerate the client; revert the commit to roll back. No data changes.
