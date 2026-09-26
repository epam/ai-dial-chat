## Context

Celebrations today are ~15.2k production lines (86 files) and ~10.5k test lines inside `apps/chat/src`:

- runtime: `context/CelebrationContext.tsx`, `celebrations/{registry,halloween,new-year}.ts(x)`, `components/CelebrationDecor`, `types/celebration.ts`, `utils/celebration.ts`, `hooks/celebration/useReducedMotion.ts`;
- shared helpers: `utils/celebration-history.ts`, `utils/celebration-snapshots.ts`, `utils/flying-characters.ts`, `components/FlyingCharacters`;
- Halloween: 25 components, 14 SCSS modules, 24 `utils/halloween*.ts`, `constants/halloween.ts`, `types/halloween.ts`;
- New Year: `components/NewYear/*` (enum in `types.ts`, durations inlined in `celebrations/new-year.ts`);
- assets: `assets/halloween-logo.svg`, `assets/new-year-logo.svg` (`?no-inline`).

Host couplings to remove (all observed):

| Coupling | Where |
|---|---|
| `useTranslation`, `ParseKeys` typing, `HalloweenI18nKeys`/`NewYearI18nKeys` | `CelebrationContext.tsx:14,50`, `types/celebration.ts`, both event modules, both decors |
| `useLocation`, `ROUTES.Root`, `UserConfigStatus.Ready`, `useAppConfig` | `CelebrationContext.tsx:15,24,51-52` |
| `useNotification().showSuccessNotification` | `CelebrationContext.tsx:25,53` |
| `useIsMobile` (app hook) | 9 scene components |
| dynamic `@epam/ai-dial-conversation-input` / `@epam/ai-dial-starter-buttons` class imports | `utils/halloween.ts` `loadHalloweenAnchorClasses`, Mummy, Ravens, SpiderTheft, WebScene |
| `.celebration-history a[href^="/conversations/"]`, `ROUTES.Conversations` | `utils/celebration-history.ts`, bat/ghost/raven/web targets; applied at `ConversationPanelView.tsx:117,1312` |
| welcome region `composer.closest('[role="region"]')` | ghost/bat/spider-theft targets |

Consumers: `main.tsx:57-102` (provider placement), `NewConversationComposer.tsx:210-211,447,497`, `Header/Logo.tsx:13,24`, `Navigation/Navigation.tsx:47,79`.

The repo has no Storybook. Publishing is `tools/publish-lib.mjs` over projects tagged `publishable`; libs carry Nx config in `package.json` (reference: `libs/starter-buttons`; multi-entry build: `libs/chat-hooks/vite.config.mts:52`; provider + hook: `libs/attachment-canvas/src/context/AttachmentCanvasContext.tsx:49,136`).

## Goals / Non-Goals

**Goals:** a publishable `@epam/ai-dial-celebrations` with runtime + lazily loaded event entries; host-injected integration; per-scene, per-decor-behaviour and secret-phrase selection; a Storybook story for every scene and behaviour; DIAL Chat unchanged for users.

**Non-Goals:** new scenes or behaviour changes, a scene-selection env var in DIAL Chat, artwork theming, Storybook for other libs or deployment, new locales.

## Decisions

### D1. One package, three JS entries

`libs/celebrations/src/index.ts` (runtime), `src/halloween/index.ts`, `src/new-year/index.ts`, built with Vite lib mode `entry: { index, halloween, 'new-year' }` like `chat-hooks`, `formats: ['es']`, CSS not split so every scene style lands in one `index.css` (`./styles.css`). Shared helpers (snapshots, flying characters, reduced motion) live in `src/shared/` and become shared chunks. Event entries are what hosts pass to the provider as loaders, so a host that never selects New Year never downloads it.

*Alternative:* one entry with the events statically imported — simpler build, but every host downloads ~14k lines of Halloween even off-season. Rejected.

### D2. Public API

