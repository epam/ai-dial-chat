## Why

A toolset that needs a login can be published to the organization, but every colleague who finds it is told to authorise it themselves — and for a toolset that runs on a shared account, they never can. The publisher usually holds that credential and has already decided to share the toolset; Chat NG gives them no way to pass the access along with it (GH #8752).

Legacy chat 0.x solved this with a **Credentials** checkbox under the toolset in its publish form, which sets `publishCredentials: true` on the publication resource DIAL Core receives. DIAL Core still supports the field (`PublicationResource.publishCredentials` in `@epam/ai-dial-typescript-sdk`); Chat NG simply never sends it, so every Chat NG publication is the unticked one. The result is a catalogue entry that looks available and is not.

## What Changes

- **Publish panel gains an opt-in "Credentials" control.** `@epam/ai-dial-publish-panel`'s `PublishPanel` accepts an optional, host-driven checkbox section (value, change handler, labels, disabled state). The lib stays host-agnostic: it renders a checkbox and reports its state, and knows nothing about toolsets, credential levels, or DIAL Core.
- **The catalog decides when the control is offered.** `libs/catalog`'s `DetailsPanel` shows it only for a `Toolset` whose `credentials.authenticationType` is not `None` **and** whose publisher is signed in (`credentials.userStatus` or `credentials.globalStatus` is `SignedIn`). Covers both OAuth and API-key toolsets — the shared-API-key case is the common one internally. No role gate: any publisher who holds the access may pass it on, matching legacy, with DIAL Core's existing `PENDING` → administrator-approval step as the control point.
- **The option is always cleared when the panel opens.** `usePublishFlow` owns the state, defaults it to `false`, and clears it in `reset()` — including after a publication that was submitted with it selected. This is the behaviour GH #5074 records as broken in the old chat.
- **The flag reaches DIAL Core.** `PublishCatalogEntityDto` gains optional `publishCredentials?: boolean`; `PublishService.publish` forwards it on the single `ADD` resource of the `createPublication` body, omitted entirely when false so the request shape is byte-identical to today's for every existing caller.
- **Publish history reports whether a publication carried shared access.** `PublishHistoryEntryDto` gains `publishCredentials: boolean`, read back from the resource Core returns, and `PublishHistoryEntry` / `PublishHistoryList` surface it — satisfying the issue's observability criterion (AC12).
- Regenerate `libs/chat-api-client` from the updated OpenAPI spec (`npm run openapi`, `npm run openapi:check`).
- No **BREAKING** change: every new field is optional on request and additive on response; a caller that sends nothing behaves exactly as before.

## Capabilities

### New Capabilities

_None._ The change extends three existing capabilities rather than introducing a new one — the control lives in the publish panel that `publish-panel-library` already defines, the decision to offer it in the flow `catalog-publish-flow` already defines, and the wire field in the endpoint `catalog-publish-api` already defines.

### Modified Capabilities

- `publish-panel-library`: `PublishPanel` gains an optional credentials-checkbox section (props, labels, a11y contract); the library's host-agnostic boundary is restated for it — no toolset, credential-level, or DIAL Core knowledge crosses into the lib.
- `catalog-publish-flow`: when the credentials option is offered, its default-cleared behaviour, and how its value reaches `onPublish`; `usePublishFlow` gains the state and clears it on `reset()`; `PublishHistoryList` shows which past publications carried shared access.
- `catalog-publish-api`: `PublishCatalogEntityDto.publishCredentials` and its forwarding onto the Core `ADD` resource; `PublishHistoryEntryDto.publishCredentials` read back from Core.

## Impact

**Backend (`apps/chat-api`)**

- `src/publish/dto/publish-catalog-entity.dto.ts` — new optional boolean field with Swagger metadata.
- `src/publish/dto/publish-history-entry.dto.ts` — new response field.
- `src/publish/publish.service.ts` — `publish()` gains a parameter and conditionally adds `publishCredentials` to the resource; `getPublishHistory()` reads the flag off the matched publication's resources.
- `src/publish/publish.controller.ts` — passes the new body field through.
- `apps/chat-api/src/openapi/` spec output regenerated.

**Generated client**

- `libs/chat-api-client` regenerated; no hand edits.

**Libraries**

- `libs/publish-panel` — `PublishPanel` props + labels, `usePublishFlow` state and `reset()`, `PublishHistoryList` entry rendering, `PublishHistoryEntry` model, README.
- `libs/catalog` — `DetailsPanel` offers the control for eligible toolsets, `item-details-props.ts` `onPublish` signature gains the flag, `catalog-props.ts` pass-through, labels plumbing, README.
- `libs/chat-hooks` — `mapPublishHistoryEntryDto` maps the new field.

**App (`apps/chat`)**

- `src/hooks/useCatalogPublishing/useCatalogPublishing.ts` — `handlePublish` forwards the flag to `publishCatalogEntity`.
- `src/components/CatalogView/CatalogView.tsx` — new label wiring.
- `src/i18n/locales/en.json` + `src/constants/translation-keys.ts` — new keys (English only; other locales fall back).

**Not changed**

- No new environment variable, feature flag, or permission concept.
- The `"Authorize to use this toolset."` badge (`catalog-toolset-credentials`) needs no change: it already keys off the published copy's own auth status, which DIAL Core sets when it applies the shared credential.
- Withdrawing organization access without deleting the publication (AC11) is already served by the existing admin **Manage credentials** surface (organization-level logout); this change adds nothing there.

**Docs**

- `docs/architecture.md` is untouched — no new lib, app, backend domain, context, route, or `ApiEndpoints` member. `npm run validate:docs` must pass after the lib README updates.
