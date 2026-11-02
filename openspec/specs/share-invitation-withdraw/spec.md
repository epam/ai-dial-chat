# share-invitation-withdraw Specification

## Purpose

A BFF endpoint that withdraws a single share invitation through DIAL Core, without revoking the resource's other shares.

## Requirements

### Requirement: BFF withdraws one share invitation

The BFF SHALL expose `DELETE /api/v1/share/invitations/{invitationId}` in
`apps/chat-api/src/share/share.controller.ts`, proxying `deleteInvitation` of
`@epam/ai-dial-typescript-sdk` with the caller's session access token
(`ShareInvitationService.withdrawInvitation`). It withdraws only that invitation: access already accepted
from it stays, the link stops working. It is distinct from `POST /api/v1/share/revoke`, which revokes
every share of a resource at once. `invitationId` is validated by the existing `GetInvitationDto`
(`INVITATION_ID_PATTERN`). Authorization is DIAL Core's (the invitation's owner). Nothing is cached; no
feature flag.

Responses: `204`; a Core `404` (already gone) is also `204`. `400` invalid id, `401`, `403`, `502` Core
error, `503` Core unreachable.

Generated client: `ShareApi.deleteInvitation({ invitationId })` → `void` (normal method). No UI, no
i18n, no RTL impact.

#### Scenario: Withdraw an invitation

- **WHEN** a client sends `DELETE /api/v1/share/invitations/inv-1`
- **THEN** the BFF SHALL call Core's `deleteInvitation('inv-1')` and answer `204`

#### Scenario: Already withdrawn

- **WHEN** Core answers `404` for the invitation
- **THEN** the BFF SHALL answer `204`

#### Scenario: Invalid id

- **WHEN** the `invitationId` is `../x`
- **THEN** the BFF SHALL answer `400` without calling Core
