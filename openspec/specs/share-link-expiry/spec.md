# share-link-expiry Specification

## Purpose

Defines how `POST /api/v1/share` reports a share link's expiry: it is read from the DIAL Core invitation's `expireAt`, never hardcoded in the chat, and it is omitted when DIAL Core does not report a usable value.

## Requirements

### Requirement: Share link expiry is read from the DIAL Core invitation

`POST /api/v1/share` (operationId `createShareLink`, request `CreateShareLinkDto`, response `ShareLinkResponseDto`; the frontend calls the normal generated `ShareApi.createShareLink` method through `useShareLink`) SHALL report the link's expiry as DIAL Core enforces it, never as a value hardcoded in the chat.

DIAL Core's `shareResource` response carries only `invitationLink`. After it succeeds, `ShareInvitationService` SHALL take the invitation id from the last path segment of `invitationLink` and call `getInvitation(invitationId)` on the shared SDK client. The call SHALL forward the caller's bearer token and SHALL NOT pass `accept`, so reading the expiry never accepts the invitation. It SHALL derive:

```
expiresInDays = ceil((invitation.expireAt - now) / 86_400_000)
```

with `expireAt` read as epoch milliseconds. The service SHALL NOT read any expiry or TTL from environment variables or constants.

Example — DIAL Core `shareResource` → `{ "invitationLink": "/v1/invitations/abc123" }`, then `GET /v1/invitations/abc123` → `{ "id": "abc123", "expireAt": <now + 72h> }`:

```
POST /api/v1/share
{ "itemId": "gpt-4o", "access": ["view"] }

201 Created
{
  "url": "https://chat.example.com/catalog/shared/abc123",
  "expiresInDays": 3,
  "access": ["view"]
}
```

Authorization is unchanged: the endpoint requires an authenticated session, and the peek runs with the same user token as `shareResource`. Nothing is cached, because each call creates a new invitation.

#### Scenario: Expiry is derived from expireAt

- **WHEN** `shareResource` returns `invitationLink` `/v1/invitations/abc123` and the peek returns `expireAt` 72 hours from now
- **THEN** the response carries `expiresInDays: 3`

#### Scenario: A partial remaining day rounds up

- **WHEN** the peek returns `expireAt` 36 hours from now
- **THEN** the response carries `expiresInDays: 2`

#### Scenario: The expiry peek never accepts the invitation

- **WHEN** the share link is created
- **THEN** `getInvitation` is called exactly once, with the invitation id and the caller's `Authorization: Bearer <token>` header and without any `accept` query parameter

### Requirement: An unknown expiry is omitted, never guessed

`ShareLinkResponseDto.expiresInDays` SHALL be optional (`@ApiPropertyOptional`, not listed in the OpenAPI `required` array; the generated model types it `expiresInDays?: number`). The expiry is informational, so failing to read it SHALL NOT fail link creation. In each of the cases below, the service SHALL log a warning naming the invitation id (never the token), return HTTP 201 with `url` and `access`, and omit `expiresInDays`:

- the peek returns an error response;
- the peek throws (network failure, timeout);
- the invitation has no `expireAt`;
- the derived value is not positive (the expiry is already in the past).

`ShareLinkData.expiresInDays` in `@epam/ai-dial-share` SHALL be optional to match. The lib receives the resolved number from the host and has no knowledge of DIAL Core. The host containers (`SharePopoverContainer`, `ShareConversationPopoverContainer`) SHALL pass `labels.expiryNote` (i18n key `share.expiryNote`, unchanged) only when `expiresInDays != null`, and `SharePopover` SHALL render no expiry note when the label is absent. This introduces no new strings, has no RTL or accessibility impact, is not gated by `ENABLED_FEATURES`, and needs no new memoisation.

#### Scenario: Peek error response

- **WHEN** the peek returns an error response (e.g. 404)
- **THEN** the response is 201 with the invitation `url` and no `expiresInDays`, and a warning is logged

#### Scenario: Peek throws

- **WHEN** the peek rejects with a network error
- **THEN** the response is 201 with the invitation `url` and no `expiresInDays`

#### Scenario: Invitation without expireAt

- **WHEN** the peek returns an invitation with no `expireAt`
- **THEN** the response is 201 with the invitation `url` and no `expiresInDays`

#### Scenario: Expiry already in the past

- **WHEN** the peek returns `expireAt` earlier than now
- **THEN** the response is 201 with the invitation `url` and no `expiresInDays`

#### Scenario: Popover hides the note when the expiry is unknown

- **WHEN** `useShareLink` resolves data without `expiresInDays`
- **THEN** the share popover shows the link with no "This link is active for …" note
