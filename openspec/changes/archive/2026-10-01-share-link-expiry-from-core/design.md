## Context

`ShareInvitationService.createShareLink` proxies DIAL Core's `shareResource` and returns `{ url, expiresInDays, access }`. Until now `expiresInDays` was the constant `3`. DIAL Core enforces its own TTL, which is configurable per role (`Role.share[<key>].invitation_ttl` in the SDK schema), and its `shareResource` response carries only `invitationLink`. This was verified by debug-logging the raw status, headers and body. The full `Invitation`, including `expireAt`, is available from the non-accepting `GET /v1/invitations/{id}` peek, which `acceptInvitation` already uses for a different purpose (reading the shared resource's itemId before accepting).

The change spans the BFF, the generated client (`libs/chat-api-client`), and one lib type (`libs/share`). The frontend containers need no change.

## Goals / Non-Goals

**Goals:**

- Report the expiry DIAL Core actually enforces, with no chat-side configuration.
- Keep the response shape and every frontend consumer as they are, except that one field becomes optional.

**Non-Goals:**

- Pluralization or an absolute-date rendering of `share.expiryNote`.
- Reusing an existing invitation instead of creating a new one per popover open.

## Decisions

1. **Peek after create, rather than a config value.** One extra round-trip per share-link creation buys per-role correctness with zero configuration. Rejected alternative: an environment variable mirroring the TTL. It is manual sync, cannot express per-role TTLs, and the user explicitly asked to avoid it.

2. **Keep `expiresInDays` rather than add `expiresAt`.** This keeps the generated client, `useShareLink`, `ShareLinkData` and both containers untouched apart from one optional flag. Rejected alternative: `expiresAt`. It is more precise (it could render "active until …"), but it changes every layer for a display that is already day-granular. It can be added later without breaking anything.

3. **Round up with `Math.ceil`.** The peek runs milliseconds after creation, so a 72-hour TTL yields `ceil(2.9999…) = 3`. Rounding down would show 2. A sub-day TTL shows 1 rather than 0.

4. **Omit on failure, never default.** A failed or empty peek logs a warning and returns the link without `expiresInDays`. Rejected alternative: falling back to 3, which reintroduces the constant and can show a wrong value. The containers already guard with `expiresInDays != null`, so omission degrades to "no note".

5. **Library isolation.** `libs/share` receives only the resolved number through `ShareLinkData`. DIAL Core endpoints, invitation parsing and the SDK call stay in `apps/chat-api`. `libs/chat-hooks` keeps passing the generated response field through, which its second isolation exception already covers. The BFF follows `apps/chat-api/AGENTS.md`: SDK client via `DialClientService`, `Logger`, and an optional DTO field with Swagger metadata.

## Risks / Trade-offs

- [`expireAt` turns out to be in seconds, not milliseconds] → The derived value would be negative and get omitted, so no wrong number is shown. The success-path debug log prints `expireAt` as an ISO date, which makes a 1970 date immediately visible.
- [The author cannot peek their own fresh invitation in some DIAL Core version] → The link is still returned without a note, and a warning is logged. To verify, check for the `Share link expiry for invitationId=… expireAt=…` debug line on a real DIAL Core.
- [Extra latency on popover open] → One small GET to DIAL Core on a non-hot path.
- [The API contract loosens (`expiresInDays` no longer required)] → Existing readers that already null-check are unaffected. External API consumers that assumed the field was always present must handle its absence; this is noted in the OpenAPI description.

## Migration Plan

No data migration. Deploy the BFF and frontend together as usual. Rollback is a code revert, which restores the constant and the required field.

## Open Questions

- What do the `Role.share` map keys mean, and what unit is `invitation_ttl` in? This is informational only, since the chat reads `expireAt`.
