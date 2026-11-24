# celebration-history-ladder Specification

## Purpose

Define the reusable viewport interaction that maps native celebration artwork to
eligible conversation rows, optionally borrows one inert row, and provides safe
rope and static alternatives with deterministic restoration.

`CelebrationProvider` in `libs/celebrations/src/context/CelebrationContext.tsx`
owns activation state; the session in
`libs/celebrations/src/utils/lottie-scene-session.ts` owns temporary playback
resources. Hosts supply anchors, direction and resolved labels. This interaction
adds no backend endpoint, generated-client method, persistent cache or telemetry.
It preserves existing memoized host inputs and provider state; per-frame React
updates and host measurements are prohibited by the requirements below.

## Requirements

### Requirement: History ladder is an explicit generic viewport interaction

`interaction-history-ladder-v1` SHALL require `viewport-stage-v1`, `direction: none` and no second interaction. The adapter SHALL validate the references, independent tracks, bind windows, copy lifetime, branches and bounds defined in `libs/celebrations/README.md` before measuring or copying host UI. Mapping SHALL preserve authored times, easing and key counts on a private clone.

#### Scenario: Drawn-only envelope
- **WHEN** the asset declares the optional `hl-drawn-bounds` rectangle
- **THEN** that envelope is checked only for the synthetic route, while the six shared station bounds protect both routes
- **AND** the optional rectangle follows the same strict invisible, static metadata format as station bounds

#### Scenario: Independent anchors
- **WHEN** the actor moves between rows while the borrowed row is falling
- **THEN** its track binds independently and the copy remains referenced to its own source row, with upright text in RTL

#### Scenario: Invalid data
- **WHEN** required metadata is duplicated, animated, painted, out of range or malformed, a bind is uncovered, or copy entry has a nonzero rotation or incorrect position
- **THEN** preparation fails safely without hiding or cloning a live element

### Requirement: Bounded visible history and one restorable row

The adapter SHALL use only host-provided anchors and visible idle rows within authored gap/drift/clearance limits. It SHALL bound discovery to 120 links and 24 ancestors, select six ordered distributed stations including the endpoints of a safe reachable corridor, and borrow at most one row of 320×64 CSS px and 80 nodes. Live nodes SHALL stay in place and no navigation or application-data mutation SHALL occur.

#### Scenario: Ineligible target
- **WHEN** a row is focused, expanded, editable, clipped, too complex or outside the safe corridor
- **THEN** it is not borrowed, and preparation chooses a complete safe drawn route or static fallback

#### Scenario: Decorative icons and translated virtual-list wrappers
- **WHEN** an otherwise eligible visible row contains noninteractive accessibility-hidden icons and its ancestor wrapper has a static planar translation
- **THEN** those presentation details do not disqualify the row, and the snapshot is positioned using its measured viewport rectangle without duplicating the ancestor translation
- **AND** hidden rows or ancestors, hidden interactive descendants, transforms on the row itself, non-translational ancestor transforms, transforms shared with the viewport scene (including body/html and custom portal ancestors), and active or pending ancestor animations remain ineligible

#### Scenario: Insufficient headroom at the beginning of history
- **WHEN** the first visible rows cannot safely host the authored first-station envelope without covering a history control or leaving the viewport
- **THEN** those initial rows are skipped before selecting six stations from a safe reachable corridor
- **AND** fewer than six eligible rows in any safe reachable corridor selects the complete drawn route without moving or padding live UI

#### Scenario: Long history or unsafe final row
- **WHEN** the complete visible row range exceeds authored reach or its trailing rows lack ending clearance
- **THEN** the adapter searches bounded alternative corridors, preferring the lowest safe ending row and earliest compatible start
- **AND** it preserves six distributed stations, unchanged gap/drift and copy safety limits, at most 720 cached station envelopes and 24 candidate copy-path checks, without repeated DOM measurement during search

#### Scenario: Restoration and replay
- **WHEN** playback completes, is cancelled, fails or is replaced
- **THEN** originals regain their exact appearance immediately, copies/WAAPI/observers/listeners are disposed, late async work cannot restart it, and replay uses pristine source data and fresh measurements

### Requirement: Geometry is prepared once and fallbacks are complete

The adapter SHALL retarget geometry once, mirror native art only, preserve live text direction, and perform no per-frame layout reads or React updates. It SHALL cancel when watched targets or membership change. Missing history SHALL use the complete authored `hl-if:drawn` alternative near the composer. Static fallback SHALL protect controls and allow notification-only when no safe readable poster fits.

#### Scenario: Authored rope alternative
- **WHEN** the drawn branch contains rope artwork instead of cards
- **THEN** the existing binding contract translates its references and checks its declared envelopes without requiring a new capability or creating per-frame geometry

#### Scenario: Changed history during a hold
- **WHEN** the measured row or container moves, changes content or becomes hidden
- **THEN** the scene cancels and restores its copy instead of remapping mid-playback

#### Scenario: Drawn route on a narrow viewport
- **WHEN** the native alternative fits a free region by the composer
- **THEN** it runs with zero snapshots and preserves its complete authored descent/slip/catch/gifts/phone/rescue sequence

### Requirement: Optional edge support and viewport travel remain authored

The adapter SHALL support optional start-edge pivots, viewport flight and a vertical top-line slot as defined in `libs/celebrations/README.md`. It SHALL validate metadata before measurement, preserve authored easing and key times, map true viewport edges and reject travel across protected controls. Existing assets SHALL retain their end-edge pivot.

#### Scenario: Flight crosses a wide viewport edge
- **WHEN** an eligible scene declares flight references and bounds
- **THEN** entry and departure keys bind to the actual visible start/end edges at any supported width, with RTL mirroring and no scaling of copied text
- **AND** offscreen flight is clipped only at the window boundary while intermediate travel remains clear of protected controls

#### Scenario: Rope continues above the resting pose envelope
- **WHEN** the drawn route declares a valid top-line slot
- **THEN** only its private upper endpoint extends beyond the visible top
- **AND** a protected heading crossed by the extended line makes that candidate ineligible
