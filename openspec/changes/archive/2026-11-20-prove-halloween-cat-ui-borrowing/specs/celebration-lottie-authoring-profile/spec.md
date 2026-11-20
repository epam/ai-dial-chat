# Spec Delta

## MODIFIED Requirements

### Requirement: Reserved interaction extension point

**[Contract]** Capability IDs that start with `interaction-` SHALL be reserved for compiled, host-independent interaction adapters.

- The first released adapter is `interaction-composer-outline-v1` (S3, #9222). Its behaviour is defined by `celebration-composer-anchoring`. It requires `composer-anchor-v1` placement and has no manifest parameters.
- The second released adapter is `interaction-cat-borrow-v1` (S4, #9223). Its behaviour is defined by `celebration-ui-borrowing`. It requires `composer-anchor-v1` placement and `direction: none`, and it has no manifest parameters.
- Every other `interaction-*` capability SHALL be unsupported, so a scene that requires one falls back as unsupported.
- An adapter's manifest parameters SHALL be limited to an `interaction` object of finite numbers, booleans and adapter-defined string-enum values, plus Lottie marker names. No released adapter defines one, and the descriptor has no `interaction` field.
- An adapter MAY fit Lottie layers whose `nm` equals one of its adapter-defined slot names, for example `composer-outline`, `composer-parcel`, `cat-root` or `cat-floor`. It SHALL change only the geometry or timing the adapter defines for that slot. A slot that is missing, duplicated or malformed is a preparation failure.
- An adapter MAY write a time-remap track on a precomposition slot it defines, for example `cat-rig`. It SHALL NOT remap the root composition. An authored time remap on such a slot is malformed.
- Manifests SHALL never carry selectors, functions, code, class names or DOM paths.
- v1 runtimes SHALL ignore Lottie `markers`, with one exception: an adapter that the scene requires reads markers whose `cm` starts with its own namespace (`cat:` for `interaction-cat-borrow-v1`). Markers in that namespace that are malformed are a preparation failure. All other markers stay ignored.

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

#### Scenario: Markers without an adapter
- **WHEN** a `viewport-stage-v1` scene that requires no adapter carries `cat:` markers
- **THEN** the markers are ignored, and the scene plays as authored

#### Scenario: Unknown namespace
- **WHEN** a pack introduces markers named `penguin:grip` before any adapter defines them
- **THEN** every runtime ignores them, and no scene changes behaviour
