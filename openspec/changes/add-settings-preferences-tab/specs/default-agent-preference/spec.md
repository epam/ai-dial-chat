## ADDED Requirements

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

The default value when no entry exists SHALL be `DefaultAgentMode.LastUsedAgent`. This default
reproduces today's behaviour exactly — `resolveInitialSelection` already prefers the user's
persisted `selectedDeploymentId` — so shipping this change SHALL NOT alter which deployment any
existing user's next new chat starts with.

A hook `useDefaultAgentPreference` (`apps/chat/src/hooks/default-agent/useDefaultAgentPreference.ts`)
SHALL expose `{ preference: string; setPreference: (value: string) => void }`, following
`useKeyboardShortcutPreference`'s file shape:

- `preference` is initialised from `localStorage` on mount.
- `setPreference(value)` writes to `localStorage`, updates local state, and dispatches a `window`
  `CustomEvent` carrying the new value so every mounted instance updates without a reload.
- The hook subscribes to that event in a `useEffect` and removes the listener on unmount.

The preference SHALL NOT be written to the server-side `.client_data/.user-config.json`; it is
per-browser, like the theme and keyboard-shortcut preferences it sits beside.

#### Scenario: Default preference when no stored value exists

- **WHEN** `localStorage` has no entry for `StorageKey.DefaultAgent`
- **THEN** `useDefaultAgentPreference` returns `preference === DefaultAgentMode.LastUsedAgent`

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
`Default agent for new chats` preference as an additional argument and apply this precedence, top to bottom:

1. `inMemoryId`, when it matches a deployment in the catalog — unchanged; an explicit in-session
   pick always wins.
2. **NEW** — the preference, when it is neither sentinel **and** a deployment with that id exists in
   the catalog.
3. **NEW** — the operator default (`appConfig.defaultDeploymentId`), when the preference is
   `DefaultAgentMode.DefaultAgent` **and** that deployment exists in the catalog. This step is
   deliberately **not** gated on the `defaultDeploymentPinned` feature flag: a user who explicitly
   asks for the operator default SHALL receive it whether or not the operator pinned it.
4. The operator default, when pinned — unchanged (step 4 of today's chain).
5. `userConfigSelectedId` — unchanged. This is the `DefaultAgentMode.LastUsedAgent` path: that mode
   needs no branch of its own, it is the fall-through produced by skipping steps 2 and 3.
6. `deployments[0]?.id ?? null` — unchanged.

Step 2 deliberately outranks steps 3 and 4, so a user naming a specific agent is not overridden by a
pinned operator default.

This is load-bearing rather than incidental, because the control that writes the preference is itself
shown **only** when an agent is pinned (see `settings-preferences-tab`). Were step 2 placed below the
pin, the row would appear exactly when its value is ignored. The two rules are therefore one design:
pinning an agent is what offers the user the choice, and the user's explicit choice is what wins.

`DEFAULT_DEPLOYMENT_PINNED`'s own description says the pin "takes priority over the user-persisted
model preference". That remains true of the *implicit* preference — `userConfigSelectedId`, the
last-used model at step 5, which the pin still beats. It does not extend to an *explicit* selection
the user made in the Default agent control.

The preference SHALL continue to be read and honoured even while `defaultDeploymentPinned` is
`false` and the control is hidden — a value stored while the flag was on is not discarded when it is
turned off. Resolution simply falls through steps 2 and 3 to the same chain as before.

All **three** existing callers SHALL pass the preference:

1. the post-fetch resolution inside `loadDeployments`;
2. `restoreDefaultSelection`;
3. the late-config re-resolution effect — the one guarded by
   `selectionExplicitlySetRef.current || rawDeployments.length === 0`, which re-resolves a
   provisional selection once user/app config arrives after the catalog.

Caller 3 is a dependency-driven `useEffect`, not a stable callback, so it SHALL read the live
preference value and list it in its dependency array — changing the preference while no explicit
selection has been made SHALL re-resolve the selection immediately. This is the opposite of the ref
discipline that callers 1 and 2 require, and the difference is deliberate: only
`restoreDefaultSelection`'s identity is load-bearing for a consumer's effect.

Missing caller 3 leaves the two new precedence steps dead on first load, because it runs after
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

#### Scenario: LastUsedAgent falls through to the persisted user-config selection

- **GIVEN** the preference is `DefaultAgentMode.LastUsedAgent`, `userConfigSelectedId` is
  `'whisper'`, and no operator default is pinned
- **WHEN** `resolveInitialSelection` runs with no in-memory selection
- **THEN** it returns `'whisper'` — identical to the behaviour before this change

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

---

### Requirement: The preference reaches restoreDefaultSelection through a ref

`DeploymentsProvider` SHALL hold the preference in a `defaultAgentRef` kept current by a
`useEffect`, alongside the four refs already serving this purpose (`itemsRef`,
`userConfigSelectedIdRef`, `isDefaultDeploymentPinnedRef`, `defaultDeploymentIdRef`).

`restoreDefaultSelection`'s `useCallback` dependency array SHALL remain `[]`. The preference SHALL
NOT be added to it.

This is load-bearing, not stylistic: `restoreDefaultSelection` is called from
`ConversationRoute`'s mount effect, whose dependency array includes it. A changing callback identity
would re-fire that effect — on every preference change, and on every deployments refetch — and
discard the selection the user had just made. The existing comment at `DeploymentsContext.tsx:459-465`
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
