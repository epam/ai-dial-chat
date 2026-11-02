# Design

## Context

See `proposal.md` for motivation and `specs/url-entity-preselection/spec.md` for the contract. Current state, verified in code:

- `ConversationRoute` owns four one-shot sinks fed by router state (`deploymentId` → `restoreSelectedItemId`, `promptContent` → `seedComposerText`, `pendingPrompt` → `openParametersPopup`, `skillId` → `selectSkillByUrl`). Each clears itself with `navigate(pathname, { replace: true, state: null })` — which **drops `search` and `hash`**. Only the skill effect has a consumed-ref (`hasConsumedRouteSkillIdRef`, the #9109 guard); the deployment and prompt effects do not.
- The mount effect evaluates `if (routeDeploymentId)` before the isolated-view branch, then falls through to `restoreDefaultSelection()` unless a route deployment was consumed, isolated view is active, or an overlay pending model exists.
- A skill in the composer is plain text `/{name} ` plus a separate mention anchor (`url`); `seedSkillMentions(content, entries)` replaces the whole message and bumps a revision. `selectSkillByUrl` takes the name from the listings and silently falls back to the last path segment when the url is not listed. `useTextInsertion` ignores a revision present at mount and acts in a microtask, so it is unsafe as a first write on a cold load.
- `restoreSelectedItemId` does not validate the id and does not persist; `DeploymentsContext.items` holds deployments only (toolsets are a separate list); `isDeploymentSelectable` (private to that file) excludes `isHidden` deployments (#9150); on a failed fetch `isLoading` becomes `false` with `items = []` and `error` set.
- The catalog sends organisation prompts through `getPublicPrompt(parsed.path)` and all others through `getPrompt(item.id)` (`fetchPromptDto`); `getPrompt` and `getPublicPrompt` map ownership differently.
- `SkillsContext` is gated by `OverlayFeature.Skills`; when disabled it clears the listings and sets `isLoading` false.
- The app root is wrapped in `<StrictMode>`; effects run, clean up and run again in development.
- `useAuthRedirect` carries `pathname + search + hash` in `callbackUrl`, so a deep link survives login unchanged.

## Goals / Non-Goals

**Goals:**
- One place in the app owns resolution, guards and URL cleanup for the three parameters, reusing every existing sink without forking its behavior.
- A deterministic result independent of the order in which deployments, skills and the prompt load.

**Non-Goals:**
- No `libs/*` change, no backend/OpenAPI change, no new context or provider.
- No change to the catalog's "Use in chat" flow; no `ConversationRoute` refactor beyond the wiring below.
- No overlay-mode support, no toolsets, no Custom Viewer start for `custom_ui`-only agents, no parameters on other routes.

## Decisions

### D1. One hook that *receives the sinks* and applies each source itself

`apps/chat/src/hooks/useUrlEntityPreselection/useUrlEntityPreselection.ts` (one hook per file, JSDoc on why). Parameter names live in `UrlPreselectionQuery` (`apps/chat/src/types/url-preselection.ts`; precedent `CatalogQuery`). `ConversationRoute` calls it with the sinks it already has:

```
useUrlEntityPreselection({
  restoreSelectedItemId, selectSkillByUrl / seedSkillMentions,
  seedComposerText, openParametersPopup,
  routeState: { hasDeploymentId, hasSkillId, hasPrompt },  // router state wins
  isDisabled: isIsolatedView || !!overlay,
})  ->  { isDeploymentOverrideActive }
```

The hook owns, in one place: a single lazy `useState` snapshot of the three params **and of the `routeState` flags** (so "router state wins" is decided once at arrival and cannot flip when the route later clears that state), the per-source "applied" refs, and URL cleanup. Because it invokes the sinks itself, **none of the route-state effects is changed to consume URL values**, so re-firing, missing guards and `navigate(pathname)` wiping the query cannot arise from URL-derived values.

Sinks have unstable identities (verified): `restoreSelectedItemId` and `seedComposerText` are stable; `selectSkillByUrl` depends on the skill lists, `seedSkillMentions` on `mentions` and `resolveName` (it changes with the draft, i.e. per keystroke), and `openParametersPopup` is a fresh no-op each render when prompts are disabled. The hook therefore reads every sink through a ref refreshed by an effect declared **before** the resolution effects (so it is current when they run in the same commit; assigning a ref during render is rejected by the `react-hooks/refs` lint rule in `apps/*`), and never lists a sink in an effect dependency array. `isDeploymentOverrideActive` is the opposite: it is **React state** (or derived synchronously from state plus the snapshot), `true` on the very first render and changing through render, never a ref — otherwise the mount effect would not re-run when an unknown id settles and the default would stay stuck.

Placement: the hook is called in `ConversationRoute` after `useSkillSelectorOverlay`, `usePromptSelectorOverlay`, `useComposerSeed`, `useOptionalOverlay` and `useIsolatedModelView` (it needs their outputs) and before the default-selection effect that consumes `isDeploymentOverrideActive`.

*Alternatives:* merging `state.x ?? url.x` into the existing effects (rejected after review — see proposal option B); redirect shim (rejected); `IsolatedModelViewContext` (rejected).

### D2. URL cleanup: one shared strip function, live-read, order-independent

A single helper (a small function in `apps/chat/src/utils/`, e.g. `buildCleanedLocation`/`stripSearchKeys`, plus a thin navigate wrapper) takes the keys to remove, reads the **current** `window.location.search`/`hash` and the current history state at call time (not a render-time value), and returns the target for one `navigate({ search, hash }, { replace: true, state })` that preserves unrelated params, the hash and pending router state. **Both** the hook's cleanup **and** the route's `clearRouteState` (which replaces the four `navigate(pathname, { replace: true, state: null })` calls and passes `keys: []`, `state: null`) call it — React Router applies navigations inside `startTransition`, so `useLocation().search` lags `window.location`, and a render-time `search` in `clearRouteState` would resurrect a parameter the hook just removed in the same tick. Two sources settling in the same tick therefore compose regardless of effect order. A late cleanup (a prompt read settling after the user left `/`) is guarded by a mounted/not-aborted check so `navigate({ search, hash })` can never rewrite `/conversations/<id>`. `setSearchParams` is not used because it drops the hash.

Each cleanup is a `replace` navigation and changes `location.key`, which `customViewerStartKey` in `ConversationRoute` includes. The gate code is not changed (scope); cleanup runs as early as each source settles, and a late reset of the gate after "Start" is a documented limitation covered by a test that pins the observed behavior.

### D3. Deployment: decide after load; hidden, non-chat and failed-load handled

The hook waits for `useDeployments().isLoading === false`, then:

- `error` set → `showErrorNotification` (`UrlPreselectionI18nKeys.DeploymentsLoadFailed*`), settle with no override (the route's default selection proceeds).
- `findDeploymentByIdOrReference(items, id)` hit that is **not `isHidden`** and whose `interfaces` is `null` or includes `chat` → `restoreSelectedItemId(hit.id)`, set override active, never persisted.
- otherwise → `showWarningNotification` (`DeploymentNotFound*`) and settle with no override. This covers unknown ids, hidden deployments, `custom_ui`-only applications (the catalog hides "Use in chat" for them — follow it, extend later) and toolset ids (a miss in `items`).

`isDeploymentOverrideActive` is `true` from mount until the source settles *and* stays `true` once a known id was applied. `ConversationRoute`'s mount effect adds one early return `if (isDeploymentOverrideActive) return;` (placed after the existing consumed-ref check, before the isolated and default branches), so the default is neither shown-then-replaced nor allowed to undo the pick; after an unknown id settles, the flag drops and the effect (dependency added) calls `restoreDefaultSelection()` once. With `isIsolatedView` or overlay the hook is disabled and touches nothing — no apply, no notification, **no URL cleanup** — so the flag is never `true` and the isolated branch keeps winning; all three parameters simply stay in the URL (isolated view also disables the `skills` and `prompts` features, so `skill-id`/`prompt-id` would be ignored there anyway).

The "deep-linkable deployment" predicate is a new kebab-case util `apps/chat/src/utils/deployments.ts` exporting `isDeepLinkableDeployment(deployment)`: not `isHidden`, and `interfaces == null || interfaces.includes('chat')` (a one-line comment notes that it mirrors the catalog's `supportsChat` in `libs/chat-hooks/src/catalog/map-deployment-to-catalog-item.ts`). Nothing is exported from `DeploymentsContext` — it is two trivial conditions — and it is **not** extracted into `libs/chat-hooks`.

*Rationale for waiting:* while `items` is empty `restoreDefaultSelection()` is a no-op (the provider applies the initial default itself after load), so the value of deferring is that a `reference` is normalised to the catalog id and an unknown id can be judged.

### D4. Skill: listing membership validates and names

Disabled when `OverlayFeature.Skills` is off (→ error notification, as the listings are empty). Otherwise wait for `useSkills().isLoading === false`, validate with `parseSkillResourceUrl`, require an exact `url` match in `skills ∪ sharedWithMe ∪ publicSkills` (no percent-encoding tolerance — ids are the canonical `skills/{bucket}/{path}` resource ids, unlike deployment ids), then call `selectSkillByUrl(url)`; the name resolves from the same listings that matched, so text and anchor agree. A match always wins: `error` is treated as a failure only when there is no match (a refetch can set `error` while stale data is still present). A miss, malformed id or `error` without a match → `showErrorNotification` (`SkillUnavailable*`), input untouched. The skills listing waits for auth readiness through its own provider; the hook relies on `isLoading`, not on timing. The skill is **not** deferred until the deployment settles: `isSkillUnsupported` is derived at render from the anchors and the current deployment, so a brief unsupported state resolves itself without cross-source ordering.

### D5. Prompt: the catalog's endpoint split, then `extractPromptParams`

Disabled when `OverlayFeature.Prompts` is off. This explicit check is **mandatory, not redundant**: with prompts disabled `openParametersPopup` is a fresh no-op each render, so without it a parameterized prompt would be silently swallowed. Validate with `parsePromptResourceUrl`; if `parsed.bucket === 'public'` read `getPublicPrompt(parsed.path)`, otherwise `getPrompt(id)` (both in `apps/chat/src/server-api/prompts.api.ts`) — the same split as `fetchPromptDto`, so ownership mapping is not guessed. Decide plain vs parameterized with `extractPromptParams(content).length > 0` called directly (`resolveCatalogPrimaryAction` takes a `CatalogItem` and is not used). Failures go through `getApiErrorDetails` to carry `traceId` into `showErrorNotification` (`PromptUnavailable*`).

### D6. Guards, StrictMode and the #9109 loop

Each source has an `applied` ref that is set **only when the result is applied or has failed — never when a fetch starts**. The prompt read runs in an effect with a cancelled flag (the prompt API wrappers take no abort signal, so a superseded request is ignored rather than aborted); in StrictMode the first run is cancelled by cleanup and the second run starts the request again because the ref is still unset; the `applied` check at apply time prevents double application if both resolve. Hook return value and the passed sink callbacks are used through refs so the effects' dependency arrays do not change identity per render.

### D7. Skill + prompt: compose once, after both settle

When both params are present the hook waits for both the skills decision and the prompt read, then:

- plain prompt → `seedSkillMentions('/' + name + ' ' + body, [{ url }])` once (no caret, no revision race; it travels the `message`/`messageRevision` path so a late-mounting textarea still receives it);
- parameterized prompt → `selectSkillByUrl(url)` first, then `openParametersPopup(...)`; submit uses the existing `handlePromptInsertText` on a mounted composer.

If one fails, the other is applied alone and the failing one notifies. Waiting for both makes the result independent of completion order. If a viewer start gate or disabled input is shown for the chosen deployment, the text is still seeded into the (disabled) input — observed behavior, same as router-state seeding today — and the parameter is still consumed and removed (covered by a test).

Real-browser finding (Chromium via the repository's Playwright fixtures): a textarea that mounts already holding text has its caret at 0 even when autofocused, so the popup's caret insertion would land in front of the mention whenever the lazily loaded composer renders after the seed. The fix is in `libs/conversation-input` — `Input` puts the caret at the end when it mounts autofocused with text, and `useTextInsertion` inserts at the end of a composer the user has never focused whose caret is still at the default start — approved as an extension of scope; it carries no host knowledge, never touches the selection of an unfocused textarea (some WebKit versions move focus on `setSelectionRange`, which the code review flagged), and is covered by lib unit tests (a throwaway Chromium fixture confirmed the behavior; it was not committed).

*Alternatives:* two independent effects (rejected — the second replace-seed erases the first); route the plain prompt through the caret-insertion channel (rejected — lost before the textarea mounts).

### D8. i18n and notifications

`UrlPreselectionI18nKeys` in `apps/chat/src/constants/translation-keys.ts` and a `urlPreselection` block in `apps/chat/src/i18n/locales/en.json` (only locale): `deploymentNotFoundTitle/Message` (`{{id}}`), `deploymentsLoadFailedTitle/Message`, `skillUnavailableTitle/Message`, `promptUnavailableTitle/Message`; grep `en.json` first and reuse an identical shared string if present. Notifications use `useNotification()`: the `*Title` key maps to `title` and the `*Message` key to `message` of `showWarningNotification` / `showErrorNotification({ title, message, requestId })`.

### D9. Public contract documentation

The params are an external integration surface (issue motivation), so the URL contract — names, id formats and encoding (`encodeURIComponent` for ids containing reserved characters; deployment lookup also tolerates reference and percent-encoding variants, skills and prompts match exactly), combination rules, failure behavior, "not honored in overlay/isolated" — is documented in `docs/architecture.md` (or the app README if that fits better), and `npm run validate:docs` is run.

## Risks / Trade-offs

- [Several sources settle at different times] → snapshot, per-source `applied` refs, live-read cleanup, and the combined seed only after both settle; covered by "any completion order" tests.
- [A wait that never settles leaves a param in the URL, so a refresh re-applies it] → every wait is bounded by the context's `isLoading`/`error` and fails fast with a notification; accepted that a hung listing keeps its own param until it settles (per-parameter cleanup keeps the others clean).
- [Skills listing is not the only legitimate access path (direct DIAL Core permission without a listing entry)] → accepted: own/shared/public listing is the definition of accessible, documented in the spec; relayed from the issue discussion as an agreed default, not verified externally.
- [`restoreSelectedItemId` on an id that later disappears from `items`] → unchanged existing behavior; the decision is taken after load.
- [Isolated view + `deployment-id`] → isolated wins, param ignored; unsupported combination removed with isolated view.
- [Changing the four existing `navigate(pathname, …)` calls] → behavior-preserving for pathname-only URLs; covered by the existing `ConversationRoute` specs plus new query/hash-preservation and "route-state clear cannot resurrect a removed param" tests.
- [Every cleanup changes `location.key`, which keys the Custom Viewer start gate] → cleanup is early and per source; a late reset of the gate is accepted and pinned by a test (gate code unchanged).
- [Late cleanup after leaving `/`] → guarded by mounted/not-aborted so it cannot rewrite another route.
- [Caret/selection on an unfocused controlled textarea in a real browser] → the plain-prompt path avoids the caret entirely; only the parameterized path relies on it and was checked in a real browser during implementation (not committed).
- [Client navigation to `/` with a changed query only does not remount the route] → out of scope; links are meant for cold arrival.

## Migration Plan

Additive, no flag. Rollback = revert the hook, enum, util, i18n block and route wiring; nothing persisted. Specs flow through the normal archive step; docs updated in the same change.

## Open Questions

None blocking.
