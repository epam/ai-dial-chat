## MODIFIED Requirements

### Requirement: Staging adapts to measured geometry

At preparation, after the player import, the scene SHALL measure the host anchors once. It SHALL use only the host-provided `CelebrationAnchors` `composer`, `starterList` and `welcomeRegion`, and SHALL pick the first qualifying mode:

1. **Ledge.** The starter list's top is at or below the composer's bottom (or no composer is measured), the card sits in the list's bottom row, and the band from the card's bottom down to the ledge floor fits inside the viewport and is clear of the composer and the heading. No other welcome-region content is measured. The snowman stands on a drawn snow ledge under the starter row and pulls the card copy down.
2. **Rim.** The composer is a safe stage, and the band above its upper edge across the travel span is clear of the heading and of every starter except the borrowed card. The snowman rides the composer's snowy upper edge.
3. **Rim with a decorative sled.** Used when no card is eligible or reachable.
4. **Self-contained snowy platform with a decorative sled.** Used when no safe composer stage exists.
5. **Static still.** Used when no free band exists for the platform.

The composer SHALL only be measured as a support. It SHALL NOT be copied, moved or restyled.

- **Travel.** The minimum travel SHALL be 160 px on desktop and 100 px on mobile. The maximum slide SHALL be 460 px on desktop and 220 px on mobile, and the longest ride that the viewport and the host content allow SHALL be chosen. He SHALL enter from at most 200 native units before his pickup stance, fading in, and the scene SHALL be clipped to the welcome region's horizontal extent.
- **Ledge height.** The ledge floor SHALL sit at the card's bottom plus its height plus 130 native units, so his seated head clears the starter row; a card taller than 66 native units SHALL NOT be borrowed for a ledge.
- **Rim reach.** A card above the rim SHALL be borrowed only when its bottom is 40–128 native units above the floor.
- **Host text.** The cast SHALL NOT overlap the heading, the composer's content or any starter other than the borrowed one, except for the mittens at the borrowed slot.

#### Scenario: Starters below the composer (default production layout)

- **WHEN** the starter list renders below the composer and its bottom row has an eligible card with a free band beneath
- **THEN** the scene uses the Ledge mode, the snowman reaches up to grip the card copy, and the composer is not covered

#### Scenario: Ledge ignores unmeasured welcome-region content

- **WHEN** the starter list sits below the composer and another element of the welcome region, neither the composer nor the heading, lies under the starter row
- **THEN** that element does not block the Ledge mode; only the composer, the heading and the viewport bounds limit the ledge band

#### Scenario: Starters above the composer

- **WHEN** the starters render between the greeting and the composer, and the rim band over the travel span is clear except for the borrowed card
- **THEN** the snowman rides the composer's upper edge on the card copy

#### Scenario: No eligible card

- **WHEN** no starter card qualifies or none is reachable from the chosen stance
- **THEN** the same story plays with a drawn sled, and no host element is hidden or copied

#### Scenario: Unsuitable geometry

- **WHEN** neither the ledge band, the rim band nor a platform band fits inside the viewport
- **THEN** the static still is shown and no host element is hidden or copied
