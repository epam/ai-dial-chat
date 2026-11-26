# Design

## Context

See `proposal.md` for the drift list. Every item was re-checked on `development` at
`b3e254229`, after #9996. This design records the evidence, the decisions the user
made, and the exact replacement text, so that implementation is copy-only.

Evidence on HEAD:

| Item | Code that decides |
| --- | --- |
| Halloween scene docs | `HalloweenBurstOverlay.tsx` maps `Spiders` to `HalloweenSpiderTheft`, `Ghost` to `HalloweenGhosts` and `Bats` to `HalloweenBats`, and renders `HalloweenCatScene` for `Cat`. Each falls back to the drop, the flock, `HalloweenNightFlight` or the crossing cat. `buildHalloweenWisps` in `libs/celebrations/src/halloween/utils/halloween.ts` has no caller. |
| ReindeerTakeoff doc | `libs/celebrations/src/new-year/utils/reindeer-text.ts` measures a textarea word; `new-year-reindeer-takeoff` specifies the drawn ice catch fallback. |
| History/composer anchors | `getCelebrationHistoryRows` (`libs/celebrations/src/utils/celebration-history.ts`) builds its selector from `anchors.historyContainer`/`historyRowLink` (`host-anchors.ts`); `HalloweenMummy.tsx` reads `anchors.composer`. `celebration-history` exists only as the app's `CELEBRATION_HISTORY_CLASS` in `apps/chat/src/constants/celebration.ts`. |
| Skeletons live text | `halloween-skeleton-animation.ts` sets `CSS.highlights` on the greeting's last word, and `HalloweenSkeletons.module.scss` gives `::highlight(celebration-skeleton-word)` `color: transparent`. |
| Footprints margin | `FOOTPRINT_MS = 12000` (`halloween-footprint-plan.ts`) and `HALLOWEEN_SCENE_DURATIONS[Footprints] = 12000`. The other scenes stop 500–1,000 ms early: Train 11/12 s, Portal 9/10 s, Ravens 12/13 s, Mummy 12/13 s, Cauldron, Mimic and Bowling 8/9 s, Skeletons 11.5/12 s, Candy 35/35.5 s, and Bats, Cat and Witches at their duration +0.5 s. |
| Snowman Ledge | `snowman-delivery-targets.ts`: `startersBelow` is true when the starter list's top is at or below the composer's bottom, or there is no composer. Only `bottomRow` cards are tried. `fitsBand` checks the viewport and every host rect except the starter list: composer and heading. |
| Duplicate IDs | `isCelebrationSceneSupported` filters `requiredCapabilities` by the `interaction-` prefix and requires `length <= 1`. `readCapabilities` in `apps/chat-api/src/celebrations/celebration-manifest.normalizer.ts` does not dedupe. |
| Button-props in profile | `SUPPORTED_CELEBRATION_CAPABILITIES` includes `InteractionButtonPropsV1`. `button-props-adapter.ts` reads only the exact `bp:entry:<n>`/`bp:restore:<n>` markers and ignores any other `bp:` marker, unlike `cat:`/`ct:`/`hl:`, whose `readNamespacedMarkers` rejects an unknown marker. The authoring profile lists neither. |
| Wisps in reduced motion | The "Further clicks reveal other characters" requirement keeps "Characters and wisps SHALL remain visible", but no scene renders wisps; the Cat's reduced-motion fallback is a static `HalloweenCat`. |

## Goals / Non-Goals

**Goals:** each listed text states what the code does, with no executable change.
The library specs stop naming app classes.

**Non-Goals:**
- Removing the dead `buildHalloweenWisps`/`HALLOWEEN_WISP_COUNT`. That is a code
  change; it is recorded here as a follow-up.
- A `new-year-elf-fireworks` scene spec. The user chose a follow-up change. It
  should cover stages, targets (the send button fished onto the rim), fallbacks and
  budgets from `libs/celebrations/src/new-year/utils/elf-fireworks-*.ts`.
- The `celebration-migration-portfolio` line "Click and secret pools SHALL stay
  unchanged". S7 prompt `00` owns it.

