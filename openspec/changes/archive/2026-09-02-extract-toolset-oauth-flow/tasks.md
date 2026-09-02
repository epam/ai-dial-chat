**Slicing strategy: risk-first.** The popup handshake carries the subtle semantics (COOP-severed
`WindowProxy`, false-cancel suppression, the acknowledgement fix), and the API shape is most likely
to be wrong for the *least* toolset-shaped consumers. So the shared primitive lands and is proven
against external-services and offline-credentials before the toolset paths migrate. Every slice
leaves `apps/chat` compiling and green.

**As built:** slices 1–2 used the re-export shims below as staging, then design **D11** overruled
them — every call site now imports the moved symbols directly from `@epam/ai-dial-chat-hooks` and no
host-side shim survives. That collapsed slices 3–5's consumer migration into one compiler-checked
codemod, so 3.5's temporary wrappers and 7.1's deletion of them are recorded as superseded rather
than performed in sequence. Per-slice verification was unchanged.

## 1. Lib scaffolding and shared declarations

- [x] 1.1 Create `libs/chat-hooks/src/oauth/` and move the enum and model declarations listed in the
      `chat-hooks-oauth-popup-flow` spec into `oauth/types.ts` and `oauth/models.ts`. Declarations
      move (not copies) — string enums are nominal, so a duplicate would not type-check against host
      call sites. Leave `OAuthResourceKind`'s member set unchanged.
- [x] 1.2 Export them from `libs/chat-hooks/src/index.ts`, and update `libs/chat-hooks/README.md`
      with the new module section per `.claude/rules/libs.md` §README requirements.
- [x] 1.3 Reduce `apps/chat/src/constants/toolsets.ts` and `apps/chat/src/models/toolsets.ts` to
      their editor-only halves — `ToolsetTransportType`, `ToolsetEditorSteps`, `ToolsetEditorQuery`,
      `AUTH_TYPE_OPTIONS`, `DEFAULT_TOOLSET_NAME`, `DEFAULT_TOOLSET_VERSION`, and the editor form
      shapes. `AUTH_TYPE_OPTIONS` stays app-owned — it maps to `ToolsetEditorI18nKeys` and
      `@tabler/icons-react`, both forbidden in a lib. *(Staged as re-export shims to prove the move,
      then reduced to the editor half per D11.)*
- [x] 1.4 Verify: `npx nx run chat:typecheck` and `npx nx run chat-hooks:test` pass with **zero**
      consumer files edited, proving the declarations moved cleanly.
      **Also required a name collision to be resolved** — the lib already published
      `interface ToolsetAuthStatus` from `catalog/entity-details.ts`, renamed to
      `ToolsetAuthStatusDetails` per design **D10**.

## 2. Pure helpers

- [x] 2.1 Move `encodeToolsetId`, `decodeToolsetId`, and `isPublicToolsetId` from
      `apps/chat/src/utils/toolsets.ts` into `libs/chat-hooks/src/oauth/toolset-id.ts`, with their
      existing cases from `apps/chat/src/utils/tests/toolsets.spec.ts`.
- [x] 2.2 Delete the private `isPublicToolsetId` duplicates in
      `libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts` **and**
      `catalog/map-deployment-to-catalog-item.ts` (there were two, not one — design **D15**) and
      import the shared one, closing the compromise recorded in the prior extraction's design notes.
      Reversing it also required a `chat-hooks-domain-utilities` spec delta, since the live spec
      mandates the duplication by name.
- [x] 2.3 Move `buildToolsetAuthorizeUrl` into `libs/chat-hooks/src/oauth/authorize-url.ts`, taking
      `redirectUri` as it already does and narrowing its `auth` parameter to `ToolsetOAuthSettings`
      so the editor form model stays app-owned (design **D12**). Move its tests, and add
      `getToolsetRedirectUri(callbackPath)`.
- [x] 2.4 Verify: `chat-hooks` and `chat` test suites green.

## 3. Popup lifecycle and handshake (highest risk)

- [x] 3.1 Move `openToolsetOAuthPopup`, the redirect-state write, `navigateToolsetOAuthPopup`, and
      `initiateOAuthLogin` into `libs/chat-hooks/src/oauth/popup.ts`. Replace the
      `getToolsetRedirectUri()` call with a required `callbackPath` parameter. **Keep the
      synchronous-open ordering intact** — it is what makes popup blocking detectable.
- [x] 3.2 Move `getToolsetOAuthChannelName` and `waitForToolsetOAuthResult` into
      `libs/chat-hooks/src/oauth/handshake.ts`. Replace the hardcoded
      `ROUTES.ToolsetSignIn || ROUTES.ToolsetEditorCallback` pathname check with a comparison against
      the caller's `callbackPath`.
