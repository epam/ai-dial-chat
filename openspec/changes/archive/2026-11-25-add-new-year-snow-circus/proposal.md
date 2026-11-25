# Snow Circus

## Why

The requested New Year scene turns interface buttons into snowballs: a penguin juggles, a snowman starts a snowball fight, the snowman buries himself, and the pair return the buttons. Existing Cat borrowing forces a fall after release; it cannot express this out-and-back story.

## What Changes

- Author a 26-second `snow-circus` scene, mobile variant and static poster in Themes, with two expressive vector characters and the approved six-beat plot.
- Add a narrowly bounded `interaction-button-props-v1` adapter to bind authored contacts and at most two inert button copies. Reuse the session, snapshot and geometry observers.
- Add a production-player Storybook preview and tests for restoration, malformed assets, reduced motion and mobile/RTL fallback.
- Add the scene to standard `new-year-default@1.5.0`, based on updated Themes `development` version `1.4.0`, and select it in the catalog. Preserve all five existing scenes and retained immutable versions.

## Capabilities

### New Capabilities

- `new-year-snow-circus`: the story, authoring budgets and adaptations.
- `celebration-button-props`: bounded authored button copies and contact binding.

### Modified Capabilities

None. The additional capability is opt-in; existing adapters and pools retain their contracts.

## Impact

Chat's shared celebrations player gains one adapter and capability registration. Themes owns native JSON/SVG and publication validation. No HTTP contracts, generated clients, dependencies, contexts or analytics are added. The host continues to pass anchors, descriptors and asset loaders; library code contains no app paths or delivery policy. The pack's toast label is `snowCircusToastMessage`, with English and Russian labels; the host may override it through the existing labels mechanism.

## Alternatives

Reusing Cat would replace the requested fight with falling buttons. Extending the single card/word copy-track contract would couple unrelated stage solvers to two small props. A compiled scene would duplicate player/lifecycle code and violate new-scene ownership. Choose a small explicit adapter with authored motion and measured contact offsets only.

## Non-goals

No event-wide engine changes, migration of existing scenes, live user-controlled game, remote deployment, commit or publication. Preparing local pack files is part of implementation; enabling the pack in an operator's deployment is separate.

## Acceptance criteria

The complete story is rendered through production LottieScene; each touch precedes motion, juggling and reactions read at actual size, and cleanup returns every button. Desktop borrows at most two 40-node buttons, mobile at most one. One player, 26 seconds, at most 48 layers, 2500 keys, 512 KiB JSON, 500 generated SVG nodes, 160 paths/1000 vertices, no filters. Missing targets retain the fight with drawn snowballs; reduced motion shows the finite poster with no snapshots. Tests, rendered pose inspection and browser measurements are recorded separately from continuous artistic acceptance.

## Compatibility and rollback

Old clients reject the unknown capability and keep their existing scenes. Removing the new pack from policy or reverting the additive registration rolls back the addition. Rollback selects retained standard version `1.4.0` and bumps the catalog revision. Existing assets stay intact.

## References

- `libs/celebrations/src/utils/pack-scene-adapter.ts:134`: adapter dispatch and shared lifecycle.
- `libs/celebrations/src/utils/borrow-targets.ts:54`: bounded eligible button discovery.
- `libs/celebrations/src/utils/celebration-snapshots.ts:334`: reversible copies.
