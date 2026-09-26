## Why

The seasonal celebration feature (runtime, Halloween and New Year events, 19 scenes, decor behaviours) is ~15k lines of production code living inside `apps/chat`, hard-wired to app contexts, i18n and DOM contracts. Other DIAL hosts cannot reuse it, and nobody can switch individual scenes off without editing app code. Extracting it into a publishable `@epam/ai-dial-celebrations` package makes it installable from npm, host-configurable per scene, and reviewable in isolation through Storybook.

## Problem

- `apps/chat/src/context/CelebrationContext.tsx:14-53` reads `react-i18next`, `react-router`, `AppConfigContext` and `NotificationContext` directly, so the runtime cannot leave the app.
- Scenes import the app hook `hooks/breakpoint/useBreakpoint` (9 components), dynamically import `@epam/ai-dial-conversation-input` / `@epam/ai-dial-starter-buttons` for class names (`utils/halloween.ts` `loadHalloweenAnchorClasses`, plus 4 direct imports), and rely on the app-owned `celebration-history` class (`components/ConversationPanel/ConversationPanelView.tsx:117,1312`).
- Scene pools are compile-time constants (`constants/halloween.ts` `HALLOWEEN_CLICK_BURSTS` / `HALLOWEEN_SECRET_BURSTS`, `celebrations/new-year.ts`); a host cannot disable a scene or a decor behaviour.
- There is no visual catalogue: scenes can only be seen by clicking the pumpkin in a running app, and the repo has no Storybook at all.

## Solution / What Changes

