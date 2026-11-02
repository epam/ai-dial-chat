## ADDED Requirements

### Requirement: A selected clickable attachment tile exposes its state as aria-pressed

When `AttachmentCard` (and so `FileAttachment` and `ImageAttachment`) receives both an `onClick` and a defined `isSelected`, the tile's interactive element SHALL expose `aria-pressed` equal to `isSelected`. The selected styling is not enough on its own: a state carried only by a CSS class is invisible to assistive technology. A tile with no `onClick`, or with `isSelected` left `undefined`, SHALL render no `aria-pressed` attribute, so tiles that are not toggles are unchanged. A pasted-text tile that expands instead of calling `onClick` is not a toggle either, and renders none.

#### Scenario: Selected tile is pressed

- **WHEN** a clickable `AttachmentCard` renders with `isSelected={true}`
- **THEN** its interactive element has `aria-pressed="true"`

#### Scenario: Unselected clickable tile is not pressed

- **WHEN** a clickable `AttachmentCard` renders with `isSelected={false}`
- **THEN** its interactive element has `aria-pressed="false"`

#### Scenario: Tile without a selected state

- **WHEN** an `AttachmentCard` renders with an `onClick` and no `isSelected`
- **THEN** its interactive element has no `aria-pressed` attribute

#### Scenario: Tile without a click handler

- **WHEN** an `AttachmentCard` renders with `isSelected={true}` and no `onClick`
- **THEN** it has no `aria-pressed` attribute

#### Scenario: Expandable pasted tile

- **WHEN** a pasted-text `AttachmentCard` renders with `onExpand`, `onClick` and `isSelected={true}`
- **THEN** its interactive element is the expand button and has no `aria-pressed` attribute
