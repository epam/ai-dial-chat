## Context

Before "chat 2.0", `isolated-model-id` was parsed once per page load in a Next.js
`getServerSideProps` handler (`get-common-page-props.ts`) and stored in a Redux `settings`
slice, which the SPA could then use to auto-create a real, empty, named `isolated_<modelId>`
conversation before any user input. Both mechanisms are gone: `apps/chat` is now a Vite SPA
(`apps/chat/src/main.tsx` → `BrowserRouter`) with React Context/hooks as the only state layer,
there is no server-rendered props path, and — this was discovered only once implementation
started — **the backend no longer supports creating a conversation without a real first
message.** `POST /conversations` (`apps/chat-api/src/conversations/conversation.controller.ts`,
backed by `CreateConversationDto.firstMessage!: string`) returns 400 on an empty message, and
the app's own overlay bridge (`useConversationListBridge.ts`'s `CreateLocalConversation`
handling) treats a blank `firstMessage` as "don't create anything — navigate to the empty
composer with a preselected model instead." There is no code path anywhere in the current app
that creates a persisted conversation without sending a real message to the model. Sending a
synthetic message to manufacture an eager conversation would trigger a real, unprompted LLM
completion on every page load — a worse outcome than the old behavior, not an equivalent one.
Given that constraint, this change pins the model and hides the surrounding UI immediately, but
the actual conversation (and its `isolated_<modelId>` name) only comes into existence once the
user sends their first real message, exactly like every other new chat in this app.

The current codebase already has extension points for the remaining, implementable parts of the
old behavior:

- **Deployment preselection without persisting it as the user's preference.**
  `ConversationRoute` already has this exact shape of problem solved twice over: a
  `deploymentId` arriving via router state (from the catalog's "Use in chat" action) calls
  `restoreSelectedItemId(routeDeploymentId)` and skips the normal `restoreDefaultSelection()`
  call; an overlay's `pendingModelId` does the same thing for the overlay's own preselection.
  Isolated view is a third source for the same mechanism.
- **UI feature toggles already remove the model selector outright.** `ui-feature-toggles`'s "An
  unusable agent selector is removed, not dimmed" requirement means `hide-change-agent`/
  `disallow-change-agent` already make `ConversationView` render no agent selector at all once a
  conversation exists. Preselecting the deployment plus forcing those two keys on reproduces
  "pinned, non-changeable model" with no new prop or component change.
- **`UiFeaturesContext`'s existing 3-level priority chain** (`ui-feature-toggles` spec — overlay
  override → server `enabledUiFeatures` → compiled defaults) already has a `Set<OverlayFeature>`
  shape ready to extend with one more, higher-priority source. Nearly every old
  `disabledFeaturesForIsolatedView`/`hiddenFeaturesForIsolatedView` entry already has a
  same-shaped key: `disallow-change-agent`, `hide-change-agent`, `hide-empty-chat-change-agent`,
  `hide-new-conversation`, `hide-navigation-menu`, `conversations-section`, `prompts`. The one
  old entry with no current equivalent is `HideTopContextMenu` — the "top context menu" it hid no
  longer exists as a surface in the new UI.
