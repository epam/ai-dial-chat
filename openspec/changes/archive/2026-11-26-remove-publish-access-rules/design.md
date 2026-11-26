## Context

Publication access rules ("Allow access if all match") let a publisher attach DIAL Core `Rule` objects (`source`, `function` = `EQUAL`/`CONTAIN`/`REGEX`, `targets`) to the target folder of a publication. Today the feature spans:

- **Backend** — `apps/chat-api/src/publish/`: `PublishRulesController`/`PublishRulesService` (`GET /api/v1/publish/rules`, wrapping the SDK's `getPublicationRules`), `dto/publish-rule.dto.ts` (`PublishRuleDto`, `PublishRuleFunction`), `dto/get-publish-rules-query.dto.ts`, `dto/publish-rules-result.dto.ts`; the `rules` field on `PublishCatalogEntityDto` and `PublishConversationDto`, sent to Core as `rules: rules ?? []` by `PublishService.publish` and `ConversationPublishService.publish`. `app-config` resolves `PUBLICATION_FILTER_SOURCES` → `publish.publicationFilterSources` (local-only registry key, `env-admission/publication-filter-sources.admission.ts`) → `config.publicationFilterSources` on `GET /api/v1/client-config`.
- **Libs** — `publish-panel` owns the UI (`PublishAccessRules`, `PublishAccessRuleEditor`, models, styles) and the state (`usePublishFlow`: `rules`, `setRules`, `onFetchExistingRules`, `isRulesLoading`, `hasRulesLoadError`, the `rules` positional argument of `onPublish`), plus `StandaloneSaveToFolderPanel.accessRules` and `FolderDestinationRoot.hasAccessRules`. `catalog` threads `ruleSourceOptions`, `hidePublishAccessRules`, `onFetchExistingRules` from `CatalogProps` to `DetailsPublishContent`. `chat-hooks` (`useResourceSavePanel`, `resource-save.ts`, `create-publish-api.ts`, the `application-mode.mjs` e2e fixture) loads, gates on and sends rules for the Save panel.
- **App** — `CatalogView`, `useCatalogPublishing`, `PublishConversationPanelContainer`, `PublishProjectPanelContainer`, `ResourceSavePanelContainer`, `AppConfigContext`, `server-api/publish-rules.api.ts`, `server-api/conversation-publish.api.ts`, `utils/publish.ts` (`getAccessRulesLabels`), `constants/i18n-keys/publish-access-rules.ts`, `translation-keys.ts`, `en.json` (`publishAccessRules.*`).

The proposal removes all of it. Two facts shape how:

1. `openspec/specs/resource-save-panel/spec.md` disables Save while folder rules load "so a publish never sends empty rules over the folder's existing ones" — i.e. the current flow assumes `rules: []` in `createPublication` can replace a folder's stored rules.
2. The unpublish paths in `publish.service.ts` and `conversation-publish.service.ts` already omit `rules` from the Core body entirely.

An external host, `pg-chat`, sets `CatalogProps.hidePublishAccessRules` (recorded in `catalog-publish-flow`).

## Goals / Non-Goals

**Goals:**

- No access-rules UI, state, endpoint, DTO, config key, i18n key or generated-client type remains.
- Publishing never changes rules already stored on a DIAL Core folder.
- Every remaining publish behaviour (folder pick, author, credentials, dependencies, direct org-unit write, history, unpublish) is unchanged.

**Non-Goals:**

- Deleting or migrating rules stored in DIAL Core.
- Changing the approval flow, authorization, or any other publish field.
- Removing generic shell plumbing that rules happened to use but that has other callers (`onPendingDestinationChange`, `FolderDestinationPanel.renderFolderViewFooter`).

## Decisions

### D1 — Remove the feature outright, not hide it behind a flag

Alternatives: (a) an `ENABLED_FEATURES` key that hides the section; (b) hide the UI only and keep the API. Both keep the full surface alive (tests, i18n, lib API, docs) for a feature the product dropped, and (b) leaves a write path no UI uses. Removal is a plain `git revert` away if the decision changes. **Pick: delete end to end.**

### D2 — Omit `rules` from `createPublication`, never send `rules: []`

Sending `[]` is what both services do today when the user adds nothing; the Save-panel guard (fact 1) shows the team treats `[]` as able to overwrite the folder's rules once approved. Without the editor's pre-fill, `[]` would silently wipe admin-configured rules on every publish. Omitting the key matches the existing unpublish precedent (fact 2). **Pick: drop the `rules` key from both publish request bodies.** The shape is pinned by a service unit test asserting the key is absent.

### D3 — Delete `rules` from the request DTOs (stale clients get 400)

Alternative: keep `rules?` as `@IsOptional` and ignore it for one release. The SPA and BFF are built and deployed together from this repo; no other in-repo caller sends `rules`. The only exposure is a browser tab loaded before the deploy, whose old bundle always sends `rules` — it gets a 400 on Publish until reloaded. That is the same exposure every DTO removal has here, so we do not add a deprecation shim. If review prefers a shim, it is a one-line `@IsOptional() @Allow()` field ignored by the service, and the scenario in `catalog-publish-api` changes from "400" to "ignored".

### D4 — `onPublish` drops the `rules` positional argument

Alternative: keep `(item, folderPath, rules, author, publishCredentials)` and always pass `[]`. That keeps a meaningless parameter in a public lib API forever. Every in-repo caller (`CatalogView` via `useCatalogPublishing`, the conversation/project containers) is updated in the same change; the new signature is `(item, folderPath, author, publishCredentials)`. Libs stay at `0.0.1`, so the break is announced in the `publish-panel` and `catalog` READMEs, not by a version bump. `pg-chat` must drop `hidePublishAccessRules` and re-check its `onPublish` arity.

### D5 — Remove `PUBLICATION_FILTER_SOURCES` and the registry key

The key is `localOnlyKey(LocalOnlyReason.Capability)`, so no managed-config (Studio) document stores it; removing it cannot invalidate stored managed config. Env validation (`apps/chat-api/src/config/env/client-ui.env.ts`, composed in `environment.config.ts`) only validates declared properties, so a deployment that still sets the variable boots and the value is ignored. Remove the property, its admission, mapper entry, response DTO field and `AppConfigContext` field, and update the composition snapshot (`apps/chat-api/src/config/tests/environment-composition.spec.ts`) and the `PUBLICATION_FILTERS` row of `docs/legacy-chat-migration-guide.md` (neither `apps/chat-api/README.md` nor `apps/chat-api/.env.template` lists the variable today).

### D6 — Keep generic panel plumbing

`onPendingDestinationChange` is also used by `PublishPanel`; `FolderDestinationPanel.renderFolderViewFooter` is a generic slot. Only `StandaloneSaveToFolderPanel` stops passing the rules footer. `useResourceSavePanel` keeps `pendingDestination` only if a non-rules consumer remains (direct-write checks); otherwise the state goes too.

### D7 — Library isolation

The change only removes props, callbacks and types. No host knowledge enters any lib; `chat-hooks` keeps calling the generated client through the instance it is given. `toolset-editor` → `chat-hooks` and `chat-hooks` → feature-lib edges are unaffected.

## Risks / Trade-offs

- [DIAL Core may treat an absent `rules` differently from what D2 assumes] → The Core contract types `rules` as optional; the unpublish path already relies on omission. Task 1 confirms against the SDK type and Core's publication handling before the backend slice lands; if Core *requires* the key, send nothing new and raise it as an open question rather than reverting to `[]`.
- [Stale browser tabs get 400 on Publish after deploy] → Accepted (D3); the existing submit-error callout shows and a reload fixes it.
- [`pg-chat` breaks at compile time] → Called out in the catalog README "Breaking changes" note and the PR description; the fix is deleting one prop.
- [Spec drift: `publish-access-rules-editor` and `publish-rules-lookup-api` become empty after archive] → Delete both spec folders during archive and confirm `npm run validate:specs` stays green.
- [Bundle] → Removal only; `PublishAccessRules` was rendered eagerly inside `PublishPanel`, so the publish chunk shrinks. No lazy-loading change needed.

## Migration Plan

1. Land in one PR, one commit per slice (backend → client regen → libs → app → docs), per the repo's one-PR-for-related-work convention.
2. Deploy SPA and BFF together (normal release).
3. Operators may delete `PUBLICATION_FILTER_SOURCES` at leisure; leaving it set is harmless.
4. Rollback: `git revert` the PR. No data is written or migrated; Core folder rules were never touched.

## Open Questions

- Does DIAL Core's `createPublication` leave a folder's rules unchanged when `rules` is absent? Task 1.1 finding: `@epam/ai-dial-typescript-sdk` types `Publication.rules` as optional (`rules?: Rule[]`), so omitting the key is a valid request, and the unpublish paths already omit it. No DIAL Core source is available in this workspace, so "absent leaves stored rules unchanged" is still inferred, not run against a live Core — confirm with the Core team before release.
- Should a deprecation shim accept-and-ignore `rules` for one release (D3)? Default: no.
