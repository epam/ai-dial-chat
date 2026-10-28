# Proposal

Issue: [#9576](https://github.com/epam/ai-dial-chat/issues/9576) — feat: preselect deployment, skill and prompt via URL query params (milestone `release-1.3`).

## Why

External applications (for example the AI DIAL Entity MCP App building Agent "Try it" links) need a supported way to link into DIAL Chat with an entity preselected. The only such link today is `?isolated-model-id=<id>`: it covers deployments only, it is scheduled for removal (`TODO: remove in next release` header of `apps/chat/src/context/IsolatedModelViewContext.tsx`), and it switches Chat into an isolated view (hidden navigation and agent picker) that these applications do not want. The catalog's "Use in chat" already knows how to preselect a deployment, add a skill mention and apply a prompt, but only through in-app navigation state.

## What Changes

- Add three URL query parameters read on the new-conversation route (`/`):
  - `deployment-id=<id>` — preselects a Model, Agent or Application for a new conversation.
  - `skill-id=<skills/{bucket}/{path}>` — adds the skill to the message input as a mention.
  - `prompt-id=<prompts/{bucket}/{path}>` — applies the prompt as the catalog's "Use in chat" does (plain body seeds the composer; a body with `{{parameters}}` opens the "Prompt parameters" popup).
  - The parameters combine, e.g. `/?deployment-id=<id>&skill-id=<skills/...>&prompt-id=<prompts/...>`.
- Behavior mirrors "Use in chat", with one deliberate difference: the **deployment is preselected without being saved** as the user's own preference (the catalog persists it via `setSelectedItemId`; this link must not — per the issue). Do not "align" it with the catalog.
- Each parameter is removed from the URL individually, as soon as that parameter has been applied or has failed (`replace`); only our three keys are touched, other query parameters, the hash and any pending router state survive. A refresh therefore never re-applies an already-settled parameter.
- No isolated view: navigation, agent picker and new-conversation controls stay visible. A prompt body is never put in the URL; Chat loads it by id.
- Failure handling:
  - `deployment-id` unknown — matches no deployment, or matches one that is hidden (`isHidden`, operator `HIDDEN_ENTITY_TAGS`) or whose declared `interfaces` do not include `chat` (this also covers `custom_ui`-only applications, exactly as the catalog hides "Use in chat" for them, and toolset ids, which are not deployments): fall back to the default deployment and show a **warning**. Decided only after deployments finish loading. If the deployments listing itself failed (`error`), show an **error** notification instead of "not found" and fall back to the default.
  - `skill-id` malformed, not in the user's own / shared-with-me / public skill listings after the listing settles, listing failed, or the `skills` UI feature disabled: error notification, message input unchanged.
  - `prompt-id` malformed, `prompts` UI feature disabled, or read failing: error notification, message input unchanged.
  - A skill used with a deployment lacking `features.skillsSupported` behaves as in the catalog (`isUnsupported` mention, sending blocked).
- `skill-id` + `prompt-id` combination is in scope:
  - Plain prompt: one `seedSkillMentions('/<name> ' + text, [{ url }])` call — mention first, prompt text after it. A `/otherSkill` written inside the prompt body is not turned into a mention (same as the catalog's plain-prompt seeding).
  - Parameterized prompt: the skill is seeded, the popup opens, and on submit the text is inserted at the caret through the existing `handlePromptInsertText`.
- While a `deployment-id` is pending the route must not call `restoreDefaultSelection()`, and once a known id is applied the default must not undo it.
- Router state wins over the URL for the same source (in-app navigation is the more specific signal); the URL parameter is still removed.
- `isolated-model-id` stays orthogonal; if present, isolated view wins: the hook does nothing — `deployment-id` is neither applied nor notified, and all three parameters stay in the URL. `skill-id` and `prompt-id` are also ignored there because isolated view disables the `skills` and `prompts` features. Overlay (iframe host) mode: likewise nothing is applied, notified or removed.
- A cleanup (`replace` navigation) changes `location.key`, which `ConversationRoute` uses to key the Custom Viewer start gate. Cleanup therefore happens as early as each source settles, and a late reset of the gate after the user pressed "Start" is a documented, accepted limitation (the gate code is not changed).
- Out of scope: toolsets, params on routes other than `/`, a Custom Viewer start for `custom_ui`-only agents (can be added later without breaking this contract).
- Documentation of the public URL contract for external integrators (see Impact).

## Alternatives considered

| Option | Verdict |
| --- | --- |
| **A. One hook in `apps/chat` that receives the route's existing sinks and applies each URL source once** (deployment → `restoreSelectedItemId`, skill → `selectSkillByUrl`/`seedSkillMentions`, prompt → `seedComposerText`/`openParametersPopup`) | **Chosen.** Reuses every sink, owns the consumed-guards and the URL stripping in one place, leaves the router-state effects untouched. |
| B. Hook returns values that the route merges as `state.x ?? url.x` into the existing router-state effects | Rejected after review: the existing effects clear state with `navigate(pathname, …)` (drops search and hash), the deployment and prompt effects lack ref guards, and a latched hook value re-fires them. |
| C. Redirect shim translating the URL into router state before the route mounts | Rejected: duplicates loading-state ownership (deployments, skills, prompt fetch) in a second place. |
| D. Extend `IsolatedModelViewContext` | Rejected: temporary, forces the isolated override, reads the URL once by design. |
| E. Pass the prompt body in the URL | Rejected by the issue and `catalog-use-in-chat` (50 000 chars, history leak). |

## Closest existing patterns (investigation)

- One-shot sinks and the #9109 consumed-ref pattern: `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` (the route-state effects for `deploymentId`, `promptContent`, `pendingPrompt`, `skillId`).
- Query-param one-shot stripping: `apps/chat/src/components/CatalogView/CatalogView.tsx` (`itemId` via `setSearchParams(prev => …delete…, { replace: true })`); enum precedent `CatalogQuery` in `apps/chat/src/types/catalog.ts`.
- Catalog "Use in chat" sinks and the prompt read split (`getPublicPrompt` for organisation prompts, `getPrompt` otherwise): `apps/chat/src/hooks/useCatalogItemActions/useCatalogItemActions.tsx` (`handleUseInChat`, `fetchPromptDto`).
- Non-persisting selection that normalises a reference to the catalog id: `restoreSelectedItemId` in `apps/chat/src/context/DeploymentsContext.tsx`; hidden-deployment rule `isDeploymentSelectable` in the same file (#9150).
- Skill mention seeding and name resolution: `selectSkillByUrl` in `apps/chat/src/components/SkillSelector/useSkillSelectorOverlay.tsx` over `seedSkillMentions` in `libs/skills/src/hooks/useSkillSelectorOverlay/useSkillSelectorOverlay.tsx`; skills feature gate `OverlayFeature.Skills` in `apps/chat/src/context/SkillsContext.tsx`.
- Prompt id parsing and params: `parsePromptResourceUrl` (`libs/chat-hooks/src/prompt/prompt-resource.ts`), `extractPromptParams` (`@epam/ai-dial-chat-shared`), `PendingParametersPrompt` = `FavoritePromptItem` (`libs/prompts/src/models/favorite-prompt-item.ts`).

## Capabilities

### New Capabilities
- `url-entity-preselection`: the `deployment-id`, `skill-id` and `prompt-id` query parameters — parsing, per-parameter consumption and URL cleanup, validation and failure notifications, skill + prompt combination, precedence rules.

### Modified Capabilities
- `conversation-deployment-selection`: the mount-time default restoration ("New Chat screen restores the user's default deployment on mount") defers to a pending or applied URL `deployment-id`.
- `isolated-model-view`: documents `deployment-id` as the non-isolating replacement and the precedence when both are present.
- `catalog-use-in-chat`: the one-shot router-state clearing keeps the URL's query string and hash (it previously navigated to the bare `pathname`).

## Impact

- Code (`apps/chat` only): a new hook `apps/chat/src/hooks/useUrlEntityPreselection/useUrlEntityPreselection.ts`, wiring in `ConversationRoute.tsx` (hook call, one extra condition in the default-selection effect, and the existing route-state `navigate(pathname, …)` calls replaced by a shared "strip keys, preserve the rest" function that the hook also uses), a query enum in `apps/chat/src/types/`, a new `apps/chat/src/utils/deployments.ts` with the "deep-linkable deployment" predicate, `translation-keys.ts` + `en.json` (only shipped locale).
- One small `libs/conversation-input` change (`Input` puts the caret at the end when it mounts autofocused with text, and `useTextInsertion` inserts at the end of a never-focused composer whose caret is still at the default start), added during implementation after a real-browser test showed popup text landing in front of a seeded skill mention; it carries no host knowledge. No other `libs/*` change. No backend/OpenAPI change: the prompt read reuses the existing `getPrompt` / `getPublicPrompt`.
- Docs: `openspec/specs` (above); a public URL-contract section for integrators (parameters, id encoding, combination rules, failure behavior) in `docs/architecture.md` or the app README; run `npm run validate:specs` and `npm run validate:docs`.
- i18n: yes — new user-visible strings (unknown deployment warning, deployments-failed error, unavailable skill, unavailable prompt).

## Rollback / compatibility

Additive and non-breaking: absent params leave behavior identical. Revert by removing the hook, enum, i18n block and the route wiring; no persisted state, schema or API is touched.

## Acceptance criteria

- Each parameter alone and each combination preselects/applies as the catalog "Use in chat" does (deployment not persisted), and settled params are gone from the URL; unrelated params, hash and pending router state survive; a refresh does not re-apply.
- `/?deployment-id=x&skill-id=y&foo=bar#h` ends as `/?foo=bar#h`.
- Unknown / hidden / non-chat / toolset `deployment-id` → default + warning; deployments load failure → default + error; unknown or inaccessible `skill-id` / `prompt-id` → error notification, composer unchanged.
- `skill-id` + plain `prompt-id` yields `/<skillName> <promptText>` with a working mention; with a parameterized prompt the popup submit appends after the mention; the result does not depend on completion order.
- No render loop, no duplicate application under React StrictMode, no default-selection flash or override.
- `isolated-model-id` present → isolated wins and the URL is left untouched; overlay mode → nothing applied, nothing removed.
- Router state `{ skillId }` plus `?deployment-id=x` arriving together ends with no `deployment-id` (a route-state clear cannot resurrect a removed parameter).
- `npm run verify:changed`, `npm run validate:specs`, `npm run validate:docs` and `openspec validate preselect-entities-via-url-params --strict` pass.
