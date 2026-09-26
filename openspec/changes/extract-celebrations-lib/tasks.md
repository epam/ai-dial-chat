## 0. Strategy and prerequisites

Strategy: **vertical slices behind a working app**. Slice 1 creates the lib and moves the runtime with a working app adapter; each later slice moves one event (New Year, then Halloween in groups) end to end, so `apps/chat` builds and its celebration behaviour is unchanged after every slice. Selection, Storybook and publishing widen the finished lib. Files move as-is (git mv) with only the edits the slice needs; relative code imports stay extensionless; the lib keeps `moduleResolution: "bundler"`. No drive-by refactors outside the moved files.

Architecture guard (applies to every slice touching `libs/celebrations/**`): the lib must not import `react-i18next`, a router, `apps/*`, app contexts, env/config, storage, network, feature flags, analytics, host routes, or any workspace lib other than the peers `@epam/ai-dial-chat-shared` / `@epam/ai-dial-ui-kit`. Host knowledge enters only through `CelebrationProvider` props.

- [x] 0.1 Land or rebase the uncommitted Halloween work and the active `add-halloween-secret-scenes` change before slice 3 moves `apps/chat/src/components/Halloween/**`.
  - Verification: `git status` shows no uncommitted files under `apps/chat/src/{components/Halloween,utils,constants,types}` related to celebrations.

## 1. Slice 1 — library scaffold and runtime with the DIAL Chat adapter

- [x] 1.1 Create `libs/celebrations` modelled on `libs/starter-buttons`: `package.json` (`@epam/ai-dial-celebrations`, description, `Apache-2.0`, `type: module`, `private: true`, `0.0.1`, exports `./package.json`, `./styles.css`, `.`, `./halloween`, `./new-year` each with the `@epam/source` condition; `dependencies: { "react-error-boundary": <workspace range> }`; peers `react`, `react-dom`, `@epam/ai-dial-chat-shared`, `@epam/ai-dial-ui-kit` at workspace ranges; `nx.tags: ["publishable"]` + the shared `publish` target), `vite.config.mts` (multi-entry `index`/`halloween`/`new-year` as in `libs/chat-hooks/vite.config.mts`, externals for peers, `createLibTailwindUtilities`, `dts`, CSS not split), `tsconfig.json`/`tsconfig.lib.json`/`tsconfig.spec.json` (reference `../chat-shared/tsconfig.lib.json`), `eslint.config.mjs` with `@nx/dependency-checks`, `tailwind.config.js`, `postcss.config.js`, `src/test-setup.ts`, `src/vite-env.d.ts`, placeholder `src/halloween/index.ts` and `src/new-year/index.ts`.
  - Verification: `npm exec nx build @epam/ai-dial-celebrations`; `npm exec nx lint @epam/ai-dial-celebrations`.
- [x] 1.2 Register the lib for the app: `tsconfig.base.json` subpath `"@epam/ai-dial-celebrations/*"`, `apps/chat/vite.config.mts` aliases for `.`, `/halloween`, `/new-year`, and a reference in `apps/chat/tsconfig.app.json`.
  - Verification: `npm exec nx typecheck chat`.
- [x] 1.3 Move the runtime into the lib: `context/CelebrationContext.tsx` → `libs/celebrations/src/context/CelebrationContext.tsx`, `types/celebration.ts` → `src/models/celebration.ts`, `utils/celebration.ts` → `src/utils/celebration.ts`, `hooks/celebration/useReducedMotion.ts` → `src/hooks/useReducedMotion.ts`, `components/CelebrationDecor` → `src/components/CelebrationDecor`. Replace host couplings with the provider props from design D2 (`events`, `activeEventId`, `resetKey`, `labels`, `onNotify`, `isMobile`, `anchors`, `selection` accepted but not yet applied, `portalContainer`); add the internal `CelebrationEnvironmentContext`; replace `notificationKey`/`notificationTitleKey` with label ids and `{{phrase}}` interpolation (D4); memoize the context value and resolved labels. Add `src/constants/public-class-names.ts` (`CELEBRATIONS_CLASS`: `decor`, `trigger`, `sceneLayer`) and `src/index.ts` barrel exporting the provider, hook, decor, class record and every type reachable from props.
  - Verification: `npm run test:file -- libs/celebrations/src/context/tests/CelebrationContext.spec.tsx`; `npm run test:file -- libs/celebrations/src/utils/tests/celebration.spec.ts`.
