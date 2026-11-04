## ADDED Requirements

### Requirement: Right panels use bounded tablet overlays

At viewport widths from 768px inclusive to 1280px exclusive, sources, attachment canvas, catalog details, skill details and standalone conversation/project publication panels SHALL overlay the main content without changing its layout width. This includes nested details/publication views and every canvas content type and mount described in the design inventory. Below 768px and from 1280px the existing panel presentation SHALL remain unchanged.

The app SHALL retain existing open-state owners and exclusion rules; shared libraries SHALL receive presentation, size and behavior through host-independent props/callbacks. Existing SidebarPanel consumers without the new opt-in SHALL retain their behavior, including left panels. The existing implementations are `libs/sidebar/src/components/SidebarPanel/SidebarPanel.tsx`, `libs/source-panel/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx`, `libs/attachment-canvas/src/components/AttachmentCanvas/AttachmentCanvas.tsx`, `libs/catalog/src/components/Details/DetailsPanel.tsx`, `libs/skills/src/components/SkillDetailsSidePanel/SkillDetailsSidePanel.tsx` and `libs/publish-panel/src/components/PublishPanel/StandalonePublishPanel.tsx`.

#### Scenario: All right-panel families leave content visible
- **WHEN** any inventoried right panel opens at 768, 1024 or 1279px
- **THEN** its width uses the panel-specific preference clamped to available width minus 32px
- **AND** underlying content retains its closed-panel layout dimensions and remains partly visible

#### Scenario: Unchanged outside the tablet range
- **WHEN** a right panel opens at 767 or 1280px
- **THEN** it retains the existing phone or desktop behavior respectively

#### Scenario: Left panel and navigation regression
- **WHEN** right panels open, close or change range at any acceptance width
- **THEN** navigation and conversation-panel presentation and state follow their existing 1280px policy without being forced open or closed

### Requirement: Effective size bounds include remembered and resized widths

Tablet panels SHALL clamp preferred, minimum, maximum, animated and drag widths consistently to the available inline width minus 32px. A configured minimum SHALL NOT exceed the effective maximum. Existing desktop preferred widths SHALL survive temporary viewport clamping without a persistence write. Existing close/reset behavior SHALL be preserved. Resizable panels SHALL keep usable pointer and keyboard resizing; non-resizable drawers SHALL remain non-resizable.

#### Scenario: Desktop size exceeds tablet capacity
- **WHEN** a resized desktop panel enters the tablet band with a preferred size or minimum exceeding its available width
- **THEN** both panel wrapper and inner content fit within the tablet cap, with accessible close control
- **AND** returning to desktop restores the prior preference within current desktop constraints

#### Scenario: Resize and viewport changes remain bounded
- **WHEN** the user resizes a tablet panel or its available containing width decreases
- **THEN** its effective width remains within the normalized bounds without horizontal page overflow or content displacement

### Requirement: Overlay lifecycle remains accessible

Tablet overlay positioning SHALL use logical inline-end properties and direction-aware resize edges. Existing modal drawers SHALL retain focus management, backdrop and scroll lifecycle; complementary panels SHALL not introduce a global modal focus trap. Escape SHALL dismiss the innermost dismissible layer first and focus SHALL return to the appropriate available trigger. Closed panels SHALL not intercept input. Existing loading, error, empty and draft states SHALL survive viewport transitions.

No new user-visible strings, feature gates, telemetry or cached data SHALL be introduced. Existing labels SHALL remain host supplied; derived prop objects/callbacks SHALL remain stable where required by memoized consumers.

#### Scenario: Open panel crosses both boundaries
- **WHEN** an open panel changes through 767, 768, 1024, 1279 and 1280px in either direction
- **THEN** it remains usable without orphan backdrops, duplicate panels, stale scroll locks or focus in hidden content

#### Scenario: Menu and another panel coexist
- **WHEN** a menu opens inside a panel or another modal panel opens above it
- **THEN** the active layer remains visible, keyboard reachable and correctly stacked
- **AND** closing it restores focus without closing unrelated panels or leaving input interception

#### Scenario: RTL and reduced motion
- **WHEN** a tablet panel is opened, resized and closed in RTL or with reduced motion
- **THEN** its logical edge, close control, resize direction and focus sequence remain correct and reduced-motion preferences are honored

