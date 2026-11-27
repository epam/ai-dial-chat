## REMOVED Requirements

### Requirement: Rules-lookup endpoint proxies DIAL Core's getPublicationRules, scoped to the exact requested folder

**Reason**: Publication access rules are removed from DIAL Chat (change `remove-publish-access-rules`). Without the editor nothing pre-fills, so `GET /api/v1/publish/rules` (operation `getPublishRules`) has no caller.

**Migration**: None for in-repo callers: the endpoint, its DTOs and the generated `getPublishRules` operation are deleted together with the former `apps/chat/src/server-api/publish-rules.api.ts`. Read folder rules from DIAL Core directly if needed.
