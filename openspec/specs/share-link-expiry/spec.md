# share-link-expiry Specification

## Purpose

How `POST /api/v1/share` derives `expiresInDays` and `expiresInHours` from the DIAL Core invitation it created, how it degrades when that expiry cannot be determined, and how the optional values flow through `ShareLinkData` and `useShareLink` to the share popover's expiry note.

## Requirements

### Requirement: Share-link expiry is read from the DIAL Core invitation

`POST /api/v1/share` (operationId `createShareLink`, `ShareInvitationService.createShareLink` in `apps/chat-api/src/share/invitation/share-invitation.service.ts`) SHALL derive `expiresInDays` and `expiresInHours` from the invitation that DIAL Core created, and SHALL NOT use a constant.

After `shareResource` returns an `invitationLink`, the service SHALL do the following:

1. Extract the invitation id. This is the last non-empty path segment of `invitationLink`, which is the same parsing the frontend invitation URL is built from.
2. Call `dialClient.client.getInvitation(invitationId, { headers: getBearerAuthHeaders(accessToken) })` with **no** `accept` query parameter. The call SHALL NOT pass `params.query.accept` in any form, because `accept=true` would accept the sharer's own invitation.
3. Compute `expiresInDays = Math.ceil((expireAt - reference) / 86_400_000)` and `expiresInHours = Math.ceil((expireAt - reference) / 3_600_000)` (`deriveInvitationExpiry` in `apps/chat-api/src/share/utils/share-resource.util.ts`). The `reference` is `max(createdAt, Date.now())` when `createdAt` is a finite number, and `Date.now()` otherwise. Taking the max of DIAL Core's `createdAt` and the BFF clock means a BFF clock running behind DIAL Core cannot round a whole-unit TTL up by an extra unit. Both values are reported, because a per-role TTL shorter than a day rounds up to `expiresInDays: 1`, and only `expiresInHours` still says how long the link lives.

`expireAt` and `createdAt` are epoch milliseconds, as declared by the SDK's `components['schemas']['Invitation']`. The constant `SHARE_LINK_EXPIRES_IN_DAYS` SHALL NOT exist anywhere in the codebase.

Example. DIAL Core invitation peek response:

```json
{
  "id": "abc123",
  "createdAt": 1790000000000,
  "expireAt": 1790604800000,
  "resources": [{ "url": "conversations/bucket/chat.json", "permissions": ["READ"] }]
}
```

`POST /api/v1/share` → `201`:

```json
{
  "url": "https://chat.example.com/catalog/shared/abc123",
  "expiresInDays": 7,
  "expiresInHours": 168,
  "access": ["view"]
}
```

Status codes are unchanged: `201`, `400` (validation), `401`, `502` (`shareResource` error), `503` (`shareResource` unreachable). The peek SHALL NOT add a new error status.

#### Scenario: Days are derived from expireAt

- **WHEN** `shareResource` returns `{ invitationLink: "/v1/invitations/abc123" }` and the peek returns `createdAt = T` and `expireAt = T + 7 days`, with the BFF clock at `T`
- **THEN** the response carries `expiresInDays: 7` and `expiresInHours: 168`

#### Scenario: A partial day rounds up

- **WHEN** the peek returns `expireAt` 36 hours after the reference time
- **THEN** the response carries `expiresInDays: 2` and `expiresInHours: 36`

#### Scenario: A TTL shorter than a day keeps its hours

- **WHEN** the role's sharing limit is 1 hour, so the peek returns `expireAt` 1 hour after `createdAt`
- **THEN** the response carries `expiresInDays: 1` and `expiresInHours: 1`

#### Scenario: A BFF clock behind DIAL Core does not inflate the value

- **WHEN** the peek returns `createdAt = T` and `expireAt = T + 3 days`, and the BFF clock reads `T - 5 seconds`
- **THEN** the response carries `expiresInDays: 3`, not `4`

#### Scenario: The peek never accepts the invitation

- **WHEN** `createShareLink` succeeds
- **THEN** `getInvitation` is called exactly once, with the extracted invitation id, and without an `accept` query parameter

#### Scenario: The same rule applies to every resource kind

- **WHEN** `createShareLink` is called with an `itemId` under `applications/`, `toolsets/`, `skills/`, `conversations/`, or `prompts/`, or with a catalog deployment id
- **THEN** `expiresInDays` and `expiresInHours` are derived from that invitation's `expireAt` the same way

---

### Requirement: An undeterminable expiry is omitted, not defaulted

The invitation peek in `createShareLink` SHALL be best-effort. If any of the following happens, the service SHALL log a `WARN` through the service's `Logger`:

- the peek call throws
- the peek returns an SDK `error`
- the peek returns no `data`
- `expireAt` is missing or not a finite number
- `expireAt` is not later than the reference time, so the computed value would be `≤ 0`

The `WARN` SHALL include the invitation id and the upstream HTTP status when one exists. It SHALL NOT include the access token or the full invitation body. The service SHALL then still return `201` with `url` and `access`, and SHALL **omit** both `expiresInDays` and `expiresInHours`. It SHALL NOT substitute a default number.

Example `201` response when the expiry is unknown:

```json
{
  "url": "https://chat.example.com/catalog/shared/abc123",
  "access": ["view"]
}
```

#### Scenario: Peek network failure

