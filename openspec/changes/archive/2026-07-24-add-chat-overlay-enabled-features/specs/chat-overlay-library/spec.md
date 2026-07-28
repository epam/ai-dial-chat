## ADDED Requirements

### Requirement: setOverlayOptions and initial handshake send enabledFeatures

`ChatOverlay.setOverlayOptions` SHALL accept `Partial<Pick<ChatOverlayOptions, 'theme' | 'modelId' | 'overlayConversationId' | 'enabledFeatures'>>`. When `enabledFeatures` is supplied, it SHALL replace (not merge with) the instance's stored `options.enabledFeatures`. `sendCurrentOverlayOptions` (the private method also used for the initial `READY`-triggered handshake send) SHALL include `enabledFeatures` in the outgoing `SetOverlayOptionsPayload` whenever `this.options.enabledFeatures` is defined, mirroring how `theme`/`modelId`/`overlayConversationId` are already conditionally included. `ChatOverlayManager.setOverlayOptions(overlayId, options)` SHALL forward the same expanded parameter shape to the underlying `ChatOverlay` instance, unchanged in every other respect.

Enabling `enabledFeatures` after construction does not retroactively change the iframe's `allow` permissions attribute (already set at iframe creation, per the existing "Microphone permission is opt-in" requirement) — a host that wants to add `voice-input` after the fact must still request microphone access through the pre-existing construction-time mechanism; this change does not add iframe permission-attribute mutation after mount.

#### Scenario: setOverlayOptions with enabledFeatures updates and resends

- **WHEN** `overlay.setOverlayOptions({ enabledFeatures: [OverlayFeature.Header, OverlayFeature.Likes] })` is called
- **THEN** the instance's stored `enabledFeatures` becomes exactly `[Header, Likes]`, and a `SET_OVERLAY_OPTIONS` message is sent with `payload.enabledFeatures: ['header', 'likes']`

#### Scenario: Omitting enabledFeatures in a later call preserves the previous value

- **WHEN** `overlay.setOverlayOptions({ enabledFeatures: ['header'] })` is called, followed later by `overlay.setOverlayOptions({ theme: 'dark' })`
- **THEN** the second call's outgoing payload still includes `enabledFeatures: ['header']` (unchanged), alongside the updated `theme`

#### Scenario: Initial handshake send includes enabledFeatures from constructor options

- **WHEN** a `ChatOverlay` is constructed with `enabledFeatures: [OverlayFeature.VoiceInput, OverlayFeature.Header]` and the app emits `READY`
- **THEN** the library's `SET_OVERLAY_OPTIONS` response includes `payload.enabledFeatures: ['voice-input', 'header']`

#### Scenario: ChatOverlayManager forwards enabledFeatures unchanged

- **WHEN** `manager.setOverlayOptions('test', { enabledFeatures: ['header'] })` is called
- **THEN** the underlying `ChatOverlay` instance for `'test'` receives the same call arguments, identically to how `theme`/`modelId`/`overlayConversationId` are already forwarded

#### Scenario: enabledFeatures does not retroactively change iframe permissions

- **WHEN** a `ChatOverlay` is constructed without `voice-input` and later `setOverlayOptions({ enabledFeatures: ['voice-input'] })` is called
- **THEN** the iframe's `allow` attribute is unchanged (still excludes `microphone`) — only the wire payload and the app's own effective UI-feature state are affected

### Requirement: README documents enabledFeatures usage on setOverlayOptions

`libs/chat-overlay/README.md` SHALL document `setOverlayOptions`'s expanded parameter shape, including an example showing `enabledFeatures` used to change which UI sections the embedded app shows without reconstructing the iframe, and SHALL note that this array replaces (not merges with) any previously-sent `enabledFeatures`.

#### Scenario: README shows a setOverlayOptions enabledFeatures example

- **WHEN** `libs/chat-overlay/README.md` is inspected
- **THEN** it contains a code example calling `setOverlayOptions({ enabledFeatures: [...] })` and a note that the array replaces the previous value rather than merging with it