## Decisions

1. **Skeletons: narrow the rule, keep the behaviour.** The visual-only highlight
   already has its own scenario ("The partner steals a greeting word") with DOM,
   text, focus and selection guarantees, so the blanket "never hide" is the wrong
   sentence. The alternative was to remove the theft from the spec, which would
   leave the code non-conforming. Rejected.
2. **Footprints: state the exception, keep 12,000 ms.** Raising the deadline to
   12,500 ms changes how long the overlay stays mounted, which is behaviour.
   Rejected for a docs-only change (user decision). The spec now names Footprints
   as the one scene without a margin. The provider's deadline runs from activation
   (`CelebrationContext.tsx`) and the story starts after target measurement, so the
   deadline can cut its last frames by that preparation delay.
3. **Duplicate interaction IDs: document, do not dedupe.** Deduping would make a
   currently rejected manifest playable, a behaviour change (user decision). The
   rule goes where the "at most one" limit already lives: the reserved-interaction
   requirement of `celebration-lottie-authoring-profile`. The function's JSDoc gets
   one clause.
4. **Snowman Ledge: describe the measured proxy.** The scene never measures
   "lowest content in the welcome region". It measures composer, heading and starter
   list only. The spec now says so and adds a scenario. The alternative, changing
   code to measure all region content, is behaviour and was not asked for.
5. **Portfolio scenario reworded in this change.** Fixing the JSDoc makes the
   "No page button" scenario false ("documentation, which mentions a page button").
   The same-change rule in `.claude/rules/docs.md` puts the reword here. The pools
   sentence in the same requirement stays untouched.

### Exact text

JSDoc in `libs/celebrations/src/halloween/types/halloween.ts`:

```ts
/**
 * Spiders descend to up to three start-page elements, wrap them in silk and
 * carry copies above the viewport; without a target they abseil from the top
 * edge and climb back. Triggered by the secret phrase.
 */
Spiders = 'spiders',
/** Ghosts possess small interface elements and one fails to scare the pumpkin; without targets a flock drifts across. */
Ghost = 'ghost',
/** Two bats fail to wake a third hanging under the composer; without room below it, small bats sweep past. */
Bats = 'bats',
/** A black cat pushes small buttons by the composer to test gravity; without eligible buttons it crosses the floor. */
Cat = 'cat',
```

JSDoc in `libs/celebrations/src/new-year/types/new-year.ts`:

```ts
/** Two reindeer free a ribbon caught on a word copied from the composer, or on a drawn ice catch, before taking flight. */
ReindeerTakeoff = 'reindeer-takeoff',
```

JSDoc in `libs/celebrations/src/utils/celebration-pack-scene.ts`:

```ts
/** Whether this release can play the scene's renderer, capabilities and placement; more than one `interaction-*` entry, even a repeated ID, cannot play. */
```

`libs/celebrations/README.md`, PenguinStar section: "The gift picks the penguin, the
snowman or the fireworks elf" becomes "The gift picks the penguin, the snowman, the
fireworks elf or the cat".

Spec text: the delta specs under `specs/` are the exact replacement text.

Library isolation: no lib starts knowing anything new about the host. The corrected
Halloween spec drops the app class names (`celebration-history`,
`CONVERSATION_INPUT_CLASS.wrapper`) in favour of the `CelebrationAnchors` fields
that `apps/chat/src/context/CelebrationHost.tsx` already fills.

## Risks / Trade-offs

- [S7 `00` also modifies `celebration-migration-portfolio` "New Year decisions"]
  → Whichever change archives second rebases its delta onto the archived text. The
  two edits touch different lines (the reindeer scenario here, the pools sentence
  there).
- [The new Snowman scenario could read as endorsing the proxy] → It records the
  code as it is. A later behaviour change that measures the whole welcome region
  replaces the scenario in the same change.
- [Docs drift again as scenes land] → `npm run spec:impact` flags specs whose cited
  files change. No new tooling is added.

## Migration Plan

No migration. The JSDoc and README edits ship in one commit with the specs synced
at archive. Rollback is a revert.