```ts
// @epam/ai-dial-celebrations
<CelebrationProvider
  events={{ halloween: () => import('@epam/ai-dial-celebrations/halloween'), 'new-year': () => import('@epam/ai-dial-celebrations/new-year') }}
  activeEventId={eventId}          // string | null
  resetKey={location.key}          // unknown
  labels={{ halloween: halloweenLabels }}   // Partial per event
  onNotify={({ title, message }) => …}
  isMobile={isMobile}
  anchors={{ composer, composerAddCluster, composerModelSelector, starterList, historyContainer, historyRowLink, welcomeRegion }}
  selection={{ halloween: { disabledScenes: [HalloweenScene.Cat], disabledDecorBehaviors: [HalloweenDecorBehavior.PumpkinWrap], isSecretEnabled: true } }}
  portalContainer={document.body}
>
```

- `useCelebration()` → `{ event, isEnabled, activate, celebrate, consumeSecretPhrase }`; `CelebrationDecor` renders the loaded event's decoration inside an error boundary.
- Loaders resolve to a module whose `default` is a `CelebrationEvent`; the event entry also exports its enums, `*_LABELS`, the `*Labels` type and the event object by name.
- `CelebrationEvent` keeps today's shape with `notificationKey`/`notificationTitleKey` (i18n keys) replaced by `labelId`s into the event's label record, plus `decorBehaviors: readonly string[]`.
- Scenes and decors read `isMobile`, `anchors`, labels and the decor-behaviour set from an internal `CelebrationEnvironmentContext` set by the provider (not exported), replacing the app hooks.

*Hook outside provider:* the project rule says consumer hooks throw outside their provider, but the existing `celebration-events` requirement demands an absent provider keep chat usable, and `Logo`/`Navigation` render outside the start page. Keep the inert default (as today) — the spec wins; recorded here as a deliberate deviation.

### D3. Selection is applied once, in the provider

The provider computes, per loaded event, memoized `clickPool`, `secretPool` and `enabledBehaviors` from `selection[event.id]`: start from all scene ids (or `enabledScenes` when given), subtract `disabledScenes`, intersect each pool; unknown ids drop out. `consumeSecretPhrase` returns `false` when `isSecretEnabled === false` or the secret pool is empty. Decors ask `useDecorBehavior(HalloweenDecorBehavior.X)` (internal) and skip installing timers/listeners when disabled. `HalloweenCornerSpider` keeps one effect, because its behaviours coordinate (an idle drop yields to the wrap, activity aborts the wrap), and gates each behaviour's timers and listeners on its flag.

*Alternative:* hosts pass a filtered event object — pushes pool logic onto every host and breaks secret-trigger consistency. Rejected.

### D4. Labels with English defaults, interpolated in the provider

