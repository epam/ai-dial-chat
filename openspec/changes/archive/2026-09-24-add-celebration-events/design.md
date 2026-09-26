## Context

The existing HalloweenProvider combines route/config eligibility, transient playback, notification translation and secret phrase interception. HalloweenDecor additionally owns random scene choice. Header and Navigation import a Halloween icon directly. The flight coordinates already serve both bats and witches. The application currently loads optional features lazily; libraries must not acquire app-owned route/config details.

## Goals / Non-Goals

Goals: one reusable application integration, self-contained event modules, preserved Halloween behavior, a New Year example sharing actual effect code, and UI_EVENT as the sole deployment selector.

Non-goals: runtime event editor, calendar scheduling, multiple simultaneous events, persistence, audio, telemetry, new dependencies or an embeddable library.

## Decisions

1. Keep the runtime in apps/chat. `CelebrationProvider` replaces HalloweenProvider and consumes `AppConfigContext.config.activeEventId`, `useLocation` and the notification adapter. A disabled default hook remains intentional: shared app components also render outside the normal provider tree. Memoize callbacks and context values. Eligibility remains exact `/`.
2. `types/celebration.ts` defines `CelebrationEvent`, `CelebrationScene`, and `CelebrationDecorationProps`. Each scene owns `id`, `Component`, `durationMs`, and `notificationKey`. Each event owns `id`, `iconUrl`, `Decoration`, `scenes`, `clickSceneIds`, `notificationTitleKey`, and optional `secretTrigger` (`phrases`, `hintPhrase`, `sceneId`). Decorations receive `onActivate` rather than importing context. Scene IDs are local to their module, avoiding a central enum of every holiday character.
3. A static allowlisted `celebrations/registry.ts` maps IDs to dynamic imports. No server-supplied import path is executed. Only the active event is loaded. Loading, unknown IDs and failures render normal app UI; stale load results are discarded on navigation/config change. An event must be ready before a secret input can be consumed. All scenes of the active module may share its lazy chunk; don't introduce a loader per tiny SVG.
4. The provider owns a single active scene, its per-scene deadline, replacement token and previous click selection. Random selection excludes the previous click when alternatives exist, handles a single eligible scene, and safely ignores an empty pool. Changing routes/config clears active playback and history. Portal, pointer transparency and aria-hidden are shared. Scene rendering failures are isolated from chat. Cleanup deadlines start when an already-loaded scene is mounted.
5. A generic declaration-based icon override preserves the current existing-slot rule. Header/Navigation import no event. `CelebrationDecor` renders the selected Decoration in the welcome area, and composer calls `consumeSecretPhrase`. Secret matching is an exact nonempty normalized match with Unicode letters/numbers preserved, so future non-Latin events work. Events without a phrase do not intercept text or show a hint. User text with attachments remains governed by the existing composer flow; do not expand interception to conversations.
6. Extract `FlyingCharacters` plus flight layout options/CSS from the existing bat/witch implementation. Halloween supplies its SVG components and settings, New Year supplies a sleigh. New Year also includes a gift trigger, decorative garland, snow and confetti scenes. Shared styles expose reduced-motion resting positions; each custom scene must supply its own static frame. Responsive counts use useIsMobile, named breakpoints remain mobile/desktop, layout uses logical positioning, flight coordinates remain physical decoration.
7. Add `UI_EVENT` through the existing config registry/provider and emit `config.activeEventId` in GET /api/v1/client-config. Remove the legacy env key/feature enum/boolean. Absent/none resolves null; valid unknown IDs are allowed through the backend and inert in the client, so new modules do not need backend changes. Generated client output is regenerated from Swagger; no hand-authored lib integration or new endpoint. Existing endpoint auth, per-user/roles 60-second cache and refresh behavior remain unchanged.
8. Reuse existing halloween translation keys. Add newYear.toastTitle, giftLabel, snowToastMessage, confettiToastMessage, sleighToastMessage. New Year uses the optional phrase `happy new year`, revealing the confetti scene. Notification hints are localized per scene and receive the event hintPhrase as interpolation. No extra i18n API required.

## Risks / Trade-offs

- Module load/render errors could disrupt the app → cancelled-load guards, empty fallback and an error boundary around decorative components.
- Removing HALLOWEEN_ENABLED is a configuration break → explicit env-reference and migration documentation; no silent legacy fallback.
- Generic code could become a graphics framework → share lifecycle and existing flight mechanics; keep custom web geometry in Halloween.
- Translated phrases can collide with real requests → exact matching only, active/loaded event on start page only, no substring matching.
- Many decorative SVG nodes → preserve bounded counts and avoid loading inactive event bundles.

## Additional Halloween scenes

Keep all six new scenes within the compiled Halloween module. SVG/CSS supplies the train, perched ravens, candy, paw prints and skeletons; bounded randomized positions are stable for each playback. Every notification retains the secret phrase. Motion preferences resolve to static art.

The portal opens at a randomized viewport position and reaches toward up to two fully visible history rows. An app-owned history class and conversation links identify candidates without adding Halloween knowledge to a library. Snapshot clones are inert, aria-hidden and pointer-transparent in the existing celebration layer. Short Web Animations temporarily fade the original rows while the copies travel into the portal; cancelling animations restores original styles without modifying layout, data, focus order, routes or API state. Focus/pointer interaction, scrolling, resizing, visibility changes, removed/recycled rows, preference changes and scene unmount cancel the illusion immediately. No visible rows or reduced motion means a decorative portal only. Prefer copies to moving actual DOM nodes (React/virtual-list ownership) or deleting/reinserting conversations (data mutation).

## Migration Plan

Implement config and regenerated DTO first, then runtime/Halloween conversion, shared flight/New Year, and integration/docs. Deploy both app and API with UI_EVENT set explicitly. Roll back together and restore the old flag only if rolling back code. No stored data migration exists.

## Open Questions

None blocking. The first version uses deployment configuration rather than calendar scheduling or an editor, as agreed in the conversation.
