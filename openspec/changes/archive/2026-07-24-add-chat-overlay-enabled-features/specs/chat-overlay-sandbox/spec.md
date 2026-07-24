## ADDED Requirements

### Requirement: A dedicated case exercises enabledFeatures through both ChatOverlay and ChatOverlayManager

The sandbox SHALL provide a case (or case section) — reachable from the case index alongside the existing cases — demonstrating `enabledFeatures` replacement through both a direct `ChatOverlay` instance and a `ChatOverlayManager`-managed overlay. At minimum it SHALL provide:

- A set of preset buttons for common combinations (e.g. "All defaults", "Header + sharing only", "Empty set") that call `setOverlayOptions({ enabledFeatures: [...] })` with a fixed array.
- A free-text/checkbox input for a custom comma-separated or multi-select list of feature keys, normalized to an array before calling `setOverlayOptions`.
- A response log (the existing `EventLog` component pattern) showing the `SetOverlayOptionsResponse` (`applied`) for each call.
- At least one preset that intentionally includes an unrecognized value, to demonstrate the "filtered with a warning, still applied" behavior from `ui-feature-toggles`.

Imports SHALL come from `@epam/ai-dial-chat-overlay`, matching the existing cases.

#### Scenario: Case is reachable from the sandbox index

- **WHEN** the sandbox's landing page (`apps/chat-overlay-sandbox/src/app/app.tsx`) is inspected
- **THEN** it lists a case for `enabledFeatures` alongside the existing cases

#### Scenario: Preset replaces the effective feature set

- **WHEN** the "Header + sharing only" preset is used
- **THEN** the embedded app's visible UI reflects only the header and sharing-related surfaces enabled by that preset, and the response log shows `{ applied: true }`

#### Scenario: Preset with an unrecognized value still applies the recognized subset

- **WHEN** the preset containing an intentionally-invalid feature key is used
- **THEN** the response log shows `{ applied: true }`, and the embedded app's visible UI reflects only the recognized keys from that preset

#### Scenario: Both direct and manager paths are exercised

- **WHEN** the `enabledFeatures` case's Direct and Manager sections are each used to apply the same preset
- **THEN** both the plain `ChatOverlay` instance and the `ChatOverlayManager`-managed instance reflect the change, verifying the manager's forwarding of the expanded `setOverlayOptions` shape

### Requirement: Case wiring for the enabledFeatures case is covered by automated component tests

The `enabledFeatures` case wrapper component(s) SHALL have a Vitest component test (co-located `tests/` folder) asserting that each preset and the custom-input path calls the mocked `ChatOverlay`/`ChatOverlayManager` `setOverlayOptions` with the expected `enabledFeatures` array, using a mocked/faked overlay instance (no real iframe/network) — following the same pattern as the existing case tests.

#### Scenario: Test asserts the preset call shape

- **WHEN** the `enabledFeatures` case's Vitest test simulates clicking the "Header + sharing only" preset
- **THEN** it asserts the mocked `setOverlayOptions` was called with `{ enabledFeatures: [...] }` matching that preset's documented array
