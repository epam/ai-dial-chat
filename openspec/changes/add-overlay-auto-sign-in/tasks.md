## 1. Protocol types

- [x] 1.1 Add `autoSignInProvider?: string` to the `auth` object on `ChatOverlayOptions` in `libs/chat-overlay/src/protocol/overlay-protocol.ts`, with JSDoc stating that its presence enables overlay auto sign-in, that the provider must also be mapped to `OverlayAuthUiMode.SameWindow`, and that it supersedes the legacy `signInOptions.autoSignIn` + `signInProvider` pair.
- [x] 1.2 Add `authAutoSignInProvider?: string` to `SetOverlayOptionsPayload` in the same file, documented as the opaque wire form.
- [x] 1.3 Extend `libs/chat-overlay/src/protocol/tests/overlay-protocol.spec.ts` with a type-surface assertion for both fields being optional.

## 2. Library payload emission

- [x] 2.1 In `libs/chat-overlay/src/lib/ChatOverlay.ts`, serialize `authAutoSignInProvider` from `options.auth?.autoSignInProvider` inside `sendCurrentOverlayOptions()`, omitting it when absent, empty, or whitespace-only.
- [x] 2.2 Add `ChatOverlay` tests in `libs/chat-overlay/src/lib/tests/ChatOverlay.spec.ts` for: constructor with the field transmits it alongside `authProviderUiModes`; no `auth` omits it; whitespace-only omits it; `setOverlayOptions({ auth })` adds it; a later `setOverlayOptions` without it drops it.
- [x] 2.3 Run `npm exec nx test @epam/ai-dial-chat-overlay` and `npm exec nx lint @epam/ai-dial-chat-overlay`.

## 3. App-side trusted state

- [x] 3.1 In `apps/chat/src/context/overlay/OverlayContext.tsx`, add a `getAuthAutoSignInProvider` reader beside `getAuthProviderUiModes` that returns the trimmed string or `undefined` for a missing, non-string, or blank value.
- [x] 3.2 Store it in state from the `SET_OVERLAY_OPTIONS` handler, expose `authAutoSignInProvider: string | undefined` on the context type and in the memoised context value.
- [x] 3.3 Extend `apps/chat/src/context/overlay/tests/OverlayContext.spec.tsx`: valid id stored; absent field leaves it `undefined`; non-string and whitespace-only treated as absent with the handshake still answered `{ applied: true }`.
- [x] 3.4 Run `npm run test:file -- apps/chat/src/context/overlay/tests/OverlayContext.spec.tsx`.

## 4. Loop guard helper

- [x] 4.1 Add a session-storage attempt helper (record / read-recent) with a 60 second TTL keyed on `href`, modelled on `useAuthRedirect`'s `chat.auth.redirectAttempt` guard, with try/catch on both read and write so a storage-blocked iframe degrades to "no record" and a failing write never blocks navigation. Export the storage key for tests.
- [x] 4.2 Unit-test the helper: fresh record suppresses, expired record does not, record for another href does not, throwing storage is treated as no record.

## 5. Auto-start effect

- [x] 5.1 In `apps/chat/src/hooks/auth/useOverlayProviderLogin.ts`, read `authAutoSignInProvider` from `useOptionalOverlay()` and add the auto-start `useEffect`: fire once per mount behind a `useRef` latch, only after provider discovery settles, only when the id is in the provider list, only when its resolved mode is `SameWindow`, and only when the loop guard allows it; record the attempt, then call the existing `openProviderLogin(providerId)`.
- [x] 5.2 Log exactly one console warning per suppression path, naming the reason: unmapped/`External` mode, unknown provider id, recent attempt.
- [x] 5.3 Extend `apps/chat/src/hooks/auth/tests/useOverlayProviderLogin.spec.tsx`: SameWindow auto-navigates to `/api/v1/auth/login/<id>?callbackUrl=<href>`; fires once across re-renders; External does not navigate and does not call `window.open`; provider absent from `providerUiModes` does not navigate; unknown id does not navigate; failed provider discovery does not navigate; fresh attempt record suppresses; no `authAutoSignInProvider` leaves current behaviour unchanged.
- [x] 5.4 Confirm `OverlayLoginGate` needs no change, and add a gate-level test only if step 5.3 cannot cover the mount path.
- [x] 5.5 Run `npm run test:file --` for the hook spec, then `npm exec nx lint @epam/chat` and `npm exec nx typecheck @epam/chat`.

## 6. Documentation

- [x] 6.1 `docs/chat-overlay-migration-guide.md`: move `signInOptions.autoSignIn` and `signInOptions.signInProvider` out of the unsupported list into a documented successor section describing `auth.autoSignInProvider`, the `SameWindow` precondition, the silent-SSO expectation, the loop guard's 60 second window, and that the other four legacy fields remain unsupported. Update the removed-options table row for `signInOptions` accordingly.
- [x] 6.2 `libs/chat-overlay/README.md`: document the new field in the options table and show it in the `auth` example next to `providerUiModes`.
- [x] 6.3 Root `README.md`: adjust the authentication bullet so it no longer claims `signInOptions` was removed outright.
- [x] 6.4 Run `npm run validate:docs`.

## 7. Verification

- [x] 7.1 Run `npm run verify:changed`.
- [ ] 7.2 Manual check in `apps/chat-overlay-sandbox`: a `SameWindow`-mapped provider with `autoSignInProvider` navigates the iframe with no click; the same provider mapped `external` keeps the button and logs the warning; a second mount within the TTL falls back to the gate.
