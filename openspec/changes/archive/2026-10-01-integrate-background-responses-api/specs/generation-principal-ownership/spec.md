# Spec Delta

## MODIFIED Requirements

### Requirement: Access isolation between principals for stop and attach

A generation SHALL be visible only to the principal that started it. `POST .../completions/stop` and `POST .../completions/attach` SHALL respond `404` — the same response as for a path with no generation at all, disclosing nothing about the generation's existence — when the caller's principal key does not match the entry's.

On the background path defined by `background-responses-generation`, isolation is per DIAL user instead of per principal key: attach and Stop for a background message are authorized by reading the conversation from the caller's own bucket and by DIAL Core's per-user ownership check on the response, so any authenticated client of the same user — another cookie session, another device, or a bearer-authenticated client — MAY attach to and stop it, and a different user still receives `404`. The principal-key rules below continue to apply to the Chat Completions and stateless Responses paths.

#### Scenario: A different subject cannot stop another principal's generation

- **GIVEN** a generation is active for header principal (`providerId` P, `sub` S1) on path X
- **WHEN** header principal (`providerId` P, `sub` S2) posts to `.../completions/stop` with path X and the correct `generationId`
- **THEN** the response is `404`, and the generation for S1 keeps running

#### Scenario: The same subject from a different provider is a different principal

- **GIVEN** a generation is active for header principal (`providerId` P1, `sub` S) on path X
- **WHEN** header principal (`providerId` P2, `sub` S) posts to `.../completions/attach` with path X
- **THEN** the response is `404` and no SSE stream is opened

#### Scenario: A cookie caller cannot attach to a bearer caller's generation

- **GIVEN** a generation is active for a header principal on path X
- **WHEN** a cookie-authenticated caller posts to `.../completions/attach` with path X
- **THEN** the response is `404`

#### Scenario: Another session of the same user stops a background generation

- **GIVEN** a background generation was started from one cookie session
- **WHEN** a second cookie session, or a bearer-authenticated client, of the same DIAL user posts Stop with its `generationId` and path
- **THEN** the response is `204` and the generation is stopped