- **New lib `libs/celebrations` → `@epam/ai-dial-celebrations`**, modelled on `libs/starter-buttons` (manifest-embedded Nx config, Vite lib build, `./styles.css` export, public class names) and tagged `publishable` so `tools/publish-lib.mjs` ships it to npm with the other libs.
  - `.` — runtime: `CelebrationProvider`, `useCelebration`, `CelebrationDecor`, event/scene/label/anchor types, `CELEBRATIONS_CLASS` (public classes on the lib's own decor and scene layer).
  - `./halloween` and `./new-year` — event definitions, scene and decor-behaviour enums, English default labels; each is a separate lazily loaded chunk.
  - `./styles.css` — all scene and decor styles.
- **Host-configurable scenes**: the provider accepts a per-event selection that enables/disables any click scene, any secret scene, each decor behaviour (Halloween: spider flee, idle thread drop, typing drum, pumpkin wrap) and the secret phrase itself. Default: everything enabled (today's behaviour).
- **All host knowledge enters through props/callbacks** (follow `libs/attachment-canvas/src/context/AttachmentCanvasContext.tsx:49,136` for the provider + hook shape): active event id (host decides route/readiness), a reset key (navigation cancel), event loaders, labels (English defaults; host passes translated strings), a notification callback, `isMobile`, and DOM anchors (composer, starter list, model selector, add cluster, history container + conversation-link selector, welcome region). Missing anchors degrade to each scene's existing decorative fallback.
- **Storybook** (new infrastructure, scoped to this lib): `libs/celebrations/.storybook` with the React/Vite framework, one story per scene (16 Halloween + 3 New Year), stories for each decor and decor behaviour, and a provider playground with scene toggles. A guard test fails when a scene enum member has no story. `build-storybook` runs in the PR workflow; no deployment.
- **App becomes a thin adapter**: a new app-level `CelebrationHost` wires `useAppConfig`, `useLocation`, `useNotification`, `t()`, `useIsMobile` and the anchor classes into the lib provider. `Logo`, `Navigation`, `NewConversationComposer` and `ConversationPanelView` import from the lib. All celebration code, tests and styles move out of `apps/chat`.
- Docs: lib README, `docs/architecture.md` libraries table, root `README.md`, regenerated `docs/host-install-matrix.md`.

## Capabilities

### New Capabilities
- `celebrations-library`: the published package contract — entry points, provider API, host-supplied inputs, per-scene/decor selection, labels, anchors, Storybook coverage and npm publishing.

### Modified Capabilities
- `celebration-events`: the runtime moves into the library; event modules declare labels instead of app i18n keys, the registry becomes host-supplied loaders, and route/readiness gating moves to the host adapter.

`halloween-easter-egg` behaviour is preserved unchanged (every scene, decor behaviour, timing, a11y, RTL and reduced-motion rule); no delta is needed.

## Non-goals

- No new scenes or behaviour changes to existing scenes.
- No new env var or admin UI for scene selection in the DIAL Chat app — the app keeps all scenes enabled; the selection API is for hosts (a `UI_EVENT_SCENES`-style setting can follow separately).
- No theming (`*Colors` / `buildCssVars`) for illustration artwork; artwork colours stay fixed in SCSS.
- No Storybook for other libs and no Storybook deployment.
- No new locales; the app keeps its 23 existing `halloween.*` / `newYear.*` keys.

## Alternatives considered

1. **Keep in app, add a scene-toggle config** (conservative baseline) — cheapest, but not reusable by other hosts and no npm package; rejected: fails the core requirement.
2. **Three packages (runtime + one per event)** — cleanest install granularity, but triples manifests, READMEs and publish surface for code that always ships together; rejected by the user in favour of subpath entries, which keep lazy loading.
3. **Keep the lib's dynamic imports of `conversation-input` / `starter-buttons`** for anchor class names — zero host wiring, but makes the lib know which composer the host uses and adds sibling deps; rejected for the library-isolation rule. Anchors are injected instead.
4. **Workspace-wide Storybook** — reusable for all libs later, but larger infra surface now; rejected by the user; the lib-local setup can be promoted later.

## Library isolation

The lib never imports i18n, router, app contexts, env/config, notifications or other libs' class constants. The app-level `CelebrationHost` adapter resolves: `activeEventId` (only when config is ready and the route is `/`), `resetKey` (`location.key`), labels (from `t()` with the existing keys), `onNotify` (→ `showSuccessNotification`), `isMobile` (`useIsMobile`), anchors (`CONVERSATION_INPUT_CLASS`, `STARTER_BUTTONS_CLASS`, its own history-panel class plus a link selector built from `ROUTES.Conversations`, the welcome region) and the scene selection. The lib knows no host route or other lib's class names.

## i18n impact

No new user-visible strings. The 23 existing keys stay in `apps/chat/src/constants/translation-keys.ts` and `en.json`; the adapter maps them onto the lib's label objects. The lib ships English defaults (identical to today's `en.json` text) for hosts without i18n.

## Scope creep flags

- Introduces Storybook as new repo tooling (dev dependencies, lib targets, one CI job).
- Touches the global provider tree in `apps/chat/src/main.tsx` (provider swap to the adapter) and four host components.
- Sequencing: the active change `add-halloween-secret-scenes` modifies `halloween-easter-egg`; this change does not, so they do not conflict at the spec level, but its code must land (or be rebased) before files move.

## Rollback / backward compatibility

Not breaking for DIAL Chat users: same scenes, timings, strings and `UI_EVENT` behaviour. The lib is new, so no published consumers break. Rollback is a revert of the change (files move back into `apps/chat`); an already-published package version can be deprecated on npm.

## Acceptance criteria

- `npm exec nx build @epam/ai-dial-celebrations` emits `index.js`, `halloween.js`, `new-year.js`, `.d.ts` files and `index.css`; `npm run publish:dry` includes the package.
- `apps/chat` contains no celebration components, scene utils, constants or SCSS; the app only has the adapter, the i18n keys and the provider placement. The chat app behaves as before (all existing celebration tests pass after moving into the lib).
- A host can disable any single click scene, secret scene, decor behaviour or the secret phrase; disabled items never play; an event with every click scene disabled keeps its decor inert on click.
- `build-storybook` succeeds in CI; every Halloween and New Year scene, each decor and each decor behaviour has a story; the story-coverage guard test passes.
- Lint, typecheck, tests and `npm run validate:docs` pass; README, architecture table, root README and install matrix are updated.
