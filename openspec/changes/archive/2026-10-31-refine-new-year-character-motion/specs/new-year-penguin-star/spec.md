## ADDED Requirements

### Requirement: Connected penguin acting and handoffs

The existing scene-local Lottie composition SHALL preserve the penguin's monochrome drawing while keeping its working flipper attached to the torso during every lean. The captured page control, paper ball and thrown star SHALL use the rendered flipper's grip, with <=1.5 px handoff error in LTR and RTL. The stage SHALL mirror drawing coordinates once, while host text, selection and restored appearance remain unchanged. Existing host-anchor, provider, interruption, static fallback, timing and resource contracts SHALL remain unchanged; no new state owner, API, strings, flags, telemetry or persistence SHALL be introduced.

#### Scenario: Borrowing and throwing while leaning

- **WHEN** the penguin leans into capture or winds up to throw
- **THEN** its shoulder stays attached to the same point on the torso
- **AND** the captured fragment and released star meet the actual flipper tip in both writing directions

### Requirement: Purposeful walking and continuous star flight

Entrance, approach to the fir and departure SHALL each include alternating short foot lifts coordinated with body travel. During held acting poses the feet SHALL settle. The star SHALL follow one continuous arc from release to the fir without repeated easing stops at intermediate samples. The existing story, 20-second duration, artwork and ceilings of 140 SVG descendants, 32 animated properties, 80 keys per property and 120 KB composition data SHALL remain intact.

#### Scenario: The penguin approaches after decorating the fir

- **WHEN** the penguin walks from its throwing position to the fir
- **THEN** its feet alternate rather than remain in a static pose while sliding
- **AND** both feet settle before the bow

#### Scenario: The released star reaches the crown

- **WHEN** the star leaves the flipper
- **THEN** it follows a continuous arc and joins the crown star without a visible position jump
