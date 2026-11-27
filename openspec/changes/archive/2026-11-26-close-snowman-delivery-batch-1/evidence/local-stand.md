# Local-stand recordings and rollback (archived batch 1 task 7.1)

Run on 2026-11-26 between 17:24 and 18:15 UTC, on a **local stand, not a deployed environment** (issue owner, 2026-11-26). A run in a deployed environment remains an S8 (#9227) item.

## Stand

| Part | Value |
| --- | --- |
| Chat | `development` at `22a7d662e` (contains the batch 1 merge `2c6a8a83f`). Frontend from `nx serve chat` on `http://localhost:4207`; `chat-api` from its `dist/main.js` built from the same commit, on port 5000 |
| Themes | the clean `../ai-dial-chat-themes` working tree at `57643b3`, `static/` served on `http://localhost:8090`. Its `static/celebrations/index.json` is the one of `900b19a` (revision `2026-11-25.3`, `defaults.new-year` = `new-year-default@1.5.1`); `GET /api/v1/celebrations` returned that revision |
| Browser | Playwright Chromium, headed, 1920 × 1080 viewport, LTR, English, persistent profile signed in by the issue owner |
| Managed configuration | active, Config Studio revision `20261125T123352838Z-f001889489b23846` (published 2026-11-25). Its `ui.celebrationDelivery.externalScenes` lists only `santa-history-delivery`, `polar-bears-workshop`, `bullfinch-couriers` and `snow-circus`, so the stand set the delivery policy through environment variables, which win over managed values |

Delivery policy as served by `GET /api/v1/client-config`:

| Phase | `UI_EVENT_DELIVERY_MODE` | `UI_EVENT_DELIVERY_REVISION` | `UI_EVENT_EXTERNAL_SCENES` |
| --- | --- | --- | --- |
| Recordings and rollback start | `prefer-external` | `1` | `gift-wrapping`, `snowman-delivery`, `santa-history-delivery`, `snow-circus`, `bullfinch-couriers`, `polar-bears-workshop` (all `new-year/`) |
| After rollback | `prefer-external` | `2` | the same without `snowman-delivery` |
| Section recording (platform) | `prefer-external` | `3` | all six again |

`UI_EVENT=new-year` throughout. The local `apps/chat-api/.env.local` was restored from its backup after the run.

## Deviations from design D2–D4

1. **Rollback through environment variables and a `chat-api` restart, not Config Studio** (issue owner's choice, 2026-11-26), because the published managed configuration did not list `snowman-delivery`. A script (`rollback.sh`) rewrote the two variables and restarted `chat-api` during playback.
2. **The open tab's refresh was triggered by a window `focus` event, not by hiding the tab.** Hiding the tab fires `visibilitychange`, which `useComposerInterrupts` treats as an interrupt, so the scene would stop for that reason alone. `focus` is one of `useClientConfigRefresh`'s triggers and is not an interrupt.
3. **Frames were captured through the DevTools protocol** (`Page.captureScreenshot`). Playwright's `page.screenshot()` re-applies the emulated viewport, which the anchored scene treats as a resize and cancels on: in attempts 2–3 every external SnowmanDelivery stopped within 3–6 s of the first screenshot. This is the failure the portfolio scenario "Frames of an anchored scene on mobile" describes, and it applies on desktop too. Attempts 1–4 are discarded for that reason and for the issues below; only attempt 5 and the two follow-up runs count.
4. **`rim` was not reached.** On the start page the adapter chose `ledge-card` whenever the starter row was present. With the starter row hidden by a stylesheet rule (`.dial-starter-buttons-root { display: none }`, standing in for a model without starters), it chose `platform`: the snowman rides the drawn sled on a floor below the composer, and no card is copied. The reason `rim` was not chosen was not established; the greeting above the composer may leave no clear band. A conversation view, where the composer has free space above it, shows no gift trigger, so it cannot start the scene. The issue owner accepted the `platform` recording in place of `rim` (2026-11-26); `rim` moves to the S8 list.

## Recordings

Not committed. Kept in the git-ignored `tmp/celebrations-evidence/close-snowman-delivery-batch-1/` together with the CDP frames, the run logs and the scripts (`run.mjs`, `post.mjs`, `rim.mjs`, `rollback.sh`).

| File | sha256 | Content |
| --- | --- | --- |
| `ledge-card.webm` | `4d95ce26cba6db191fbcb4df21511895d4683342d81ba0fa2faa284b59e20fc2` | Start page with three starters. External SnowmanDelivery on the 15th gift click (17:46:27 UTC), section `ledge-card`, full 25 s at normal speed. The snowman borrows "What can you do?"; the scene is still active at 24 s |
| `platform.webm` | `0433d56addf6b5f2b510a75c66cb7312582284e2e02ae3567e58f959ca3dbc5f` | Start page, starter row hidden. External SnowmanDelivery on the 13th gift click (18:14:32 UTC, revision `3`), section `platform` on the sled, no copied card, active at 24 s |
| `rollback.webm` | `dd6badaedcabe2df35a4b2e62aa978111ec99e9691e1928de6e6470394553144` | The rollback run below and the following clicks in the same tab. The recording process was stopped, not closed, so the file may lack its final index |
| `after-rollback.webm` | `8fe5920ca7cee33a4b537cca3204a48c64f3ecfee66cd1ee0dc461a9f0876c2b` | A fresh tab under revision `2`: the gift clicks and secret phrases listed below |

Each external activation requested `/api/v1/celebrations/assets/new-year-default-snowman-delivery-desktop-e102fb11b63505f4`, the 1.5.1 desktop variant whose hash equals the Chat fixture (`evidence/publication.md`).

## Rollback during a `ledge-card` playback

The external SnowmanDelivery started on the 4th gift click of a fresh tab at 17:52:30.34 UTC (revision `1`). Times are from the scene start:

| Time | Event |
| --- | --- |
| 0 s | external SnowmanDelivery starts; the snowman borrows the "What can you do?" starter |
| 9.1 s | `rollback.sh` starts: allowlist without `snowman-delivery`, revision `2`, `chat-api` restarted |
| 12.2 s | `chat-api` healthy again (the script took 3.1 s) |
| 16.0 s | window `focus` event; the tab requests `GET /api/v1/client-config` once |
| 16.1 s | the scene layer is gone: **the scene stopped 116 ms after the refreshed policy arrived**, about 9 s before its natural end |

**Check 1, card restored.** The CDP frame 0.8 s after the stop (`shots/rollback-after-stop.png`) shows all three starters in their slots, "What can you do?" first, and no scene. The frame at 9 s (`shots/rollback-0009s.png`) shows the snowman carrying the copy.

**Check 2, remaining pool and compiled SnowmanDelivery.**

- *Same tab.* 17 more activations followed in the tab, and none requested a SnowmanDelivery asset. External polar bears (`new-year-default-polar-bears-desktop-2dcdcf837b4415ea`) and bullfinch couriers (`new-year-default-bullfinch-couriers-desktop-1901d6be39a86042`) played there. The run identified scenes by their toast, which proved unreliable, so it could not tell a compiled SnowmanDelivery apart. It was stopped, and stopping it also ended the `chat-api` process `rollback.sh` had started, which was restarted with the same revision `2` environment.
- *Fresh tab under revision `2`*, scenes identified by their DOM. Gift clicks: penguin-star, elf-fireworks, bullfinch-couriers (external, asset requested), elf-fireworks, penguin-star, elf-fireworks, an unanchored pack scene, polar-bears-workshop (external, `data-composer-carry`, asset requested), penguin-star, polar-bears-workshop, an unanchored pack scene, polar-bears-workshop, cat-bauble. **The 14th click played the compiled SnowmanDelivery** (`data-new-year-scene="snowman-delivery"`), with no request for the external SnowmanDelivery asset (`shots/compiled-snowman.png`).

**Check 3, other external scenes stay external.** After the rollback, bullfinch couriers and polar bears loaded their pack assets in both tabs. The secret phrase `happy new year` played the compiled ReindeerTakeoff, then the **external GiftWrapping** (`new-year-default-gift-wrapping-desktop-28260bbcf8f593a6`, composer-anchored stage; `shots/external-gift-wrapping.png`). Santa and Snow Circus, the other two allowlisted secret scenes, were not drawn after the rollback, so they were not observed.

**Outcome:** the rollback meets "The external SnowmanDelivery is reversible on its own" and "Batches stay independently reversible" on this stand: the playing scene stopped as soon as the tab received revision `2`, the borrowed card was back in its slot, SnowmanDelivery then played compiled, and the other allowlisted external scenes stayed external.

## Still open for S8 (#9227)

- a `rim` section recording (deviation 4; `platform` was accepted in its place for batch 1)
- a run in a deployed environment with its real Chat, Themes index and delivery revisions
- rollback through managed configuration (Config Studio) during playback
- browser checks on mobile and desktop, LTR and RTL, every section, with contact, story and restoration asserted in the rendered page
- contact frames at grip, seat, impact, lodge, catch and slot
- profiles: rendering cost per frame and the SVG element count against the 800-element cap
- retention: heap and detached nodes after repeated plays and cancellations
- preparation p95 under CPU throttling
- long-task recovery of the copy and the Lottie clock
- a normal-speed parity review against the compiled scene by a reviewer (these recordings are evidence for that review, not the review itself)
- the pinned-player review of both published variants in lottie-web 5.13.0

## Published

Posted on #9226 on 2026-11-26 after the issue owner approved the draft: https://github.com/epam/ai-dial-chat/issues/9226#issuecomment-7200891051