Each event exports `HALLOWEEN_LABELS` / `NEW_YEAR_LABELS` (text copied verbatim from today's `en.json`) and a `HalloweenLabels` / `NewYearLabels` interface. The provider merges `labels[event.id]` over defaults and replaces `{{phrase}}` itself (no i18next). Decors receive resolved labels through the environment context. DIAL Chat's adapter builds the objects with `t()` from the unchanged keys, memoized on the language.

### D5. Anchors replace cross-lib imports and host routes

`CelebrationAnchors` holds class names and selectors (D2). `loadHalloweenAnchorClasses` and every direct `@epam/ai-dial-conversation-input` import are deleted; targets read `anchors` from the environment context. `celebration-history.ts` takes `historyContainer` + `historyRowLink` instead of the hard-coded class and route. Every target function already returns an empty/fallback plan when an element is absent, so missing anchors reuse existing fallbacks (covered by existing tests, re-pointed).

### D6. Styling and assets

SCSS modules move unchanged; the lib gets `tailwind.config.js` with the root preset and `createLibTailwindUtilities` so `desktop:`, `rtl:` and theme tokens used in TSX still emit. Artwork keeps fixed hex colours (non-goal: theming); `var(--text-primary, #161b2d)` fallbacks already meet the contrast rule. Public classes `CELEBRATIONS_CLASS = { decor, trigger, sceneLayer }` (`dial-celebrations-*`) are emitted last in `mergeClasses`, get guard tests and no CSS. The logo SVGs are imported as URLs; Vite lib mode inlines them as data URIs, which is acceptable for two ~1 KB icons (`iconUrl` stays a string).

### D7. Storybook, scoped to the lib

`npm exec nx g @nx/storybook:configuration @epam/ai-dial-celebrations --uiFramework=@storybook/react-vite` (adds the Nx plugin and `storybook`/`build-storybook` targets for this project only; version pinned to the current stable major compatible with Vite 8 at implementation time). Stories live next to their component (`*.stories.tsx`) and are excluded from `tsconfig.lib.json` and the build.

- `StoryHostPage` fixture: fake composer (with anchor classes), starter list, history panel with conversation links, welcome region, pumpkin decor area — passed through `anchors`.
- `ScenePlayer` story helper: renders `CelebrationProvider` with a synchronous loader and a "Play" control calling `celebrate(id)`; args expose `isMobile`, `dir` (ltr/rtl) and a reduced-motion toggle (story-level `matchMedia` override).
- Stories: `Halloween/Scenes/<Scene>` ×16, `NewYear/Scenes/<Scene>` ×3, `Halloween/Decor` + one per `HalloweenDecorBehavior` (with short story-only timings via an internal timing override so the wrap starts in seconds), `NewYear/Decor`, `Playground` with multi-select controls for `selection`.
- `story-coverage.spec.ts`: imports story modules via `import.meta.glob('../**/*.stories.tsx', { eager: true })`, collects each story's `parameters.celebrationScene` / `celebrationBehavior`, and asserts every enum member is covered.
- PR workflow: a `build_celebrations_storybook` job running `npm exec nx build-storybook @epam/ai-dial-celebrations`.

*Alternative:* explicit `storybook dev` commands in the manifest without `@nx/storybook` — avoids a new plugin, but loses caching/inference and contradicts "run tasks through Nx". Rejected.

### D8. DIAL Chat adapter

`apps/chat/src/context/CelebrationHost.tsx` replaces `CelebrationContext.tsx` at the same position in `main.tsx`. It owns only resolution: `activeEventId = status === Ready && pathname === ROUTES.Root ? config.activeEventId : null`, `resetKey = location.key`, labels from `t()`, `onNotify → showSuccessNotification`, `isMobile = useIsMobile()`, anchors from lib class constants plus the app's `celebration-history` class and `a[href^="${ROUTES.Conversations}/"]`, `selection` = none. All props are memoized. Host components switch imports to the lib; `ConversationPanelView` keeps its app-owned class.

### D9. Tests move with the code

The 39 celebration specs move into `libs/celebrations/src/**/tests` with imports re-pointed; mocks of `useBreakpoint`, `AppConfigContext`, `NotificationContext`, `react-i18next` and the class-name libs become provider props in a shared test render helper. The app keeps a `CelebrationHost` spec (gating, reset, labels mapping, notify) and its existing Logo/composer tests.

## Risks / Trade-offs

- [Big-bang move breaks the working app mid-way] → migrate in slices behind the lib alias: scaffold + runtime first with the app adapter, then shared helpers, New Year, Halloween scene groups; the app builds and tests pass after each slice.
- [Uncommitted Halloween work and the active `add-halloween-secret-scenes` change touch the same files] → land/rebase them before slice 2; the move is file-for-file so rebases stay mechanical.
- [Vite lib mode + multiple entries produce CSS order differences] → single `index.css` (no code split); add `vite-verify-published-styles` markers for a Halloween and a New Year class.
- [Storybook adds heavy dev dependencies and CI time] → dev-only, one project, cached by Nx; build job only when the lib is affected.
- [Timing-heavy scenes are hard to review in Storybook] → story-only timing override for decor behaviours; scene stories replay on demand.
- [Public API is now a contract] → keep internal context/helpers unexported; README documents only exported names; semver via the existing release flow.

## Migration Plan

1. Scaffold lib (manifest, configs, tsconfig refs, alias in `apps/chat/vite.config.mts`, `tsconfig.app.json` reference, `tsconfig.base.json` subpath).
2. Move runtime + shared helpers, add props API, add `CelebrationHost`; app switches imports. Verify.
3. Move New Year entry. Verify.
4. Move Halloween (decor, then scene groups), replace anchors/labels/isMobile, split corner-spider behaviours. Verify.
5. Selection logic + tests. 6. Storybook + stories + coverage test + CI job. 7. Docs, install matrix, publish dry run.

Rollback: revert the change; nothing persists and no published consumer exists yet. A bad published version can be deprecated on npm.

## Open Questions

- Package name `@epam/ai-dial-celebrations` and dir `libs/celebrations` — assumed; confirm before publishing.
- Should DIAL Chat later expose scene selection through config (e.g. `UI_EVENT_SCENES`)? Out of scope here.
