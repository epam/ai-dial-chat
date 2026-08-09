## Context

Publishing a conversation, application, or toolset always sends `rules: []` to DIAL Core today:

- `apps/chat-api/src/conversations/conversation-publish.service.ts:99-105` (`rules: []` at line 104), called from `conversation-publish.controller.ts:76-89`.
- `apps/chat-api/src/publish/publish.service.ts:94-100` (`rules: []` at line 99), called from `publish.controller.ts:66-79`.

Both call `this.dialClient.client.createPublication(...)` (`@epam/ai-dial-typescript-sdk`, wired via `DialClientService`, `apps/chat-api/src/dial/dial-client.service.ts:1,10,26`). The SDK's generated schema already supports rules:

```ts
// node_modules/@epam/ai-dial-typescript-sdk/dist/index.d.ts
Rule: { function?: RuleFunction; source?: string; targets?: string[] };
RuleFunction: 'TRUE' | 'FALSE' | 'EQUAL' | 'CONTAIN' | 'REGEX';
```

`source` is untyped (plain `string`) on the SDK side — DIAL Core evaluates a rule at read-access-check time against whatever claim name is supplied; an unrecognized `source` simply never matches, it is not a validation error. This matters for D5 below.

The SDK also already exposes the read side of this: `getPublicationRules` (`POST /v1/ops/publication/rule/list` under the hood), request `{ url: string }` (a `ResourceLink`), response `{ rules?: MapStringList }` where `MapStringList = { [folderPath: string]: Rule[] }` (`index.d.ts:11697-11718`, `3439-3441`, `3553-3554`, `3091-3093`). Core resolves the folder path plus every ancestor folder that has rules in one response, keyed by path. Nothing in `apps/chat-api` calls this operation today. This matters for D7 below.

The frontend request bodies are currently `{ folderPath }` (`apps/chat/src/server-api/conversation-publish.api.ts:4-11`) and `{ folderPath, version }` (`apps/chat/src/server-api/publish.api.ts:13-22`) — no `rules` field exists on the wire from the client at all today; the `[]` is purely a backend-side default.

**Two distinct frontend architectures publish today**, both built on `libs/publish-panel`:

1. **Conversations** — `PublishConversationPanelContainer.tsx` calls `usePublishFlow` (`libs/publish-panel/src/utils/use-publish-flow.ts`) for all publish-flow state (folder selection, submit/error state), then renders `StandalonePublishPanel` (`libs/publish-panel/src/components/PublishPanel/StandalonePublishPanel.tsx`), which itself renders `PublishPanel` (scrollable body) + `PublishFooter` (pinned).
2. **Catalog (applications/toolsets)** — `CatalogView.tsx:503-515` (`handlePublish`) passes an `onPublish` callback and folder/history props into `<Catalog>` (`libs/catalog`), which forwards them to `DetailsPanel.tsx`. `DetailsPanel` builds its own `usePublishFlow` (lines 114-122) and renders `PublishPanel` (329-366) + `PublishFooter` (507-519) **inline**, inside its own existing slide-in shell — it does not use `StandalonePublishPanel`.

Both paths converge on the same `usePublishFlow` hook and the same `PublishPanel`/`PublishFooter` pair from `libs/publish-panel`. That convergence point is where this design adds the rules feature once, instead of twice.

`PublishPanel.tsx` currently renders (verified, `libs/publish-panel/src/components/PublishPanel/PublishPanel.tsx`):
- Summary row: lines 198-206.
- Folder-selection block (label, search, tree, callout): lines 208-257.
- Publish history section (gated on `isFolderSelected && resource?.version != null`): lines 259-273.

There is no footer in this file — `PublishFooter` is a sibling component, rendered by the two shell consumers only.

