## Why

Publishing a conversation, application, or toolset today sends `rules: []` unconditionally to DIAL Core (`apps/chat-api/src/conversations/conversation-publish.service.ts:104`, `apps/chat-api/src/publish/publish.service.ts:99`) — there is no way for a publisher to restrict who can see a published resource by role, claim, or other attribute. Without it, every publish is effectively open to anyone with folder access, which blocks audiences that need attribute-based publish restrictions.

## What Changes

- Add an **access-rules editor** to the shared Publish sidebar (`libs/publish-panel`), placed in the scrollable body immediately after the folder-selection block and before publish history, so it appears identically for conversations, applications, and toolsets.
- The editor lets the user add zero or more rules (`{ source, function, targets }`), each rendered as a removable chip; a "clear all" control removes every rule. A single-rule inline/full-screen (desktop/mobile) editor validates `EQUAL`/`CONTAIN` (one or more trimmed, non-empty targets) and `REGEX` (exactly one non-empty, syntactically valid pattern) before a rule can be added.
- `libs/publish-panel` exposes this as **controlled props** (`rules`, `onRulesChange`, `ruleSourceOptions`, rule-related labels) on `PublishPanel`/`StandalonePublishPanel` — no request-building, no i18n, no app/config knowledge inside the library.
- `apps/chat` owns state (rules array, per-rule validation), retrieves the allowed `source` list from client-config, and includes `rules` in the publish request body for both the conversation and catalog (application/toolset) flows.
- **New config-registry entry** (`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`): a client-visible `publish.publicationFilterSources` config entry, env-var driven (default `['title', 'role', 'dial_roles']`), surfaced through the existing client-config endpoint/DTO — no new endpoint.
- **Backend DTO changes** (additive/backward-compatible): `PublishConversationDto` and `PublishCatalogEntityDto` gain an optional `rules?: PublishRuleDto[]` field, validated with `class-validator`/`@ValidateNested`/`@Type` against an allowlisted `PublishRuleFunction` enum (`EQUAL`/`CONTAIN`/`REGEX`). Missing `rules` normalizes to `[]`. `conversation-publish.service.ts` and `publish.service.ts` pass `dto.rules ?? []` to `createPublication` instead of the hardcoded `[]`.
- Regenerate the OpenAPI spec/`chat-api-client` for the two changed DTOs; operation IDs (`publishConversation`, `publishCatalogEntity`) stay stable.
- **New read endpoint** `GET /api/v1/publish/rules?folderPath=...` (`apps/chat-api/src/publish/`), wrapping DIAL Core's existing `getPublicationRules` SDK operation (`POST /v1/ops/publication/rule/list`), so that **selecting a destination folder pre-fills the rules editor with that folder's already-configured rules**. Both the conversation and catalog flows call the same endpoint through one shared frontend wrapper, since the lookup is folder-scoped, not entity-type-scoped.

**BREAKING**: None. Both endpoints keep their existing required fields; `rules` is optional and defaults to `[]`, so older clients and existing tests remain valid.

## Non-Goals

- Admin approval/review UI for rules.
- Comparing existing vs. changed rules on an already-published resource.
- Editing rules on an already-created publication request.
- Displaying publication rules in marketplace/catalog details.
- **Ancestor-rule provenance/comparison UI** — showing *which parent folder* a rule was inherited from, or a side-by-side "existing vs. changed rules" comparison. This change fetches and pre-fills only the **exact selected folder's own rules**; DIAL Core's response is ancestor-inclusive, but this change discards every entry except the exact match.
- Publishing prompts, files, or folders (unaffected by this change).
- Restoring the currently-disabled publish history fetch (tracked separately; see `disable-catalog-publish-history-fetch` / `disable-conversation-publish-history-fetch`).

## Alternatives Considered

1. **Separate modal after folder selection** — rejected: adds an extra step and forces the panel and the modal to share submission state across two surfaces, complicating the single-submit invariant this change must preserve.
2. **Collapsible "Advanced" section** — rejected: access rules are a security-relevant setting; hiding them by default risks a publisher not noticing a lack of restriction, or not noticing rules they added.
3. **Rules section before the folder picker** — rejected: breaks the natural task order "where to publish → who may access it," and the callout messages tied to folder selection would end up sandwiched awkwardly between the two sections.
4. **Host render-slot (`renderAccessRules`) instead of controlled props** — rejected: both consumers (`PublishConversationPanelContainer` via `StandalonePublishPanel`, and `DetailsPanel` assembling `PublishPanel` directly) already pass folder/submission state as controlled props into the same shared components; a slot would require each host to re-implement rule-chip rendering/removal, duplicating logic the library can own once. See `design.md` for the full comparison.
5. **Hardcoded frontend constant for the filter-source list** — rejected: the list conceptually belongs to shared runtime config (like other client-visible settings), and a hardcoded constant would need an immediate follow-up migration once a config source exists; extending the existing config-registry mechanism costs no new endpoint and avoids that churn.

