# Full Cat asset (task 5.1)

The asset was bootstrapped once by a throwaway script (design D10), which sits in the session scratchpad and is not committed. The reference geometry is the real `ConversationInput` at 1280 × 800: the model selector (875, 410, 56 × 36) and Send (933, 410, 40 × 40) as prizes, both on side +1, with no support. Its sources are:

- `buildCatPlan` with both buttons, for the two-prize story
- `buildCatPlan` with the model selector alone, for the one-prize story
- the CSS keyframes of the compiled crossing fallback

The Storybook fixture is `libs/celebrations/src/stories/fixtures/cat-borrow-full.lottie.json`. The published file is task 5.3.

| Measure | Value | v1 cap (amended) |
| --- | --- | --- |
| Published (minified) size | 215,778 B (210.7 KiB) | 512 KiB |
| Layers (root 2, rig 28) | 30 | 30 |
| Keyframes | 2,540 | 4,000 |
| Path vertices | 210 | 8,000 |
| Rig timeline | 2,751 frames at 60 fps (45.85 s) | — |
| Station replay error at segment boundaries | 0.08 px | — |
| Poster (static seated cat, SVG, 120 × 105) | 6,966 B | 100 KiB |

The spike's projection (about 3,200 keyframes and about 370 KiB) overestimated the result. The one-prize tail and the crossing are sparser than the spike's dense push segment.

## Sections (rig-local frames)

| Section | Frames | Content |
| --- | --- | --- |
| `two-prizes` | 0–1500 | The full 25 s two-button story. Its binds: `entry-edge`, `perch`, `prize-0`, `move` (the walk between the buttons), `prize-1`, `exit-edge`. `cat:branch:one-prize` is at 789 (release 0, 13.15 s) |
| `one-prize` | 1500–2211 | The one-button story from 13.15 s to 25 s: shuffle, rebound watch, recoil, two grooming bouts, departure. `cat:landing:0` has an elastic range of 8 s |
| `crossing` | 2211–2751 | The compiled 9 s CSS walk. The cat is offscreen until 2.2 s, crosses the bottom 39 px above the viewport edge by 6.8 s, at 120 px (cat-motion scale 85.7 %). Tail 1.8 s, legs 0.62 s and blink 4 s loops are sampled from the CSS keyframes |

Each section's last keyframe holds, so no interpolation blends one section into the next.

**Structure changes from the spike:**

- `cat-art` is merged into `cat-motion` (anchor (80, 120), scale 87.5 % × squash), to stay within 30 layers.
- The actor's fade-in (0–450 ms) and fade-out (24.35–24.95 s) sit on the `cat-rig` layer's opacity, on the composition clock that both story paths share.
- The new anchor `move` gives the walk between the buttons the measured walking direction (design D5, "Risks").

## Pinned-player review (Storybook `Packs/CatBorrowSpike`, Full* stories, 1280 × 800)

| Story | Result |
| --- | --- |
| `full-two-buttons` | Two copies. The model selector falls first, the cat walks to Send, Send falls and rebounds, then the cat recoils and leaves |
| `full-one-button` | Only `+` is borrowed (side −1, the cat is mirrored). After the fall the tail plays: rebound, recoil, grooming |
| `full-crossing` | No copy. The 120 px cat walks across the bottom |

**Recorded delta V8.** The compiled crossing moves in proportion to the viewport width (`translateX(±(100vw + 140px))`). The asset uses fixed offsets from the viewport edges instead (−60 px at 2.2 s, then W + 60 px at 6.8 s), so the cat stays visible for about 4.6 s at about the compiled speed (about 304 px/s at 1280 px against 315).

**Finding.** `nx run @epam/ai-dial-celebrations:build-storybook` served a cached build after a story edit. Run it with `--skip-nx-cache` before browser checks. The spike's measurements ran on fresh builds: each one contained the stories and the paw reference that had just been added.
