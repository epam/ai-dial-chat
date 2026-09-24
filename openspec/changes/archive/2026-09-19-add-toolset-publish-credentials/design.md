## Context

Publishing a catalog entity in Chat NG runs through one path:

`DetailsPanel` (`libs/catalog`) → `usePublishFlow` + `PublishPanel` (`libs/publish-panel`) → `onPublish` → `useCatalogPublishing.handlePublish` (`apps/chat`) → `publishCatalogEntity` (`server-api/publish.api.ts` → generated `libs/chat-api-client`) → `POST /api/v1/catalog/{entityType}/{entityId}/publish` → `PublishService.publish` → DIAL Core `createPublication`.

DIAL Core's `PublicationResource` already carries an optional `publishCredentials?: boolean` (`@epam/ai-dial-typescript-sdk`, `components['schemas']['PublicationResource']`). Setting it on the `ADD` resource tells Core to copy the publisher's own toolset credential onto the published copy, so the copy arrives already authorised and its catalogue card carries no `"Authorize to use this toolset."` marker. Nothing in Chat NG sets it, so every Chat NG publication is the unticked one.

Legacy chat 0.x (`origin/development-0.x`) is the reference implementation:

- `useToolsetActions.handlePublish` seeds `PublicationModel.publishCredentials = isToolsetSignedIn(toolset)` — this is an *eligibility* flag ("offer the control"), not the submitted value.
- `PublicationToolsetRow` renders `PublicationCredentialsRow` (a `Checkbox` + `IconKey` + "Credentials") under the toolset row when that flag is set.
- The submitted value is separate state: `CreatePublicationHandler` sends `...(isToolsetId(id) && { publishCredentials: selectedPublishCredentials.includes(id) })`, read from `selectSelectedCredentialsItems`, which starts empty — i.e. unticked by default.
- `publication-service.ts` omits the field entirely when false.
- Reviewer side: an administrator can untick it while approving (`updateAndApprovePublicationRequestEpic`), and `PublicationToolsetRow` renders the row for a submitted publication, which is how a publisher sees after the fact that a publication carried shared access.

Constraints for this change:

- `libs/publish-panel` is a published, host-agnostic library (AGENTS.md §Library isolation). It must not learn what a toolset is, what a credential level is, or that DIAL Core exists.
- `libs/catalog` already models toolset credentials (`CatalogItemCredentials` on `CatalogItem`: `authenticationType`, `userStatus`, `globalStatus`, `isPublic`, `isManageableByAdmin`) and already renders a credentials action from them (`catalog-toolset-credentials`). Deciding *whether the toolset has a login the publisher holds* is therefore already inside the catalog's remit.
- `apps/chat-api` conventions are in `apps/chat-api/AGENTS.md` (thin controllers + Swagger, validated DTOs, typed exceptions, `@epam/ai-dial-typescript-sdk` via `DialClientService`). This change adds no endpoint, no env var, and no new authorization rule.
- `libs/chat-api-client` is generated; it is regenerated, never hand-edited.

