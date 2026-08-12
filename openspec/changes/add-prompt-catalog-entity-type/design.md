## Context

The prompts backend is finished. `apps/chat-api/src/prompts/` implements ten routes under `/api/v1/prompts` (`prompt.controller.ts:37-289`), split into `personal/`, `public/`, and `resource/` services, and specified across `openspec/specs/prompts-api/spec.md`, `openspec/specs/prompts-folders/spec.md`, and `openspec/specs/prompts-share-api/spec.md`. `libs/chat-api-client/src/generated/src/apis/PromptsApi.ts` already exposes every operation with typed request/response models.

Nothing on the frontend calls any of it. There is no `prompts.api.ts` wrapper, `promptsApi` is missing from the singleton registry at `apps/chat/src/server-api/api-client.ts:158-176`, and `CatalogEntityType` (`libs/catalog/src/types/entity-type.ts:2-7`) has four members: `Model`, `Agent`, `Toolset`, `Skill`.

Constraints that shape every decision below:

1. **No backend change.** The API surface is fixed at what `apps/chat-api` exposes today. Where the existing backend cannot serve a UI affordance, that affordance is dropped rather than bolted on with a new endpoint.
2. **`libs/catalog` stays host-agnostic** (`AGENTS.md` §Library isolation). The lib may learn that a `Prompt` entity type exists as a display category; it may not learn about `/api/v1/prompts`, the generated client, `ROUTES`, or `OverlayFeature`.
3. **The catalog is already generic over entity type.** `filterCatalogItems` matches on `item.type`, `sortCatalogItems` is type-blind, `buildCatalogTabs` derives tabs from the items present, and `Card` / `ListView` / `EntityTypeLabel` read `type` through `ENTITY_TYPE_COLOR`. Adding a member is mostly declarative; the work is in the app adapter and the editor page.

## Goals / Non-Goals

**Goals:**

- Every one of the ten generated `PromptsApi` methods has a real caller in `apps/chat`.
- Prompts are first-class citizens of the existing unified catalog — searchable, sortable, filterable, with a details panel — not a bolt-on list.
- A prompt is reusable: its body reaches the conversation composer in one click.
- Full authoring lifecycle: create, edit, delete, move between folders, and create/rename/delete folders.
- `libs/catalog` gains no host knowledge; every prompt-specific decision arrives through a prop.

**Non-Goals:**

- **Prompt unshare.** `discard-shared-catalog-item.dto.ts:6` `@Matches(/^(?:applications|toolsets|conversations)\/…/)`, so a prompt path is rejected with 400 before reaching the service. Worse, `listPrompts` returns a shared prompt under a bucket-relative path with the *owner's* bucket stripped, so the frontend cannot reconstruct the resource url the discard call needs. See D7.
- **Prompt publishing.** No publish route accepts a prompt resource kind.
- Prompt variables/templating (`{{placeholder}}` substitution at insert time), a prompt picker inside the composer, prompt versioning, and prompt folder navigation inside the catalog grid.

**Scope revision (post-review):** the change originally forbade any edit under `apps/chat-api/**`. Three of the follow-ups the first pass documented as backend-capability limitations were subsequently pulled into scope — prompt favourites (D6), prompt share links (D7), and dropping DIAL folder markers from the prompt listings (D14) — so the backend, `openapi.json`, and the generated client are now part of this change. `npm run openapi:check` staying green is still the proof that spec and client agree.

## Decisions

### D1 — `Prompt` is a `CatalogEntityType` member, not a parallel type system

Add `Prompt = 'PROMPT'` to the existing enum, with an `ENTITY_TYPE_COLOR` entry and a `TAB_ORDER` slot after `Toolset`. Everything type-generic then works for free.

*Alternatives:* a separate `PromptCatalog` component (duplicates search/sort/filter/details, and prompts stay invisible to catalog search); reusing `CatalogEntityType.Skill` (already exported and colour-mapped for a different concept — silently breaks any host filtering on it). Both rejected.

