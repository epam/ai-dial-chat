## MODIFIED Requirements

### Requirement: The gift offers a finite wrapping story

New Year SHALL register `NewYearScene.GiftWrapping` as a `happy new year` secret-phrase scene alongside `NewYearScene.ReindeerTakeoff`, with enabled scenes selected without consecutive repeats. The existing provider SHALL own selection and an 18.5-second mount deadline. The scene SHALL play one non-looping 16-second Lottie composition after at most two seconds of importing the player plus 250 ms of SVG initialization.

The scene SHALL show these beats, in order:

1. Two elves arrive at the composer corners while the master surveys the work.
2. They wrap the composer.
3. A proud pause, before the helper leans back to pull a loose ribbon end.
4. The ribbon accidentally winds around the master while the composer unwraps.
5. A hold on the awkward result, while the stunned master and the helper's double take establish the joke.
6. The helper proudly presents his work, while the master makes frustrated little hops: a ribbon tail joins his torso cocoon to an ankle band.
7. The master hops away with a chest bow, and the helper follows with the reel.

Departure and decoration removal SHALL finish before the mount deadline.

Gift clicks SHALL never activate GiftWrapping. They SHALL pick between PenguinStar and SnowmanDelivery.

The app SHALL supply `newYear.giftWrappingToastMessage` through its existing label adapter; the library SHALL provide an English default and an optional typed label property. The revision SHALL add no new GiftWrapping labels or public API.

#### Scenario: Gift wrapping is selected

- **WHEN** the enabled gift scene is selected by the secret phrase or existing direct scene API
- **THEN** both elves act through the setup, pull, reversal, reaction and hopping departure without sound
- **AND** the helper's tension ribbon stays attached to his actual hand and to the master's torso ribbon attachment, and the cocoon follows the master's torso
- **AND** the composer is visually released before departure, and cleanup completes within the deadline
