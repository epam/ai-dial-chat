# Verification: new-year-snowman-delivery

Branch `feat/new-year-snowman-delivery`, based on `development` at `4d49f75f3`.
Unit-test results and browser observations are reported separately: a passing
unit test is not evidence of believable motion or smooth rendering.

## Automated checks

| Command | Result |
| --- | --- |
| `npm exec nx run-many -t lint,test,typecheck -p @epam/ai-dial-celebrations --skip-nx-cache` | Pass: 72 files, 1306 tests; lint 0 errors (221 warnings, the same as before this change) |
| `npm exec nx run-many -t test,build -p @epam/chat` (part of the combined run) | Tests pass: 273 files, 3983 tests |
| `npm exec nx typecheck @epam/chat` | **Fails, pre-existing on `development`:** `ConversationRoute.url-preselection.spec.tsx` builds a `UserConfigDto` without the `projects` field that #9628 made required; #9627 added that spec. This change touches neither file. |
| `npx tsc -p libs/celebrations/tsconfig.storybook.json --noEmit` | Pass (stories) |
| `npm exec nx build @epam/ai-dial-celebrations` | Pass |
| `npm run validate:docs` | Pass |
| `scripts/validate-spec-references.mjs` (Node 24) | 0 errors |
| `openspec validate new-year-snowman-delivery --strict` | Valid |

**Unit coverage.** The new tests cover:

- **Session callback:** `onPlaybackStarted` is called once on the first frame with the frame-0 time; it is never called after cancellation; a throw makes the session fail; an adapter without the callback adds no listener.
- **Staging:** every mode, every excluded card state, scan bounds and travel bounds.
- **Plan, per scenario** (desktop 1280 and 1920 RTL Ledge, mobile 360 and 900 RTL Ledge, RimSled, Platform):
  - beat order;
  - sled stop → body compression on the next frame → head separation three frames later;
  - head speed within ±20 % of the sled;
  - branch flex before the release;
  - catch between the mittens;
  - grips ≤1.5 px at 60 fps;
  - planted feet ≤0.5 units;
  - card identity before the restore;
  - exit;
  - no zero-scale interpolation;
  - every structural budget.
- **Component:** every interrupt event, a companion-reported interruption, the fallbacks, and five activate/cancel runs.

## Budgets: proposed limits and measured values

| Budget | Limit | Measured |
| --- | --- | --- |
| Serialized composition | ≤170 KB | about 135–152 KB depending on geometry (tests) |
| Top-level layers | ≤16 | 9 to 10 (plus the snowman precomposition's 11 layers) |
| Animated properties | ≤56 desktop / ≤48 mobile | 50 desktop |
| Keys per property / total | ≤128 / ≤1,300 (revised from 96 / 1,200, see design D10) | longest 106–114, total about 1,130–1,210 |
| Card WAAPI keyframes | ≤48 | 35 to 41 |
| Grip drift (sled and present) | ≤1.5 px | ≤1.31 px |
| Generated SVG descendants / paths (browser) | ≤360 / ≤150 desktop, ≤320 / ≤130 mobile | 265 / 122 desktop, 247 / 113 mobile |
| Scene code, gzip, without `lottie_light` | ≤35 KB | ≤19.5 KB. This is an upper bound: an esbuild bundle of the scene that also inlines the shared session, snapshot and observer helpers it imports. The whole `new-year.js` entry is 40.2 KB gzip. |

## Browser review (Storybook, headless Chromium via Playwright)

**How the frames were taken.** The frames were taken with CDP
`Page.captureScreenshot`. Playwright's own `page.screenshot` resizes the
viewport, and the scene correctly cancels on `resize`. Each capture also lags
100–300 ms behind its label, so frame labels are approximate.

**Desktop 1280×900, starters below the composer (Ledge).** Observed in order:

1. He enters with the present.
2. He looks up and balances the present on his head.
3. He jumps, hangs on the card and drops with the copy.
4. He lowers it and it drops onto the snow.
5. He tests it with a foot, sits and glides.
6. The sled noses up in the snowbank and the head flies into the bough.
7. He delivers the present with a bow.
8. He catches the head and puts it on backwards (the carrot points behind him), then corrects it.
9. He carries the card back and jumps it into its exact slot (the original "Tell me a riddle" returns).
10. He leaves holding his head, and the decor fades.

**Ride length.** After review the ride was lengthened: the longest ride that fits is now chosen (it used to start from the minimum), with a maximum of 460 px on desktop and 220 px on mobile. On the 1280×900 Ledge story the sled now travels about 450 px.

**Ledge with his head clear of the row.** Seated, his head clears the starter
row. This was confirmed after moving the ledge down: an earlier build covered
"Write a poem" and "Plan my evening".

**The other variants.**

| Variant | Mode | Observation |
| --- | --- | --- |
| RTL 1280×900 | Ledge | Mirrored travel, tree on the left, copied card text unmirrored |
| Mobile 390×844 (Storybook fixture) | Platform | Complete story with a drawn sled planted upright; one snowman |
| Starters above the composer | Platform | The starter row overlaps the band above the composer, as designed |
| No starters | Platform | The greeting sits directly above the composer and blocks the rim band |
| Unsuitable geometry | Static still | No player loaded |

**Profiles** (CDP `Performance.getMetrics` plus in-page `requestAnimationFrame`
and long-task observers, over the full 25 s run):

| Run | Frame intervals p50 / p99 / max | Frames > 33 ms | Long tasks | Script / style / layout time |
| --- | --- | --- | --- | --- |
| Desktop | 8.3 / 9.3 / 9.5 ms (120 Hz headless) | 0 | 0 | 0.62 / 0.47 / 0.12 s |
| Mobile, 4× CPU throttle | 8.3 / 9.3 / 9.4 ms | 0 | 0 | 0.40 / 0.26 / 0.13 s |

The layout counts come from the SVG renderer's own updates. The scene performs
no per-frame host reads: geometry is measured once at preparation, and
observers react only to events.

**Resource accumulation.** Five activate → interrupt cycles were run, one per
event: `pointerdown`, `scroll`, `resize`, `keydown`, and a hidden
`visibilitychange`.

- During each run: one card copy, with the original's opacity at 0.
- After each run: 217 nodes, 0 animations, 0 copies, the original's opacity at 1, and 20 `window` / 7 `document` listeners. All of these equal the baseline.

## Limits of this verification

- **Card–Lottie skew.** The skew was not measured numerically. In the contact
  frames (grip, hang, lower, return, slot) the mittens are on the card copy.
  By design the skew is bounded by one animation frame (D6).
- **Headless rendering.** Frame timing comes from headless Chromium, not a
  physical mobile device. Paint time is not separated from the metrics above.
- **Artwork review.** The artwork was reviewed at actual size on the
  Storybook's light surface only. A dark-surface review is still to do.
- **Mobile fixture.** The mobile Storybook fixture used 44 px buttons, which
  were then above the ledge height limit (56 units). The limit was raised to
  66 units afterwards, so the mobile Ledge path is covered by unit tests but
  was not re-captured in the browser.
