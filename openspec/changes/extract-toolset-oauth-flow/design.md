## Context

`apps/chat/src/utils/toolsets.ts` is 697 lines spanning two unrelated concerns. Roughly lines
97–435 are a generic OAuth authorization-code popup flow; the remainder is toolset-editor form
mapping, validation, and DIAL-error parsing. Nine modules import from it, and the popup trio
(`openToolsetOAuthPopup` / `navigateToolsetOAuthPopup` / `waitForToolsetOAuthResult`) has four
independent consumers spanning three different OAuth resource kinds — toolsets, external services,
and scheduled-task offline credentials.

`pg-chat` has hand-copied ~800 lines of this into a second repository, and the copy has already
diverged: it fixes a dropped-acknowledgement bug that still exists here.

Two constraints shape every decision below, both from `AGENTS.md` §Library isolation:

- **Line 35/41:** a lib must never import routing, app contexts, auth/session/cookies, env vars,
  feature flags, or i18n. `ROUTES.ToolsetSignIn` is routing, so it cannot cross the boundary.
- **Line 41:** `libs/chat-hooks` *may* depend on `@epam/ai-dial-chat-api-client` types and contain
  thin request/response logic, but "must still never construct or configure a client instance
  (base URL, auth headers, CSRF token)".

`libs/chat-hooks` is the right home: it already owns `shared/toolset-login-events.ts` (a
document-scoped `EventTarget` — precedent that browser-API code belongs there),
`catalog/mcp-endpoint-url.ts`, and `mapToolsetCredentials`.

## Goals / Non-Goals

**Goals:**

- One canonical implementation of the OAuth popup handshake, consumed by both repos.
- A boundary drawn by consumer evidence, not by file: the four-consumer popup core moves; the
  one-consumer editor form mapping stays.
- Migrate all nine in-repo consumers with no observable behaviour change, except the one
  acknowledgement fix, which is stated as a spec delta rather than smuggled in.
- Keep the prior extraction's host-owned classification intact everywhere it still holds, and
  document precisely where and why it is being revisited.

**Non-Goals:**

- Changing the OAuth protocol, the DIAL Core contract, the `Cross-Origin-Opener-Policy` requirement,
  or any HTTP/route/session behaviour.
- Extracting toolset-editor form mapping, `server-api/` wrappers, page shells, or i18n.
- Migrating `pg-chat` in this change — it consumes the package once published, on its own schedule.
- Renaming `ToolsetRedirectState.toolsetId` for non-toolset resource kinds (see D6).

## Decisions

### D1 — Boundary drawn from the consumer matrix, not the file

Audited per function, not per file. Moves:

| Unit | Consumers today | Host-owned dependency |
| --- | --- | --- |
| `openToolsetOAuthPopup`, `navigateToolsetOAuthPopup`, `waitForToolsetOAuthResult` | 4 | `ROUTES` (2 refs) |
| `buildToolsetAuthorizeUrl`, `initiateOAuthLogin`, `getToolsetOAuthChannelName`, redirect-state write | 2–3 | `ROUTES` (1 ref) |
| `encodeToolsetId`, `decodeToolsetId`, `isPublicToolsetId` | 2–3 | none |
| `useToolsetLogin` | 2 (Catalog, SigninInterruptDialog) | `server-api/toolsets` |
| OAuth callback completion logic | 1 here + 1 in `pg-chat` | `server-api`, routing, i18n |

Stays: `toolsetDtoToForm`, `formToToolsetBody`, `getDefaultToolsetForm`, `isToolsetFormValid`,
`isValidEndpointUrl`, `fetchToolsetAuthSettings`, `extractToolsetApiErrorMessage`,
`getToolsetFallbackName`, `signin-interrupt.ts`.

The prior extraction's file-level verdict ("`toolsets.ts` … stays host-owned") is not overturned for
the editor half — only for the popup half, where the host-owned surface is two `ROUTES` references.

### D2 — `callbackPath` is an injected parameter (required, not stylistic)

`getToolsetRedirectUri()` (`apps/chat/src/utils/toolsets.ts:158`) and the popup-URL pathname check
(`:366`) are the only host couplings in the handshake. Routing is explicitly forbidden in libs, so
both become a caller-supplied `callbackPath: string`, resolved by the app from its own `ROUTES`.