## Capabilities

### New Capabilities

- `publish-access-rules-editor`: the shared, host-agnostic rule-list/rule-editor UI in `libs/publish-panel` — add/remove/clear rules, per-function validation (EQUAL/CONTAIN/REGEX), chip rendering, accessibility (keyboard, ARIA live regions, focus management), mobile/desktop/RTL behavior, and pre-filling from a host-supplied existing-rules fetch on folder selection. Domain-neutral: no knowledge of conversations vs. catalog.
- `publish-rules-lookup-api`: the new `GET /api/v1/publish/rules?folderPath=...` endpoint wrapping DIAL Core's `getPublicationRules` SDK operation, shared by both publish flows.

### Modified Capabilities

- `conversation-publish-flow`: `PublishConversationPanelContainer` gains rules state (owned via a new hook or extension of its existing wiring) and passes it into `StandalonePublishPanel`'s new controlled props; `onPublish` includes `rules` in the request; selecting a destination folder triggers a lookup against `publish-rules-lookup-api` that pre-fills the editor with that folder's existing rules.
- `conversation-publish-api`: `POST /api/v1/conversations/publish` request body gains optional `rules`; `PublishConversationDto` and `conversation-publish.service.ts` change as described above. The spec's current statement that "rules is always `[]`" is superseded.
- `catalog-publish-flow`: `CatalogView` → `Catalog` (`libs/catalog`) → `DetailsPanel` gains rules state passed through `CatalogProps` and rendered via `DetailsPanel`'s existing inline `PublishPanel` usage; `onPublish` includes `rules`; selecting a destination folder triggers the same rules lookup as conversations.
- `catalog-publish-api`: `POST /api/v1/catalog/{entityType}/{entityId}/publish` request body gains optional `rules`; `PublishCatalogEntityDto` and `publish.service.ts` change as described above. The spec's current explicit callout that rules support is deliberately absent ("no per-request rule editor") is superseded.
- `publish-panel-library`: the library's public barrel (`libs/publish-panel/src/index.ts`) gains the new rule-related types/props on `PublishPanel`/`StandalonePublishPanel`; the existing guarantee of zero dependency on `CatalogItem`/app/config/i18n is preserved and re-verified for the new surface.
- `config-registry-and-env-provider`: `CONFIG_DEFINITIONS` gains a new `publish.publicationFilterSources` entry (env-var driven, default `['title', 'role', 'dial_roles']`), following the exact pattern of the existing `customVisualizers`/`uiFeatures.enabledUiFeatures` entries.
- `client-config-endpoint`: `GET /api/v1/client-config`'s response gains `config.publicationFilterSources: string[]`, following the exact pattern of the existing `overlayAllowedOrigins`/`enabledUiFeatures` additions — same endpoint, same auth/rate-limit/cache key.

## Impact

