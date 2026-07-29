## Why

Creating a brand-new OAuth toolset with "With Login" and no manually configured client (i.e.
relying on DIAL Core's dynamic client registration, RFC 7591) always fails: the "Log in" click
persists the new toolset, but then builds the OAuth authorize URL from the pre-save React form
state, which never had a `clientId`/`authorizationEndpoint` in the first place — those are only
known once Core dynamically registers the client during creation and returns them in the saved
toolset's `authSettings`. With both fields empty, `buildToolsetAuthorizeUrl` returns `null`, no
popup ever opens, and the user sees the generic "Failed to log in. Please check your credentials
and try again." toast with no way to proceed. See
[epam/ai-dial-chat#7904](https://github.com/epam/ai-dial-chat/issues/7904).

## What Changes

- After the persist-before-login step creates a brand-new OAuth "With Login" toolset, the Auth
  section SHALL re-fetch the just-created/updated toolset and use its server-returned
  `authSettings` (the dynamically-registered `clientId`/`authorizationEndpoint`, when present) to
  build the OAuth authorize URL, instead of reusing the stale pre-save form state that never had
  those fields rendered or populated.
- This refetch-and-merge applies specifically to the OAuth "With Login" (dynamic registration)
  path; the existing "With Login & Config" path, where the user supplies `clientId`/
  `authorizationEndpoint` directly, is unaffected since those fields are already present in form
  state.
- No change to the persisted toolset ID handling already covered by the existing "First login for
  a brand-new toolset uses the freshly created id" scenario — this change addresses the separate
  gap where the *auth settings themselves*, not just the ID, are stale immediately after creation.

## Capabilities

### Modified Capabilities

- `toolset-authentication`: the OAuth redirect/callback handshake requirement gains a
  precondition — when initiating OAuth login for a toolset relying on dynamic client
  registration, the system must have the Core-issued `clientId`/`authorizationEndpoint` available
  before building the authorize URL, refetching the toolset after persist if the local form state
  does not yet carry them.

## Impact

- `apps/chat/src/pages/ToolsetEditor/EditorForm/AuthSection.tsx` (`handleLogIn`,
  `initiateOAuthLogin` call site)
- `apps/chat/src/pages/ToolsetEditor/ToolsetEditor.tsx` (persist-before-login helper)
- `apps/chat/src/utils/toolsets.ts` (`buildToolsetAuthorizeUrl`, `toolsetDtoToForm`)
- No backend or API contract changes — DIAL Core already returns `authSettings` on
  `getToolset`/create; this is a frontend data-freshness fix only.