This also fixes something the current code cannot express: `readResultFromPopupUrl` hardcodes a check
against *two* app routes (`ROUTES.ToolsetSignIn || ROUTES.ToolsetEditorCallback`). As a parameter,
the caller passes whichever route it actually opened, so the lib stops knowing that this app happens
to have two callback routes.

**Alternative rejected:** a `getRedirectUri()` callback. Strictly more powerful, but the lib needs the
path for a string comparison as well as URL construction, so it would need two callbacks where one
plain string suffices.

### D3 — DIAL Core access by injected callbacks, not a client instance

`useToolsetLogin` needs `loginToolset`, `logoutToolset`, `getToolset`. Two compliant options:

1. **Injected callbacks** (chosen) — the hook receives three functions matching the existing
   `server-api/toolsets.ts` signatures. Precedent: `useFavoriteEntitiesState`
   (`libs/chat-hooks/src/catalog/useFavoriteEntitiesState/useFavoriteEntitiesState.ts:50-52`) takes
   `loadFavorites`/`updateFavorite` exactly this way and documents *"Does not import any app context
   or server-api."*
2. **An already-configured `ToolsetsApi` instance** — sanctioned by `AGENTS.md:41`, and would also
   deduplicate the thin wrappers both repos maintain.

Chosen (1) because it keeps the hook trivially testable with plain `vi.fn()`s, matches the closest
existing precedent in the same lib folder, and leaves each host free to keep its own `AbortSignal`
convention (`pg-chat` uses a conditional-spread signal argument this repo does not have). The hook
still builds the `ToolsetLoginBodyDto`/`ToolsetLogoutBodyDto` bodies itself — permitted, since the
lib may depend on generated-client *types*.

### D4 — Enum declarations move; app constants keep only their editor-only half

TypeScript string enums are nominal: a host's `ToolsetCredentialsLevel.User` will not type-check
against a structurally identical enum declared elsewhere. The declarations must move, exactly as
recorded for `PromptSource`/`SkillSource` in the prior extraction's design notes.

`apps/chat/src/constants/toolsets.ts` keeps its editor-only members (`ToolsetTransportType`,
`ToolsetEditorSteps`, `ToolsetEditorQuery`, `AUTH_TYPE_OPTIONS`, `DEFAULT_TOOLSET_NAME`,
`DEFAULT_TOOLSET_VERSION`) and nothing else; its ~30 call sites import the moved declarations from
the package instead (D11). The migration is import-path churn, not a behavioural rewrite.

`AUTH_TYPE_OPTIONS` stays app-owned regardless: it maps enum members to `ToolsetEditorI18nKeys` and
`@tabler/icons-react` components — i18n and UI rendering, both forbidden in the lib.

### D5 — The acknowledgement fix travels with the move

`waitForToolsetOAuthResult` posts the acknowledgement and then closes the channel in the same tick
(`apps/chat/src/utils/toolsets.ts:340-347`). The acknowledgement is discarded, so a callback popup
that lost its `WindowProxy` — the only situation the acknowledgement exists for — can be left open.
`pg-chat`'s port defers the close by one macrotask and has a regression test.

Shipping the buggy version into a shared lib and fixing it afterwards would mean knowingly
publishing a defect. The fix moves with the code and is recorded as a `toolset-authentication`
spec delta so it is reviewed as behaviour, not slipped in as refactoring.

### D6 — `ToolsetRedirectState.toolsetId` keeps its name for now

For `OAuthResourceKind.ExternalService` and `.OfflineCredentials`, `toolsetId` already carries a
non-toolset value — a composite `{appId}/external_services/{serviceId}` scope id, or the fixed
sentinel `'offline-credentials'` (documented at `apps/chat/src/models/toolsets.ts:81-87`). A
kind-neutral `resourceId` would be the better name in a shared package.

Deferred deliberately: renaming touches all three flows plus their callback branches, which is a
behaviour-risk-free but wide diff that would obscure this change's actual boundary. Recorded as a
follow-up and flagged in the proposal for a reviewer to overrule.

### D7 — Callback completion moves as a hook; page shells stay

