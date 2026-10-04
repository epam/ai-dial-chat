## ADDED Requirements

This capability defines only the seams the celebration migration needs. **[Contract]** requirements are delivered by S5 (#9224, theme resolution) and S6 (#9225, embedding overrides). **[Invariant]** requirements describe behavior at `1cfb11468`.

### Requirement: Theme identity is separate from color scheme

**[Contract]** `ThemeProvider` (`apps/chat/src/context/ThemeContext.tsx`) SHALL expose three separate values:

- `selectedThemeId`: the user's preference, which may be `system`
- `resolvedThemeId`: the theme actually applied
- `resolvedColorScheme`: `light` or `dark`

The color scheme SHALL come from the theme's catalog `colorScheme` when present. Without it, legacy derivation applies: `dark` for the ID `dark` and `light` otherwise, which matches today's logo choice (`ThemeContext.tsx:48-51`). Consumers that need light/dark (code-block theme, editor theme, logo, Lottie variants) SHALL read `resolvedColorScheme`. They SHALL NOT compare a theme ID with `light`/`dark`.

**[Invariant]** Today consumers infer the scheme inconsistently from the ID:

- `apps/chat/src/app/app.tsx:127` and `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx:414` treat every non-`light` ID as dark.
- `ThemeContext.tsx:49`, `apps/chat/src/components/SkillFilePreview/SkillFilePreview.tsx:85` and four editor pages treat every non-`dark` ID as light.

S5 resolves this. S0 records it only.

#### Scenario: A custom dark theme
- **WHEN** the catalog declares `{ "id": "acme-night", "colorScheme": "dark" }` and the user selects it
- **THEN** `resolvedColorScheme` is `dark`, and celebration variants with `colorScheme: dark` are chosen

#### Scenario: A legacy catalog
- **WHEN** no theme declares `colorScheme`
- **THEN** `resolvedColorScheme` is `dark` for the ID `dark` only, as the logo behaves today

### Requirement: Catalog defaults, system mapping, branding and pack references

**[Contract]** The catalog SHALL accept the following optional fields (C1 in `celebration-pack-contracts`):

- `defaultThemeId`: must name a configured theme.
- `systemThemeIds: { light, dark }`: both must name configured themes.
- `themes[].branding: { logoAssetId?, faviconAssetId? }`: values resolve only through the catalog `assets` registry.
- `themes[].celebrationPacks: { [eventId]: { packId, version } }`.

An invalid reference SHALL be dropped and logged by the BFF. The rest of the catalog SHALL still be served. Without these fields, behavior SHALL stay exactly as it is today:

- first-visit default `light` (`ThemeContext.tsx:126-142`)
- `system` only when both `light` and `dark` exist (`ThemeContext.tsx:106-111`)
- the stored preference is kept when it is temporarily missing

None of these fields can enable a celebration event (see `celebration-source-selection`).

#### Scenario: Custom system mapping
- **WHEN** `systemThemeIds` is `{ "light": "acme-day", "dark": "acme-night" }` and the OS prefers dark
- **THEN** selecting `system` resolves to `acme-night`

#### Scenario: Dangling default
- **WHEN** `defaultThemeId` names a theme that is not configured
- **THEN** the BFF drops the field, and first-visit behavior falls back to today's `light` rule

### Requirement: Transient appearance override from embedding hosts

**[Contract]** The overlay protocol SHALL gain a separate optional field, `appearance`, on `ChatOverlayOptions`, on `setOverlayOptions` and on `SetOverlayOptionsPayload` (`libs/chat-overlay/src/protocol/overlay-protocol.ts:352-372,413-431`). Its semantics:

- **omitted**: no change to the current override
- **`null`**: clear the override, restore the underlying selected theme, and cancel affected celebration playback
- **object**: atomic replacement of the whole previous override, with no deep merge

Object shape:

```json
{
  "appearance": {
    "baseThemeId": "dark",
    "colors": { "bg-layer-0": "#101726", "text-primary": "#F3F4F6" },
    "celebrationPacks": { "new-year": { "packId": "acme-new-year", "version": "1.0.0" } }
  }
}
```

The app SHALL validate the entire update before applying any effect:

- `baseThemeId` must be configured.
- Each `colors` key must be a known token, and each value must be valid for that token's type.
- Each pack reference must be registered for the deployment.
- The update must not contain raw CSS, HTML, scripts, URLs, fonts or asset uploads.

An invalid update SHALL change nothing and SHALL be answered with a structured response: `{ "applied": false, "rejected": [{ "field": "appearance.colors.text-primary", "code": "invalid-value" }] }`. A valid one SHALL be answered with `{ "applied": true }`.

The override state SHALL live app-owned in `ThemeProvider`, which is already an ancestor of both `CelebrationHost` and the overlay context (`apps/chat/src/main.tsx:54-105`; `OverlayModeGate` → `OverlayProvider` is nested at `:71`). It SHALL never be written to local storage, and it SHALL be dropped on iframe teardown.

Two existing protocol rules differ from this contract, so S6 SHALL resolve them explicitly:

- Existing optional fields treat `null` as unset (`openspec/specs/chat-overlay-protocol/spec.md:65`). For `appearance`, `null` means clear.
- An existing malformed payload gets no response (`chat-overlay-protocol` spec, `enabledFeatures` requirement). Here an invalid `appearance` gets a structured rejection.

#### Scenario: Omitted versus null
- **WHEN** a host sends `setOverlayOptions({ modelId: 'x' })` while an override is active, and later sends `setOverlayOptions({ appearance: null })`
- **THEN** the first call leaves the override active, and the second clears it and restores the user's selected theme

#### Scenario: Partially invalid update
- **WHEN** an `appearance` object has a valid `baseThemeId` and one invalid color value
- **THEN** nothing is applied, the previous override stays, and the response lists the rejected field

### Requirement: The legacy theme string is preserved

**[Invariant]** `theme: string` SHALL keep its current behavior. When present and truthy, the app calls the persistent `setTheme` (`apps/chat/src/context/overlay/OverlayContext.tsx:869-871`), which writes local storage (`ThemeContext.tsx:160-167`). Absent or `null` means unset. The SDK keeps the previous value when the field is omitted (`libs/chat-overlay/src/lib/ChatOverlay.ts:279`).

An `appearance` override SHALL take precedence over `theme` for the transient resolution while it is active. Clearing it SHALL reveal whatever `theme` and the stored preference resolve to.

#### Scenario: Existing embedder unchanged
- **WHEN** an existing host sends only `theme: 'dark'`
- **THEN** the theme is applied and persisted exactly as today, and no `appearance` state exists

### Requirement: Capability advertisement and version skew

**[Contract]** The iframe SHALL advertise appearance support in its handshake (the exact field is defined in S6). A new SDK SHALL send `appearance` only to an iframe that advertises it. Against an older iframe, the SDK SHALL keep sending its legacy `theme` and SHALL report through its API that the override is unsupported. An older iframe SHALL ignore an unexpected `appearance` field and SHALL NOT treat it as malformed. **[Invariant]** Today's validator, `hasSetOverlayOptionsPayload` (`apps/chat/src/context/overlay/OverlayContext.tsx:258-273`), checks only known fields and does not reject extra keys. This comes from source inspection; S6 SHALL add a test for it.

To roll back, the host SHALL send `appearance: null` and await `{ applied: true }` before it stops sending the field. Stopping without sending `null` does not clear an active override. If the clear is rejected or unsupported, the host recreates the iframe with legacy options.

#### Scenario: New host, old iframe
- **WHEN** a host built with the S6 SDK embeds an iframe from before S6
- **THEN** the legacy `theme` still applies, and the host is told that `appearance` is unsupported

### Requirement: Overrides never widen permissions or bypass origin checks

**[Contract]** An appearance or pack override SHALL NOT enable an event, scene or decor behavior. It SHALL NOT bypass `UI_EVENT=none` or host selection. It SHALL NOT introduce URLs or code.

**[Invariant]** The existing message checks stay in force and apply to `appearance` unchanged (`OverlayContext.tsx:848-867,909`):

- `event.source === window.parent`
- origin allowlist
- pinning of the first accepted origin
- immutability of the host domain

#### Scenario: Message from an unexpected origin
- **WHEN** a `SET_OVERLAY_OPTIONS` carrying `appearance` arrives from an origin other than the pinned host
- **THEN** it is rejected exactly as such messages are rejected today, and nothing is applied