- **`renameConversation`** (`apps/chat/src/server-api/conversations.api.ts`) already exists for
  exactly the "override the backend-derived name" need: once the first real message creates the
  conversation (with a name auto-derived from that message's content), isolated view renames it
  to the deterministic `isolated_<modelId>` immediately after.

This is an explicitly **temporary** reinstatement (TODO: remove next release), so the design goal
is maximum reuse of these mechanisms and minimum new surface area, not a clean permanent feature.

## Goals / Non-Goals

**Goals:**
- Detect `?isolated-model-id=<id>` client-side and drive one cohesive "isolated view" mode for
  that tab's lifetime (until full page reload).
- Preselect the deployment (without persisting it as the user's preference) and force the model
  selector hidden, so the pinned model is immediately visible on the empty composer and cannot be
  changed once a conversation starts.
- Force the same fixed `OverlayFeature` set the old feature hid/disabled, and render a not-found
  state when the id doesn't resolve.
- Rename the conversation to `isolated_<modelId>` as soon as it is actually created by the user's
  first message.
- Mark every added line with `// TODO: remove in next release` so a future cleanup pass can grep
  and delete it confidently.

**Non-Goals:**
- Not reintroducing SSR, Redux, or a `settings` slice.
- Not eagerly creating a conversation before any user input — the backend has no endpoint for an
  empty conversation, and manufacturing one with a synthetic first message would trigger a real,
  unprompted LLM completion on every page load. Isolated view shows the normal empty-composer
  state (with the model pinned and the rest of the UI hidden) until the user actually sends
  something, same as any other new chat.
- Not adding a `HideTopContextMenu`-equivalent UI surface — it has no current counterpart and
  reintroducing it is out of scope for a temporary shim.
- Not changing `OverlayContext`'s postMessage protocol — isolated view is a plain iframe embed
  with no JS SDK host on the other side, so it never receives `SET_OVERLAY_OPTIONS`.
- Not implementing a separate "skip recreate-on-close" mechanism — the old behavior this
  replaced (always keeping a blank conversation object in the Redux store) no longer exists; an
  empty route already renders the composer-only state with no conversation object at all.
- Not implementing an "installed models" input-readiness bypass — grepping the current
  `ConversationView`/`ConversationPage`/`NewConversationComposer` call sites for any such gate
  (the successor to the old `isChatReadyForInput`/`isInputVisible` logic) found none; there is
  nothing to bypass.
- Not adding a `fixedModel` prop pass-through anywhere — pinning is achieved through deployment
  preselection plus the forced UI-feature set, not a separate mechanism.
- Not adding a feature flag / `ENABLED_FEATURES` gate — matching the old behavior, this is
  unconditional on the query param alone.

## Decisions

**1. Detect the param and resolve the deployment in a new context, not a route-local hook.**
Add `IsolatedModelViewProvider`/`useIsolatedModelView` in
`apps/chat/src/context/IsolatedModelViewContext.tsx` (`// TODO: remove in next release` header),
mounted in `apps/chat/src/main.tsx` inside both `BrowserRouter` (needs `useLocation()`) and
`DeploymentsProvider` (needs `useDeployments()`), alongside `UiFeaturesProvider`. On mount, if
`isolated-model-id` is present in `useLocation().search`, it resolves the id against
`useDeployments().items` via `findDeploymentByIdOrReference`. Once `DeploymentsContext` has
finished its initial load, an unresolved id sets `isNotFound`. Once resolved, it calls
`UiFeaturesContext.applyIsolatedViewOverride` with the forced set (Decision 2) exactly once. The
context exposes `{ isActive, isNotFound, resolvedDeploymentId }` via `useIsolatedModelView()`;
`ConversationRoute` is the sole consumer.
*Alternative considered:* read the query param locally inside `ConversationRoute` — workable for
detection alone, but the UI-feature override needs to be applied from somewhere that survives
navigation to `/conversations/<id>` (the toggles must still be forced once the created
conversation is shown, and `ConversationRoute` unmounts at that point), so a context mounted
above the router match is the simpler single owner for both concerns.

**2. Force UI features through a new, higher-priority override input on `UiFeaturesContext`,
applied on param presence alone — not on deployment resolution.**
Add `applyIsolatedViewOverride` alongside the existing `applyOverlayOverride`, with its own
`useState<Set<OverlayFeature> | null>`. Priority becomes: isolated-view forced set (highest) →
overlay override → server `enabledUiFeatures` → compiled defaults. `IsolatedModelViewProvider`
calls it once as soon as `modelId` (the query param) is present, with a fixed, hard-coded set:
`{disallow-change-agent, hide-change-agent, hide-empty-chat-change-agent, hide-new-conversation,
hide-navigation-menu}`; `conversations-section` and `prompts` are simply absent from that set, so
they read as disabled under the override's replace-not-merge semantics (same "disabled" vs.
"hidden" split the old code had).
*Bug found in manual testing:* the override was originally gated on `resolvedDeployment` (i.e.
`useDeployments()` finishing its async load), which let `app.tsx`'s "open the conversations panel
by default" effect run first and briefly flash the panel open on every page load before the
override landed. The old SSR feature hid this UI purely on query-param presence
(`isIsolatedView = params?.has(...)`), independent of whether the id ever resolved — gating on
`modelId` instead of `resolvedDeployment` restores that same presence-only timing.
*Alternative considered:* funnel isolated-view through `applyOverlayOverride` itself (same
setter, same priority slot) — rejected because the existing spec states overlay override is
written only by `OverlayContext`'s postMessage handler, and because isolated view and a real
overlay embed are a real (if rare) simultaneous case (an overlay host could itself pass
`isolated-model-id` through to the iframe URL); giving isolated view its own, higher-priority
slot keeps the two independent.

**3. Deployment preselection reuses the existing `routeDeploymentId`/`pendingModelId` gate in
`ConversationRoute`.** The effect that currently reads `if (routeDeploymentId) { restoreSelectedItemId(...); return; } if (hasConsumedRouteDeploymentRef.current) return; if (!overlay?.pendingModelId) { restoreDefaultSelection(); }` gets a third guard: when
`useIsolatedModelView()` returns `isActive && resolvedDeploymentId`, it calls
`restoreSelectedItemId(resolvedDeploymentId)` once (tracked by its own ref, mirroring
`hasConsumedRouteDeploymentRef`) and skips `restoreDefaultSelection()`, exactly like the existing
`overlay?.pendingModelId` branch already does for a structurally identical need.

**4. Not-found rendering uses `NoDataContent`, not the full-page `NotFoundPage`.**
`apps/chat/src/pages/NotFound/NotFound.tsx` is a route-level 404 with "Open catalog"/"New
chat"/"Back" actions that make no sense inside a locked-down, navigation-hidden iframe embed.
Instead, `ConversationRoute` renders the UI kit's `NoDataContent` (title + description, no
actions, `live` for `aria-live`) in place of `NewConversationComposer` when
`useIsolatedModelView().isNotFound` is `true`.