`ToolsetAuthCallback.tsx` (238 lines here, 221 in `pg-chat`) is ~85% flow logic — read redirect
state, validate `state`, scrub the `code`, exchange, report, close — and ~15% page shell: route
params, i18n, and the app's fallback/status rendering.

The flow becomes `useOAuthCallbackCompletion({ exchange, callbackPath, searchParams })`. Each app
keeps its own page: this repo renders `RouteFallback`, `pg-chat` renders a translated
`role="status"` live region. Neither belongs in a lib.

This repo's page additionally branches on three resource kinds, dispatching to `signInExternalService`
/ `signInOfflineCredentials` / `loginToolset`. That dispatch is host routing of API calls, so it stays
in the page and is expressed to the hook as the single injected `exchange` callback.

### D8 — New `libs/chat-hooks/src/oauth/` module

Named for the concern, not the entity, because three resource kinds already share it and only one is
a toolset. `shared/toolset-login-events.ts` stays where it is (already exported, unrelated to the
popup flow). `isPublicToolsetId` lands in `oauth/` and the private duplicate in
`catalog/map-entity-details-to-catalog.ts` is deleted, closing a compromise the prior extraction was
forced into.

### D9 — Migration order

Enums/models → pure helpers → popup lifecycle → handshake → `useToolsetLogin` → callback hook →
consumers, verifying after each step.

**As built**, the first two slices used temporary re-export shims as staging (verifying that the
declarations had moved with zero consumer edits), and D11 then collapsed the remaining slices into a
single compiler-checked codemod. The verification points per slice were unchanged.

### D10 — The lib's existing `ToolsetAuthStatus` interface is renamed, not worked around

`libs/chat-hooks` already published `interface ToolsetAuthStatus` from
`catalog/entity-details.ts` — an object shape (`global`/`appLevel`/`userLevel`/…), unrelated to the
`SIGNED_IN`/`SIGNED_OUT`/`FAILED` enum this change moves in. Two symbols cannot share a name in one
barrel, so something had to give.

The interface was renamed to `ToolsetAuthStatusDetails`, and the enum keeps its name. Reasons: the
interface had three in-lib consumers and **zero** app consumers, appeared in no README, and is
structural (so a rename costs nothing at any call site); the enum is nominal, is named by
`useToolsetLogin`'s cancellation re-verification, and is already spelled `ToolsetAuthStatus` in both
consuming repos. Renaming the enum instead would have pushed a nominal-type rename onto every host.

**Alternative rejected:** leaving the enum app-owned. It would have avoided the collision, but
`pg-chat`'s `useToolsetLogin` compares against `ToolsetAuthStatus.SignedIn` in exactly the branch
this change extracts, so the lib genuinely needs the declaration.

### D11 — Direct imports, not host-side re-export shims

D4 and D9 originally proposed leaving `constants/toolsets.ts` / `models/toolsets.ts` /
`utils/toolsets.ts` as partial re-export shims, so no consumer import path had to change. Overruled
in review: the shims are dropped and every call site imports the moved symbols directly from
`@epam/ai-dial-chat-hooks`.

A shim that only forwards a declaration is a second place to read before finding the real one, and it
hides the boundary this change exists to draw — a reader of `constants/toolsets.ts` could not tell
which half is host-owned. The staging benefit was real but temporary, and tasks 7.1 already scheduled
the shims for deletion in the same change; keeping them for two slices and then removing them only
split one mechanical sweep into two. Direct imports also make the boundary enforceable: a host module
that starts to need a moved symbol has to name the package.

The cost is a wider diff (~30 files), which is why it was applied as one codemod and settled with
`eslint --fix` for `import/order`. Every edit is compiler-checked.

### D12 — The lib's authorize-URL builder takes a narrow settings shape, not the editor form model

`buildToolsetAuthorizeUrl` took `ToolsetAuthFormData` — an editor form model carrying
`keyHeader`, `clientSecret`, `isLoggedIn`, `withLogin` and other fields it never reads. That model
stays app-owned (D4/tasks 1.3), so the lib signature takes `ToolsetOAuthSettings` instead:
`clientId`, `authorizationEndpoint`, `scopes`, `codeChallenge`, `codeChallengeMethod` — exactly the
fields it reads, and exactly the shape `useToolsetLogin` already declared privately for its own
callers. `ToolsetAuthFormData` remains structurally assignable to it, so every app call site passes
its form state unchanged.

