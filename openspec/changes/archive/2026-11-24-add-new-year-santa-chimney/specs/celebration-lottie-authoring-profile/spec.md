## MODIFIED Requirements

### Requirement: Reserved interaction extension point

**[Contract]** Capability IDs that start with `interaction-` SHALL be reserved for compiled, host-independent interaction adapters.

- The first released adapter is `interaction-composer-outline-v1` (S3, #9222). Its behaviour is defined by `celebration-composer-anchoring`. It requires `composer-anchor-v1` placement and has no manifest parameters.
- The second released adapter is `interaction-cat-borrow-v1` (S4, #9223). Its behaviour is defined by `celebration-ui-borrowing`. It requires `composer-anchor-v1` placement and `direction: none`, and it has no manifest parameters.
- The third released adapter is `interaction-copy-track-v1` (S7 batch 1, #9226). Its behaviour is defined by `celebration-copy-track`. It requires `composer-anchor-v1` placement and `direction: none`, and it has no manifest parameters.
- The composer-carry adapter is `interaction-composer-carry-v1`. Its behavior is defined by `celebration-composer-carry`; it requires `composer-anchor-v1` and `direction: none`, and has no manifest parameters. Published packs require matching Themes validation support and a runtime that advertises the capability.
- The history-ladder adapter `interaction-history-ladder-v1` requires `viewport-stage-v1` placement and `direction: none`. Its geometry, copy and safe-poster behavior are defined by `celebration-history-ladder`; no manifest parameters are added. This is the only interaction permitted on viewport placement.
- Every other `interaction-*` capability SHALL be unsupported, so a scene that requires one falls back as unsupported. A scene SHALL require at most one `interaction-*` capability.
- An adapter's manifest parameters SHALL be limited to an `interaction` object of finite numbers, booleans and adapter-defined string-enum values, plus Lottie marker names. No released adapter defines one, and the descriptor has no `interaction` field.
- An adapter MAY fit Lottie layers whose `nm` equals one of its adapter-defined slot names, for example `composer-outline`, `composer-parcel`, `cat-root`, `cat-floor`, `ct-actor`, `composer-carry`, `composer-decoration` or optional `composer-side`, or starts with an adapter-defined prefix, for example `ct-track:`, `ct-follow:` or `ct-if:`, or adds an adapter-defined section suffix to such a name, for example `ct-travel#rim,platform`. It SHALL change only the geometry, timing or opacity the adapter defines for that slot. A required slot that is missing, or any recognized slot that is duplicated or malformed, is a preparation failure.
- An adapter MAY write a time-remap track on a precomposition slot it defines, for example `cat-rig` or `ct-actor`. It SHALL NOT remap the root composition. An authored time remap on such a slot is malformed.
- Manifests SHALL never carry selectors, functions, code, class names or DOM paths.
- v1 runtimes SHALL ignore Lottie `markers`, with one exception: an adapter that the scene requires reads markers whose `cm` starts with its own namespace (`cat:` for `interaction-cat-borrow-v1`, `ct:` for `interaction-copy-track-v1`, `hl:` for `interaction-history-ladder-v1`). Markers in that namespace that are malformed are a preparation failure. All other markers stay ignored.

#### Scenario: A pack ahead of the runtime
- **WHEN** a manifest scene requires `interaction-cat-borrow-v1` and the client is older than S4
- **THEN** the known event keeps its bundled `cat` scene, and no external player starts for it

#### Scenario: The composer-outline adapter is supported
- **WHEN** a `composer-anchor-v1` scene requires `interaction-composer-outline-v1` on a client that includes S3
- **THEN** the scene is supported, and the adapter fits only its `composer-outline` and `composer-parcel` layers

#### Scenario: Adapter without an anchored placement
- **WHEN** a scene requires `interaction-composer-outline-v1` but declares `viewport-stage-v1` placement
- **THEN** the scene is unsupported, and a known event keeps its bundled scene

#### Scenario: The cat-borrow adapter is supported
- **WHEN** a `composer-anchor-v1` scene with `direction: none` requires `interaction-cat-borrow-v1` on a client that includes S4
- **THEN** the scene is supported, the adapter reads only `cat:` markers, and it changes only its own slots and the `cat-rig` time remap

#### Scenario: The copy-track adapter is supported
- **WHEN** a `composer-anchor-v1` scene with `direction: none` requires `interaction-copy-track-v1` on a client that includes S7 batch 1
- **THEN** the scene is supported, the adapter reads only `ct:` markers, and it changes only its own slots and the `ct-actor` time remap

#### Scenario: A copy-track pack ahead of the runtime
- **WHEN** a manifest scene `snowman-delivery` requires `interaction-copy-track-v1` and the client is older than S7 batch 1
- **THEN** the known event keeps its bundled `snowman-delivery` scene, and no external player starts for it

#### Scenario: Markers without an adapter
- **WHEN** a `viewport-stage-v1` scene that requires no adapter carries `cat:` markers
- **THEN** the markers are ignored, and the scene plays as authored

#### Scenario: Unknown namespace
- **WHEN** a pack introduces markers named `penguin:grip` before any adapter defines them
- **THEN** every runtime ignores them, and no scene changes behaviour

#### Scenario: Composer carry is supported
- **WHEN** a composer-anchored scene with direction `none` requires `interaction-composer-carry-v1`
- **THEN** the runtime maps only its carry, decoration and optional side slots and uses one inert composer snapshot
#### Scenario: History ladder on a supported runtime
- **WHEN** a viewport scene requires only the history-ladder interaction with direction none
- **THEN** the runtime maps only its declared history slots, starts its optional row copy on the player clock and uses the safe full-story/static fallback contract
