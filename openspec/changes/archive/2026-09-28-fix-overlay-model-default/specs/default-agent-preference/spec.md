## MODIFIED Requirements

### Requirement: resolveInitialSelection consults the preference before the operator default

`resolveInitialSelection` in `apps/chat/src/context/DeploymentsContext.tsx` SHALL accept the
**stored** `Default agent for new chats` preference as an additional argument — `string | null`,
`null` while the user has never picked one — and the overlay host's `modelId` as a further argument
(`overlayModelId: string | null`, `null` outside overlay mode or before the host sent one), and apply
this precedence, top to bottom:

1. `inMemoryId`, when it matches a deployment in the catalog — unchanged; an explicit in-session
   pick always wins.
2. The overlay host's `modelId` (`OverlayContextType.modelId`, see `chat-overlay-app-mode`), when a
   deployment whose `id` **or** `reference` equals it exists in the catalog — resolved through
   `findDeploymentByIdOrReference`, returning that deployment's `id`. It outranks every step below:
   the host embeds the overlay for one specific agent, so a new overlay chat SHALL open on it for a
   first-time user too, not only for one whose persisted selection happens to match. An unknown
   value falls through.
3. **NEW** — the preference, when it is non-null, neither sentinel **and** a deployment with that id
   exists in the catalog.
4. **NEW** — the operator default (`appConfig.defaultDeploymentId`), when the preference is
   `DefaultAgentMode.DefaultAgent` **and** that deployment exists in the catalog. This step is
   deliberately **not** gated on the `defaultDeploymentPinned` feature flag: a user who explicitly
   asks for the operator default SHALL receive it whether or not the operator pinned it.
5. **NEW** — `userConfigSelectedId`, when the preference is `DefaultAgentMode.LastUsedAgent` **and**
   that deployment exists in the catalog.
