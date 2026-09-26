## Why

Halloween currently owns the provider, trigger logic, icon overrides and scene lifecycle. Adding another occasion would duplicate integration across the application. Introduce a reusable celebration mechanism and prove it with a small New Year event while preserving Halloween's behavior.

## What Changes

- Add a lazy event registry and a shared CelebrationProvider for start-page activation, scene selection, notifications, optional secret phrases and cleanup.
- Make Halloween an event definition with its existing artwork and scenes. Header, navigation and composer consume generic celebration integration.
- Add New Year with a gift trigger, seasonal icon, snow, confetti and flying sleigh scenes; reuse a shared flight effect across events.
- Add optional `UI_EVENT` deployment configuration and `config.activeEventId` to the existing client-config response. **BREAKING:** remove `HALLOWEEN_ENABLED` and `features.halloweenEnabled`; `UI_EVENT` is the sole selector and `none` explicitly disables effects.
- Keep one event active at a time, lazy loading, start-page-only scope, click-through decoration, keyboard support, RTL, reduced motion and translated notifications.
- Extend Halloween with a ghost train, a clawed portal that visually borrows history rows, ravens, candy rain, invisible paw prints and dancing skeletons. Borrowed rows return automatically; conversation data and requests never change.

## Capabilities

### New Capabilities

- `celebration-events`: Event definitions, selection, reusable lifecycle, scene playback, module isolation and a New Year module.

### Modified Capabilities

- `halloween-easter-egg`: Halloween becomes a module of the shared celebration provider, selected exclusively by the generic config.
- `config-registry-and-env-provider`: Resolve an optional event identifier and expose the effective selection through client-config.

## Impact

Changes remain in apps/chat and apps/chat-api, except generated OpenAPI/client output regenerated from the backend DTO. No new dependency, backend endpoint, library, event editor or scheduling service is introduced. Existing source references: apps/chat/src/context/HalloweenContext.tsx:81, apps/chat/src/components/Header/Logo.tsx:14, apps/chat/src/components/NewConversationComposer/NewConversationComposer.tsx:438, apps/chat-api/src/app-config/app-config.service.ts:214.

## Alternatives

Keeping independent providers minimizes today's changes but duplicates integration for each new event. A fully configurable animation editor would support runtime authoring but adds a new product surface and restricted effect language. Choose compiled event modules plus a small shared runtime: custom scenes remain ordinary React components and existing effects can be reused.

## Non-goals

Calendar scheduling, role-based rollout, persistent user preferences, arbitrary remote executable modules, admin UI, audio and changes to ordinary chat behavior are outside this change.

## Acceptance criteria

Halloween keeps its existing effects. New Year can be selected using `UI_EVENT=new-year`, with no event-specific branches in Header, Navigation or Composer. Explicit off and unknown event IDs remain inert. Navigation cancels effects. Every trigger notification supplies its event's secret phrase when configured. Tests cover config precedence, both events, optional phrases, lazy loading races, scene replacement and reduced-motion/responsive behavior.

## Compatibility and rollback

The user explicitly requested removing the legacy setting. Deployments must replace `HALLOWEEN_ENABLED=true` with `UI_EVENT=halloween`; missing, null, `none` and unsupported selections render no effects. Deploy backend and frontend together. Reverting requires restoring the former variable as well as the former code. `UI_EVENT=none` is the operational off switch.