*Consequence:* `CatalogEntityType` is exported from `libs/catalog`, so a new member widens a public union. It is additive — `tabLabels` is `Partial<Record<…>>` (`catalog-props.ts:55`) and `ENTITY_TYPE_COLOR` is exhaustive-checked by `Record<CatalogEntityType, string>`, which makes the compiler point at every map that must be extended. That is the desired failure mode.

### D12 — A prompt shows exactly two details tabs: Content and Overview

**Added.** `DetailsPanel` pushed `About` unconditionally as the first tab. For a prompt that tab would carry only the description, which the Overview tab already lists alongside the folder, source, and last-updated rows — two tabs saying the same thing. So `About` is skipped for `CatalogEntityType.Prompt`, leaving `Content` (the body) then `Overview`.

The type check lives inside the lib rather than behind another host predicate. That is consistent with how the lib already keys behaviour off the entity type (`ENTITY_TYPE_COLOR`, `TAB_ORDER`, `Header`'s primary-action rule), and it avoids widening the public API for a display decision — the opposite trade-off from D6/D7, where the fact being encoded was a *host capability*, not a display rule.

`buildPromptOverview` (`apps/chat/src/utils/map-prompt-to-catalog-item.ts`) produces the Overview rows at the app edge, where the i18n labels are. It runs in both the list mapper and `handleFetchDetails`, because a fetch result replaces `item.details` wholesale and would otherwise drop the tab.

### D2 — Prompt body renders as a new optional details tab, not squeezed into an existing one

Add `promptContent?: CatalogItemPromptContent` to `CatalogItemTabData` and `Content = 'content'` to `CatalogDetailsTab`. `CatalogItemPromptContent` carries `{ content: string }` — a resolved string, nothing else. The tab follows the established "absent field ⇒ hidden tab" rule already used by `tools`, `limits`, `pricing`, and `api` (`DetailsPanel.tsx:368-402`), and renders read-only with the existing copy-to-clipboard affordance plus an `aria-live` copy confirmation.

*Alternatives:* stuffing the body into `api.snippets` (misuses a Connect-tab model, shows a language selector for a non-code payload); putting it in `overview` (a label/value spec grid, wrong shape for a 50k-character block); putting it in `item.description` / the About tab (collides with the prompt's own description field, and About has no copy affordance). Rejected.

### D3 — The prompt's DIAL path is the `CatalogItem.id`, unprefixed

`PromptResponseDto.id` is the path inside the prompts namespace (`Work/AI/my-prompt`). Use it verbatim as `CatalogItem.id`.

Every id→API dispatch in `CatalogView` is *already* type-switched (`handleFetchDetails`, `handleEdit`, `handleDelete`, `onToggleFavorite` all branch on `item.type` today — `CatalogView.tsx:257-297,610-680`), so the type discriminator needed to route a prompt id to the prompts endpoints is present at every call site without inventing an encoding.

*Alternative:* a `prompt:` sentinel prefix for global id uniqueness. Rejected — it forces encode/decode at every boundary (details deep-link `?itemId=`, favourites, share) for a collision that requires a deployment id shaped exactly like a prompt path, and it would silently corrupt the value passed to `getPrompt({ path })` if one call site forgot to strip it.

### D4 — `PromptsContext` owns prompt state; `DeploymentsContext` is untouched

A new provider following the `ThemeContext` reference pattern (`useMemo`'d value, `usePrompts` throws outside the provider, cancelled-flag fetches). It exposes `prompts`, `folders`, `sharedWithMe` (from `listPrompts`), `publicPrompts`, `publicFolders` (from `listPublicPrompts`), `isLoading`, `error`, and `refetchPrompts` / `refetchPublicPrompts`.

*Why not extend `DeploymentsContext`:* it is already a large provider owning deployments, toolsets, schemas, and the selected-deployment preference; prompts share no lifecycle with it and would force every deployment consumer to re-render on a prompt mutation. *Why not fetch inside `CatalogView`:* the `PromptEditor` page needs the same folder list, and `ConversationRoute` will eventually need prompt lookup — a component-local fetch would be duplicated immediately.

**Mutations refetch, they do not patch.** After every create/update/delete/move/folder call, the context refetches. This matches `refetchToolsets()` after `deleteToolset` (`CatalogView.tsx:656-662`) and avoids reimplementing the backend's path-rewriting semantics client-side — a folder rename rewrites the id of every prompt beneath it (`prompts-folders` spec, "Renaming a folder updates all prompt paths"), which no local patch could get right.

### D5 — Prompt "Use in chat" pre-fills the composer through existing router state

`ConversationRoute` already holds `const [inputMessage, setInputMessage] = useState<string | undefined>()` and feeds it to `NewConversationComposer`'s `message` prop (`ConversationRoute.tsx:60,266`), and already reads router state for `deploymentId` (`ConversationRoute.tsx:57-59`). Prompt use-in-chat navigates to `ROUTES.Root` with `state: { promptContent }`, which seeds `inputMessage` in the same effect that handles `deploymentId`.

*Alternatives:* a query param (a prompt body is up to 50 000 characters — it would blow the URL length limit and leak content into history/logs); a new `PendingComposerInputContext` (a whole provider for a single one-shot handoff the router already models); a new composer prop (`message` already is that prop).

*Detail:* the state is one-shot. It is consumed on mount and cleared with `navigate(…, { replace: true })`, mirroring how `CatalogView.tsx:121-131` already clears the one-shot `itemId` param, so a later back-navigation does not silently re-inject stale text.

### D6 — Prompts are favouritable through a new `prompts.installed` user-config section

**Revised.** The first pass suppressed the star because user-config had no prompts bucket. Adding one turned out to be genuinely small, so the bucket exists now: `UserConfig` gains `prompts: { installed: string[] }`, `CURRENT_CONFIG_VERSION` goes 3 → 4, and `migrateConfig` fills the section for every earlier shape. A new `PATCH /api/v1/user-config/prompts` writes it.

That endpoint cannot reuse `UpdateInstalledDto`: its `id` is `@Matches(/^\S+$/)`, and a prompt path legitimately contains spaces (`Work/AI/tone of voice`). So `UpdateInstalledPromptDto` validates `id` against the prompts module's own `PROMPT_PATH_PATTERN`, which admits spaces and slashes while still rejecting traversal segments.

On the frontend, `FavoriteEntityType` gains `Prompt`, `FavoriteApplicationsProvider` folds `prompts.installed` into the one `favoriteIds` set, and `resolveFavoriteEntityType` (`apps/chat/src/utils/favorites.ts`) maps a `CatalogEntityType` to the section its favourite is stored in — replacing a two-branch ternary that would have become a three-branch nested one.

*Consequence:* the `isFavoriteVisible` predicate the first pass added to `libs/catalog` is **removed**. It existed only to hide the star for prompts; with prompts favouritable it had no caller, and a lib prop with no consumer is dead public API.

*Alternative:* store prompt paths in the existing `deployments.installed` bucket. Rejected — it corrupts a typed list that other code resolves against the deployments catalog.

### D7 — Prompt share links work via an explicit `resourceKind`; unshare stays suppressed

**Revised.** The open question was whether `POST /api/v1/share` accepts a bare prompt path. It does not: DIAL Core's sharing API wants the fully-qualified resource url (`prompts/{bucket}/{path}`), and the prompts endpoints deliberately never expose a bucket to the frontend.

Rather than leak the bucket into the client, `CreateShareLinkDto` gains an optional `resourceKind?: ShareResourceKind` (`'prompt'`). When set, `ShareService` treats `itemId` as bucket-relative and qualifies it with the caller's own session bucket. Absent, the existing pass-through behaviour is byte-identical, so no other share caller changes.

*Why an explicit discriminator rather than sniffing the path:* a bare prompt path `AI/summarize` prefixed blindly becomes `prompts/AI/summarize`, which is indistinguishable from an already-qualified path whose bucket happens to be `AI`. A flag makes the caller's intent unambiguous.

`isShareVisible` returns `true` for a prompt only when `item.isMyApp` — DIAL Core grants access out of the owner's bucket, and the caller's bucket is the only one the backend can qualify against.

Unshare stays off (see Non-Goals): both the DTO regex and the missing owner bucket block it, and `resolveSharedItemSummary` short-circuits `prompts/` ids because a prompt has no deployments/toolsets list entry to summarise.

### D8 — One feature key, `OverlayFeature.Prompts`, gates the whole surface

`prompts` joins the `OverlayFeature` enum (`libs/chat-overlay/src/protocol/overlay-protocol.ts:55+`) and is read through the existing `useUiFeature` hook. It gates: prompt items entering `catalogItems`, the Prompt Create option, and the `PromptEditor` route (which redirects to the catalog when disabled). This is exactly how `OverlayFeature.Toolsets` gates toolsets today (`CatalogView.tsx:176,196-205,786`).

*Alternative:* separate keys for reading vs authoring. Rejected as premature — a read-only prompt catalog has no content source, since nothing else in the product creates prompts.

### D9 — `PromptEditor` is a route page and the sole home of folder management

`ROUTES.PromptEditor = '/prompt-editor'`, lazy-loaded in `app/app.tsx` next to `ToolsetEditorPage`, with query params `?id=<path>` (edit) / absent (create) and `?returnUrl=`, matching `ToolsetEditorQuery` conventions.

Layout: name, description, and content fields, plus a folder picker whose own controls cover create/rename/delete folder and (in edit mode) move. Form validation mirrors the backend DTOs exactly so the user never round-trips for a rule the client already knows — name 1–256 chars and no `/` (`create-prompt.dto.ts:24-28`), description ≤ 2000, content ≤ 50 000, folder path against the same optional-path shape. Server-side 409 (duplicate / rename conflict) still surfaces as an inline field error, because uniqueness cannot be checked client-side.

*Why not a modal:* content is long-form, folder management is a second dimension of state, and a route gives a deep-linkable edit URL consistent with the three existing editor pages.

### D13 — The editor's UI lives in `libs/prompt-editor`; the route page is a thin adapter

**Added.** The form and folder picker moved out of `apps/chat` into a new `@epam/ai-dial-prompt-editor` lib, splitting cleanly along the isolation rule:

| Concern | Owner |
| --- | --- |
| Field state, folder sub-form state, character-counter announcements, a11y wiring | lib |
| Validation against the storage contract, API calls, notifications, routing, feature gate, i18n | `apps/chat/src/pages/PromptEditor/PromptEditor.tsx` |

The lib deliberately **does not validate**. Length limits and the name pattern are DIAL contract facts, so the host validates on submit and hands messages back through `errors`. Folder mutations are delegated through `folderActions`, whose `onCreateFolder` / `onRenameFolder` may resolve with the resulting path so the picker can follow it. `onValidateFolderName` is a pure callback the lib calls before dispatching, which keeps the name pattern out of the lib while still blocking a doomed request.

`initialValues` re-seeds the form when its identity changes, which is how the host hands over an asynchronously-loaded prompt.

*Why not keep it in the app:* the form is the one piece of this feature with no host coupling once validation is lifted out, and the same shape is wanted by the overlay host.

*Detail:* the folder sub-form repeats the outer form's Save/Cancel labels, so it is wrapped in a named `role="group"` — without it both pairs are indistinguishable to a screen reader, and were also ambiguous to `getByRole` in tests.

### D14 — DIAL folder markers are dropped from the prompt listings

**Added.** DIAL Core writes a `.dial_folder` marker to keep an otherwise-empty folder alive. It is a storage artefact, not a prompt, and reading it as one yields a broken entry in every listing. `isHiddenPromptPath` (segment-exact, so a prompt legitimately named `my.dial_folder-notes` survives) filters it out of `listPrompts`, its `sharedWithMe` branch, and `listPublicPrompts` — before any prompt body is fetched, so the markers cost no round-trips.

`renameFolder` skips them too: a marker cannot be read as a prompt, so copying it to the new path would fail the whole rename.

This matches the existing precedent in `conversation-listing.service.ts:240`, `deployments-listing.service.ts:190`, and `toolset-mapper.util.ts:332`. The prompts module's own `.folder` sentinel is unaffected — it is still used to derive empty folders.

### D10 — Details fetch dispatches on type inside the app adapter

`handleFetchDetails` (`CatalogView.tsx:257-297`) currently always calls `getDeploymentDetails`. It gains an early branch: a `Prompt` item resolves through `getPrompt` (personal/shared) or `getPublicPrompt` (public folder), returning `{ promptContent: { content } }`. Existing behaviour for every other type is byte-identical.

*Why not fetch the content up-front in the list mapper:* `listPrompts` already returns `content` for personal prompts, so the fetch is often redundant — but public prompts and long bodies make lazy resolution the safer default, and `onFetchDetails` is the seam the lib already provides for exactly this. The mapper seeds `promptContent` when the list response already carries it, so the panel renders instantly and the fetch only refreshes.

### D11 — Folder labels reuse the existing Personal/Shared/Public vocabulary

`mapPromptToCatalogItem` derives `folder` the same way `resolveDeploymentFolder` / `resolveToolsetFolder` do (`map-deployment-to-catalog-item.ts:101-152`): own prompts get `[t(CatalogI18nKeys.FolderPersonal), ...segments]`, shared get `[t(…FolderShared), ...]`, organisation get `[t(…FolderPublic), ...]`, splitting `folderId` on `/`. The `t` function is passed in as an argument exactly as the existing mappers take it, keeping i18n at the app edge.

`ListView`'s Folder column is hidden only for `Model` today (`columns.ts:40`); prompts keep it, since folder position is the primary organising signal for a prompt library.

## Risks / Trade-offs

- **Two new optional props on `libs/catalog`'s public surface (`isUnshareVisible`, plus the `promptContent` model field)** → Both default to today's behaviour when absent, so no existing host is affected. `isUnshareVisible` is threaded `Catalog` → `DetailsPanel` → `Header` and combined (AND) with the built-in ownership rule, per `.claude/rules/libs.md` "every declared prop must be read". `isFavoriteVisible` was added by the first pass and then removed once prompts became favouritable (D6) — a lib prop with no caller is dead public API.
- **A new lib (`libs/prompt-editor`) for a single consumer** → Accepted (D13). The split is where the isolation rule draws it, and the lib's 27 tests exercise the form directly instead of through the app's API mocks. Cost: the app's vitest run resolves the lib from its build output, so a lib change needs `nx build @epam/ai-dial-prompt-editor` before app tests see it.
- **Prompt actions are still asymmetric with deployments** — no Remove-from-My-List, no Publish → Accepted and documented as a backend-capability limitation with the exact blocking DTO regex cited. Favourites and share links were the other two and are now implemented (D6, D7).
- **A user-config schema bump (3 → 4) on a shape every session reads** → `migrateConfig` already tolerates missing sections and is exercised by 54 unit tests covering the v1, v2, v3, and corrupt-input paths; the new section is purely additive, so a v3 file read by new code and a v4 file read by old code both degrade to an empty favourites list rather than an error.
- **Refetch-after-mutation costs a round trip and can flash a stale list** → Accepted for correctness (D4): a folder rename rewrites every descendant id, and a client-side patch would diverge from the backend's own path arithmetic. `isLoading` covers the window; the editor navigates back only after the refetch settles.
- **A 50 000-character prompt body in a details tab and a textarea** → Render the content block with `overflow` scroll inside its own container and no syntax highlighting; the editor's textarea is plain. Character counters announce only near the limit (last 10 chars) per `.claude/rules/a11y.md`, not on every keystroke.
- **Prompt ids are user-authored paths that reach `?itemId=` deep links and the share flow** → Always pass them through the existing `safeDecodeURIComponent` / `encodeURIComponent` boundary helpers already used by the deployment mappers; the backend re-validates every path against `PROMPT_PATH_PATTERN`, so a malformed id fails closed with a 400.
- **`OverlayFeature` is part of the published overlay protocol** → Additive enum member only; overlay hosts that do not send `prompts` get today's behaviour. `libs/chat-overlay`'s protocol spec and any host-facing docs list the new key in the same commit.
- **Prompt search matches name, description, and type but not body** (`filterCatalogItems` reads those three fields) → Accepted. Content search would need either the body eagerly loaded for every prompt or a backend search endpoint; both are out of scope. Called out in the spec so it is a known gap, not a bug report.
- **RTL** → The content block, character counters, and folder picker use logical properties (`ps-*`/`pe-*`, `text-start`, `border-s-*`); the editor's back chevron gets `rtl:scale-x-[-1]`. The copy icon is symmetric and is not mirrored.

## Migration Plan

One persisted-shape change: user-config `version` 3 → 4, gaining `prompts: { installed: [] }`. It is forward- and backward-tolerant (see Risks), so no migration step is needed — `readConfig` rewrites the file on first read.

1. Ship `libs/catalog` (enum member, colour, tab, content tab, `isUnshareVisible`, prompt tab set) and `libs/chat-overlay` (feature key). Inert on their own: no host passes the new props yet, and `buildCatalogTabs` only renders a tab for a type present in `items`.
2. Ship the backend slice — `.dial_folder` filtering, the user-config prompts section, and the share `resourceKind` — plus the regenerated client. All three are additive; existing callers are unaffected.
3. Ship `prompts.api.ts` + `promptsApi` registration. Inert: no caller yet.
4. Ship `PromptsContext` and `mapPromptToCatalogItem` behind `OverlayFeature.Prompts`. Zero user-visible change while the key is off.
5. Ship `libs/prompt-editor`, the `PromptEditor` route, and the catalog wiring, still gated.
6. Enable `prompts` in `ENABLED_FEATURES` per environment.

**Rollback:** remove `prompts` from `ENABLED_FEATURES` — the catalog, composer, and routes return to their current behaviour with no code change and no orphaned data (prompts created while enabled stay in DIAL Core, untouched and re-readable when re-enabled). Favourited prompt paths stay in `prompts.installed`, where nothing else reads them.

> **Note:** `prompts` is currently in `DEFAULT_ENABLED_UI_FEATURES`, so step 6 is already in effect and the feature ships on by default. That is a deliberate deviation from the dark-rollout sequence above; removing it from the default set is the only thing needed to restore it.

## Open Questions

1. **Should organisation (public) prompts be visible when `OverlayFeature.Prompts` is on but the user has no personal prompts?** Assumed yes — the Public folder is how a user discovers prompts worth copying. Revisit only if a stakeholder wants the tab hidden until the user owns a prompt.
2. **Should a prompt shared with the user be removable from their list?** Blocked on two backend facts, not on a product decision: the discard DTO rejects prompt paths, and `listPrompts` strips the owner bucket a discard call needs. Both are fixable; neither is in this change.

**Resolved since the first pass:**

- *Does `POST /api/v1/share` accept a bare prompt path?* No — it needs `prompts/{bucket}/{path}`. Resolved by D7's explicit `resourceKind`.
- *Do prompt favourites belong in a follow-up?* No — they are in this change. Resolved by D6.
