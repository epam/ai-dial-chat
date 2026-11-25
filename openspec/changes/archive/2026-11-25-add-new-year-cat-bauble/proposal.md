## Why

### Problem

The user asked for a New Year scene with a cat. The New Year gift pool has a penguin, a snowman and an elf, but no animal whose personality comes from timing: anticipation, a miss, displacement grooming, fright and pride. The Halloween cat (`libs/celebrations/src/halloween/utils/halloween-cat-plan.ts`) methodically pushes buttons off the composer. A New Year cat has to tell a different story, not reskin that one.

### Solution

Add `NewYearScene.CatBauble` ("The bauble"), a bundled New Year scene in the gift click pool:

1. A grey tabby cat with a bell collar trots along the composer's upper rim toward a small drawn fir standing at the rim's far end. One of the fir's hooks is empty.
2. Its pupils widen, it crouches, wiggles its rear and pounces at the lowest bauble. The bauble swings away, the cat misses, lands and grooms a paw as if nothing happened.
3. It notices the composer's model selector, lies on the rim and hooks an inert visual copy of the selector up onto the rim with a stretched paw. Then it swats the copy, which slides along the rim into the fir's trunk.
4. The fir shakes and leans toward the cat. The cat freezes, ears flat, tail puffed. The fir straightens, and the copy has landed on the empty hook, hanging like a new ornament.
5. The cat admires it, rears up, takes it in its mouth, carries it back and drops it exactly into its slot. Then it curls up beside it, stretches and leaves.

Without an eligible selector, a drawn tangerine plays the same part. Without a composer that leaves room for the story, a static still shows instead.

The scene follows the elf fireworks pattern (`libs/celebrations/src/new-year/utils/elf-fireworks-animation.ts`, `elf-fireworks-targets.ts`, `elf-fireworks-composition.ts`). One scene-local native Lottie SVG composition carries the cat, fir and tangerine. One WAAPI snapshot track for the selector copy is generated from the same plan and started on the Lottie clock through `onPlaybackStarted`. The selector eligibility checks follow the penguin's model-selector checks (`libs/celebrations/src/new-year/utils/penguin-star-targets.ts`).

### Alternatives

- **Reuse the Halloween cat rig and plan.** Rejected: it is a CSS/WAAPI scene with a different story and a halloween-specific silhouette. Copying its plan would repeat the button-pushing story.
- **Borrow a starter card instead of the selector.** Rejected: the snowman already borrows a starter card, a card is too wide to read as an ornament, and starters may be hidden or sit below the composer.
- **Pure CSS/WAAPI cat.** Rejected: an articulated cat (spine lean, tail, ears, pupils, a stretching leg) with a fir pendulum on one clock is exactly what the scene-local Lottie timeline is for in this module.

### Non-goals

- No new anchor, trigger or `CelebrationAnchors` field: `composer` and `composerModelSelector` already exist.
- No change to the shared Lottie session, snapshot helper or other scenes.
- No live user control during playback, no sound, and no secret-phrase change: the cat joins the gift click pool only.
- No external pack or Themes delivery.

### Acceptance criteria

- A gift click can pick `cat-bauble`, which plays the full story on desktop and mobile in LTR and RTL, with the paw, mouth and fir contacts proven by probe tests.
- The selector copy returns to its exact rect and the original is restored on completion and on any interruption. The real control is never clicked, focused or reparented, and drafts survive.
- Reduced motion, missing APIs and player failure show the static still without loading the player.
- The structural budgets in the spec hold in unit tests. A browser check in Storybook covers desktop, mobile, RTL, reduced motion and interruption, and replay leaves no copies, layers or timers.
- `newYear.catBaubleToastMessage` is translated in DIAL Chat, and the README and specs describe the scene.

### Rollback

The change is additive. Reverting it removes the enum member, the label and the scene. Hosts that list `cat-bauble` in their disabled scenes keep working, because unknown ids are ignored.

## What Changes

- Add `NewYearScene.CatBauble = 'cat-bauble'` and the `CatBaubleMode` enum (`Selector`, `Tangerine`, `Static`) in `libs/celebrations/src/new-year/types/new-year.ts`.
- Add scene modules under `libs/celebrations/src/new-year/`: `utils/cat-bauble-targets.ts`, `utils/cat-bauble-art.ts`, `utils/cat-bauble-composition.ts`, `utils/cat-bauble-animation.ts`, `components/NewYearCatBauble/NewYearCatBauble.tsx` and `components/NewYearCatBauble/CatBaubleStill.tsx`, with tests.
- Register the scene in `NewYearSceneOverlay`, `NEW_YEAR_SCENE_DURATIONS` (`CAT_BAUBLE_MS + 2500`) and `NEW_YEAR_CLICK_SCENES`. Add the `catBaubleToastMessage` label with an English default.
- In DIAL Chat, add `NewYearI18nKeys.CatBaubleToastMessage` and `newYear.catBaubleToastMessage` in `apps/chat/src/i18n/locales/en.json`.
- Add Storybook stories (default, mobile, RTL, reduced motion, interruption), and update the `libs/celebrations/README.md` scenes section and `NewYearScene` list.

## Capabilities

### New Capabilities

- `new-year-cat-bauble`: the cat-and-bauble story, its targets and fallbacks, synchronized selector copy, cleanup, adaptations and budgets.

### Modified Capabilities

- `celebration-events`: the New Year scene list, gift click pool, deadlines and labels gain `cat-bauble`. They also catch up with the already-shipped `elf-fireworks`, which the spec still omits.

## Impact

- **Code:** `libs/celebrations` (New Year entry only, lazy-loaded as before), plus i18n keys in `apps/chat`.
- **Lib isolation:** the host still supplies anchors and translated labels through `CelebrationHost`. The lib reads only the class names it is given, and adds no routes, i18n, app contexts or storage.
- **i18n:** one new user-visible string, `newYear.catBaubleToastMessage`.
- **Bundle:** the new code lives in the lazily imported `./new-year` entry. The player is the existing light Lottie player, loaded only for animated playback.
- **No** API, persistence, feature-flag, telemetry or cache changes.
