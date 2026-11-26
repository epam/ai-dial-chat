## ADDED Requirements

### Requirement: Contact translations keep the cast inside the viewport
Borrowing SHALL occur only when a conservative authored artwork envelope remains inside the viewport for the full blended contact motion. Invalid bounds SHALL fail before mutation. When bounds are absent, the complete composition rectangle SHALL be used. Unsafe contacts SHALL use drawn props without moving or hiding real controls.

#### Scenario: Return near the right edge on mobile
- **WHEN** an otherwise eligible button would move a visible character outside a 360px viewport during return
- **THEN** the scene uses drawn snow and both characters remain visible

#### Scenario: Blended contacts
- **WHEN** nonnegative authored contact weights sum to at most one
- **THEN** every accepted translation and all interpolated blends keep the artwork envelope within the viewport

### Requirement: Scene eligibility precedes pair selection
Scene-specific button eligibility SHALL be applied before candidate pair ranking. Rejected candidates SHALL NOT displace eligible alternatives. Discovery limits and the behavior of scenes without a predicate SHALL remain unchanged.

#### Scenario: Wide selector beside small buttons
- **WHEN** two eligible small buttons are adjacent to an ineligible wide model selector
- **THEN** discovery chooses both small buttons rather than discarding one after pair selection