Decided with the requester before drafting (issue #8752 left all three open):

1. **No role gate** — any publisher signed in to the toolset may pass the access on.
2. **Both OAuth and API-key toolsets** are eligible.
3. **AC12 observability** lands on the publish-history entry.

## Goals / Non-Goals

**Goals:**

- Offer an opt-in "Credentials" control in the Chat NG publish panel for a toolset that needs a login and whose publisher holds one (AC1–AC3).
- Guarantee the option is cleared every time the panel opens, including after a publication submitted with it selected (AC4) — the case GH #5074 records as broken in the old chat.
- Carry the choice unchanged to DIAL Core's `publishCredentials` on the publication's `ADD` resource, so AC5–AC9 follow from Core's existing behaviour rather than from new Chat NG logic.
- Let a publisher see afterwards which publications carried shared access (AC12).
- Keep every new field optional/additive: an unchanged caller produces an unchanged request.

**Non-Goals:**

- Any reviewer-side surface. Chat NG has no publication-approval UI of its own (administrators approve in DIAL Core's admin surface), so legacy's "administrator may untick while approving" has no counterpart here and none is added.
- Changing the `"Authorize to use this toolset."` badge (`catalog-toolset-credentials`). It reads the published copy's own auth status; Core flips that when it applies the shared credential (AC6).
- Adding a way to withdraw organization access (AC11). The existing admin **Manage credentials** surface already logs out organization-level credentials without touching the publication.
- Conversation publishing. `publishCredentials` is a toolset concept; `conversation-publish-api` is untouched.
- Folder-level or bulk credential publishing. Chat NG publishes one entity per request.
- Displaying, echoing, or logging any credential value anywhere (AC9). Only the boolean travels.

## Decisions

### D1 — The lib renders a generic checkbox; the catalog decides when to show it

`PublishPanel` gains an optional section driven purely by props:

```tsx
publishCredentials?: boolean;              // undefined ⇒ section not rendered
onPublishCredentialsChange?: (value: boolean) => void;
labels.credentialsLabel / credentialsHint  // host-supplied, English defaults
```

The section renders only when `onPublishCredentialsChange` is supplied, so the whole feature is opt-in per host and per item. The lib names nothing domain-specific — the label text is a host string.

*Alternatives considered.* (a) Put the eligibility rule in `libs/publish-panel` by giving it a `resource.credentials` shape. Rejected: it drags toolset and credential-level modelling into a library whose whole point is not knowing about either, and conversations would inherit a prop that can never apply to them. (b) Have `apps/chat` pass a `renderExtraPublishFields` render-prop. Rejected: the app would then own layout, spacing, and the disabled/submitting coupling that the panel already manages for every other field, and two hosts would draw the same control differently.

### D2 — Eligibility derives from `item.credentials` inside `libs/catalog`

`DetailsPanel` offers the control when all hold:

- `item.type === CatalogEntityType.Toolset`
- `item.credentials?.authenticationType` is set and is not `ToolsetAuthenticationType.None`
- `item.credentials.userStatus === CredentialStatus.SignedIn` **or** `item.credentials.globalStatus === CredentialStatus.SignedIn`

This is the Chat NG equivalent of legacy's `isToolsetSignedIn(toolset)`. Legacy checked only the `GLOBAL` level; Chat NG accepts either, because publishing always acts on the publisher's own source item (`isPublishVisible` requires `item.isMyApp`), where `globalStatus` is the owner's own credential and `userStatus` covers a personal credential on top of it. A publisher who holds neither sees no control (AC3), and a `None`-auth toolset never shows one (AC2).

`DetailsPanel` already receives `item.credentials` — no new fetch, no new prop from the app, and no loading state, because the details panel does not render until the item's details have resolved.

*Alternatives considered.* A host predicate `isPublishCredentialsVisible?: (item) => boolean`, matching the existing `isPublishVisible`/`isUnpublishVisible` pattern. Rejected as redundant plumbing: unlike write-access and admin status, every input to this decision is already on the item the panel holds, and `libs/catalog` already branches on exactly these fields for its credentials action. The prop is left out rather than added unused; if a second host ever needs to override the rule, adding it later is additive.

### D3 — `usePublishFlow` owns the value, and `reset()` clears it (AC4)

The flag is flow state, next to `rules` and `author`:

- `publishCredentials: boolean` initialised to `false`;
- `setPublishCredentials`;
- included in `reset()`, which `DetailsPanel` already calls on both close paths (`handleClosePublish` and the confirmation-close path);
- passed as a fifth argument to `onPublish(item, folderPath, rules, author, publishCredentials)`.

`PublishPanel` unmounts when the sub-view closes, so state cannot survive visually either. Two independent mechanisms both give "cleared on open", which is what makes the legacy bug hard to reintroduce; a `reset()` regression test asserts it directly.

Notably the flag is deliberately *not* synced from history the way `rules` are pre-filled from the destination folder: AC4 says selecting it is always a deliberate act, so a folder whose previous publication carried credentials must still open unticked.

*Alternatives considered.* Local `useState` inside `PublishPanel`. Rejected: `handleSubmit` lives in the hook and would have to receive the value through a callback, and the panel would then hold the only state the hook cannot reset — exactly the shape the legacy bug had.

### D4 — `onPublish` gains a positional argument rather than an options object

`onPublish(item, folderPath, rules, author, publishCredentials)` extends the existing positional signature. It is a breaking type change for any out-of-repo caller of `@epam/ai-dial-publish-panel` / `@epam/ai-dial-catalog`, but the argument is additive and existing in-repo callers (`useCatalogPublishing.handlePublish`, the conversation publish container) keep compiling — a four-parameter function is assignable to a five-parameter type in TypeScript.

*Alternatives considered.* Refactoring to `onPublish(item, { folderPath, rules, author, publishCredentials })`. Rejected for this change: it touches every publish call site and both READMEs for no behavioural gain, and mixes a signature refactor into a feature change. Worth doing on its own if a sixth field appears.

### D5 — Backend: optional request field, conditionally set on the Core resource

`PublishCatalogEntityDto` gains:

```ts
@ApiPropertyOptional({ ... })
@IsOptional()
@IsBoolean()
publishCredentials?: boolean;
```

`PublishService.publish` takes it as a parameter and builds the resource as
`{ action: 'ADD', sourceUrl, targetUrl, ...(publishCredentials ? { publishCredentials: true } : {}) }`.

Omitting it when false (rather than always sending `false`) matches legacy's `publication-service.ts` and keeps the request byte-identical to today's for every existing caller, so no Core-side behaviour can change for them. Unpublish is untouched: a `DELETE` resource grants nobody anything.

Authorization is unchanged. Core derives the publication's actor from the bearer token and enforces target-folder write access against it, and the publication is `PENDING` until an administrator approves — that approval is the control point for the security-relevant act the issue flags, and it already exists.

*Alternatives considered.* Deriving the flag server-side (chat-api reads the toolset's auth status and decides). Rejected: the publisher's intent is not derivable — being signed in is exactly the state in which *both* answers are legitimate — and it would add a toolset lookup to every publish request.

### D6 — Observability reads the flag back off Core's own resources (AC12)

`getPublicationSourceAction` in `publication.util.ts` already locates the resource matching `sourceUrl` within each publication. A sibling `getPublicationSourceCredentials(publication, sourceUrl): boolean` reads `publishCredentials` off that same matched resource (`PublicationResourceLike` gains the optional field). `PublishHistoryEntryDto` gains a required `publishCredentials: boolean` — always present, defaulting to `false` when Core omits it — and `PublishHistoryEntry` in `libs/publish-panel` gains the same, mapped by `mapPublishHistoryEntryDto`.

`PublishHistoryList` renders a marker on entries that carried shared access, with a host-supplied label. Storing the flag chat-api-side was never an option: `PublishService` holds no persistence and DIAL Core is the sole source of truth (see `catalog-publish-api`).

One honest limit, recorded rather than hidden: the publish-history section in `PublishPanel` is currently commented out behind a `TODO: will implement later`. This change wires the data through and renders it in `PublishHistoryList`, so the marker appears the moment that section is re-enabled; it does not re-enable the section, which is a separate decision with its own scope.

### D7 — i18n

New English keys under the existing catalog publish namespace, added to `apps/chat/src/i18n/locales/en.json` and `CatalogI18nKeys`:

- `catalog.publish.credentialsLabel` — "Publish with my credentials"
- `catalog.publish.credentialsHint` — explains that members will use the toolset without authorising, and that the credential itself is never shown to them
- `catalog.publish.historySharedCredentials` — the history marker

Other locales fall back to English, per the repo's existing practice. The lib keeps English defaults for each label so it renders standalone.

### D8 — Accessibility

The control is a ui-kit 2.0 `Checkbox` with `labelProps={{ label }}` and `caption={hint}`; the kit wires the caption as the checkbox's description, so no hand-rolled `aria-describedby` is needed. The consequence of ticking it is stated in the caption, not only in the label, because the label alone ("Credentials") is what made the legacy control opaque. `disabled` follows `isSubmitting`, matching every other field in the panel. The history marker is text, not an icon alone; any decorative icon beside it carries `aria-hidden`. Text colours resolve through existing panel tokens, so the AAA contrast floor is inherited rather than re-derived.

## Risks / Trade-offs

- **A publisher shares a personal credential with the whole organization by mistake** → The control is unticked on every open (D3), its caption states the consequence in plain words (D8), and it is only ever offered to someone who already holds the credential. DIAL Core's administrator approval still stands between the request and the organization. Accepted deliberately: gating by role was considered and rejected with the requester, because the person holding a shared team account is usually not an administrator — gating it would leave the issue's own use case unsolved.
- **DIAL Core ignores `publishCredentials` on a deployment that predates it** → The publication still succeeds; the copy simply arrives unauthorised, exactly as today. Nothing in Chat NG asserts the credential was applied, and the history marker reports what was *requested*, which is what AC12 asks for.
- **`publishCredentials` semantics differ between Core versions** → Only a boolean crosses the wire and it is omitted when false, so an older Core sees today's exact request. No fallback logic is added for a difference nobody has observed.
- **The history marker is invisible until the history section is re-enabled** → Recorded in D6 as a known limit rather than papered over; the data path and the `PublishHistoryList` rendering are delivered and unit-tested, so re-enabling the section is the only remaining step.
- **Signature churn for external consumers of the two libs** (D4) → Additive positional argument; documented in both READMEs. In-repo callers compile unchanged.
- **The generated client drifts from the spec** → `npm run openapi` then `npm run openapi:check` are part of the task list, and the PR workflow runs the check independently.

## Migration Plan

No data migration, no environment variable, no feature flag, no deployment ordering constraint beyond the usual: backend and frontend ship together from the same build, and an older frontend against a newer backend simply never sends the field.

Rollback is reverting the change. Publications already submitted with `publishCredentials: true` are DIAL Core records and are unaffected — Core continues to honour them; Chat NG merely stops offering the control and stops showing the history marker.

## Open Questions

None blocking. Two deliberately deferred, each recorded above rather than left implicit:

1. Re-enabling the publish-history section in `PublishPanel` (D6) — pre-existing `TODO`, its own scope.
2. Converting `onPublish` to an options object (D4) — worth doing when a sixth field appears.
