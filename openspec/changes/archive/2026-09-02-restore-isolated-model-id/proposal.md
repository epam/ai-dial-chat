## Why

Before the "chat 2.0" rewrite, the app supported an `?isolated-model-id=<modelId>` query
parameter used to embed the chat, locked to one specific model, inside an iframe on another
page (the "quick app in an old page" pattern). The rewrite dropped this parameter entirely and
it was never reintroduced. A real embedding case (chat embedded in an old page, locked to one
quick app) needs it back now. This is an explicitly temporary reinstatement — every piece of
code it adds carries a `// TODO: remove in next release` marker — not a permanent capability
addition, so it is scoped to reuse existing extension points (`fixedModel`, `OverlayFeature`)
rather than reintroducing the old SSR/Redux plumbing.

## What Changes

- Add a new, temporary `isolated-model-id` URL query parameter, read client-side (there is no
  SSR anymore) by a new context provider mounted near the app root.
- When present and resolvable against the current deployments list, its value drives a single
  "isolated view" mode for the current tab:
  - A fixed set of `OverlayFeature` UI toggles is forced on for the tab's lifetime:
    `disallow-change-agent`, `hide-change-agent`, `hide-empty-chat-change-agent`,
    `hide-new-conversation`, `hide-navigation-menu`. `conversations-section` and `prompts` are
    forced off (absent from the forced set).
  - Separately, `app.tsx` skips rendering `<Navigation />` entirely (desktop rail and mobile
    sheet both) while isolated view is active, since `hide-navigation-menu` only ever governed
    the mobile hamburger/sheet and explicitly leaves the desktop rail alone.
  - The deployment is preselected (without persisting it as the user's own preference, reusing
    the existing `restoreSelectedItemId` mechanism `ConversationRoute` already has for router-state
    and overlay preselection), and the forced `hide-change-agent`/`disallow-change-agent` toggles
    above already remove the agent-selector control entirely (per the existing
    `ui-feature-toggles` behavior) — together these "pin" the model with no new prop or component.
  - **Not eagerly creating a conversation before user input.** The backend requires a real first
    message to create any conversation at all (`firstMessage` is a required, validated field;
    an empty one is rejected), so unlike the old feature there is no conversation, and no
    `isolated_<modelId>` name, until the user actually sends something — manufacturing one with a
    synthetic message would trigger a real, unprompted LLM completion on every page load, which
    would be worse than the old behavior, not equivalent to it. Once the user's first message
    creates the conversation, it is immediately renamed to `isolated_<modelId>` (overriding the
    backend's message-derived name) via the existing `renameConversation` call.
  - If the id does not resolve against `useDeployments().items`, the root route renders a
    not-found state (`NoDataContent`) instead of the composer.
- Extend `UiFeaturesContext` with a second, non-overlay override source ("isolated view"
  forced features) that takes precedence over the existing overlay-override/server/default
  chain, since a page can be embedded in an iframe without ever going through the overlay
  postMessage protocol.
- Two items from the old feature list require no new code, because the mechanism they used to
  suppress no longer exists in the current architecture, and are explicitly out of scope:
  skipping conversation recreation on close, and bypassing an "installed models" input-readiness
  gate.
- Every new file/function/branch added for this SHALL carry a `// TODO: remove in next
  release` comment (or equivalent header on a whole new file), since this is a scheduled
  removal, not a permanent feature.
- **BREAKING**: none — this only adds behavior gated behind a previously-unused query
  parameter; no existing route, prop, or default behavior changes when the parameter is
  absent.

## Capabilities

### New Capabilities
- `isolated-model-view`: the `isolated-model-id` query-param-driven temporary embed mode —
  detection, deployment preselection, forced UI features, not-found handling, and
  post-first-message renaming to `isolated_<modelId>`, all marked for removal in the next
  release.

### Modified Capabilities
- `ui-feature-toggles`: `UiFeaturesContext` gains a second override source (isolated-view
  forced features) alongside the existing overlay override, with defined precedence between
  the two, since today's spec states the overlay handler is the sole writer.

## Impact

- `apps/chat/src/context/UiFeaturesContext.tsx` — new override input and precedence rule.
- `apps/chat/src/context/IsolatedModelViewContext.tsx` (new) — reads the query param, resolves
  the deployment, and forces the UI-feature override.
- `apps/chat/src/main.tsx` — mounts the new provider alongside `UiFeaturesProvider`/
  `OverlayModeGate`.
- `apps/chat/src/app/app.tsx` — conditionally omits `<Navigation />` while isolated view is
  active.
- `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` — consumes
  `{ isActive, isNotFound, resolvedDeploymentId }` to preselect the deployment, render a
  not-found state when the id doesn't resolve, and rename the conversation after the first
  message creates it.
- No changes to `ConversationView`, `NewConversationComposer`, or any `fixedModel` prop.
- No backend (`apps/chat-api`) changes; no new environment variables; no new persisted state.
