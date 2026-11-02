## ADDED Requirements

### Requirement: Application editors can sign in to one external service through the Chat host

`AppEditorIframe` SHALL add `externalServiceLogin` to the editor iframe URL with the same value it gives
`applicationCredentials`: `true` only when both credential capability gates are enabled. An editor SHALL treat a
missing or `false` value as "not supported" and may fall back to `REQUEST_APPLICATION_CREDENTIALS`.

`AppEditorIframe` SHALL handle `{ type: 'REQUEST_EXTERNAL_SERVICE_LOGIN', appId: string, serviceId: string,
offlineUsageConsent: boolean }` only when both gates are enabled, `event.origin` equals the configured editor URL's
origin, `event.source` is the current iframe's `contentWindow`, `appId` and `serviceId` are nonempty strings and
`offlineUsageConsent` is a boolean. Other messages SHALL be ignored.

For a handled request the host SHALL, without opening any host dialog:

1. open the shared OAuth popup before awaiting anything;
2. read the application's public external-service listing for `normalizeDeploymentId(appId)` and select the entry
   whose `id` equals `serviceId`;
3. sign the person in through `useExternalServiceLogin` at `USER` level, passing the opened popup, the entry's OAuth
   settings and the request's `offlineUsageConsent` unchanged — `OAUTH` and `DIAL_NATIVE` services only;
4. post `{ type: 'EXTERNAL_SERVICE_LOGIN_RESULT', appId, serviceId, success, reason? }` to the iframe, echoing the
   `appId` and `serviceId` exactly as received.

`reason` SHALL be one of `popup-blocked`, `not-found`, `unsupported-auth-type`, `cancelled`,
`admin-consent-required`, `offline-unavailable`, `failure`. The host SHALL close the popup on every failure it
detects before navigating it. The host SHALL NOT set `offlineUsageConsent` on the person's behalf.

The handler SHALL be memoized and included in `handleMessage`'s dependencies. No new feature flag, translated
string, cache or visual surface is introduced; RTL and keyboard behavior are unchanged.

#### Scenario: Host advertises the relay only with both gates

- **WHEN** both credential gates are enabled
- **THEN** the iframe URL carries `externalServiceLogin=true`
- **AND** with either gate disabled it carries `externalServiceLogin=false` and requests are ignored

#### Scenario: One OAuth service is signed in without the credentials dialog

- **WHEN** the current editor sends a trusted request for service `gitlab-oauth` of `applications/public/runner app`
  with `offlineUsageConsent: true`
- **THEN** the host opens only the provider's consent popup, signs the person in at `USER` level with offline-use
  consent for `applications/public/runner%20app`
- **AND** posts `EXTERNAL_SERVICE_LOGIN_RESULT` with `success: true`, `appId: 'applications/public/runner app'` and
  `serviceId: 'gitlab-oauth'`
- **AND** no `ApplicationCredentials` dialog is mounted

#### Scenario: The popup is reserved before the lookup

- **WHEN** a trusted request arrives
- **THEN** the OAuth popup is opened before the service listing is requested
- **AND** a blocked popup answers `success: false, reason: 'popup-blocked'` without requesting the listing

#### Scenario: Unknown or unsupported service

- **WHEN** the listing has no entry with the requested `serviceId`, or the entry's authentication type is `API_KEY`
  or `NONE`
- **THEN** the host closes the popup and answers `success: false` with `not-found` or `unsupported-auth-type`

#### Scenario: Consent is forwarded, never defaulted

- **WHEN** a trusted request carries `offlineUsageConsent: false`
- **THEN** the sign-in is made without offline-use consent

#### Scenario: Other origins, windows or malformed payloads are ignored

- **WHEN** the message origin or source is not the current editor, or `serviceId` is empty, or
  `offlineUsageConsent` is missing
- **THEN** no popup opens and no result is posted