- [x] 3.3 Apply the acknowledgement fix from design D5: defer the channel close by one macrotask so
      the acknowledgement is delivered. Add the regression test asserting the callback receives it.
- [x] 3.4 Port the downstream repo's 33 handshake cases
      (its `apps/chat/src/utils/tests/toolsets.spec.ts`) alongside this repo's existing cases —
      they cover channel-unavailable, unreadable cross-origin URL, closed-popup-without-focus, and
      single-teardown, which the current suite does not.
- [x] 3.5 ~~Keep `apps/chat/src/utils/toolsets.ts` compiling by re-exporting the moved functions
      wrapped with the app's own `ROUTES.ToolsetSignIn` as `callbackPath`.~~ **Superseded by D11:** no
      wrappers were kept. `apps/chat/src/utils/toolsets.ts` keeps only the app-level
      `getToolsetRedirectUri()`, which binds `ROUTES.ToolsetSignIn` to the lib's `callbackPath`
      parameter; every consumer passes its own `callbackPath` directly. Argument placement is
      recorded as design **D13**.
- [x] 3.6 Verify: full `chat` suite green with zero consumer edits.

## 4. Prove the API on the non-toolset consumers first

- [x] 4.1 Migrate `apps/chat/src/hooks/externalServices/useExternalServiceLogin.ts` to import the
      popup trio from `@epam/ai-dial-chat-hooks`, passing its own `callbackPath`.
- [x] 4.2 Migrate `apps/chat/src/hooks/offlineCredentials/useOfflineCredentialsLogin.ts` the same
      way. If either needs a signature the toolset path did not, fix it here — before three more
      consumers depend on it — and record the change as a design note.
- [x] 4.3 Migrate `apps/chat/src/pages/AppsEditor/AppEditorIframe.tsx` (popup trio +
      `encodeToolsetId`/`decodeToolsetId`). No signature change was needed for any of the three
      non-toolset consumers beyond the injected `callbackPath`.
- [x] 4.4 Verify: `apps/chat/src/hooks/externalServices/tests/`,
      `apps/chat/src/hooks/offlineCredentials/tests/`, and the `AppEditorIframe` suite green.

## 5. Toolset login hook

- [x] 5.1 Move `useToolsetLogin` into `libs/chat-hooks/src/oauth/useToolsetLogin/`, taking
      `{ loginToolset, logoutToolset, getToolset }` as injected callbacks per design D3. Model the
      params interface on `libs/chat-hooks/src/catalog/useFavoriteEntitiesState/`. Move its spec,
      replacing the `server-api` module mock with plain callback stubs.
- [x] 5.2 Reduce `apps/chat/src/hooks/toolsets/useToolsetLogin.ts` to a thin app adapter that injects
      the `apps/chat/src/server-api/toolsets.ts` wrappers and the app's `callbackPath`, so
      `CatalogView.tsx` and `SigninInterruptDialog.tsx` keep their current import.
- [x] 5.3 Verify: `useToolsetLogin`, `CatalogView`, and `SigninInterruptDialog` suites green. The
      hook's spec moved into the lib with plain callback stubs in place of the `server-api` module
      mock (18 cases); the app adapter is thin enough to be covered by the two consumer suites.

## 6. Callback completion hook

- [x] 6.1 Extract the completion flow from
      `apps/chat/src/pages/ToolsetAuthCallback/ToolsetAuthCallback.tsx` into
      `libs/chat-hooks/src/oauth/useOAuthCallbackCompletion/`, parameterised by an injected `exchange`
      callback, `callbackPath`, and the query parameters. It returns in-progress/failed state and
      renders nothing. `exchange` resolves `ToolsetOAuthFailureReason | null` so the host can report
      a pre-request validation failure with its own reason (design **D14**).
- [x] 6.2 Reduce `ToolsetAuthCallback.tsx` to a page shell: read the resource kind from the stored
      redirect state, pick the matching API call (`loginToolset` / `signInExternalService` /
      `signInOfflineCredentials`) as the `exchange` callback, and render `RouteFallback`. The
      per-kind dispatch stays in the page — it is host routing of API calls.
- [x] 6.3 Move the page's flow-level cases into the lib's spec; keep only shell-level cases
      (dispatch-by-kind, rendering) in `apps/chat/src/pages/ToolsetAuthCallback/tests/`.
- [x] 6.4 Verify: callback page suite and the new lib suite green.

## 7. Clean up and guard

- [x] 7.1 Migrate every importer to the package. **Folded into the D11 codemod** rather than done as
      a separate cleanup, since 3.5 left no wrappers to delete. 27 files rewritten across
      `ToolsetEditor.tsx`, `EditorForm/AuthSection.tsx`, `CatalogView`, `SigninInterruptDialog`,
      `AppEditorIframe`, the three login hooks, the callback page, and their specs; each keeps its
      editor-only helpers local. Import order settled with `eslint --fix`.
