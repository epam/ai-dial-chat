## MODIFIED Requirements

### Requirement: Secret triggers and notification hints belong to the event

Only the loaded, selected event on `/` SHALL intercept an exact nonempty normalized secret phrase in the start-page composer. Normalization SHALL preserve Unicode letters and numbers and ignore letter case, surrounding whitespace and punctuation. Substrings SHALL NOT match. Events with no secret trigger SHALL send all text normally. Every scene notification for an event with a secret SHALL interpolate its declared hintPhrase; secret triggers SHALL declare a `sceneIds` pool. CelebrationProvider SHALL filter unavailable IDs and choose uniformly among distinct valid IDs, excluding the preceding secret choice when another valid choice exists. It SHALL own this selection history independently of clicks and reset it on navigation or event changes. An empty valid pool SHALL NOT consume messages; a singleton SHALL remain repeatable. Existing conversation routes SHALL continue sending normally.

#### Scenario: A non-Latin phrase
- **WHEN** the configured phrase is written using Cyrillic or Arabic letters and the user sends the same phrase with punctuation or case differences
- **THEN** matching preserves those letters and triggers the intended scene

#### Scenario: Event has no secret
- **WHEN** an event omits secretTrigger
- **THEN** no composer text is consumed and notifications receive no secret hint

#### Scenario: Repeated secret phrases
- **WHEN** an exact phrase is sent repeatedly with multiple valid secret scenes
- **THEN** each message selects a scene other than the previous secret choice, regardless of intervening clicks

#### Scenario: No playable secret scene
- **WHEN** every secret scene reference is unavailable or the pool is empty
- **THEN** the message is sent normally without a celebration

#### Scenario: Reset after navigation or event change
- **WHEN** the user returns to the start page or selects another event
- **THEN** the secret selection history is cleared

#### Scenario: A single valid secret scene
- **WHEN** a secret pool contains only one valid scene, with duplicate or unavailable references
- **THEN** every matching message restarts that scene and its own deadline
