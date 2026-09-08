## Context

`ShareService.createShareLink` (`apps/chat-api/src/share/share.service.ts`) builds a
DIAL Core `shareResource` request from a single `itemId`. Before this change it
resolved related resources only for conversations:

```
createShareLink(itemId, access)
  ├── resourceUrl = toShareResourceUrl(itemId)
  ├── getRelatedResourceUrls(accessToken, bucket, resourceUrl)
  │     └── if NOT conversations/  → return []        ← applications got nothing
  └── shareResource({ resources: [resourceUrl, ...related] })
```

For an application, `getRelatedResourceUrls` returned `[]`, so DIAL Core was asked
to share only the application. The prompt a quick app references as a
`dial-prompt` skill (`application_properties.skills[].url`, a `prompts/{bucket}/...`
resource) got no grant — the recipient hit "Access denied to the prompt."

## Approach

Generalize `getRelatedResourceUrls` to dispatch by resource kind, mirroring the
existing conversation pattern for applications:

```
getRelatedResourceUrls(accessToken, sessionBucket, resourceUrl)
  ├── conversations/ → getConversationRelatedResourceUrls (existing logic, extracted)
  ├── applications/  → getApplicationRelatedResourceUrls (new)
  └── else            → return []
```

`getApplicationRelatedResourceUrls` reuses the `applications/{bucket}/{path}` →
`getCustomApplication` resolution that
`DeploymentsDetailsService.buildApplicationDetails`
(`apps/chat-api/src/deployments/details/deployments-details.service.ts`) already
uses — `parseDialApplicationResource` (`apps/chat-api/src/common/utils/dial-application-resource.ts`)
splits the resource id, then the SDK's `getCustomApplication(bucket, path)` loads
the full application body, forwarding the caller's bearer token.

The new `collectApplicationPromptResourceUrls` helper walks
`application_properties.skills[]` and keeps the `url` of every entry whose `type`
is exactly `'dial-prompt'` and whose `url` is a DIAL prompt resource url
(`isPromptResourceUrl` from `apps/chat-api/src/prompts/utils/prompt-mapper.util.ts`).
The `orchestrator.system_prompt` (`type: 'custom'`, inline content), `contexts[]`
(file resources), `tool_sets[]`, and every other skill kind carry no separate DIAL
resource and are left alone. Dedup is by exact url string, first-seen order.

Collected prompt urls are appended after the application in
`shareResource.resources` with the same resolved permissions
(`READ` for view, `READ`+`WRITE` for edit) — identical to how conversation file
attachments are handled today.

## Cross-bucket rule

DIAL Core rejects a single `shareResource` request mixing more than one owning
bucket (`"You're not allowed to share resources of different owners in a single
request"`). The caller also cannot grant access to a resource in another user's
private bucket. So a referenced prompt whose bucket (`getResourceBucket`, segment
`[1]` of a `prompts/{bucket}/...` url) is neither the application's own bucket nor
the public/organization bucket (`PUBLIC_BUCKET`,
`apps/chat-api/src/conversations/constants/conversation.constants.ts`) is silently
dropped — same rule the conversation path already applies to `files/...`
attachments. A prompt in the `public` bucket has no exclusive owner and is kept.

## Opaque application_properties

`application_properties` is authored by the embedded Quick Apps editor iframe and
treated as opaque everywhere in this repo (persisted/read as
`Record<string, unknown>`). The helper does not import the editor's
`QuickApp2Config` / `DialPromptSkill` types (they live in the editor package, not
this repo). The walk is defensive: `isRecord` + `Array.isArray` + `typeof === 'string'`
guards mean a missing or malformed `skills` array yields no urls rather than
throwing. This matches the defensive style of `collectConversationResourceUrls`.

## Error handling

The application pre-read is **best-effort**: it must never block sharing the
application itself. Before this related-resource lookup existed, an
`applications/...` itemId could be shared as long as `shareResource` succeeded —
the app itself was never gated on a prior read. Any failure here degrades to
app-only sharing rather than failing the share:

- Application read throws (network/timeout) → logged as a warning, returns `[]`.
- Application read returns an upstream error (e.g. 404) → logged as a warning
  (including the upstream status), returns `[]`.
- Application read returns no data (an empty body, or a plain custom app with no
  `application_properties`) → logged as a warning, returns `[]`.

In every failure case the share proceeds with the application resource alone —
`shareResource` is still called, just with no related prompt urls appended. The
attached prompts are an enhancement on top of the baseline "share the app" path,
not a precondition for it. This deliberately diverges from the conversation path
(which fails the share on a read error): a conversation with no data is a DIAL
Core malfunction, whereas a plain custom application legitimately has no
`application_properties`, and a transient pre-read error must not regress the
baseline ability to share the app.

## Alternatives considered

- **Share prompts client-side, from the frontend.** Rejected: the frontend does
  not reliably know which prompts a quick app references (that state lives in the
  embedded editor's data model), and the existing share endpoint is a single
  server-side call. Resolving related resources server-side, as conversations
  already do, is the consistent pattern.
- **Share every referenced resource (prompts + toolsets + files in `contexts[]`).**
  Rejected for scope: #8529 is specifically the attached prompt. Toolsets have
  more varied reference shapes and are a separate follow-up. `contexts[]` are
  file resources already covered when the recipient opens the app (and sharing
  them per-app would duplicate the conversation-file logic for a resource kind
  not in the issue).
- **Fail the whole share when a cross-bucket prompt is found.** Rejected: it
  would block sharing any quick app that references someone else's prompt, a
  likely regressive break. Dropping silently matches the conversation path's
  established behavior.

## No new endpoint, DTO, or frontend change

`POST /api/v1/share` request and response shapes are unchanged. The server only
resolves more related resources before proxying to DIAL Core. No generated-client
impact, no OpenAPI regeneration needed, no i18n, no RTL, no feature flag.
