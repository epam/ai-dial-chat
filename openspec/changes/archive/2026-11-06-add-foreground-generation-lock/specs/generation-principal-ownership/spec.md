## MODIFIED Requirements

### Requirement: Access isolation between principals for stop and attach

A generation's registry entry SHALL be visible only to the principal that started it. `POST .../completions/stop` and `POST .../completions/attach` SHALL respond `404` when the caller's principal key does not match the entry's and no rule below authorizes the caller. That is the same response as for a path with no generation at all, so it discloses nothing about the generation's existence.

**Background path.** On the background path defined by `background-responses-generation`, isolation is per DIAL user instead of per principal key. Attach and Stop for a background message are authorized by reading the conversation from the caller's own bucket and by DIAL Core's per-user ownership check on the response. Any authenticated client of the same user — another cookie session, another device, or a bearer-authenticated client — MAY attach to and stop it, and a different user still receives `404`.

**Foreground Stop.** On the Chat Completions and stateless Responses paths, Stop is additionally authorized by the stored marker.

- A Stop naming the `generationId` of a live `foregroundGeneration` marker is stored on that marker with the caller's own token (`foreground-generation-lock` "A Stop from any writer is stored on the marker").
- Any caller DIAL Core lets write the conversation MAY therefore stop it: another session or device of the same user, or an editor of a shared project.
- A caller who cannot read or write the conversation still receives `404`. In a project, a view-only caller receives `403` from the write-access check first.

**Foreground attach** stays scoped to the principal key on those paths: another principal's attach receives `404`.

The principal-key rules below continue to apply to the registry on the Chat Completions and stateless Responses paths.

#### Scenario: A different subject cannot stop another principal's generation

- **GIVEN** a generation is active for header principal (`providerId` P, `sub` S1) on path X in S1's own bucket
- **WHEN** header principal (`providerId` P, `sub` S2), who cannot write that conversation, posts to `.../completions/stop` with path X and the correct `generationId`
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

#### Scenario: Another session of the same user stops a foreground generation

- **GIVEN** a foreground generation was started from one cookie session and holds a live marker
- **WHEN** a second cookie session of the same DIAL user posts Stop with its `generationId` and path
- **THEN** the response is `204` and the generation stops as a user stop

#### Scenario: An editor stops another editor's foreground generation

- **GIVEN** editor E1 runs a foreground generation in a conversation of a project shared with E2 for writing
- **WHEN** E2 posts `.../completions/stop` for that conversation with its `generationId`
- **THEN** the response is `204` and the generation stops as a user stop, while E2's attach for the same conversation still receives `404`
