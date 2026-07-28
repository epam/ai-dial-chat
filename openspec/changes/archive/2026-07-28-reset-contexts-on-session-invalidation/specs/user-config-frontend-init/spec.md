## MODIFIED Requirements

### Requirement: UserConfigContext loads user configuration once per authenticated identity

`UserConfigProvider` (`apps/chat/src/context/UserConfigContext.tsx`) SHALL call `getUserConfig()` from `apps/chat/src/server-api/user-config.api.ts` exactly once for each authenticated identity: once on mount, and again whenever the authenticated identity (`useUser().user?.sub`) changes while the provider remains mounted. It must not trigger a second request on re-renders, or on child component mount/unmount cycles, that do not correspond to a `sub` change.

When the resolved `sub` changes while `UserConfigProvider` stays mounted, the provider SHALL reset `pinnedConversationIds`, `installedToolsetIds`, `installedDeploymentIds`, and `selectedDeploymentId` to their empty/`null` defaults, set `status` back to `Loading`, and re-issue `getUserConfig()` — mirroring what already happens on a fresh mount. This SHALL NOT re-run merely because `user` is updated in place with an unchanged `sub` (see `spa-auth-session`'s identity revalidation requirement).

`UserConfigProvider` is placed inside `RequireAuth` in `apps/chat/src/main.tsx`, wrapping `AppConfigProvider` and `ConversationsProvider`. It therefore only mounts after the user is authenticated, and continues to fully reset via that unmount/remount path on explicit logout or a `401`. The identity-keyed effect above additionally covers the case where the identity changes without an intervening unmount — i.e. `spa-auth-session`'s "adopt the new profile in place" behavior on a focus/visibility identity mismatch.

**State exposed by `UserConfigContextType`:**

```typescript
interface UserConfigContextType {
  pinnedConversationIds: string[];
  installedToolsetIds: string[];
  installedDeploymentIds: string[];
  selectedDeploymentId: string | null;
  status: UserConfigStatus;
  setPinnedConversation: (id: string, isPinned: boolean) => Promise<void>;
  setInstalledToolset: (id: string, isInstalled: boolean) => Promise<void>;
  setInstalledDeployment: (id: string, isInstalled: boolean) => Promise<void>;
  setSelectedDeployment: (id: string | null) => Promise<void>;
}
```

`UserConfigStatus` enum values: `Idle`, `Loading`, `Ready`, `Error` (defined in `apps/chat/src/types/user-config-status.ts`).

#### Scenario: Status transitions from Loading to Ready on successful fetch

- **WHEN** `UserConfigProvider` mounts and `getUserConfig()` resolves with a valid v2 config
- **THEN** `status` transitions from `Loading` to `Ready`
- **AND** `pinnedConversationIds`, `installedToolsetIds`, `installedDeploymentIds` are populated from the response

#### Scenario: Status stays Loading while the fetch is in flight

- **WHEN** `UserConfigProvider` mounts and `getUserConfig()` has not yet resolved
- **THEN** `status` is `Loading`

#### Scenario: Single fetch — no duplicate requests on re-render

- **WHEN** `UserConfigProvider` re-renders (e.g. due to parent state change) after the initial fetch completes, with the authenticated identity unchanged
- **THEN** `getUserConfig()` is NOT called a second time

#### Scenario: Identity changes while UserConfigProvider stays mounted

- **WHEN** `useUser().user?.sub` changes from one authenticated value to another while a `UserConfigProvider` instance remains mounted
- **THEN** `status` becomes `Loading`, `pinnedConversationIds`/`installedToolsetIds`/`installedDeploymentIds`/`selectedDeploymentId` are reset to their defaults, and `getUserConfig()` is re-invoked, replacing the exposed state with the new identity's config once it resolves

#### Scenario: In-place user update with unchanged sub does not trigger a refetch

- **WHEN** `useUser().user` is replaced with a new object whose `sub` equals the previous value (e.g. from `spa-auth-session`'s focus-revalidation requirement updating other claims)
- **THEN** `UserConfigProvider` does NOT reset or re-fetch its state
