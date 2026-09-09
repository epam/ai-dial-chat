## ADDED Requirements

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