- [x] 1.4 Move `context/tests/CelebrationContext.spec.tsx` and `CelebrationRuntime.spec.tsx` into the lib, replacing mocks of `AppConfigContext`, `NotificationContext`, `react-i18next` and the router with provider props; add tests for `resetKey` cancellation, `activeEventId: null`, label merge/interpolation and the inert hook outside the provider.
  - Verification: `npm run test:file -- libs/celebrations/src/context/tests/CelebrationRuntime.spec.tsx` plus the files from 1.3.
- [x] 1.5 Add `apps/chat/src/context/CelebrationHost.tsx` (design D8): resolves `activeEventId` (ready config + `ROUTES.Root`), `resetKey` (`location.key`), labels from `t()` with the existing `HalloweenI18nKeys`/`NewYearI18nKeys`, `onNotify` → `showSuccessNotification`, `isMobile` via `useIsMobile`, anchors from `CONVERSATION_INPUT_CLASS`, `STARTER_BUTTONS_CLASS`, the app's `celebration-history` class and `a[href^="${ROUTES.Conversations}/"]`; all memoized. Keep the event loaders pointing at the still-in-app event modules via `apps/chat/src/celebrations/registry.ts` for now. Swap it into `apps/chat/src/main.tsx`; switch `NewConversationComposer.tsx`, `Header/Logo.tsx`, `Navigation/Navigation.tsx` to import from `@epam/ai-dial-celebrations`.
  - Verification: `npm run test:file -- apps/chat/src/context/tests/CelebrationHost.spec.tsx` (new: gating off `/` and before ready, reset on navigation, label mapping, notify forwarding); `npm run test:file -- apps/chat/src/components/Header/tests/Logo.spec.tsx`.
- [x] 1.6 Architecture guard for slice 1: confirm `libs/celebrations/src` has no forbidden imports (see Strategy) and `apps/chat/src/context/CelebrationContext.tsx` no longer exists.
  - Verification: `npm exec nx lint @epam/ai-dial-celebrations`; `npm run verify:changed`.

## 2. Slice 2 — shared helpers and the New Year entry

- [x] 2.1 Move `utils/celebration-snapshots.ts`, `utils/flying-characters.ts`, `utils/celebration-history.ts` and `components/FlyingCharacters/*` into `libs/celebrations/src/shared/`; change `celebration-history` to read `historyContainer` + `historyRowLink` from anchors (design D5).
  - Verification: `npm run test:file -- libs/celebrations/src/shared/tests/FlyingCharacters.spec.tsx` and the moved helper specs.
- [x] 2.2 Move `components/NewYear/*`, `celebrations/new-year.ts` and `assets/new-year-logo.svg` into `libs/celebrations/src/new-year/`; export `newYearEvent` (default + named), `NewYearScene`, `NEW_YEAR_LABELS` (text equal to `en.json`), `NewYearLabels`; replace `useIsMobile`, i18n keys and `GhostIconButton` label with environment context values. Point the adapter's `new-year` loader at `@epam/ai-dial-celebrations/new-year`.
  - Verification: `npm run test:file -- libs/celebrations/src/new-year/tests/NewYear.spec.tsx`; `npm run test:file -- apps/chat/src/context/tests/CelebrationHost.spec.tsx`; `npm run verify:changed`.

## 3. Slice 3 — Halloween entry

