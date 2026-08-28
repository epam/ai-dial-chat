## Why

`apps/chat/src/utils/toolsets.ts` (697 lines) mixes two unrelated things: a **generic OAuth
authorization-code popup handshake** and **toolset-editor form mapping**. The handshake half is
already treated as a shared primitive *inside this repo* — `openToolsetOAuthPopup`,
`navigateToolsetOAuthPopup` and `waitForToolsetOAuthResult` are imported by four independent
consumers, only one of which is about toolsets at all:

| Consumer | Uses the popup trio for |
| --- | --- |
| `apps/chat/src/hooks/toolsets/useToolsetLogin.ts:21-23` | toolset credentials |
| `apps/chat/src/hooks/externalServices/useExternalServiceLogin.ts` | external services |
| `apps/chat/src/hooks/offlineCredentials/useOfflineCredentialsLogin.ts` | scheduled-task offline consent |
| `apps/chat/src/pages/AppsEditor/AppEditorIframe.tsx:39-40` | app-editor iframe relay |

`OAuthResourceKind` (`apps/chat/src/constants/toolsets.ts`) exists precisely because three different
resource kinds already share this machinery. It is a reusable primitive that was simply never
packaged.

It is now being **hand-copied into a second repository**. `pg-chat` ported ~800 lines of it
(`apps/chat/src/utils/toolsets.ts`, `types/toolsets.ts`, `models/toolsets.ts`,
`hooks/toolsets/useToolsetLogin.ts`, `pages/ToolsetAuthCallback/`) because no shared home exists.
That is exactly the failure mode
`openspec/changes/archive/2026-08-26-extract-reusable-chat-utilities-and-api-transport/proposal.md`
opened with: *"Every future client of this codebase that wants to reuse this logic today has no
option but to copy the files by hand, reproducing exactly this kind of drift."*

**The drift has already started.** The copy fixed a real bug this repo still has:
`waitForToolsetOAuthResult` closes the flow's `BroadcastChannel` in the same tick it posts the
result acknowledgement (`apps/chat/src/utils/toolsets.ts:340-347`), which discards that
acknowledgement. The acknowledgement exists solely so a callback popup whose `WindowProxy` was
severed can close itself — so today, in exactly the COOP/cross-origin case the acknowledgement was
built for, the popup can be left open. The port defers the close by one macrotask and has a
regression test for it; this repo has neither.

### Revisiting a previous decision, deliberately

The extraction change above explicitly classified `toolsets.ts` as host-owned — *"17 files stay
host-owned, untouched: … `signin-interrupt.ts`, `toolsets.ts`"* — and went as far as **duplicating
`isPublicToolsetId`** into `libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts` rather
than widen that file's boundary (design.md D-note on the `isPublicToolsetId` cross-file dependency).

That call was correct on the evidence available then: the file was audited **whole**, it is 697
lines of genuinely mixed concerns, and it had one consumer repo. Two things changed. First, a second
consumer now exists and is copying rather than importing. Second, a function-level audit (not a
file-level one) shows the host-owned part is **two lines**: `ROUTES.ToolsetSignIn` at
`apps/chat/src/utils/toolsets.ts:158` and `:366`. Everything else in the handshake is `window`,
`sessionStorage`, `BroadcastChannel` and `URL` — browser APIs, not host state. "Touches `window`"
is not the same as "host-owned"; `libs/chat-hooks` already owns browser-API code
(`libs/chat-hooks/src/shared/toolset-login-events.ts` uses a document-scoped `EventTarget`).

## What Changes

- Extract the OAuth popup lifecycle and completion handshake into `@epam/ai-dial-chat-hooks`:
  `buildToolsetAuthorizeUrl`, `openToolsetOAuthPopup`, `navigateToolsetOAuthPopup`,
  `initiateOAuthLogin`, `waitForToolsetOAuthResult`, `getToolsetOAuthChannelName`, and the redirect-
  state write. The two `ROUTES.ToolsetSignIn` references become an explicit **`callbackPath`
  parameter** supplied by the host — the app-level seam this repo's lib rules require.
- Extract the enums and models the handshake's signatures need (`ToolsetOAuthInitiationResultType`,
  `ToolsetOAuthResultType`, `ToolsetOAuthFailureReason`, `ToolsetOAuthChannelControlType`,
  `ToolsetOAuthCallbackQuery`, `ToolsetCredentialsLevel`, `ToolsetAuthTypes`, `ToolsetAuthStatus`,
  `WithLogin`, `OAuthResourceKind`, `TOOLSET_REDIRECT_STATE_KEY`, plus `ToolsetRedirectState`,
  `ToolsetOAuthInitiationResult`, `ToolsetOAuthResult`, `ToolsetOAuthChannelMessage`,
  `ToolsetOAuthResultAcknowledgement`). String enums are nominal in TypeScript, so the declaration
  itself must move — the same constraint recorded for `PromptSource`/`SkillSource` in the prior
  extraction's D-notes. `apps/chat/src/constants/toolsets.ts` keeps its editor-only members and
  its ~30 call sites import the moved declarations straight from the package (see design D11 — the
  originally proposed re-export shims were dropped in review in favour of direct imports).
- Move `encodeToolsetId` / `decodeToolsetId` / `isPublicToolsetId`, and **delete the private
  duplicate** of `isPublicToolsetId` the prior extraction was forced to create in
  `libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts`.
- Extract `useToolsetLogin` as a host-agnostic hook taking `{ loginToolset, logoutToolset,
  getToolset }` as injected callbacks, following `libs/chat-hooks/src/catalog/
  useFavoriteEntitiesState/useFavoriteEntitiesState.ts:50-52`, which takes `loadFavorites` /
  `updateFavorite` the same way and documents *"Does not import any app context or server-api."*
