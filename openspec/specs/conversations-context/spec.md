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

### Requirement: In-place list updaters preserve the list reference on a no-op update

`ConversationsProvider` (`apps/chat/src/context/ConversationsContext.tsx`) owns the `conversations` state. Its in-place updaters SHALL return the previous `conversations` array reference from their `setConversations` updater when the update would change no item:

- `updateConversationTitle(id, title)`, when no item matches `id` or when the matching item's `title` already equals `title`;
- `removeConversationFromList(id)`, when no item matches `id`;
- the optimistic write in `pinConversation(id, isPinned)`, when no item matches `id` or when the matching item's `isPinned` already equals `isPinned`.

When an update does change an item, the updater SHALL keep its current behavior: a new array, a new object for the changed item only, and every other item keeping its identity. Returning the previous reference lets React skip the state update, so no `useConversations()` consumer re-renders and no memo derived from `conversations` recomputes.

This requirement adds no endpoint, cache, feature flag, user-visible string, RTL behavior, accessibility semantic or telemetry event. `pinConversation` still issues its API request even when the optimistic write was a no-op.

#### Scenario: Title update with the current title keeps the list reference

- **GIVEN** the provider has loaded a list that contains a conversation titled "Plan"
- **WHEN** `updateConversationTitle` is called with that conversation's id and "Plan"
- **THEN** `conversations` is the same array reference as before the call

#### Scenario: Title update with a new title replaces only the matched item

- **GIVEN** the provider has loaded a list that contains a conversation titled "Plan"
- **WHEN** `updateConversationTitle` is called with that conversation's id and "Roadmap"
- **THEN** `conversations` is a new array, the matched item's `title` is "Roadmap", and every other item is the same object reference as before

#### Scenario: Removing an unknown id keeps the list reference

- **WHEN** `removeConversationFromList` is called with an id that matches no item
- **THEN** `conversations` is the same array reference as before the call

#### Scenario: Pinning an already-pinned conversation keeps the list reference

- **GIVEN** a loaded conversation with `isPinned: true`
- **WHEN** `pinConversation` is called with its id and `true`
- **THEN** `conversations` is the same array reference immediately after the call

### Requirement: Opening a conversation whose name is unchanged does not rewrite the list

When `ConversationPage` loads a conversation and passes the loaded `name` to `updateConversationTitle`, and the list item's `title` already equals that name, the `conversations` array reference SHALL remain unchanged. Conversation switches therefore do not start a second pass through every consumer of the list.

#### Scenario: Navigating to a conversation with a matching title

- **GIVEN** the conversation list contains an item whose `title` equals the `name` the conversation API returns for it
- **WHEN** the user navigates to that conversation and `loadConversation` completes
- **THEN** the `conversations` array reference is the same as before the navigation