- [x] 3.1 Move `celebrations/halloween.tsx`, `types/halloween.ts`, `constants/halloween.ts`, `assets/halloween-logo.svg`, `utils/halloween.ts` and the decor (`HalloweenDecor`, `HalloweenPumpkin`, `HalloweenPumpkinSilk`, `HalloweenCornerSpider`, `HalloweenSpider`, `Halloween.module.scss`) into `libs/celebrations/src/halloween/`; rename the public enum to `HalloweenScene`; add `HalloweenDecorBehavior`, `HALLOWEEN_LABELS`, `HalloweenLabels`; pumpkin label from the environment context; delete `loadHalloweenAnchorClasses` and dead `isHalloweenSecretPhrase`. Point the adapter's `halloween` loader at the lib and delete `apps/chat/src/celebrations/`.
  - Verification: `npm run test:file -- libs/celebrations/src/halloween/tests/HalloweenDecor.spec.tsx`.
- [x] 3.2 Move the interface-borrowing scenes (Ghosts, Bats, Cat, Ravens, Web, Portal, SpiderTheft, Mummy) with their `utils/halloween-*-{plan,targets,animation}.ts`, SCSS modules and specs; replace `useIsMobile` and direct `@epam/ai-dial-conversation-input` imports with environment `isMobile`/`anchors`; welcome region from `anchors.welcomeRegion`.
  - Verification: `npm run test:file --` each moved spec, starting with `libs/celebrations/src/halloween/tests/HalloweenGhosts.spec.tsx`, `HalloweenCatScene.spec.tsx`, `HalloweenRavens.spec.tsx`, `HalloweenBats.spec.tsx`.
- [x] 3.3 Move the remaining scenes (Train/TrainArtwork, Extras: Candy/Footprints/Skeletons, NightFlight, Secrets/Cauldron, Mimic, Bowling, BurstOverlay) with their utils, SCSS and specs; expose the train soundtrack URL as a Halloween event option instead of the `HALLOWEEN_TRAIN_AUDIO_SRC` constant.
  - Verification: `npm run test:file --` each moved spec, including `libs/celebrations/src/halloween/tests/HalloweenExtras.spec.tsx` and `HalloweenTrain.spec.tsx`; `npm run verify:changed`.
- [x] 3.4 Architecture guard for slice 3: `apps/chat/src` contains no `Halloween`, `NewYear`, `FlyingCharacters`, `celebration-*`, `halloween*` or `flying-characters` files beyond the adapter and i18n keys; the lib has no forbidden imports.
  - Verification: `npm exec nx lint @epam/ai-dial-celebrations`; `npm exec nx typecheck chat`.

## 4. Slice 4 — scene and decor selection

- [x] 4.1 Implement design D3 in `libs/celebrations/src/context/CelebrationContext.tsx`: memoized per-event click/secret pools and enabled behaviours from `selection` (`enabledScenes`, `disabledScenes`, `disabledDecorBehaviors`, `isSecretEnabled`), `celebrate` ignoring disabled ids, secret consumption rules, unknown ids ignored; internal `useDecorBehavior`.
  - Verification: `npm run test:file -- libs/celebrations/src/context/tests/CelebrationSelection.spec.tsx` (new: disabled scene never plays, allow-list only, empty click pool inert, secret disabled/empty pool sends normally, unknown ids ignored).
- [x] 4.2 Gate each `HalloweenCornerSpider` behaviour (flee, drop, drum, wrap) so a disabled one installs no timer or listener; the behaviours stay in one effect because they coordinate (drops yield to the wrap, activity aborts it).
  - Verification: `npm run test:file -- libs/celebrations/src/halloween/tests/HalloweenDecor.spec.tsx` (new cases per disabled behaviour); `npm run verify:changed`.

## 5. Slice 5 — Storybook

- [ ] 5.1 Run `npm exec nx g @nx/storybook:configuration @epam/ai-dial-celebrations --uiFramework=@storybook/react-vite` (check `--help` first); keep generated files under `libs/celebrations/.storybook`; exclude `*.stories.tsx` from `tsconfig.lib.json`; import `../src/**/*.module.scss` styles through the lib entry.
  - Verification: `npm exec nx build-storybook @epam/ai-dial-celebrations`.
- [ ] 5.2 Add story helpers in `libs/celebrations/src/stories/`: `StoryHostPage` (composer, starter list, history panel with links, welcome region, decor area; anchors passed through props), `ScenePlayer` (provider with synchronous loader, Play control, `isMobile`/`dir`/reduced-motion args) and a story-only timing override for decor behaviours.
  - Verification: `npm exec nx build-storybook @epam/ai-dial-celebrations`.
