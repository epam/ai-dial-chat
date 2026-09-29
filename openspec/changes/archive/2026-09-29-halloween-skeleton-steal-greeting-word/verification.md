## Automated

- `halloween-skeleton-plan.spec.ts` (21): with a reachable word the plan has 22 tracks (≤ 80 keyframes), adds the heading to observed anchors, grabs at the hide time, reproduces the partner's hand from emitted root/body/arm keyframes for every 50 ms hold sample and keeps the copy's centre on it; the copy starts and ends exactly over the original box; RTL mirrors the word position; words below the stage, out of reach or outside the band, and composer-less hosts keep the previous ending.
- `halloween-skeleton-targets.spec.ts`: takes the last word ("Valery" across `<b>Valery</b>!`, "evening" without a name) without changing the heading; skips without the Highlight API or a visible heading.
- `halloween-skeleton-animation.spec.ts`: the highlight appears only at the grab and disappears when the copy lands; keydown and a heading text change remove it immediately; heading DOM unchanged; all tracks and timers released.
- `HalloweenSkeletons.spec.tsx`: word copy text, computed font and colour; the copied text counter-mirrors in RTL.

## Browser (Storybook, headless Chromium, `tmp/skeletons-lost-skull/theft-*`)

- Natural playback at 1280 LTR/RTL: highlight absent at 10.3 s, present at 10.75/11.0 s ("Good ___!" with the partner carrying "evening"), absent again at 11.6 s. RTL copy text is not mirrored.
- Defect found and fixed: the dangling word covered the partner's face → arm lowers forward after the grab (−12°).
- 360 px with starters between the greeting and the composer: the word is ~128 px above the reach limit and the previous ending plays, as designed.

## Chat-layout regression

- Reported: no theft in the integrated chat. Cause: the chat's greeting sits right above the composer, below the raised-arm reach, so the fixed −75° solve produced a negative jump and was rejected (Storybook's default layout put starters between them, hiding the case).
- Fix: solve the arm angle for a small hop when the word is within standing reach. New plan tests for desktop/mobile with the heading 36px above the composer (failed before, pass now).
- Storybook with `startersBelowComposer` (chat order): theft plays at 1280 LTR/RTL and 360; highlight present at 10.75/11.0 s, removed at 11.6 s.

## Limits

- The Storybook greeting has no name, so only the "evening" fallback was seen in a browser; the name path is covered by unit tests. No real `apps/chat` run.
- Frames were captured through CDP (see the parent change's note on `page.screenshot`).