- [x] 7.2 Confirm `apps/chat/src/utils/toolsets.ts` now contains only the editor half:
      `toolsetDtoToForm`, `formToToolsetBody`, `getDefaultToolsetForm`, `isToolsetFormValid`,
      `isValidEndpointUrl`, `fetchToolsetAuthSettings`, `extractToolsetApiErrorMessage`,
      `getToolsetFallbackName`, and `getToolsetRedirectUri`'s app-level wrapper.
- [x] 7.3 **Architecture guard** (required by the tasks rules for `libs/*` work): grep
      `libs/chat-hooks/src/oauth/` for `/api`, `server-api`, `ROUTES`, `useTranslation`, `i18n`,
      `context/`, `localStorage`, `Configuration`, and `@tabler` — every hit must be zero. Confirm
      the module imports only browser APIs, `@epam/ai-dial-chat-shared`, and
      `@epam/ai-dial-chat-api-client` **types**.
- [x] 7.4 Verify the full workspace: `npx nx run-many -t typecheck test lint`.
      `typecheck` and `lint` green across all 30 projects. `test`: `@epam/chat` 1975 passed / 2
      skipped and `@epam/ai-dial-chat-hooks` 1263 passed; four untouched projects
      (`chat-shared`, `sidebar`, `attachment-input`, `chat-overlay`) fail under Nx's default worker
      count with `TypeError: Cannot read properties of undefined (reading 'config')` at file scope in
      **every** spec. Reproduced on a clean `development` checkout with this change stashed, and all
      four pass with `vitest run --maxWorkers=4` — a pre-existing local worker-count limit, not a
      regression from this change.

## 9. Security review follow-up (PR #8493)

- [x] 9.1 Require `https:` for the authorization endpoint in
      `libs/chat-hooks/src/oauth/authorize-url.ts`, accepting plain `http:` only on the loopback
      interface (design **D16**), and record it as a spec delta since it changes behaviour relative
      to the pre-move code.
- [x] 9.2 Cover the new rule: https accepted; remote http refused; `localhost`/`127.0.0.0/8`/`[::1]`
      accepted; `localhost.evil.com`, `notlocalhost`, `127.0.0.1.evil.com` and `1270.0.0.1` refused.
- [x] 9.3 Confirm nothing in tree relied on a remote `http:` authorization endpoint (no fixture or
      call site in either repo sets one).

## 8. Follow-ups — recorded, not done here

These three are deliberately left unchecked: 8.1 and 8.2 ask for *new change proposals* (one here,
one in the downstream repo) rather than code in this change, and 8.3 needs a human at a real
provider.

- [ ] 8.1 Record the `ToolsetRedirectState.toolsetId` → `resourceId` rename (design D6) as its own
      change: it touches all three resource-kind flows and their callback branches, and would blur
      this change's boundary.
- [ ] 8.2 Record the downstream migration as a change **in that repo**: delete its ~800 copied lines
      (`utils/toolsets.ts`, `types/toolsets.ts`, `models/toolsets.ts`,
      `hooks/toolsets/useToolsetLogin.ts`, the callback page's flow half) and consume the package.
      Blocked only on a published build and a version bump there; nothing downstream breaks in the
      meantime.
- [ ] 8.4 Tighten the editor's own validation so an `http:` authorization endpoint is rejected at
      save time with a specific message. `isToolsetAuthValid` still accepts it via
      `isOptionalValidEndpointUrl` (which allows `http`/`https`/`sse` for the *toolset* endpoint), so
      after design **D16** such a toolset saves cleanly and then fails at login with the generic
      "OAuth configuration is missing" error. It fails closed, which is correct, but the message
      points at the wrong thing.
- [ ] 8.5 Harden the OAuth callback's CSRF `state` check to an unconditional equality comparison,
      per the `info` item in PR #8493's security review. It is currently skipped when the stored
      redirect state carries no `state` field, for redirect states written before that field
      existed. Exploiting it needs same-origin code execution (writing a crafted state into the
      popup's own `sessionStorage`), so the review records no required change; the prerequisite is
      confirming no old-format states remain in circulation.
- [ ] 8.3 Manual verification against a live provider — this change alters the acknowledgement
      timing, which unit tests cover with fake timers but cannot prove end to end. Needs a human:
      OAuth login through a real popup for a toolset, an external service, and offline credentials;
      a cancelled consent screen; and a COOP-severed popup closing itself. Not blocking, and not
      sufficient on its own to call the change complete.