- Extract the OAuth **callback completion** logic — read redirect state, validate `state`, scrub the
  `code` from the URL, exchange it, report over channel + URL marker, close on acknowledgement — as
  a hook parameterised by the exchange call and the resource kind. `ToolsetAuthCallback.tsx` and
  `pg-chat`'s equivalent keep their own thin page shells for routing and i18n.
- **Fix the dropped-acknowledgement bug** as part of the move (defer the channel close by one
  macrotask), so both repos converge on the fixed behaviour rather than the buggy one.
- Migrate all nine consumers to the package and delete the app-owned implementations.

### Explicitly staying app-owned

Toolset-editor form mapping and validation (`toolsetDtoToForm`, `formToToolsetBody`,
`getDefaultToolsetForm`, `isToolsetFormValid`, `isValidEndpointUrl`, `fetchToolsetAuthSettings`),
`extractToolsetApiErrorMessage` (typed against the generated client's `ResponseError`),
`getToolsetFallbackName`, `apps/chat/src/utils/signin-interrupt.ts`, every `server-api/` wrapper,
the route constants, the page shells, and all i18n. These are host-owned throughout, exactly as the
prior audit concluded.

## Capabilities

### New Capabilities

- `chat-hooks-oauth-popup-flow`: host-agnostic OAuth authorization-code popup orchestration
  published from `@epam/ai-dial-chat-hooks` — authorize-URL construction, synchronous popup opening,
  redirect-state handoff into the popup's own `sessionStorage`, opener severing, and the redundant
  completion handshake (`BroadcastChannel` + popup-URL polling + opener-focus cancellation), with
  the callback route path injected by the host.
- `chat-hooks-toolset-login`: host-agnostic toolset login orchestration (`useToolsetLogin`) and the
  OAuth callback completion hook, both parameterised by injected API callbacks, covering API-key and
  OAuth at `USER` and `GLOBAL` levels plus the stale-credential re-login path.

### Modified Capabilities

- `chat-hooks-domain-utilities`: the requirement that `isPublicToolsetId` be a private,
  non-exported duplicate inside each mapping module is reversed — the helper now has one shared
  declaration in `oauth/toolset-id.ts` (design **D15**).
- `toolset-authentication`: the OAuth redirect/callback handshake requirement gains the
  acknowledgement-delivery guarantee that the current implementation silently fails (the channel
  must stay open long enough for the acknowledgement to reach the popup). Observable behaviour is
  otherwise unchanged; this is the one behavioural fix in an otherwise structural change.

## Impact

- **Affected libs**: `libs/chat-hooks/src/` gains an `oauth/` module and new public barrel exports;
  `libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts` loses its private
  `isPublicToolsetId` duplicate in favour of the shared one.
- **Affected app code**: `apps/chat/src/utils/toolsets.ts` shrinks to the editor-only half;
  `apps/chat/src/constants/toolsets.ts` and `apps/chat/src/models/toolsets.ts` shrink to their
  editor-only halves; `apps/chat/src/hooks/toolsets/useToolsetLogin.ts` becomes a thin app adapter
  that injects the `server-api/toolsets` calls and the app's `callbackPath`; the nine consumers
  listed above switch imports to the package.
- **Cross-repo**: `pg-chat` deletes ~800 lines and consumes the package instead. It pins
  `@epam/ai-dial-chat-hooks` at an exact version, so it needs a published build and a version bump —
  it is **not** blocked by this change and can migrate whenever the package lands.
- **i18n**: no new user-visible strings. The lib gains no `t()` calls; every message stays in the
  host page shells.
- **Rollback / backward-compat**: additive at the package level and behaviour-preserving at the app
  level, apart from the acknowledgement fix. Consumer import paths do change (design D11), which is
  mechanical and compiler-checked. Reverting is reverting the commit; no data, route, or HTTP
  contract changes, and DIAL Core is untouched.
- **Scope creep flag**: this touches a shared lib and a second repository. It does **not** touch
  `server-api/base.ts`, CSRF/session policy, the `Cross-Origin-Opener-Policy` header requirement, or
  any DIAL Core contract.

### Alternatives considered

1. **Leave it duplicated** (baseline). Zero risk now, but the drift is already real and silent — one
   repo has the acknowledgement fix and the other does not. Rejected.
2. **Extract only the enums/models, keep the flow duplicated.** Cheap and safe, but leaves the
   360-line handshake — the part with the subtle COOP/cancellation semantics and the bug — copied.
   That is the half most expensive to keep in sync. Rejected.
3. **Extract the whole `toolsets.ts` file.** Simplest boundary to describe, but drags editor form
   mapping and `ResponseError`-typed error parsing into a lib that has no business owning them, and
   re-opens the host-owned classification the prior audit made correctly. Rejected.
4. **Extract the handshake + login/callback orchestration, keep editor forms app-owned** (chosen).
   Boundary follows the evidence — the four-consumer popup trio moves, the one-consumer editor
   mapping stays — and needs exactly one injected seam (`callbackPath`) plus the established
   injected-API-callback pattern.

### Open question for review

`useExternalServiceLogin` and `useOfflineCredentialsLogin` reuse the popup machinery with
`OAuthResourceKind.ExternalService` / `.OfflineCredentials`, where `ToolsetRedirectState.toolsetId`
is repurposed as an opaque correlation id (documented at `apps/chat/src/models/toolsets.ts:81-87`).
The moved type should probably rename that field to something kind-neutral (`resourceId`), but that
touches all three flows. Design decision D6 proposes keeping `toolsetId` for this change and
renaming separately; flagging it here so a reviewer can overrule.
