Slicing: contract-first. Slice 1 fixes the wire contract in the library so an editor can be built against it in
parallel; slices 2–3 build the host end to end; slice 4 documents and verifies.

## 1. Library contract (`libs/visualizer-connector`)

- [x] 1.1 Add `RequestExternalServiceLogin = 'REQUEST_EXTERNAL_SERVICE_LOGIN'` and
      `ExternalServiceLoginResult = 'EXTERNAL_SERVICE_LOGIN_RESULT'` to `AppsEditorMessages` in
      `libs/visualizer-connector/src/types/visualizer-connector.ts`
- [x] 1.2 Add `AppsEditorExternalServiceLoginRequestMessage` to `AppsEditorClientMessage` and
      `AppsEditorExternalServiceLoginResultMessage` to `AppsEditorHostMessage` in
      `libs/visualizer-connector/src/models/apps-editor.ts`
- [x] 1.3 Parse both in `libs/visualizer-connector/src/lib/apps-editor-protocol.ts` (identifiers, boolean
      `offlineUsageConsent` / `success`, optional string `reason`; reject the wrong direction)
- [x] 1.4 Add `requestExternalServiceLogin(appId, serviceId, { offlineUsageConsent })` to
      `libs/visualizer-connector/src/lib/AppsEditorClient.ts`
- [x] 1.5 Tests in `libs/visualizer-connector/src/lib/tests/apps-editor-protocol.spec.ts` and
      `libs/visualizer-connector/src/lib/tests/AppsEditorChannel.spec.ts`: valid request and result, malformed
      fields, wrong direction, client helper wire output
- [x] 1.6 Architecture guard: the library diff adds no API client, `/api` path, session, feature flag, OAuth or
      credential-level knowledge

## 2. Host plumbing (`apps/chat`)

- [x] 2.1 Add `ExternalServiceLogin = 'externalServiceLogin'` to `AppsEditorIframeQuery` and the request/result
      members to `AppsEditorEvent` in `apps/chat/src/types/apps-editor.ts`; keep the wire-value equality with the
      library enum
- [x] 2.2 Add a thin `listExternalServices(appId)` wrapper over the generated `externalServicesApi` method in
      `apps/chat/src/server-api/external-services.ts`
- [x] 2.3 Add the optional `popup?: Window` to `ExternalServiceLoginParams` and use it in `loginWithOAuth` and
      `loginWithDialNative` in `apps/chat/src/hooks/externalServices/useExternalServiceLogin.ts`; extend its tests
      for a supplied popup (navigated, not reopened; closed on early failure)

## 3. Host relay (`AppEditorIframe.tsx`) — depends on 1 and 2

- [x] 3.1 Advertise `externalServiceLogin` with the same gate value as `applicationCredentials`
- [x] 3.2 Implement `handleExternalServiceLoginRequest` (design D2–D4) and dispatch it from `handleMessage` only
      when both gates are on
- [x] 3.3 Tests in `apps/chat/src/pages/ApplicationEditor/setup/tests/AppEditorIframe.spec.tsx`: advertised value
      for gates on/off; OAuth success with `USER` level and the forwarded `offlineUsageConsent`; DIAL-native path;
      each failure reason; raw ids echoed; foreign origin/window and invalid payload ignored; popup opened before any
      awaited call

## 4. Documentation and verification

- [x] 4.1 `libs/visualizer-connector/README.md`: the client helper row and the two `AppsEditorMessages` rows
- [x] 4.2 `apps/chat/README.md` and `docs/auth/auth-bff-encrypted-cookie.md`: the relay next to the existing
      `REQUEST_APPLICATION_CREDENTIALS` description; `apps/chat/src/server-api/tests/external-services.api.spec.ts` covers
      the new listing wrapper
- [x] 4.3 `npm exec nx test visualizer-connector`, `npm exec nx test chat`, `npm exec nx lint chat`,
      `npm run validate:specs`

## 5. Follow-ups (out of scope)

- [ ] 5.1 Decide on a host-side restriction of the `appId` an editor may name (proposal, open questions)
- [ ] 5.2 Logout and API-key relays if an editor without its own BFF session needs them