The same applies to `navigateToolsetOAuthPopup` and `initiateOAuthLogin`, which only forward `auth`
to the builder.

### D13 — Where `callbackPath` sits in each signature

`callbackPath` is required (D2), and TypeScript cannot place a required positional after an optional
one. So it is inserted into the required prefix rather than appended:

- `initiateOAuthLogin(auth, toolsetId, callbackPath, credentialsLevel?)`
- `navigateToolsetOAuthPopup(popup, auth, toolsetId, callbackPath, credentialsLevel?, resourceKind?)`
- `waitForToolsetOAuthResult(popup, flowId, { toolsetId, credentialsLevel, callbackPath, … })` — into
  the options object it already had.

**Alternative rejected:** converting the two popup functions to options objects. Better shape for six
parameters, but it churns every call site's argument list on top of an already-wide import diff, for
a signature both consuming repos already use positionally. Recorded as a follow-up instead.

### D14 — The callback hook's `exchange` reports host-side validation failures by return value

`ToolsetAuthCallback`'s external-service branch can fail *before* any request, when the composite
scope id in `toolsetId` will not parse — today it reports `MissingRedirectState`. With the exchange
injected, the host needs a way to say "this failed, and not with `LoginRequestFailed`".

`exchange` therefore returns `Promise<ToolsetOAuthFailureReason | null>`: `null` means success, a
reason means report that reason, and a rejection still maps to `LoginRequestFailed`. Chosen over a
custom error class thrown across the boundary, which would make control flow depend on exception
identity through a package boundary for a case that is an ordinary expected outcome.

### D15 — Both `isPublicToolsetId` duplicates are deleted, not one

The prior extraction was forced to copy `isPublicToolsetId` into **two** files, not the one D8 named:
`catalog/map-entity-details-to-catalog.ts` and `catalog/map-deployment-to-catalog-item.ts`, each with
its own `TOOLSETS_ID_PREFIX`/`PUBLIC_BUCKET_SEGMENT` pair and the identical apologetic comment. Both
now import the shared helper. Leaving the second copy would have left the compromise D8 exists to
close half-open.

## Risks / Trade-offs

- **[Four consumers, three resource kinds, one shared primitive]** → A signature that fits toolsets
  but not external services or offline credentials would surface only at the third migration.
  Mitigation: migrate `useExternalServiceLogin` and `useOfflineCredentialsLogin` **before**
  `useToolsetLogin`, so the least toolset-shaped consumers prove the API first.
- **[The handshake's semantics are subtle and hard to test]** → COOP-severed `WindowProxy`,
  false-cancel suppression, and the focus-based cancellation rule are exactly the parts a refactor
  can silently break. Mitigation: the existing `apps/chat/src/utils/tests/toolsets.spec.ts` suite
  moves with the implementation, plus `pg-chat`'s handshake tests (33 cases, including the
  acknowledgement regression) are ported into the lib rather than left behind.
- **[Nominal enums make this a wide diff]** → ~30 call sites change import paths. Mitigation: every
  such change is compiler-checked (D11), so a missed or mistyped import is a build failure rather
  than a runtime one; the sweep was applied as one mechanical codemod rather than by hand.
- **[Cross-repo coordination]** → `pg-chat` pins an exact package version, so it cannot consume this
  until a build is published. Mitigation: nothing in `pg-chat` breaks meanwhile; its copy keeps
  working, and its migration is a separate change in that repo.
- **[Revisiting a recorded decision]** → Re-opening the "host-owned" classification invites future
  churn if done on thin grounds. Mitigation: the reversal is scoped to the popup half, justified by
  a second consumer and a two-line coupling, and the editor half's classification is explicitly
  reaffirmed rather than quietly dropped.
- **[Trade-off accepted]** Injected callbacks (D3) mean both repos keep their own thin
  `server-api/toolsets.ts` wrappers — a small, stable duplication kept deliberately in exchange for
  the lib never touching client configuration.
