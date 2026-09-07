# Spec: conversations-context

## Purpose

Reset and refetch semantics of `ConversationsContext` when the authenticated identity changes.

## Requirements

### Requirement: ConversationsContext resets and refetches when the authenticated identity changes

`apps/chat/src/context/ConversationsContext.tsx` SHALL treat the currently authenticated identity (`useUser().user?.sub`) as part of its conversation-list load effect's dependencies, in addition to the effect's existing mount-time trigger. When the resolved `sub` changes while `ConversationsProvider` remains mounted, the provider SHALL reset `conversations` to `[]` and `error` to `null`, set `isLoading` to `true`, and re-invoke `listConversations()` — exactly as it already does on initial mount. This SHALL NOT re-run merely because `user` is updated in place with an unchanged `sub`.

`ConversationsProvider` is placed inside `RequireAuth`, wrapping the rest of the app, in `apps/chat/src/main.tsx`. It therefore also fully resets via the ordinary unmount/remount path on explicit logout or a `401`; the identity-keyed effect above additionally covers the case where the identity changes without an intervening unmount (an in-place identity adoption — see `spa-auth-session`'s identity revalidation requirement).

#### Scenario: Identity changes while ConversationsProvider stays mounted

- **WHEN** `useUser().user?.sub` changes from one authenticated value to another while a `ConversationsProvider` instance remains mounted
- **THEN** `isLoading` becomes `true`, `conversations` is cleared to `[]`, and `listConversations()` is re-invoked, replacing `conversations` with the new identity's list once it resolves

#### Scenario: In-place user update with unchanged sub does not trigger a refetch

- **WHEN** `useUser().user` is replaced with a new object whose `sub` equals the previous value (e.g. from `spa-auth-session`'s focus-revalidation requirement updating other claims)
- **THEN** `ConversationsProvider` does NOT reset or re-fetch `conversations`

#### Scenario: Explicit logout still resets via unmount

- **WHEN** the user logs out (`status` transitions away from `Authenticated`) and a new identity subsequently authenticates, remounting `ConversationsProvider`
- **THEN** the freshly-mounted provider starts with `conversations: []` and issues exactly one `listConversations()` call for the new identity, independent of the identity-keyed effect

### Requirement: Explicit conversation-list refresh preserves loaded content

`ConversationsContext` SHALL own the distinction between blocking list loads
and background refreshes. When `refreshConversations()` is called after the
provider has loaded, it SHALL request the full conversation list without
clearing `conversations` and without changing `isLoading` to `true`. On success,
it SHALL replace `conversations` with the returned `items`. On failure, it SHALL
preserve the loaded list and populate the existing `error` state.

This background behavior SHALL NOT change the initial or authenticated-identity
load defined by the existing identity-keyed requirement: those loads continue
to clear the list and expose `isLoading=true`. No backend endpoint, generated
client, cache, feature flag, user-visible string, RTL behavior, accessibility
semantic, memoisation contract, rate limit, or telemetry event is added.

#### Scenario: Loaded rows remain available during background refresh

- **GIVEN** `ConversationsProvider` has completed its initial load with one or
  more conversations and `isLoading` is `false`
- **WHEN** `refreshConversations()` is called and its list request is pending
- **THEN** `isLoading` remains `false` and `conversations` retains the previously
  loaded items

#### Scenario: Successful background refresh replaces the list

- **GIVEN** a background `refreshConversations()` request is pending while the
  previous conversation list remains available
- **WHEN** the request resolves with a new `items` array
- **THEN** `conversations` is replaced by that array and `isLoading` remains
  `false`

#### Scenario: Failed background refresh preserves usable data

- **GIVEN** `ConversationsProvider` already contains a loaded conversation list
- **WHEN** `refreshConversations()` fails
- **THEN** the loaded list remains unchanged, `error` contains the failure, and
  `isLoading` remains `false`
