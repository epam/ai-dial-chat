## MODIFIED Requirements

### Requirement: Hosts choose which scenes and decor behaviours are shown

**Selection.** `selection` SHALL accept, per event id:

- `enabledScenes`: when set, only these scenes may play;
- `disabledScenes`: never play;
- `disabledDecorBehaviors`;
- `isSecretEnabled`: defaults to `true`.

Defaults SHALL enable everything, reproducing today's behaviour.

**Halloween entry exports:**

- `HalloweenScene` (16 members);
- `HalloweenDecorBehavior` (`SpiderFlee`, `SpiderDrop`, `SpiderDrum`, `PumpkinWrap`);
- `halloweenEvent` (its default export), `createHalloweenEvent` and `HalloweenEventOptions` (an optional `trainSoundtrackUrl`; the train scene is silent without it).

**New Year entry exports:**

- `NewYearScene` (3 members: `PenguinStar`, `GiftWrapping`, `SnowmanDelivery`);
- `newYearEvent` as its default export.

**Pools and triggers.**

- Disabled scenes SHALL be removed from both the click pool and the secret pool before random selection, and `celebrate(id)` SHALL ignore a disabled id.
- A click with an empty click pool SHALL do nothing.
- A secret phrase SHALL be consumed only when `isSecretEnabled` is true and at least one of its scenes is enabled; otherwise the text SHALL be sent normally.
- A disabled decor behaviour SHALL never start (its timers and listeners are not installed), while the rest of the decor keeps working.
- Unknown ids in a selection SHALL be ignored.

#### Scenario: A host switches off one scene

- **WHEN** the host disables `HalloweenScene.Cat` and the user clicks the pumpkin repeatedly
- **THEN** every other click scene can play and the cat never does

#### Scenario: A host keeps only one scene

- **WHEN** `enabledScenes` for Halloween is `[HalloweenScene.Ghost]`
- **THEN** every pumpkin click plays the ghosts and the secret phrase is sent as a normal message, because none of its scenes is enabled

#### Scenario: A host disables the pumpkin wrap

- **WHEN** `disabledDecorBehaviors` contains `HalloweenDecorBehavior.PumpkinWrap` and the page stays idle past the wrap delay
- **THEN** the corner spider keeps fidgeting and dropping on its thread but never climbs down to the pumpkin

#### Scenario: A host disables the secret phrase

- **WHEN** `isSecretEnabled` is `false` and the user sends `trick or treat`
- **THEN** `consumeSecretPhrase` returns `false` and the message is sent normally

#### Scenario: A host disables the snowman

- **WHEN** `disabledScenes` for New Year contains `NewYearScene.SnowmanDelivery` and the user clicks the gift repeatedly
- **THEN** every click plays PenguinStar and the snowman never appears