- **Frontend (apps/chat)**: `PublishConversationPanelContainer.tsx`, `CatalogView.tsx`, `apps/chat/src/server-api/conversation-publish.api.ts`, `apps/chat/src/server-api/publish.api.ts`, new i18n keys in `apps/chat/src/i18n/locales/*.json`, retrieval of `publish.publicationFilterSources` from client-config.
- **Shared libraries**: `libs/publish-panel` (new components/props for the rule editor, updated `PublishPanel`/`StandalonePublishPanel`/`PublishPanelLabels`), `libs/catalog` (`CatalogProps`, `DetailsPanel.tsx` threading of the new props — no new lib-boundary violation).
- **Backend (apps/chat-api)**: `app-config/config-registry/config-registry.constants.ts`, `app-config/dto/client-config-response.dto.ts` (new field), new `PublishRuleDto`/`PublishRuleFunction` shared DTO, `conversations/dto/publish-conversation.dto.ts`, `publish/dto/publish-catalog-entity.dto.ts`, `conversations/conversation-publish.service.ts`, `publish/publish.service.ts`, and a new `publish/publish-rules.controller.ts` + `publish-rules.service.ts` (+ response DTO) calling the SDK's `getPublicationRules`.
- **Generated client**: `libs/chat-api-client` regenerated (`npm run openapi`) for the two changed DTOs, the new nested rule DTO/enum, and the new `getPublishRules` operation; no *existing* operation IDs change.
- **Dependencies**: none new; uses existing `class-validator`, `@nestjs/swagger`, `@epam/ai-dial-typescript-sdk` (`Rule`/`RuleFunction`/`getPublicationRules`/`Rules`/`MapStringList` schemas already defined in the SDK's generated types), and `@epam/ai-dial-ui-kit` (`Highlight` for any searchable source list).

## Acceptance Criteria

1. The same rules section is visible after the folder picker in the conversation, application, and toolset Publish sidebar.
2. The user can create multiple valid rules, see them as chips, and remove one or all of them.
3. The publish body reaches DIAL Core through the generated client and NestJS with the exact `{ source, function, targets }` array.
4. When there are no rules, DIAL Core receives `[]`; an older request without the `rules` field remains valid.
5. Invalid enums, empty sources/targets, malformed nested objects, and invalid regular expressions are rejected predictably: the UI blocks add/submit, and the backend returns 400 for an untrusted payload.
6. A publish failure does not lose rules; success and closing the panel clear local state.
7. Library isolation is preserved: shared libraries know nothing about endpoints/config/auth, and the host adapts data through props/callbacks.
8. The UI meets WCAG 2.1 AAA, keyboard navigation, focus management, mobile, and RTL requirements.
9. All new strings are localized, and component/hook/service/controller tests cover observable behavior.
10. Conversation and catalog publish regression tests confirm the existing folder-selection, replace/no-replace, loading/error, and success behavior is unchanged.
11. Selecting a destination folder that already has configured rules pre-fills the rules editor with exactly that folder's existing rules (not ancestor folders' rules); selecting a folder with no rules of its own shows an empty editor; a lookup failure surfaces a non-blocking notice and never blocks folder selection or submission.
12. Changing the destination folder after rules were fetched (or manually entered) re-fetches and re-populates for the newly selected folder, replacing the prior contents.

## Backward Compatibility & Rollback

- Additive only: both publish endpoints keep all currently-required fields; `rules` is optional on the wire and normalizes server-side to `[]` when absent. The new rules-lookup endpoint is a brand-new route with no prior behavior to preserve.
- Rollback path: stop sending `rules` from the frontend (or feature-gate the new UI section), stop calling the rules-lookup endpoint (or feature-gate the pre-fill effect only, leaving the editor otherwise functional), and revert the two publish services to the hardcoded `rules: []` fallback — no endpoint removal is required for either rollback path (an unused optional field, and an unused GET endpoint, are harmless to leave in place temporarily); removing the new `publish/rules` route entirely is also a safe, independent rollback step if desired.
- The rules-lookup endpoint introduces no persistence — it is a pass-through read of DIAL Core's own `getPublicationRules` response — so rollback has no data cleanup step.

## Resolved Decisions

1. **Filter-source list origin** — Extend the existing `CONFIG_DEFINITIONS` config-registry with a new client-visible `publish.publicationFilterSources` entry (env-var driven, default `['title', 'role', 'dial_roles']`), surfaced through the existing client-config endpoint. No new endpoint.
2. **Inherited/existing rules for the selected folder** — **In scope**: selecting a folder pre-fills the rules input with that folder's already-configured rules, backed by DIAL Core's `getPublicationRules`/`POST /v1/ops/publication/rule/list` operation, already typed in `@epam/ai-dial-typescript-sdk`. This change adds a new `GET /api/v1/publish/rules?folderPath=...` endpoint and wires both publish flows to call it on folder selection, replacing the editor's contents with the exact-match result (`[]` if the folder has no rules of its own). Ancestor-rule display/provenance and any "existing vs. changed" comparison UI remain out of scope (see Non-Goals).

## Open Questions / Unknowns (non-blocking)

- **Maximum rule count / maximum target-string length / duplicate-rule handling**: not documented in the current DIAL Core SDK schema or this repo's existing DTOs. `design.md` proposes safe, explicit frontend/backend limits as a separate, clearly-labeled decision rather than inventing silent behavior.
- Whether `publish.publicationFilterSources` should also expose human-readable labels per source — assumption: ship raw strings first; labeling is a follow-up if requested.
- **Overwrite-on-folder-change discards unsaved manual edits**: changing the destination folder replaces whatever is currently in the rules editor (including rules the user just added by hand for a different folder) with the newly selected folder's existing rules. This is a deliberate UX choice — flagged in `design.md`'s Risks section since it is a mild data-loss-on-navigation pattern.