**5. Rename to `isolated_<modelId>` right after the first real message creates the conversation.**
Both of `ConversationRoute`'s existing conversation-creation call sites
(`handleCreateConversation`, `handleStarterSelect`) already call `apiCreateConversation` and then
either `saveConversation` or `navigate`. When isolated view is active, each SHALL additionally
call `renameConversation(getConversationPath(conversation.id), `isolated_${sanitizedModelId}`)`
before navigating, so the conversation the user lands on already carries the deterministic name
rather than the backend's message-derived one.
*Alternative considered:* rename lazily/in the background after navigation — rejected because a
quick-app host reading the conversation's name right after the user's first send should see the
deterministic name, not a transient auto-generated one.

**6. Hiding navigation is a direct conditional render in `app.tsx`, not a new `OverlayFeature` key.**
Manual verification surfaced that `hide-navigation-menu` (used in Decision 2's forced set) only
ever governs the mobile hamburger/`NavigationSheet` — `ui-feature-toggles`'s own requirement
states it explicitly does not touch the desktop rail (`NavigationPanel`, with the logo, nav
items, and user-menu footer), which is exactly what was still showing. The old feature hid
navigation unconditionally on every viewport (`shouldShowNavigation = !isIsolatedView`), so
`app.tsx` SHALL NOT render `<Navigation />` at all — desktop and mobile alike — whenever
`useIsolatedModelView().isActive` is `true`.
*Alternative considered:* add a new `OverlayFeature` value (e.g. a "hide desktop rail" key) to
`libs/chat-overlay`'s protocol enum — rejected because that enum is a permanent, versioned wire
protocol surface, and a temporary shim scheduled for deletion next release does not justify a
permanent addition to it; a direct conditional render at the one call site is strictly less
code and disappears cleanly with the rest of this change.

**7. TODO markers.**
Every new file gets a header comment `// TODO: remove in next release — isolated-model-id was a
temporary reinstatement, see openspec/changes/restore-isolated-model-id`. Every new branch inside
a shared file (`UiFeaturesContext`, `ConversationRoute`, `main.tsx`) gets an inline
`// TODO: remove in next release` immediately above it, so a future removal pass can grep
`isolated-model-id\|remove in next release` and find every touch point without re-deriving intent
from git blame.

## Risks / Trade-offs

- **[Risk]** The immediately-usable-conversation-on-load behavior the old feature had (a quick-app
  host reading a real conversation id right after the iframe loads, before any user message) is
  not preserved — the conversation now only exists after the first send. → **Mitigation:** this
  is an explicit, user-confirmed trade-off given the backend has no path to create a message-less
  conversation without sending a synthetic message to the LLM; the model is still pinned and the
  UI still locked down immediately, just without a conversation id ahead of the first message.
- **[Risk]** A host that legitimately wants overlay behavior AND happens to pass
  `isolated-model-id` on the same URL gets isolated view's forced features regardless of what the
  overlay host later sends via `SET_OVERLAY_OPTIONS`, because isolated view is the highest
  priority slot. → **Mitigation:** documented in the `ui-feature-toggles` delta spec as
  intentional; this combination is not the scenario the parameter exists for and is not expected
  in practice.
- **[Risk]** The temporary nature of this change (TODO comments, minimal test surface) means it
  is easy to bit-rot if "next release" slips repeatedly. → **Mitigation:** the grep-able TODO
  marker plus this openspec change directory serve as the removal checklist; `tasks.md` includes
  an explicit last task to confirm removal scope.
- **[Risk]** A page reload while showing the created isolated conversation (now at
  `/conversations/<id>`, no `isolated-model-id` in the URL) loses the forced UI-feature override,
  since it lived only in `UiFeaturesContext`'s in-memory state. → **Mitigation:** this matches the
  old SSR behavior — the old parameter was also re-evaluated fresh per page load, so a host
  reloading the iframe was always expected to reload it at the original `?isolated-model-id=...`
  URL, not at the conversation's own URL.

## Migration Plan

Additive only — gated entirely behind a previously dead query parameter. No data migration, no
environment variable, no default-behavior change when the parameter is absent. Rollback is
deleting the files/branches added (all pre-marked with the TODO comment).

## Open Questions

- None outstanding; `HideTopContextMenu` parity and eager (pre-first-message) conversation
  creation are both explicitly out of scope (see Non-Goals) — the latter confirmed with the
  requester given the backend constraint discovered during implementation.