No mechanism today supplies an allowed list of publication "source" claims to the frontend (confirmed: no `publicationFilters`-equivalent anywhere in `apps/chat-api/src` or `apps/chat/src/server-api`). The closest extension point is the app-config registry (`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`, `ConfigDefinition` in `app-config.types.ts:5-20`), already surfaced to the client through `ClientConfigDto` (`apps/chat-api/src/app-config/dto/client-config-response.dto.ts`) via `GET` client-config, consumed by `AppConfigContext.tsx` and exposed through `useAppConfig()`.

## Goals / Non-Goals

**Goals:**
- Add a controlled, host-agnostic rules editor to `libs/publish-panel`, wired identically into both the conversation and catalog publish paths through their shared `usePublishFlow` + `PublishPanel` convergence point.
- Carry `rules` through to DIAL Core via both existing publish endpoints, additively.
- Source the allowed `source` list from a new config-registry entry, not a hardcoded frontend constant.
- Pre-fill the rules editor with the selected folder's existing rules via a new read endpoint wrapping DIAL Core's `getPublicationRules`.
- Preserve every existing publish-flow behavior (folder selection, replace/no-replace, loading/error, submit gating) unchanged.

**Non-Goals:**
- Ancestor-rule provenance/comparison UI — this design fetches and surfaces only the exact selected folder's own rules, discarding any ancestor-folder entries DIAL Core's response also includes.
- Any admin approval/review UI, rule editing on an already-created request, or rule display in marketplace details.
- New backend endpoints for the publish request itself — both `PublishConversationDto`/`PublishCatalogEntityDto` are extended in place. (One new **read** endpoint, `GET /api/v1/publish/rules`, is in scope — see D7 — since no existing endpoint can serve that purpose.)
- A shared cross-layer TypeScript type for the rule shape between `libs/publish-panel` (frontend) and `apps/chat-api` (backend DTO). The codebase already has independent frontend/backend representations of this same value set plus the DIAL SDK's untyped `RuleFunction`; introducing a shared lib for three enum members would add cross-boundary coupling for no real benefit.

## Decisions

### D1 — Placement: new section between the folder block and history

The rules editor renders as a new block inside `PublishPanel.tsx`, inserted after the folder-selection `<div>` closes (after line 257) and before the history section (line 259) — i.e. always present, always in the scrollable body, never inside the pinned `PublishFooter`. This matches the brief's placement decision exactly and requires no change to `StandalonePublishPanel.tsx`'s shell/footer split, since both stay outside `PublishPanel`'s own scroll content.

### D2 — Controlled props on `PublishPanel`/`StandalonePublishPanel`, state lifted into `usePublishFlow`

Two API shapes were compared, per the brief:

1. **Controlled props** (`rules`, `onRulesChange`, `ruleSourceOptions`, labels) passed down from the host, mirroring how `folderItems`/`selectedFolderPath`/`onSelectedFolderPathChange` already work.
2. **Host render slot** (`renderAccessRules`), analogous to `renderSummary`.

**Chosen: controlled props (1).** `renderSummary` is a slot because the summary's *content* is genuinely host-specific (catalog needs an icon + type badge; conversations need a plain title) — there is no shared behavior to centralize. Rules are the opposite: the chip list, add/remove/clear interactions, per-function validation, and accessibility behavior are identical for every host. A render slot would force `PublishConversationPanelContainer` and `DetailsPanel` to each re-implement chip rendering, removal, and validation — exactly the duplication the brief asks us to avoid. Controlled props let `libs/publish-panel` own that UI once.

