## MODIFIED Requirements

### Requirement: The gift offers a finite wrapping story

New Year SHALL register `NewYearScene.GiftWrapping` as its only `happy new year` secret-phrase scene. The existing provider SHALL own selection and an 18.5-second mount deadline. The scene SHALL play one non-looping 16-second Lottie composition after at most two seconds of importing the player plus 250 ms of SVG initialization. The scene SHALL show two elves arriving at the composer corners while the master surveys the work, wrapping the composer, pausing proudly before the helper leans back to pull a loose ribbon end, and accidentally winding ribbon around the master while the composer unwraps. It SHALL hold the awkward result while the stunned master and the helper's double take establish the joke, then show the helper proudly presenting his work while the master makes frustrated little hops because a ribbon tail joins his torso cocoon to an ankle band. The master SHALL hop away with a chest bow and the helper SHALL follow with the reel. Departure and decoration removal SHALL finish before the mount deadline. Gift clicks SHALL activate PenguinStar only. The app SHALL supply `newYear.giftWrappingToastMessage` through its existing label adapter; the library SHALL provide an English default and optional typed label property. The revision SHALL add no new labels or public API.

#### Scenario: Gift wrapping is selected

- **WHEN** the enabled gift scene is selected by the secret phrase or existing direct scene API
- **THEN** both elves act through the setup, pull, reversal, reaction and hopping departure without sound, the helper's tension ribbon remains attached to his actual hand and the master's torso ribbon attachment, the cocoon follows the master's torso, the composer is visually released before departure, and cleanup completes within the deadline
