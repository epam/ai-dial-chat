## ADDED Requirements

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