- **WHEN** `getInvitation` rejects
- **THEN** the response is `201` with `url` and `access` and without an `expiresInDays` key, and a warning is logged

#### Scenario: Peek upstream error

- **WHEN** `getInvitation` resolves with `error` set and `response.status = 404`
- **THEN** the response is `201` without `expiresInDays`, and the warning includes status `404`

#### Scenario: Missing expireAt

- **WHEN** the peek returns an invitation without `expireAt`
- **THEN** the response is `201` without `expiresInDays`

#### Scenario: expireAt already in the past

- **WHEN** the peek returns an `expireAt` that is earlier than or equal to the reference time
- **THEN** the response is `201` without `expiresInDays`

#### Scenario: Primary share failure is unchanged

- **WHEN** `shareResource` itself fails
- **THEN** the existing `502`/`503` mapping applies, and `getInvitation` is not called

---

### Requirement: `expiresInDays` is optional across the contract

`ShareLinkResponseDto.expiresInDays` and `ShareLinkResponseDto.expiresInHours` (`apps/chat-api/src/share/dto/share-link-response.dto.ts`) SHALL be declared optional (`expiresInDays?: number`, `expiresInHours?: number`) with `@ApiProperty({ required: false, ... })`. Their descriptions SHALL state that the value is read from DIAL Core's invitation expiry and is omitted when it cannot be determined. `libs/chat-api-client/openapi.json` SHALL NOT list either field in the schema's `required` array, and the generated `ShareLinkResponseDto` model SHALL type both as optional. Both SHALL be produced by `npm run openapi`, never by hand-editing. The operationId (`createShareLink`), the generated SDK method, and the request DTO (`CreateShareLinkDto`) are unchanged, and frontend callers keep using the normal (non-`Raw`) method.

`ShareLinkData.expiresInDays` and `ShareLinkData.expiresInHours` in `libs/share/src/models/share-link-data.ts` SHALL be optional, and the `ShareLinkData` row in `libs/share/README.md` SHALL show `expiresInDays?: number; expiresInHours?: number`.

#### Scenario: OpenAPI check agrees with the DTO

- **WHEN** `npm run openapi` and `npm run openapi:check` run after the change
- **THEN** both pass, and the `ShareLinkResponseDto` schema's `required` array is `["url", "access"]`

#### Scenario: README matches the type

- **WHEN** `npm run validate:docs` runs
- **THEN** it passes, and the README's `ShareLinkData` shape lists `expiresInDays` as optional

---

### Requirement: The expiry flows to the popover unchanged

`useShareLink` (`libs/chat-hooks`) SHALL copy `response.expiresInDays` and `response.expiresInHours` into `ShareLinkData` as-is, including `undefined`, and SHALL NOT default, round, or recompute them. The hook keeps receiving an already-configured generated client. No endpoint path, DIAL Core detail, or TTL knowledge enters `libs/chat-hooks` or `libs/share`.

The app containers `SharePopoverContainer` and `ShareConversationPopoverContainer` SHALL build `expiryNote` with `formatShareExpiryNote` (`apps/chat/src/utils/share.ts`):

- When `expiresInHours` is below 24, the note uses the `share.expiryNoteHours` translation key with `{ count: expiresInHours }`.
- Otherwise, when `expiresInDays != null`, the note uses the `share.expiryNote` translation key with `{ count: expiresInDays }`.
- Otherwise the note is `undefined`, and `SharePopover` renders no expiry note.

Both keys are pluralized through i18next's `_one` / `_other` suffixes, so the note reads "1 hour" / "1 day" rather than "1 days".

The change has no RTL/direction impact, because the markup is unchanged. It has no accessibility impact, because the note is still static text with no new interactive element. It is not gated behind `ENABLED_FEATURES` or `ENABLED_FEATURES_ROLES`. No memoisation changes are required. It adds no cache: the peek result is not cached, because share links are ephemeral and every popover open creates a fresh invitation.

#### Scenario: The hook passes an omitted expiry through

- **WHEN** the client's `createShareLink` resolves to `{ url, access }` without `expiresInDays`
- **THEN** the hook's `data.expiresInDays` is `undefined`

#### Scenario: The hook passes a DIAL Core value through

- **WHEN** the client's `createShareLink` resolves with `expiresInDays: 7`
- **THEN** the hook's `data.expiresInDays` is `7`

#### Scenario: The hook passes the hours through

- **WHEN** the client's `createShareLink` resolves with `expiresInHours: 168`
- **THEN** the hook's `data.expiresInHours` is `168`

#### Scenario: No expiry note without a value

- **WHEN** a share popover container renders with share-link data that has no `expiresInDays`
- **THEN** the link and copy actions render, and no "This link is active for …" text is present

#### Scenario: The expiry note uses the DIAL Core value

- **WHEN** a share popover container renders with `expiresInDays: 7` and `expiresInHours: 168`
- **THEN** the note reads "This link is active for 7 days."

#### Scenario: A link shorter than a day is described in hours

- **WHEN** a share popover container renders with `expiresInDays: 1` and `expiresInHours: 1`
- **THEN** the note reads "This link is active for 1 hour.", not "1 day"

#### Scenario: A single day is singular

- **WHEN** a share popover container renders with `expiresInDays: 1` and `expiresInHours: 24`
- **THEN** the note reads "This link is active for 1 day."