- [ ] 5.3 Add stories: one per `HalloweenScene` (16) and `NewYearScene` (3) with `parameters.celebrationScene`, `Halloween/Decor`, one per `HalloweenDecorBehavior` with `parameters.celebrationBehavior`, `NewYear/Decor`, and a `Playground` with selection controls.
  - Verification: `npm exec nx build-storybook @epam/ai-dial-celebrations`.
- [ ] 5.4 Add `libs/celebrations/src/stories/tests/story-coverage.spec.ts` asserting every scene and decor-behaviour member has a story.
  - Verification: `npm run test:file -- libs/celebrations/src/stories/tests/story-coverage.spec.ts`.
- [ ] 5.5 Add a `build_celebrations_storybook` job to `.github/workflows/pr.yml` running `npm exec nx build-storybook @epam/ai-dial-celebrations` (no deploy).
  - Verification: `npm run verify:changed`.

## 6. RTL and accessibility checks

- [ ] 6.1 No new UI is introduced; confirm moved decor keeps logical positioning (`start/end`, `rtl:` mirror on the web only) and scenes keep physical measured geometry. Add the `dir` arg to `ScenePlayer` and keep the existing RTL assertions in the moved specs (`HalloweenCatScene`, `HalloweenGhosts`, `HalloweenRavens`, `HalloweenDecor`) passing; add a guard test that `CELEBRATIONS_CLASS` classes render on the decor root, trigger (found by its accessible name) and scene layer.
  - Verification: `npm run test:file -- libs/celebrations/src/components/CelebrationDecor/tests/CelebrationDecor.spec.tsx` plus the four specs named above.

## 7. i18n

- [ ] 7.1 No new user-visible strings: `apps/chat/src/i18n/locales/en.json` and `translation-keys.ts` stay unchanged; add a test in `apps/chat/src/context/tests/CelebrationHost.spec.tsx` that every `HalloweenLabels`/`NewYearLabels` field is mapped from an existing key, and in the lib that `HALLOWEEN_LABELS`/`NEW_YEAR_LABELS` equal today's English text.
  - Verification: `npm run test:file -- apps/chat/src/context/tests/CelebrationHost.spec.tsx`.

## 8. Publishing and documentation

- [ ] 8.1 Write `libs/celebrations/README.md` (H1 package name, Overview, Installation + `import '@epam/ai-dial-celebrations/styles.css';`, Peer Dependencies, Components/Hooks/Events/Enums/Types sections with compiling examples of D2, selection and anchors, public class table).
  - Verification: `npm run validate:docs`.
- [ ] 8.2 Update `docs/architecture.md` (libraries table and count; celebration mechanism now in the lib; `CelebrationContext` row → `CelebrationHost` adapter), root `README.md` libraries table, `apps/chat/README.md` celebration section (points to the lib), and run `npm run docs:install-matrix` (add a scenario in `scripts/generate-install-matrix.mjs` if the lib is a new host scenario).
  - Verification: `npm run validate:docs`.
- [ ] 8.3 Add `tools/vite-verify-published-styles.mjs` markers for one Halloween and one New Year class to the lib's Vite config; run the publish dry run.
  - Verification: `npm exec nx build @epam/ai-dial-celebrations`; `npm run publish:dry` lists `@epam/ai-dial-celebrations` with every export target present.

## 9. Final verification

- [ ] 9.1 Run strict OpenSpec validation, `npm run validate:docs`, `npm run build:quiet` (bundling changed) and exactly one `npm run verify:full`; record results below. Leave the change active for archive approval.
  - Verification: `openspec validate extract-celebrations-lib --strict`; the commands above.

## 10. Follow-ups (out of scope)

- [ ] 10.1 Decide whether DIAL Chat should expose scene selection through config (e.g. a `UI_EVENT_SCENES` env var mapped by `apps/chat-api`).
- [ ] 10.2 Consider promoting the lib-local Storybook setup to a workspace-wide one for other libs.

## Verification record

Pending.
