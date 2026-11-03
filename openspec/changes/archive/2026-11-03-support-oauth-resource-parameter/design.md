## Context

DIAL Core (epam/ai-dial-core#2218) stores an optional RFC 8707 `resource` in a toolset's or external
service's `auth_settings` and sends it on the authorization-code exchange and on refresh. Core never
builds the authorize URL. Chat does, in the browser, through one builder —
`buildToolsetAuthorizeUrl` in `libs/chat-hooks/src/oauth/authorize-url.ts` — which every login entry
point reaches through `initiateOAuthLogin` or `navigateToolsetOAuthPopup`
(`libs/chat-hooks/src/oauth/popup.ts`). Servers that check `resource` on both legs (Notion MCP)
answer `invalid_target` when only the token leg has it.

What the code does today:

- **Settings flow into the builder through `ToolsetOAuthSettings`** (`libs/chat-hooks/src/oauth/models.ts`),
  structurally duplicated as `ExternalServiceOAuthSettings`
  (`libs/chat-hooks/src/external-services/useExternalServiceLogin.ts`). Six places copy five DTO
  fields into it by hand: `useToolsetLogin` (re-read branch), `useCatalogToolsetCredentials`,
  `application-credentials.ts`, `apps/chat/src/utils/signin-interrupt.ts` (twice), and
  `AppEditorIframe`'s external-service relay. Two more pass the editor form state
  (`ToolsetAuthFormData`) straight in: `useToolsetEditorOAuthLogin` and `AppEditorIframe`'s toolset
  relay (via `toolsetDtoToForm(dto).auth`). `useToolsetLogin` and `useExternalServiceLogin` each copy
  the caller's `oauthSettings` once more, field by field, before navigating the popup.
- **Toolsets go through chat-api.** `ToolsetAuthSettingsBodyDto` is whitelisted
  (`forbidNonWhitelisted`), `toDialAuthSettings` builds Core's snake-case body for OAuth only,
  `preserveHiddenAuthSettings` refills `OAUTH_MERGEABLE_KEYS` from the stored toolset when the body
  omits them, and `mapAuthSettings` is an allowlist that doubles as secret redaction. The issue did
  not list any of this; without it, the editor's first save with a Resource field returns `400`.
- **External services go through chat-api** for reads (`mapDialExternalServiceToDto`, shared by the
  single-service GET and the public listing) and for the declare `PUT`
  (`toDialExternalServiceDefinition`). The Chat UI never calls the `PUT`; it exists for other
  callers (#9526).
- **SDK.** `@epam/ai-dial-typescript-sdk` is pinned at `0.2.0-dev.15`, which has no `resource`.
  `0.2.0-dev.23` (published 2026-11-03, `development` dist-tag) declares `resource?: string` on
  `ResourceAuthSettings` and `ResourceAuthSettingsData`; `ExternalService` / `ExternalServiceData`
  type `auth_settings` as `ResourceAuthSettings`, so they carry it too.
- **Static vs dynamic** is `WithLogin.WithConfig` vs `WithLogin.WithLogin`, restored from Core's
  `dynamically_registered` flag in `authSettingsDtoToForm` (`apps/chat/src/utils/toolsets.ts`).

Core's rules this design relies on (from the Core PR): `resource` must be an absolute URI without a
fragment; it is rejected for dynamic registration and for NONE / API_KEY / DIAL_NATIVE; on a toolset
OAuth update an omitted value keeps the stored one and a blank one clears it; a static toolset saved
without a value gets the server's Protected Resource Metadata value when the server publishes one;
an external-service `PUT` replaces the whole object.

## Goals / Non-Goals

**Goals:**

- Every Chat OAuth login whose stored settings carry `resource` sends it on the authorize leg.
- Static OAuth toolsets can set, keep and clear `resource` from the toolset editor.
- chat-api accepts, validates, forwards and returns `resource` for toolsets and external services.
- Stop hand-copying OAuth DTO fields at six call sites, so the next field is added once.

**Non-Goals:** dynamic-registration input, non-OAuth types, offline-credentials consent, catalog
details display, Admin UI — see the proposal.

## Decisions

### D1. The builder adds `resource` verbatim when non-blank

`buildToolsetAuthorizeUrl` sets `resource` from `auth.resource?.trim()` when non-empty, after
`scope`. It does not validate the value: Core validated it on save and sends the same string on the
exchange, and any rewrite (normalising a trailing slash, lowercasing) would make the legs differ.
The parameter is added through `URLSearchParams`, so it is percent-encoded like the others.

*Alternative:* re-validate in the builder and return `null` on a bad value. Rejected — it would turn
a server-side data problem into a silent "invalid config" for a value Core already accepted.

### D2. One pure mapper, `toToolsetOAuthSettings`, in `chat-hooks/oauth`

A new `toToolsetOAuthSettings(source?: ToolsetOAuthSettingsSource): ToolsetOAuthSettings` lives next
to the builder and is exported from the root and `./oauth`. `ToolsetOAuthSettingsSource` is a
structural interface (`clientId`, `authorizationEndpoint`, `scopesSupported`, `codeChallenge`,
`codeChallengeMethod`, `resource`, all optional) that both `DialToolsetAuthSettingsDto` and
`GetExternalServiceResponseDto` satisfy, so the `oauth` module takes no dependency on the generated
client for it. The six hand-copy sites switch to it; `useToolsetLogin` / `useExternalServiceLogin`
pass `resource` through when copying the caller's settings. `ExternalServiceOAuthSettings` gains
`resource` too; it stays a separate interface (merging the two is an unrelated refactor).

Library isolation holds: the lib receives already-fetched DTO data from the host or from the
injected `getToolset`; it adds no route, client construction or Core call.

*Alternative:* add `resource` at each site (issue's scope). Rejected — the bug this change fixes is
exactly "one field missing on one leg"; six copies make the same failure likely at one entry point.

### D3. Editor field: static registration only, optional, validated in the lib

`ToolsetAuthFormData.resource?: string`; `AuthSection` renders a kit `Input`
(`id="toolset-resource"`) after Scopes only under `WithLogin.WithConfig`, wired like the token
endpoint input. A new `isValidOAuthResource(value)` in `libs/toolset-editor/src/utils/toolsets.ts`
returns `true` for blank, otherwise requires no whitespace, no `#`, and a successful `new URL(value)`
(which accepts any absolute URI, not only http(s) — matching Core's "absolute URI" rule). It feeds
both `ToolsetEditor`'s error surfacing (`resource` joins `AUTH_ERROR_FIELDS` and
`ToolsetFormErrors`) and `isToolsetAuthValid`. Labels: `AuthSectionLabels.resourceLabel`,
`.resourcePlaceholder`, `ToolsetEditorValidationLabels.resourceInvalid`, English defaults, filled
by `ToolsetApplicationEditor` with `t(ToolsetEditorI18nKeys.Resource*)`.

No caption/help text: Core resolves the value itself when it is blank and the server publishes
metadata, so the empty field is the right default and needs no instruction.

### D4. Host mapping: blank means `''` on update, omitted on create

`authSettingsDtoToForm` reads `resource ?? ''`. `formToToolsetBody(form, redirectUri, isUpdate)`
writes `resource` only for OAuth + `WithConfig`: trimmed value if non-blank; else `''` when
`isUpdate`, nothing on create. `ToolsetApplicationEditor` passes `Boolean(toolsetId)`.

Why not always `''`: Core documents blank as "clear" on update; on create it is unspecified whether
a blank value suppresses the Protected Resource Metadata lookup. Omitting on create is the
unambiguous "no value given". Why not omit on update: an omitted value keeps the stored one, so the
user could never clear the field.

A `resource` that `WithLogin` toolsets read back from Core (Core fills it from metadata) stays in
the form state for the authorize URL but is never sent, since Core rejects it for dynamic
registration.

### D5. chat-api: forward, never merge

- `ToolsetAuthSettingsBodyDto.resource` and `ExternalServiceAuthSettingsBodyDto.resource`:
  `@IsOptional() @IsString() @MaxLength(2048) @Matches(OAUTH_RESOURCE_PATTERN)` with
  `OAUTH_RESOURCE_PATTERN = /^(?:[A-Za-z][A-Za-z0-9+.-]*:[^\s#]+)?$/` in a new
  `apps/chat-api/src/common/validators/oauth-resource.pattern.ts` (the empty alternative allows the
  clearing `''`). It follows the existing `*.pattern.ts` files and the allowlist-regex rule in
  `apps/chat-api/AGENTS.md`.
- `toDialAuthSettings` forwards `resource` in the OAuth branch when `!= null`.
  `toDialExternalServiceDefinition` adds it to its `undefined`-filtered object, so `''` survives.
- `resource` is **not** added to `OAUTH_MERGEABLE_KEYS`. Core keeps an omitted value already; the
  merge would re-send a stored value for a `WithLogin` toolset and Core would reject the save.
- `mapAuthSettings` and `mapDialExternalServiceToDto` add `resource`; `DialToolsetAuthSettingsDto`
  and `GetExternalServiceResponseDto` gain `@ApiPropertyOptional() resource?: string`.
- Types: bump `@epam/ai-dial-typescript-sdk` to `0.2.0-dev.23` (exact pin, as today). `DialAuthSettings`
  (`components['schemas']['ResourceAuthSettings']`) and the external-service types then declare
  `resource` themselves; no local type extension and no raw `fetch`. The rest of the dev.15 → dev.23
  type diff is additive (org-unit operations and schemas, `ORG_UNITS` added to `ResourceTypes`,
  which `apps/chat-api/src/share/utils/share-resource.util.ts` only uses as a value type, not an
  exhaustive match), so `nx typecheck`/`test` on chat-api is the check for the bump. One addition
  is not inert: `createPublication` gained a body-less `409` ("a skill or project target is an org
  unit's folder"), so `result.error` can be `undefined` on failure. The two conversation
  publish/unpublish paths in `apps/chat-api/src/conversations/conversation-publish.service.ts` now
  check `!result.response.ok || result.error != null`, the guard `publish.service.ts` already uses.

*Alternative:* extend the SDK type locally (`& { resource?: string }`) and bump later. Rejected now
that `0.2.0-dev.23` is published — it would add a follow-up and hide a later SDK rename.

### D6. Editor login re-reads stored settings only when the field is blank

`useToolsetEditorOAuthLogin` today builds the URL from form state for `WithConfig`. If the field is
blank and Core resolved a value at save, form state has none and the exchange fails with
`invalid_target`. For `WithConfig` with a blank `resource`, the hook follows the existing
dynamic-registration branch: open the popup synchronously, `await ensureSaved()`,
`fetchToolsetAuthSettings(savedToolsetId)`, navigate with the form's settings plus the stored
`resource`, and report only `{ resource }` back (the stored settings have no client secret, and the
editor merges `result.auth` into the form). Both branches share one `openPopupWithStoredAuth` helper. With a
filled field it keeps today's path. `useCallback` dependencies are unchanged (the hook has none).

*Alternative:* always re-read for every OAuth login. Rejected for now — one more round trip on a
path that works when the field is filled; the narrower rule covers the failing case.

Other entry points read settings from Core-backed DTOs (`DialToolsetDto`, external-service DTOs),
which already carry the stored value once D5 returns it.

## Risks / Trade-offs

- [Chat ships before Core #2218] → chat-api forwards a field Core does not know; Core's Jackson
  config may ignore or reject it. **Mitigation:** merge and release together (stated in the
  proposal); the frontend sends `resource` only when the user typed one or Core returned one, so an
  untouched toolset behaves as today.
- [SDK bump pulls in unrelated changes] → dev.15 → dev.23 also adds org-unit API surface. **Mitigation:**
  the bump is its own first task, verified by chat-api typecheck and tests before any `resource` code;
  the observed diff removes nothing chat-api reads.
- [Re-read changes popup timing for blank-field static logins] → the popup now opens before
  `ensureSaved`, as in the dynamic branch, which is the more popup-blocker-safe order; a failed read
  closes it and reports `Failed`.
- [External-service `PUT` without `resource` erases it] → inherent to Core's replace semantics;
  documented in the DTO's Swagger description and the spec. No Chat UI calls it today.
- [`new URL` accepts some strings Core may reject] (e.g. `urn:` forms Core's `URI.isAbsolute` treats
  differently) → Core still returns `400`, surfaced through the editor's existing upstream error
  notification (`extractToolsetApiErrorMessage`).

## Migration Plan

1. Merge together with epam/ai-dial-core#2218; deploy chat-api and the frontend after Core.
2. Existing toolsets need no migration: they have no `resource` and keep producing the same URLs.
   Static toolsets created before Core #2218 get a value only after an edit or re-create (Core note).
3. Rollback: revert the commit. Stored values stay in Core and are still sent on the token leg, so
   both-legs servers fail as before; nothing else depends on the field.

## Open Questions

- Does Core treat `resource: ""` on **create** as "no value" (metadata lookup still runs)? D4 avoids
  depending on it by omitting the field on create. Confirm with the Core PR author; if yes, D4 could
  always send `''`.
- Should the Admin UI and Chat share wording for the field label? Chat uses "Resource" (issue text).
