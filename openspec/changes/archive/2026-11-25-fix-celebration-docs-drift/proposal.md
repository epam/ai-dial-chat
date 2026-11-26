# Proposal

## Why

The S7 inventory (#9960) found celebration docs, specs and JSDoc that describe
behaviour the code does not have. Since then the New Year scene PRs (#9973, #9976,
#9983, #9990, #9998, #9996) have changed celebration docs again. Hosts and pack
authors copy these texts: a JSDoc that promises a page button or a spec that names
a class the library never reads sends them to the wrong place. Each item below was
re-checked on `development` at `b3e254229`.

## What Changes

Docs, specs and JSDoc only. No runtime behaviour, constant, test or asset changes.

- **`HalloweenScene` JSDoc** (`libs/celebrations/src/halloween/types/halloween.ts`).
  `Cat` still "follows drifting will-o'-the-wisps", but the scene is the
  gravity-testing story with a crossing cat as fallback (the wisp builder is never
  rendered). `Ghost` and `Bats` describe only their fallbacks. `Spiders` describes
  only the drop, not the theft. Rewrite each to name the story first and the
  fallback second.
- **`NewYearScene.ReindeerTakeoff` JSDoc**
  (`libs/celebrations/src/new-year/types/new-year.ts`). It says "a ribbon caught on
  a page button". The code and `new-year-reindeer-takeoff` catch a word copied from
  the textarea value or placeholder, or a drawn ice catch.
- **`isCelebrationSceneSupported` JSDoc**
  (`libs/celebrations/src/utils/celebration-pack-scene.ts`). The function counts
  `interaction-*` entries, so a scene that lists the same interaction ID twice is
  rejected. Document this. Do not dedupe (user decision).
- **`halloween-easter-egg` spec:**
  - The secret-scene requirement names `celebration-history` and
    `CONVERSATION_INPUT_CLASS.wrapper`. The library reads the host-supplied
    `CelebrationAnchors` `historyContainer`/`historyRowLink` and `composer`.
  - The Skeletons rule "SHALL never animate, hide or mutate a live control or its
    text" contradicts the spec's own "The partner steals a greeting word" scenario
    and the code, which hides the greeting's last word with a CSS custom
    highlight. Narrow the rule to allow this one visual-only exception (user
    decision).
  - The scene-lifetime rule says every deadline "SHALL outlast" its artwork.
    Footprints' 12,000 ms story equals its 12,000 ms deadline, which runs from
    activation, so the deadline can cut its last frames. Record this as a
    stated exception and keep the constant (user decision).
- **`new-year-snowman-delivery` spec.** The Ledge condition ("the card's row is the
  lowest content in the welcome region") is stricter than the code. The code checks
  that the starter list sits below the composer, the card is in its bottom row, and
  the band under the row is clear of the composer and the heading. Restate the rule
  as the code checks it.
- **`celebration-lottie-authoring-profile` spec.** The reserved-interaction
  requirement does not list the released `interaction-button-props-v1` adapter and
  calls every unlisted `interaction-*` ID unsupported. It also does not say that a
  repeated ID counts twice. Add both.
- **`celebration-migration-portfolio` spec.** The "No page button in
  ReindeerTakeoff" scenario describes the enum doc as still mentioning a page
  button, which stops being true once the JSDoc is fixed. Reword it as history.
  "Click and secret pools SHALL stay unchanged" is also stale, but S7 prompt `00`
  owns it. It is only cited here.
- **`libs/celebrations/README.md`.** The PenguinStar section lists the gift pool
  without the cat (#9996 updated only the GiftWrapping section). Add it.

Out of scope, recorded in `design.md`: a scene spec for ElfFireworks (user decision:
follow-up), the unused `buildHalloweenWisps`/`HALLOWEEN_WISP_COUNT`, and the
portfolio pools sentence (S7 `00`). The gift click-pool sentence in
`celebration-events` was already fixed by #9996, so it is dropped.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `halloween-easter-egg`: correct the host-anchor names for secret scenes, narrow the
  Skeletons live-text rule to its visual-only highlight, record that the
  Footprints deadline equals its story and can cut its last frames, and drop the
  wisps from the reduced-motion rule.
- `new-year-snowman-delivery`: restate the Ledge stage condition as the code
  checks it.
- `celebration-lottie-authoring-profile`: list `interaction-button-props-v1` and
  state that a repeated `interaction-*` ID counts twice.
- `celebration-migration-portfolio`: reword the ReindeerTakeoff page-button
  scenario as history.

## Impact

- **Code:** three JSDoc blocks in `libs/celebrations/src` and no executable lines.
  The public API, exports and the published package shape stay the same.
- **Docs:** `libs/celebrations/README.md` (one sentence) and four main specs, which
  change through delta specs at archive.
- **Library isolation:** unchanged. The corrected texts describe host-supplied
  anchors and no longer name app classes (`celebration-history`,
  `CONVERSATION_INPUT_CLASS`) inside a library spec.
- **i18n:** no new user-visible strings and no translation keys.
- **Non-goals:** no constant fix for Footprints, no capability dedupe, no ElfFireworks
  spec, no change to the portfolio's pool decisions.
- **Alternatives considered:** changing the code to match the docs (Footprints
  +500 ms, deduped capability IDs). The user rejected both as behaviour changes for
  a docs-only change.
- **Rollback:** revert the commit. No data, contract or runtime state depends on it.
- **Acceptance:** `npm run validate:docs`, `npm run validate:specs` and
  `openspec validate fix-celebration-docs-drift --strict` pass. Every item above
  reads as the code does on HEAD. `npm exec nx lint celebrations` stays green.
