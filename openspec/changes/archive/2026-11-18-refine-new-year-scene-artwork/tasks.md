# Tasks

Slicing strategy: risk-first rendered artwork, then independent scene slices and coordinated pack integration. Existing contact/lifecycle tests are retained; add regression tests only for changed observable behavior. The user has authorized implementation after the visual audit.

## 1. Reindeer artwork slice

- [x] 1.1 Refine `reindeer-art.ts` and `ReindeerStill.tsx`, retaining existing motion/contact tracks within the original budgets; render braced/reach/flight poses at360/1280 and update the corresponding README description.
  Verification: compare against baseline audit; `npm run test:file -- libs/celebrations/src/new-year/utils/tests/reindeer-takeoff.spec.ts libs/celebrations/src/new-year/utils/tests/reindeer-physics.spec.ts libs/celebrations/src/new-year/components/NewYearReindeerTakeoff/tests/NewYearReindeerTakeoff.spec.tsx`; existing native hoof/nose probe with unchanged budgets.

## 2. Penguin and snowman artwork slices

- [x] 2.1 Refine `penguin-star-art.ts` and selected poses/fallback while preserving grips; compare capture/throw/bow on360/1280 and document the resulting design in README.
  Verification: `npm run test:file -- libs/celebrations/src/new-year/utils/tests/penguin-star.spec.ts libs/celebrations/src/new-year/components/NewYearPenguinStar/tests/NewYearPenguinStar.spec.tsx`; native flipper/star handoff probe.
- [x] 2.2 Refine `snowman-delivery-art.ts` and matching fallback; separate lodged face from needles without moving the branch socket; compare impact/catch/recovery and update README.
  Verification: `npm run test:file -- libs/celebrations/src/new-year/utils/tests/snowman-delivery.spec.ts libs/celebrations/src/new-year/components/NewYearSnowmanDelivery/tests/NewYearSnowmanDelivery.spec.tsx`; existing card/head geometry and budget checks.

## 3. Elf artwork and staging slice

- [x] 3.1 Refine `gift-wrapping-elves.json`, `GiftWrappingArt.tsx` and scene-local placement/poses; retain compact grips and visible reaction roles, render pull/reveal/departure and update README.
  Verification: `npm run test:file -- libs/celebrations/src/new-year/utils/tests/gift-wrapping.spec.ts libs/celebrations/src/new-year/components/NewYearGiftWrapping/tests/NewYearGiftWrapping.spec.tsx`; native ribbon/mitten probe with all existing limits.

## 4. Companion Themes artwork slice

- [x] 4.1 Prepare immutable pack1.1.1 with volume-preserving bullfinch facing changes and readable stage placement; update poster and companion release documentation, preserving all old assets.
  Verification: Themes publication validator/tests; current-frame-checked mobile/desktop images through production `LottieScene`, budget counts and turn-key inspection.
- [x] 4.2 Apply revised elf artwork and compatible placement to authored desktop/mobile JSON and poster; update hashed paths/bytes/digests/manifest and local default index without publishing.
  Verification: Themes validator/tests; same pull/reveal frames as compiled version, true composer anchor, RTL and missing-anchor fallback; old pack tree byte comparison.

## 5. Integration and verification

- [x] 5.1 Run native mobile360/900RTL and desktop1280/1920 captures, light/dark working poses and reduced-motion stills; verify contacts, cancellation/restoration and record browser cost. Keep the library isolated from app/API/env/storage/telemetry knowledge.
  Verification: scene browser harnesses and pack preview, before/after evidence and resource profiles in verification.md; disclose any unperformed continuous-motion assessment separately from observed frames.
- [x] 5.2 Complete five-axis review, spec/docs validation, one `npm run verify:changed`, one `npm run verify:full` and `npm run build:quiet`; fix relevant findings and summarize unrelated failures accurately.
  Verification: recorded command results and final diff review. Release deployment is outside this change.
