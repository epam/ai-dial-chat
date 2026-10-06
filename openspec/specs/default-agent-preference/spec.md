# default-agent-preference Specification

## Purpose

The "Default agent for new chats" preference: its storage under StorageKey.DefaultAgent, its sentinel values, and how the new-chat screen resolves it before falling back to the operator default.

## Requirements

### Requirement: DefaultAgentMode enum names the two sentinel values

The system SHALL declare a string enum in `apps/chat/src/types/default-agent.ts`:

```ts
export enum DefaultAgentMode {
  DefaultAgent = 'default-agent',
  LastUsedAgent = 'last-used-agent',
}
```

The two values are carried over verbatim from chat 1.0's `DEFAULT_AGENT` / `LAST_USED_AGENT`
constants, so a value stored by a chat 1.0 deployment remains meaningful.

The preference's stored value is a single string with a three-case grammar: either
`DefaultAgentMode.DefaultAgent`, or `DefaultAgentMode.LastUsedAgent`, or any other string, which
is read as a deployment id. No separate discriminator field is stored.

#### Scenario: A stored value that is not a sentinel is a deployment id

- **WHEN** the stored value is `'gpt-4o'`
- **THEN** it is interpreted as the deployment id `gpt-4o`, not as an invalid mode

---

### Requirement: Preference persisted to localStorage under StorageKey.DefaultAgent

The system SHALL add `DefaultAgent = 'defaultAgent'` to the `StorageKey` enum
(`apps/chat/src/types/storage-key.ts`) and store the preference there via the existing
`getFromLocalStorage` / `setToLocalStorage` helpers (`apps/chat/src/utils/local-storage.ts`).

When no entry exists the preference SHALL be treated as **unset**, which resolves through the
pre-existing chain (the pinned operator default, then the persisted `selectedDeploymentId`) — so
shipping this change SHALL NOT alter which deployment any existing user's next new chat starts
with. `DefaultAgentMode.LastUsedAgent` is the value a *control* displays for an unset preference
when nothing is pinned; it is not written to `localStorage` on the user's behalf.

A hook `useDefaultAgentPreference` (`apps/chat/src/hooks/default-agent/useDefaultAgentPreference.ts`)
SHALL expose
`{ preference: string; storedPreference: string | null; setPreference: (value: string) => void }`,
following `useKeyboardShortcutPreference`'s file shape:

- `storedPreference` is the raw stored value, `null` while no entry exists. It is what
  `resolveInitialSelection` reads, because only an explicitly chosen mode outranks a pinned
  operator default.
- `preference` is `storedPreference` with `DefaultAgentMode.LastUsedAgent` substituted when nothing
  is stored. It is a display value.
- `setPreference(value)` writes to `localStorage`, updates local state, and dispatches a `window`
  `CustomEvent` carrying the new value so every mounted instance updates without a reload.
- The hook subscribes to that event in a `useEffect` and removes the listener on unmount.

The preference SHALL NOT be written to the server-side `.client_data/.user-config.json`; it is
per-browser, like the theme and keyboard-shortcut preferences it sits beside.

#### Scenario: Default preference when no stored value exists

- **WHEN** `localStorage` has no entry for `StorageKey.DefaultAgent`
- **THEN** `useDefaultAgentPreference` returns `storedPreference === null` AND
  `preference === DefaultAgentMode.LastUsedAgent`

#### Scenario: Stored value is loaded on mount

- **WHEN** `localStorage` holds `StorageKey.DefaultAgent = 'gpt-4o'`
- **THEN** `useDefaultAgentPreference` returns `preference === 'gpt-4o'`

#### Scenario: Calling setPreference persists and updates the value

- **WHEN** `setPreference(DefaultAgentMode.DefaultAgent)` is called
- **THEN** `localStorage` holds `'default-agent'` AND subsequent reads of `preference` return
  `DefaultAgentMode.DefaultAgent`

#### Scenario: Preference change reaches every mounted instance immediately

