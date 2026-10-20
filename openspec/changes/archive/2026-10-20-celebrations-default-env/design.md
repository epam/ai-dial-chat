## Context

#9496 added a per-user **Seasonal celebrations** switch and made it opt-in.
`useCelebrationPreference()` (`apps/chat/src/hooks/celebration/useCelebrationPreference.ts`)
treats anything but a stored `'true'` as off, and `CelebrationHost`
(`apps/chat/src/context/CelebrationHost.tsx`) passes `config.activeEventId` only when that value is
on. `UI_EVENT` reaches the client through the config registry: `CONFIG_DEFINITIONS` entry
`ui.activeEventId` → `EnvConfigProvider` → `CLIENT_CONFIG_MAPPINGS` → `ClientConfigDto` →
`AppConfigContext`. Boolean `config` keys already flow the same way (`overlay.enabled` →
`config.overlayEnabled`), and boolean env vars already have a validated pattern
(`USAGE_LIMITS_CONTROL_ENABLED` in `apps/chat-api/src/config/environment.config.ts`).

## Goals / Non-Goals

**Goals:**
- Let the operator choose whether a configured event is on by default, with `true` as the default.
- Keep a user's explicit choice authoritative over the operator default.
- Make an operator change reach every user who never saved a choice, with no browser migration.

**Non-Goals:**
- Role-based defaults, server-side storage of the user choice, scheduling.
- Any change to `libs/celebrations` or to the switch UI and its visibility rule.

## Decisions

### 1. A `config` key, not a `features` flag

Registry key `ui.celebrationsEnabledByDefault` (`type: 'config'`, `valueType: 'boolean'`,
`visibility: 'client'`, `defaultValue: true`) is placed directly after `ui.activeEventId`. The
client receives it as `config.celebrationsEnabledByDefault`.
*Alternative:* `FeatureKey` + `useFeatureFlag`. Rejected: features mean "capability available" and
pass through role gating. This value is a preference default tied to `activeEventId`.

### 2. Env var name and parsing

`UI_EVENT_ENABLED_BY_DEFAULT`. The `UI_EVENT_` prefix groups it with the variable it qualifies in
`.env.template` and the README table. Parsing copies `USAGE_LIMITS_CONTROL_ENABLED`'s
`@Transform`: `null`/absent → `undefined` (the class default `true` applies); boolean passthrough;
`false`/`0`/`no` (trimmed, lowercased) → `false`; anything else → `true`. The generic `envVar`
path in `EnvConfigProvider.resolve` then returns the boolean, so no special case is needed there.
*Alternative:* fail-closed parsing like `ALLOW_VISUALIZER_SEND_MESSAGES`. Rejected: that var is
security-sensitive and defaults off. This one is cosmetic and defaults on, so a typo should keep
the default.

### 3. Mapper and DTO

`createDefaultClientConfig` gains `celebrationsEnabledByDefault: true`, added at the end of the
object so the existing response key order (pinned in `app-config.service.spec.ts`) only grows.
The mapping is `defineMapping('celebrationsEnabledByDefault', ({ resolved }) => resolved !== false)`:
only an explicit `false` turns it off, matching the env default.
`ClientConfigDto` gets a required `@ApiProperty({ type: Boolean, ... })` field, followed by
`npm run openapi`. Generated files are never hand-edited.

### 4. Effective preference resolved in the hook, never persisted

`readStoredPreference` returns `boolean | null` (`'true'` → `true`, `'false'` → `false`, else
`null`). The hook keeps that stored value in state and derives
`isEnabled = stored ?? config.celebrationsEnabledByDefault` with `useAppConfig()`. `setIsEnabled`
keeps writing an explicit string and broadcasting the `CustomEvent`. Its detail stays a `boolean`,
which listeners store as the new explicit value.
*Alternative:* write the default to storage on first read. Rejected: it pins whatever default
existed at first visit.

The hook's return shape (`{ isEnabled, setIsEnabled }`) does not change, so `CelebrationHost`,
`PreferencesTab`, `PreferencesFields` and `SettingsModal` need no edits.
`SettingsModal.handleSave` already writes only when the draft differs from the stored effective
value, so an unchanged Save keeps following the operator default.

### 5. Frontend initial state

`AppConfigContext`'s `INITIAL_STATE.config.celebrationsEnabledByDefault` is `true`, and the
loaded state uses `response.config?.celebrationsEnabledByDefault ?? true`. This avoids a flash
only in theory. `CelebrationHost` already waits for `UserConfigStatus.Ready`, and the row needs
`activeEventId`, which is `null` until load, so the pre-load value is never visible.

### Library boundary

`libs/celebrations` is untouched. It keeps receiving a resolved `activeEventId`. The env var,
registry key and storage key all stay in `apps/chat-api` / `apps/chat`.

## Risks / Trade-offs

- [Deployments that already set `UI_EVENT` see celebrations again for users who never touched the
  switch] → Documented as a behaviour change in the README, `.env.template` and PR. Operators can
  restore opt-in with `UI_EVENT_ENABLED_BY_DEFAULT=false`.
- [`SettingsModal` initialises its draft at mount; if it ever mounted before the config loaded,
  the draft would hold the `true` fallback] → Not reachable today, because the dialog opens from
  a loaded UI and the row is hidden while `activeEventId` is `null`. No extra sync is added.
- [A user who wants "follow the operator" after toggling has no reset] → Accepted. An explicit
  choice is sticky by design. Clearing site data resets it.

## Migration Plan

Deploy backend and frontend together (the frontend treats a missing field as `true`, so an older
backend yields the new default). No data migration. Rollback: set `UI_EVENT_ENABLED_BY_DEFAULT=false`
or revert. Stored values keep the same format.

## Open Questions

None blocking. The name `UI_EVENT_ENABLED_BY_DEFAULT` is an assumption and can be renamed before
apply.