**State ownership**: `rules: PublicationRule[]` is lifted into `usePublishFlow` itself, as a new piece of state parallel to `selectedFolderPath` (`libs/publish-panel/src/utils/use-publish-flow.ts:146`):
- `UsePublishFlowResult` gains `rules: PublicationRule[]`, `setRules: (rules: PublicationRule[]) => void`, `isRulesLoading: boolean`, `hasRulesLoadError: boolean`.
- `UsePublishFlowOptions` gains an optional `onFetchExistingRules?: (folderPath: string[]) => Promise<PublicationRule[]>` — see D7 for how and when the hook calls it.
- `handleSubmit` (`use-publish-flow.ts:176-192`) passes `rules` as a third argument: `onPublish(item, selectedFolderPath, rules)`. `UsePublishFlowOptions.onPublish`'s signature changes from `(item: TItem, folderPath: string[]) => Promise<void>` to `(item: TItem, folderPath: string[], rules: PublicationRule[]) => Promise<void>`.
- `reset()` (`use-publish-flow.ts:194-198`) additionally resets `rules` to `[]` and `hasRulesLoadError` to `false`. Because both containers already call `publishFlow.reset()` on close (`PublishConversationPanelContainer.tsx:87-94`; `DetailsPanel`'s equivalent close handling), "closing resets unsaved rules" (required UI behavior) falls out for free — no new reset wiring needed in either container.

Rationale for lifting into the hook rather than each container owning local `useState`: `onPublish` closures are freshly created every render in both containers (arrow functions, not `useCallback`-memoized against stale state), so a container-local `useState` would also work correctly — but putting it in the hook keeps the single "everything the submit needs" state bag in one place (matching `selectedFolderPath`), and gives every future consumer of `usePublishFlow` the reset-on-close behavior automatically instead of requiring each one to remember it.

`PublishPanelProps` and `StandalonePublishPanelProps` gain, as **required** props (matching `folderItems`'s required-ness — every current consumer must supply them):
```ts
rules: PublicationRule[];
onRulesChange: (rules: PublicationRule[]) => void;
ruleSourceOptions: string[];
```
plus new fields on `PublishPanelLabels` for the section heading, chip "OR"/remove/clear labels, add-rule button, the single-rule editor's field labels, and validation error strings (enumerated in `specs/publish-access-rules-editor/spec.md`).

### D3 — New domain-neutral model and components in `libs/publish-panel`

`libs/publish-panel/src/models/publish.ts` gains:
```ts
/** Combining function applied across a rule's `targets`. */
export enum PublicationRuleFunction {
  Equal = 'EQUAL',
  Contain = 'CONTAIN',
  Regex = 'REGEX',
}

/** One access-restriction rule: grants access when `source`'s claim value
 *  matches any of `targets` (OR) under `function`. Rules within a publish
 *  request are combined with AND. */
export interface PublicationRule {
  source: string;
  function: PublicationRuleFunction;
  targets: string[];
}
```
This shape matches DIAL Core's rule model while narrowing the supported functions to the three access-rule functions exposed in the editor. The enum is named `PublicationRuleFunction` to avoid confusion with a bare `Function` collision and to read naturally per the brief's requested enum name.

Two new sibling components, following the existing `PublishFoldersTree`/`PublishHistoryList` pattern (own folder, own `tests/`):
- `libs/publish-panel/src/components/PublishAccessRules/PublishAccessRules.tsx` — the chip list: renders each rule as a removable chip (`source`, translated `function`, `targets` joined with a "ǂ Or ǂ" separator), an "Add rule" trigger, and a "Clear all" control shown only when `rules.length > 0`. Chip identity uses array index since rules are not independently reorderable.
- `libs/publish-panel/src/components/PublishAccessRuleEditor/PublishAccessRuleEditor.tsx` — the single-rule editor (source `Select`, function `Select`, and targets via `TagInput` for `EQUAL`/`CONTAIN` or a single-value text field for `REGEX`). Save is disabled until the rule is structurally complete (source chosen, function chosen, ≥1 trimmed non-empty target for `EQUAL`/`CONTAIN`, or exactly one syntactically valid pattern for `REGEX`). Desktop renders inline (matching the folder-picker's existing surface); mobile renders as a full-screen step, per the responsive pattern already used elsewhere in this app (see `.claude/skills/responsive-design`).

Both new components import UI-kit primitives directly (`Select`, `Notification` for inline errors, `@tabler/icons-react` for chip close icons), following the precedent already set by `PublishPanel.tsx` itself, which imports `SearchInput` from `@epam/ai-dial-sidebar` and `Notification`/`NotificationType`/`NotificationVariant` directly from `@epam/ai-dial-ui-kit` (`PublishPanel.tsx:1-6`) — i.e. `libs/publish-panel` already depends on sibling UI-kit/sidebar libs directly; this change does not introduce a new category of dependency.

Regex validity uses the platform-native `RegExp` parser (`trim`, reject empty, `try { new RegExp(pattern) } catch`) — no new dependency, since this repo has no dedicated regex-linting library.

**Duplicate targets within one rule**: this repo's `TagInput` (`libs/ai-dial-kit/src/components/TagInput/TagInput.tsx`, wrapping `DialTagInput`) is the designated free-entry-tag component per `.claude/rules/all-tsx.md`; `PublishAccessRuleEditor` rejects an exact-duplicate tag (case-sensitive trimmed-string comparison against already-added targets in the same rule) before calling `TagInput`'s `onChange`.

**Cross-rule duplicates** (two rules with identical `source`+`function`+`targets`) are **not** blocked. DIAL Core's rule evaluation is idempotent under AND-combination of identical rules, so allowing it is harmless, just redundant. Not worth a new UX affordance to prevent.

### D4 — Filter-source list: new config-registry entry, no new endpoint

Add to `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`:
```ts
{
  key: 'publish.publicationFilterSources',
  type: 'config',
  valueType: 'json',
  visibility: 'client',
  defaultValue: ['title', 'role', 'dial_roles'],
  critical: false,
  description:
    'Allowed claim/category names selectable as a publication access rule\'s source. Sourced from PUBLICATION_FILTER_SOURCES (comma-separated); falls back to the product default when unset.',
  owner: 'chat-team',
  envVar: 'PUBLICATION_FILTER_SOURCES',
}
```
`ClientConfigDto` (`apps/chat-api/src/app-config/dto/client-config-response.dto.ts`) gains `publicationFilterSources!: string[]` (`@ApiProperty({ type: [String], example: ['title', 'role', 'dial_roles'] })`), populated by whatever shared mechanism already turns `CONFIG_DEFINITIONS` entries into `ClientConfigDto` fields (the same mechanism that fills `fileManagerTabs` from `fileManager.availableTabs` today) — no new endpoint, no new controller method.

Frontend: `AppConfigContext.tsx` gains `publicationFilterSources: string[]` in `AppConfigState.config`, a `DEFAULT_PUBLICATION_FILTER_SOURCES = ['title', 'role', 'dial_roles']` constant (mirroring `DEFAULT_FILE_MANAGER_TABS`), and one line in `loadConfig`'s mapping (`response.config?.publicationFilterSources ?? DEFAULT_PUBLICATION_FILTER_SOURCES`). Both `PublishConversationPanelContainer` and `CatalogView`/`DetailsPanel`'s wiring read `useAppConfig().config.publicationFilterSources` and pass it as `ruleSourceOptions`.

**Why this over a comma-separated env var parsed ad hoc in the frontend**: this repo has no SSR page-props injection point (Vite SPA, not Next.js) — the config-registry + client-config endpoint is the existing client-config delivery mechanism, and it already supports `valueType: 'json'` array values (see `fileManager.availableTabs`, `overlay.allowedOrigins`). Reusing it is strictly additive to an existing, tested pipeline.

### D5 — Backend DTO and validation

New file `apps/chat-api/src/publish/dto/publish-rule.dto.ts` (shared by both publish DTOs, since both live under the publish domain conceptually; `PublishConversationDto` imports it from there — no circular dependency, `conversations` already depends on shared `files` DTOs the same way, e.g. `IsValidFilePath` from `../../files/dto/file-path.validator`):
```ts
export enum PublishRuleFunction {
  Equal = 'EQUAL',
  Contain = 'CONTAIN',
  Regex = 'REGEX',
}

export class PublishRuleDto {
  @ApiProperty({ description: 'Claim/category name this rule matches against.', example: 'roles' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  source!: string;

  @ApiProperty({ enum: PublishRuleFunction, example: PublishRuleFunction.Contain })
  @IsEnum(PublishRuleFunction)
  function!: PublishRuleFunction;

  @ApiProperty({ description: 'Values combined with OR; exactly one pattern when function is REGEX.', type: [String], example: ['engineering', 'support'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(200, { each: true })
  targets!: string[];
}
```
`PublishConversationDto` and `PublishCatalogEntityDto` each gain:
```ts
@ApiPropertyOptional({ type: [PublishRuleDto], default: [] })
@IsOptional()
@IsArray()
@ArrayMaxSize(20)
@ValidateNested({ each: true })
@Type(() => PublishRuleDto)
rules?: PublishRuleDto[];
```
The global `ValidationPipe`'s `transform: true` (already configured, `apps/chat-api/AGENTS.md` §Security defaults) instantiates `PublishRuleDto` instances via `@Type(() => PublishRuleDto)`, so nested validation actually runs; `whitelist`/`forbidNonWhitelisted` strip/reject unknown nested fields.

**Deliberately not validated server-side**: `source` is not checked against `publish.publicationFilterSources`. Rationale: that list is operator-configurable and can change without a deploy; the DIAL Core SDK's own `Rule.source` is untyped `string` (§Context) — Core silently treats an unrecognized source as "never matches," not an error. Enforcing an allowlist here would require the DTO layer to read live config-registry state (a layering violation: DTOs are pure data shape, not config-aware), and would only reject requests Core itself would have handled safely. The frontend still only offers the configured sources in its `Select`, so a mismatched `source` can only reach the backend from a deliberately hand-crafted request — which DIAL Core already neutralizes.

`regex` validity for a `REGEX`-function rule's single target is **not** re-validated server-side beyond the generic string constraints above (non-empty, ≤200 chars) — DIAL Core is the authority on whether it accepts the pattern; this mirrors how this backend already trusts Core for `folderPath` semantics rather than re-implementing Core's own validation.

`conversation-publish.service.ts:104` and `publish.service.ts:99` change from `rules: []` to `rules: dto.rules ?? []` (both services already receive the full DTO's other fields as method parameters; the simplest change is passing the already-validated `rules` array through as one more parameter, keeping the existing method-parameter style rather than switching either method to take the whole DTO object).

### D6 — Rule/target limits (explicit, previously undocumented)

No limit is documented in the DIAL Core SDK schema or this repo. Proposed, safe, symmetric frontend+backend limits (frontend blocks add/submit at the same thresholds so the user never hits the 400 path in normal use):
- Max **20 rules** per publish request (`PublishConversationDto.rules`/`PublishCatalogEntityDto.rules`, `@ArrayMaxSize(20)`).
- Max **20 targets** per rule (`PublishRuleDto.targets`, `@ArrayMaxSize(20)`) — `REGEX` rules are additionally constrained to exactly 1 by the UI (only `EQUAL`/`CONTAIN` can reach the 20-target ceiling) and, if desired, could be tightened with a conditional validator; this design leaves the DTO-level cap uniform at 20 and lets the UI enforce the REGEX-specific "exactly one" rule, since a REGEX request with 2+ targets from a non-UI client is already meaningless to Core (only the first would ever be used) rather than dangerous.
- Max **200 characters** per `source` string and per target/pattern string.

These are new, additive constraints with no existing behavior to break; they are called out as an explicit decision (not inherited from any upstream contract) per the brief's instruction not to invent silent limits.

### D7 — Reading existing rules on folder selection: new read endpoint, exact-match pre-fill, overwrite semantics

Selecting a destination folder pre-fills the rules editor with that folder's already-configured rules.

**New endpoint**: `GET /api/v1/publish/rules?folderPath=<path>` in the existing `apps/chat-api/src/publish/` domain (a new `publish-rules.controller.ts` + `publish-rules.service.ts` + `publish-rules-result.dto.ts`, sibling to the existing `publish.controller.ts`/`publish.service.ts`). It is placed in the domain-neutral `publish` folder — not under `conversations/` — because the lookup is folder-scoped, not entity-type-scoped, and both flows need the identical call; a single shared endpoint avoids the duplication a per-domain endpoint would create. `PublishRulesService.getRules(accessToken, folderPath)`:
1. Builds the same `public/{folderPath}/` target-folder string used by `createPublication` (reusing `publish-target.util.ts` from `conversation-publish-api`'s extraction, §D5's sibling work), URL-encoded via `encodeDialResourcePath`.
2. Calls `this.dialClient.client.getPublicationRules({ headers, body: { url: publicTargetFolder } })`.
3. Decodes the response's `rules` map keys and returns **only** the entry whose decoded key equals the requested `folderPath` exactly (after the same `public/`-prefix/trailing-slash normalization used elsewhere in this service) — `[]` if no entry matches. Every other key in Core's response (ancestor folders) is discarded server-side; this backend never returns ancestor-folder rules to the client, keeping the "no provenance/comparison UI" non-goal enforceable at the contract level, not just a frontend choice.

Response: `PublishRulesResultDto { rules: PublishRuleDto[] }` (reusing the same `PublishRuleDto` defined for the publish request body — same shape, no duplicate type).

Request/response example:
```
GET /api/v1/publish/rules?folderPath=Organization/Data%20Science/Shared%20chats
```
```json
{ "rules": [{ "source": "role", "function": "CONTAIN", "targets": ["engineering"] }] }
```
```
GET /api/v1/publish/rules?folderPath=Organization/Empty%20Folder
```
```json
{ "rules": [] }
```

Authorization: caller SHALL be authenticated (existing session guard). No additional write-access check is performed — this is a read of what rules already apply, not a write; if the caller cannot actually see the folder's rules, DIAL Core's own response (which may omit or restrict data the caller isn't authorized to see) is passed through as-is, the same trust boundary already used for `createPublication`. Rate limiting: default global throttle (read endpoint), matching the publish-history endpoints. Caching: **none** — this is a live, interaction-scoped lookup fired once per folder-selection click, not a background-refreshed list; a cache would risk showing stale rules immediately after another user/admin changes them, right when accuracy matters most for a publisher deciding whether to add redundant rules.

**Frontend wiring**: `usePublishFlow` calls the host-supplied `onFetchExistingRules(folderPath)` (D2) inside a `useEffect` keyed on `selectedFolderPath`; it fires once per folder-selection commit (a `PublishFoldersTree` node click, i.e. once per `onSelectedFolderPathChange` call), never per keystroke (there is no free-text folder input in this UI, only tree selection, so this is inherently debounce-free already). On success, `setRules(result)` — a **full overwrite**, not a merge. On failure, `hasRulesLoadError` is set and `rules` is left unchanged (whatever was there before the failed fetch); the section shows a small non-blocking inline notice, and the user may still add rules by hand or retry by reselecting the folder. When `selectedFolderPath` becomes `undefined` (folder deselected), `rules` resets to `[]`.

`PublishConversationPanelContainer` and `DetailsPanel`'s wiring both supply `onFetchExistingRules` as a thin call to a new shared `apps/chat/src/server-api/publish-rules.api.ts` wrapper (`getPublishRules(folderPath)` → generated `publishApi.getPublishRules({ folderPath })`), keeping the actual HTTP call at the app edge per library isolation.

**Why overwrite, not merge, despite the data-loss risk**: changing the destination folder mid-edit replaces the rules editor's contents with the new folder's existing rules, discarding any not-yet-submitted manual edits for the previous folder. This keeps the editor state consistent with the currently selected folder and is called out explicitly in the Risks section below.

## Risks / Trade-offs

- **[Risk]** Extending `usePublishFlow`'s `onPublish` signature (third `rules` argument) is a breaking change to that hook's public contract, and the hook is exported from the library's public barrel (`libs/publish-panel/src/index.ts`). → **Mitigation**: this repo has exactly two consumers of `usePublishFlow` (`PublishConversationPanelContainer`, `DetailsPanel`), both updated in this same change; `publish-panel-library`'s spec is updated in lockstep (see proposal's Modified Capabilities) so the barrel contract and its consumers move together in one change, not two.
- **[Risk]** A large operator-configured `publicationFilterSources` list could make the plain `Select` dropdown unwieldy. → **Mitigation**: `Select` already supports `searchable`; the source picker enables it, with matched text rendered via the shared `Highlight` component per `.claude/rules/search-results-highlight.md`.
- **[Risk]** Silently accepting any `source` string server-side (D5) could be seen as under-validating. → **Mitigation**: this exactly matches DIAL Core's own tolerance (unrecognized source never matches, isn't rejected) and keeps DTOs decoupled from live config state; documented explicitly rather than left implicit.
- **[Trade-off]** Lifting `rules` into `usePublishFlow` (D2) slightly grows that hook's responsibility beyond folder/submission state. Accepted because it removes the need for either container to hand-roll its own reset-on-close wiring for rules, and keeps "everything `onPublish` needs" in one returned object.
- **[Risk]** Overwrite-on-folder-change (D7) discards any rules the user manually added for a previously selected folder the moment they pick a different folder, with no undo. → **Mitigation**: this is a deliberate UX choice to keep the editor state aligned with the selected folder; if this proves surprising in practice, a follow-up could add a confirmation step before overwriting non-empty manual edits — out of scope for this change.
- **[Risk]** The new `GET /api/v1/publish/rules` endpoint adds a second network round-trip to the publish flow (in addition to the publish submission itself), on every folder selection. → **Mitigation**: it fires only on folder-selection commit (tree click), not on every render or keystroke; it is a lightweight read with no caching overhead to manage, and a failed/slow fetch never blocks folder selection, rule entry, or submission — it only fails to pre-fill.

## Migration Plan

- **Deploy**: Purely additive — new optional DTO fields, new config-registry entry with a safe default, one new read endpoint, new UI section. No data migration, no breaking change to any existing request/response shape. Ship as one change; no feature flag needed since an empty `rules: []` is behaviorally identical to today, and the new read endpoint has no prior behavior to preserve.
- **Rollback**: Stop sending `rules` from the frontend (revert the two container wiring commits, or hide the new `PublishAccessRules` section), stop calling `GET /api/v1/publish/rules` (or hide only the pre-fill effect while keeping manual rule entry), and revert `conversation-publish.service.ts`/`publish.service.ts` to the hardcoded `rules: []`. The added optional DTO fields, config-registry entry, and new read endpoint are harmless to leave in place if only the frontend/service changes are reverted — no cleanup step is required either way.
- **Verification sequence** (see `tasks.md`): backend DTO/config-registry/rules-lookup contract first (so the OpenAPI/generated-client shape is fixed before any frontend code consumes it), then the shared `libs/publish-panel` editor (including the `usePublishFlow` fetch-on-select wiring), then each host integration, then i18n/RTL/a11y, then full regression.

## Open Questions

- Whether `publish.publicationFilterSources` should eventually carry human-readable labels per source — out of scope here; ship raw strings, revisit if requested.
- Whether a future change should surface ancestor-folder rule provenance (which parent folder a shown rule came from) or an existing-vs-changed comparison — explicitly deferred, not part of this design; D7 only exposes the exact-match folder rules.
- Whether overwrite-on-folder-change (D7) should eventually gain a confirmation step when it would discard non-empty manual edits — noted as a Risk above, not addressed in this change.