- **GIVEN** both the Preferences tab and `DeploymentsProvider` hold a live
  `useDefaultAgentPreference` instance
- **WHEN** `setPreference` is called from the Preferences tab
- **THEN** the other instance's `preference` updates on the same render cycle — no page reload and
  no navigation is required

#### Scenario: No server write accompanies a preference change

- **WHEN** `setPreference` is called
- **THEN** no request is made to `/api/v1/user-config` or any other endpoint

---

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
   exists in the catalog and is selectable.
4. **NEW** — the operator default (`appConfig.defaultDeploymentId`), when the preference is
   `DefaultAgentMode.DefaultAgent` **and** that deployment exists in the catalog and is selectable. This step is
   deliberately **not** gated on the `defaultDeploymentPinned` feature flag: a user who explicitly
   asks for the operator default SHALL receive it whether or not the operator pinned it.
5. **NEW** — `userConfigSelectedId`, when the preference is `DefaultAgentMode.LastUsedAgent` **and**
   that deployment exists in the catalog and is selectable.
6. The operator default, when pinned and selectable — unchanged (step 4 of today's chain).
7. `userConfigSelectedId`, when selectable — unchanged. This is the fall-through for an **unset** preference.
8. The first deployment that is not hidden, else the first deployment, else `null`
   (`(deployments.find((d) => !d.isHidden) ?? deployments[0])?.id ?? null`).

"Selectable" in steps 3–7 is `isDeploymentSelectable`: the id is in the catalog **and** the
deployment is not `isHidden` — an operator-hidden deployment (`HIDDEN_ENTITY_TAGS`, Issue #9150)
never becomes a new chat's model through a stored or configured preference. Steps 1 and 2 check
only presence in the catalog (`isDeploymentPresent` / `findDeploymentByIdOrReference`).

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
read the preference and `overlayModelId` through `defaultAgentRef` and `overlayModelIdRef`. Caller
3's live-value discipline is the opposite of the ref discipline that callers 1 and 2 require, and
the difference is deliberate: only `restoreDefaultSelection`'s identity is load-bearing for a
consumer's effect.

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

---

### Requirement: The preference reaches restoreDefaultSelection through a ref

`DeploymentsProvider` SHALL hold the preference in a `defaultAgentRef` kept current by a
`useEffect`, alongside the other refs serving this purpose (`itemsRef`,
`userConfigSelectedIdRef`, `isDefaultDeploymentPinnedRef`, `defaultDeploymentIdRef`,
`overlayModelIdRef`).

`restoreDefaultSelection`'s `useCallback` dependency array SHALL remain `[]`. The preference SHALL
NOT be added to it.

This is load-bearing, not stylistic: `restoreDefaultSelection` is called from
`ConversationRoute`'s mount effect, whose dependency array includes it. A changing callback identity
would re-fire that effect — on every preference change, and on every deployments refetch — and
discard the selection the user had just made. The comment on `itemsRef` in `DeploymentsContext.tsx`
records the same constraint for `items`.

#### Scenario: Callback identity is stable across a preference change

- **GIVEN** a consumer has captured `restoreDefaultSelection`
- **WHEN** the user changes the `Default agent for new chats` preference
- **THEN** `restoreDefaultSelection`'s identity is unchanged, and any effect depending on it does not
  re-fire

#### Scenario: A preference change is picked up by the next resolution

- **GIVEN** the preference is changed from `LastUsedAgent` to `'opus'` while the app stays mounted
- **WHEN** the user then navigates to the new-chat screen and `restoreDefaultSelection` runs
- **THEN** the selection resolves to `'opus'` — the ref carries the new value despite the stable
  callback identity

#### Scenario: An in-chat agent switch is not clobbered by a deployments refetch

- **GIVEN** the user has selected a deployment in the current session
- **WHEN** the deployments catalog refetches and rebuilds `items`
- **THEN** `ConversationRoute`'s mount effect does not re-fire and the user's selection stands