6. The operator default, when pinned — unchanged (step 4 of today's chain).
7. `userConfigSelectedId` — unchanged. This is the fall-through for an **unset** preference.
8. `deployments[0]?.id ?? null` — unchanged.

Step 2 SHALL NOT consult the preference: in overlay mode the host's `modelId` wins over the user's
`Default agent for new chats` choice. Outside overlay mode `overlayModelId` is `null` and the chain
is exactly steps 1 and 3–8.

Steps 3, 4 and 5 deliberately outrank step 6, so a user's explicit choice — a named agent, the
operator default, or the last used agent — is not overridden by a pinned operator default.

This is load-bearing rather than incidental, because the control that writes the preference is itself
shown **only** when an agent is pinned (see `settings-preferences-tab`). Were those steps placed
below the pin, the row would appear exactly when its value is ignored. The two rules are therefore
one design: pinning an agent is what offers the user the choice, and the user's explicit choice is
what wins. Step 5 is the half that was missing when the preference first shipped: with only steps 3
and 4 above the pin, choosing `Last used agent` was indistinguishable from never touching the
control, so the pin kept winning and the option was inert (Issue #8889).

`DEFAULT_DEPLOYMENT_PINNED`'s own description says the pin "takes priority over the user-persisted
model preference". That remains true of the *implicit* preference — `userConfigSelectedId` at
step 7, reached only while nothing is stored, which the pin still beats. It does not extend to an
*explicit* selection the user made in the Default agent control, including an explicit
`Last used agent`.

The preference SHALL continue to be read and honoured even while `defaultDeploymentPinned` is
`false` and the control is hidden — a value stored while the flag was on is not discarded when it is
turned off. Resolution simply falls through steps 3, 4 and 5 to the same chain as before — with the
pin absent, an explicit `Last used agent` and an unset preference resolve to the same deployment
anyway.

All **three** existing callers SHALL pass the preference and the overlay host's `modelId`:

1. the post-fetch resolution inside `loadDeployments`;
2. `restoreDefaultSelection`;
3. the late-config re-resolution effect — the one guarded by
   `selectionExplicitlySetRef.current || rawDeployments.length === 0`, which re-resolves a
   provisional selection once user/app config arrives after the catalog.

Caller 3 is a dependency-driven `useEffect`, not a stable callback, so it SHALL read the live
preference and `overlayModelId` values and list both in its dependency array — changing either while
no explicit selection has been made SHALL re-resolve the selection immediately. Callers 1 and 2 SHALL
read `overlayModelId` through an `overlayModelIdRef`, for the same reason as `defaultAgentRef`. This is the opposite of the ref
discipline that callers 1 and 2 require, and the difference is deliberate: only
`restoreDefaultSelection`'s identity is load-bearing for a consumer's effect.

Missing caller 3 leaves the preference steps dead on first load, because it runs after
`loadDeployments` and overwrites the selection.

#### Scenario: Preference naming a specific agent wins over a pinned operator default

- **GIVEN** the preference is `'opus'`, `appConfig.defaultDeploymentId` is `'gpt-4o'`,
  `defaultDeploymentPinned` is on, and both deployments are in the catalog
- **WHEN** `resolveInitialSelection` runs with no in-memory selection
- **THEN** it returns `'opus'`

#### Scenario: DefaultAgent resolves to the operator default even when unpinned

- **GIVEN** the preference is `DefaultAgentMode.DefaultAgent`, `appConfig.defaultDeploymentId` is
  `'gpt-4o'` which exists in the catalog, `defaultDeploymentPinned` is **off**, and
  `userConfigSelectedId` is `'whisper'`
- **WHEN** `resolveInitialSelection` runs with no in-memory selection
- **THEN** it returns `'gpt-4o'`, not `'whisper'`

#### Scenario: LastUsedAgent resolves to the persisted user-config selection

- **GIVEN** the preference is `DefaultAgentMode.LastUsedAgent`, `userConfigSelectedId` is
  `'whisper'`, and no operator default is pinned
- **WHEN** `resolveInitialSelection` runs with no in-memory selection
- **THEN** it returns `'whisper'` — identical to the behaviour before this change

#### Scenario: An explicit LastUsedAgent wins over a pinned operator default

- **GIVEN** the preference is `DefaultAgentMode.LastUsedAgent`, `appConfig.defaultDeploymentId` is
  `'gpt-4o'`, `defaultDeploymentPinned` is on, and `userConfigSelectedId` is `'whisper'`, both in
  the catalog
- **WHEN** `resolveInitialSelection` runs with no in-memory selection
- **THEN** it returns `'whisper'`, not `'gpt-4o'`

#### Scenario: An unset preference still yields to a pinned operator default

- **GIVEN** `localStorage` has no entry for `StorageKey.DefaultAgent`,
  `appConfig.defaultDeploymentId` is `'gpt-4o'`, `defaultDeploymentPinned` is on, and
  `userConfigSelectedId` is `'whisper'`, both in the catalog
- **WHEN** `resolveInitialSelection` runs with no in-memory selection
- **THEN** it returns `'gpt-4o'` — the pin beats the implicit last-used selection

#### Scenario: LastUsedAgent with nothing ever used falls back to the pin

- **GIVEN** the preference is `DefaultAgentMode.LastUsedAgent`, `userConfigSelectedId` is `null`,
  `appConfig.defaultDeploymentId` is `'gpt-4o'`, and `defaultDeploymentPinned` is on
- **WHEN** `resolveInitialSelection` runs with no in-memory selection
- **THEN** it returns `'gpt-4o'`

#### Scenario: An in-session pick still outranks the preference

- **GIVEN** the preference is `'opus'` and `inMemoryId` is `'gpt-4o'`, both in the catalog
- **WHEN** `resolveInitialSelection` runs
- **THEN** it returns `'gpt-4o'`

#### Scenario: Preference naming a deleted deployment falls through

- **GIVEN** the preference is `'retired-model'`, no catalog entry has that id, no operator default is
  pinned, and `userConfigSelectedId` is `'whisper'`
- **WHEN** `resolveInitialSelection` runs with no in-memory selection
- **THEN** it returns `'whisper'` and the stored preference is left untouched in `localStorage`

#### Scenario: DefaultAgent with no operator configured falls through

- **GIVEN** the preference is `DefaultAgentMode.DefaultAgent` and
  `appConfig.defaultDeploymentId` is `null`
- **WHEN** `resolveInitialSelection` runs with `userConfigSelectedId === 'whisper'`
- **THEN** it returns `'whisper'`

#### Scenario: The overlay host's modelId outranks the preference, the pin and the persisted selection

- **GIVEN** `overlayModelId` is `'sigma'`, the preference is `'opus'`, `appConfig.defaultDeploymentId`
  is `'gpt-4o'` with `defaultDeploymentPinned` on, `userConfigSelectedId` is `'whisper'`, and all
  four are in the catalog
- **WHEN** `resolveInitialSelection` runs with no in-memory selection
- **THEN** it returns `'sigma'`

#### Scenario: The overlay host's modelId matches a deployment reference

- **GIVEN** `overlayModelId` is `'sigma-ref'` and the catalog holds a deployment with id `'sigma'` and
  `reference: 'sigma-ref'`
- **WHEN** `resolveInitialSelection` runs with no in-memory selection
- **THEN** it returns `'sigma'`

#### Scenario: An unknown overlay modelId falls through

- **GIVEN** `overlayModelId` is `'missing'`, no catalog entry has that id or reference, and
  `userConfigSelectedId` is `'whisper'`
- **WHEN** `resolveInitialSelection` runs with no in-memory selection
- **THEN** it returns `'whisper'`

#### Scenario: An in-session pick still outranks the overlay modelId

- **GIVEN** `overlayModelId` is `'sigma'` and `inMemoryId` is `'gpt-4o'`, both in the catalog
- **WHEN** `resolveInitialSelection` runs
- **THEN** it returns `'gpt-4o'`

#### Scenario: An overlay modelId arriving after the catalog loaded re-resolves a provisional selection

- **GIVEN** the catalog has loaded, no explicit selection has been made, and `overlayModelId` is `null`
- **WHEN** `overlayModelId` becomes `'sigma'`, which is in the catalog
- **THEN** the late-config re-resolution effect sets `selectedItemId` to `'sigma'`
