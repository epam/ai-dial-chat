## MODIFIED Requirements

### Requirement: Subscriber release and upstream termination are bounded; ownership handoff is not

Upstream termination SHALL be bounded: every cancellation entry point SHALL abort the entry's `AbortController`.

Subscriber and resource release SHALL be bounded: if a generation's terminal write has not settled within a configured finalization bound measured from the moment that write was dispatched, the entry SHALL deliver its terminal event to every subscriber, remove all listeners, clear its timer, and release its runtime generation tracking — so no attach subscriber or SSE response is held open by an unsettled write.

That bound SHALL also cover subscribers that would arrive after it: once an entry's subscriber resources have been released — by the finalization bound or by any other path that releases them while the key is retained — `attach(ownerKey, path)` SHALL return no attachment for that entry, exactly as for an absent entry, so no listener can be added to an emitter that will never deliver another terminal event and no later settlement is relied on to release one. The check SHALL key on the entry's resources-released guard, not on a particular lifecycle state, and SHALL be evaluated in the same synchronous step that would otherwise hand out the attachment. An entry whose resources have not yet been released — including one in `Finalizing` — SHALL keep returning its attachment unchanged.

Safe ownership handoff SHALL NOT be bounded. An entry whose terminal write has not settled SHALL be **retained** in the registry in a distinct retained state, continuing to own its `ownerKey + path` key and continuing to reject `register` with 409, because releasing the key would readmit the stale-overwrite this capability exists to prevent. Ownership SHALL NOT be cleared merely in order to report fewer active generations, and SHALL NOT be cleared in order to refuse an attach: refusing a late attachment SHALL NOT remove, replace, or settle the retained entry, and SHALL NOT change `hasLocalForegroundGeneration`, `abort`, or any lease-scoped worker method.

Recovery SHALL be: the write settling — resolving or rejecting — releases the entry; otherwise the entry persists for the process lifetime and a process restart clears it. A terminal write that fails or whose failure is ambiguous about whether the data was committed SHALL be treated as settled, and ownership released, because the worker is demonstrably finished. When the terminal save throws, the worker SHALL settle through `persistenceFailed(lease)`, which delivers `{ type: 'error', errorType, message }` taken from `GENERATION_PERSISTENCE_ERROR` to every subscriber regardless of the cancellation reason — including a user Stop — so a storage failure stays visible, and the completion stream SHALL yield one additional `data: { error: GENERATION_PERSISTENCE_ERROR }` SSE frame.

#### Scenario: A never-settling terminal write releases subscribers but not ownership

- **GIVEN** a generation's terminal write is dispatched and never settles
- **WHEN** the finalization bound elapses
- **THEN** every attach subscriber receives its terminal event and is unsubscribed, the entry's timer and runtime tracking are released, the entry remains in the registry in the retained state, and a `register` for the same principal and path still returns 409

#### Scenario: A slow but healthy terminal write is neither cancelled nor duplicated

- **GIVEN** a generation's terminal write exceeds the finalization bound and then succeeds
- **WHEN** it resolves
- **THEN** no second write was attempted, the write was not cancelled, and the entry leaves the retained state and releases its registry key

#### Scenario: An ambiguous persistence failure releases ownership

- **WHEN** a terminal write rejects without establishing whether the data was committed
- **THEN** the failure is logged, the entry settles and releases its registry key, and no second write is attempted

#### Scenario: A failed terminal save after a user Stop reports a persistence error

- **GIVEN** a generation was stopped by the user
- **WHEN** its terminal save rejects
- **THEN** every subscriber receives an `error` terminal event carrying `GENERATION_PERSISTENCE_ERROR`'s type and message rather than `stopped`, and the completion stream emits a `GENERATION_PERSISTENCE_ERROR` SSE frame

#### Scenario: An attach after the finalization bound gets no attachment while ownership is retained

- **GIVEN** a generation's terminal write is dispatched, the finalization bound has elapsed, and the write is still pending
- **WHEN** `attach` is called for the same principal and path, once or repeatedly
- **THEN** every call returns no attachment, the entry's emitter gains no listener, no timer is armed, and `register` for the same principal and path still throws `ConflictException`

#### Scenario: Settlement after a refused late attach still frees the key once

- **GIVEN** a late `attach` was refused for a retained entry
- **WHEN** the pending terminal write then resolves or rejects and the worker settles its lease
- **THEN** the key is released and runtime tracking is finished exactly once, a later `register` for the same principal and path succeeds, and a further settlement call on the old lease is a no-op that cannot affect the new entry

#### Scenario: An attach from inside a terminal notification is refused

- **GIVEN** an entry is releasing its subscriber resources — on settlement, the finalization bound, or shutdown — and is notifying its `terminal` listeners
- **WHEN** a listener calls `attach` for the same principal and path from inside that notification
- **THEN** `attach` returns no attachment, while the key is still owned at that moment (`hasLocalForegroundGeneration` is true for a non-background entry)

#### Scenario: An attach during finalization, before the bound, still receives the terminal event

- **GIVEN** a generation has entered `Finalizing` and the finalization bound has not elapsed
- **WHEN** a client attaches and the write then settles, or the bound then elapses
- **THEN** the attachment is returned and its subscriber receives exactly one terminal event and is unsubscribed
