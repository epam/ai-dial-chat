## Context

Toolset OAuth login opens a same-origin popup and navigates it to the provider's authorize URL.
The provider redirects back into a callback route running inside that popup
(`ToolsetAuthCallback.tsx`), which submits the auth code, then reports the outcome to the opener
over a flow-scoped `BroadcastChannel` and closes itself. The opener
(`waitForToolsetOAuthResult` in `apps/chat/src/utils/toolsets.ts`) both listens on that channel
and polls `popup.closed` every 500ms, so it can detect a manual cancellation (the user closes the
popup without ever completing the OAuth flow).

Today the popup closes itself via a fixed ~50ms `setTimeout` right after `postMessage`. The
opener treats `popup.closed` as a signal only after a further `closeGraceMs` (300ms) with no
message — under load, the message can still be in flight past that grace window, so a
successful login resolves as `Cancelled`. Both call sites (Catalog Details Panel's
`CatalogView.tsx`, Toolset Editor's `AuthSection.tsx`) already carry a best-effort `getToolset`
re-check for a `Cancelled` result, but it is a single immediate GET wrapped in an empty
`catch {}` — by design, a result that still looks like "not signed in" (including a request
failure) is treated as a genuine cancel and stays silent.

This design does not touch that re-check; it removes the primary source of false `Cancelled`
results so the re-check is needed far less often.

## Goals / Non-Goals

**Goals:**

- Eliminate the popup-close vs. `BroadcastChannel`-message race for the success/failure path:
  make it structurally impossible for the opener to close (or consider closed) the popup before
  it has received the popup's message.
- Preserve today's behavior for a genuine manual cancellation (user closes the popup before any
  result is ever posted) — no scenario described in `toolset-authentication`'s "OAuth redirect
  and callback handshake" requirement or its "Cancel" scenarios should regress.
- Guarantee the popup never lingers open indefinitely, even if the opener tab is gone.
- Fix the unrelated but adjacent API-key success-notification gap in `AuthSection.tsx`.

**Non-Goals:**

- Redesigning the `BroadcastChannel` transport itself (channel naming, message schema) — unchanged.
- Removing the `getToolset` re-check on `Cancelled` — kept as a secondary safety net for cases
  this redesign doesn't cover (opener gone, browser storage partitioning edge cases).
- Any backend/API change — the login/logout endpoints and their contracts are untouched.
- Changing the QuickApps `postMessage` login relay's own popup handling
  (`AppEditorIframe.tsx`) beyond the shared utility it calls — it inherits the fix automatically
  since it drives the popup through the same `navigateToolsetOAuthPopup` /
  `waitForToolsetOAuthResult` pair.

## Decisions

### Decision: the opener closes the popup, not the popup itself

**Chosen approach:** the callback popup posts its result over `BroadcastChannel` and then stops
— it does not call `window.close()`. `waitForToolsetOAuthResult`'s `channel.onmessage` handler,
after resolving the result, calls `popup.close()` itself before returning.

Because the message is now guaranteed to arrive strictly before the popup closes (closing is a
*consequence* of the opener having processed the message, not a competing independent timer),
there is no window in which `popup.closed` can be observed true before the message is delivered
for the success/failure path. The existing `popup.closed` poll + `closeGraceMs` grace period
keeps its original purpose — detecting the user closing the popup manually before any message
was ever sent — and needs no behavior change, since that path never had a message to lose.

**Alternatives considered:**

- *Ack handshake* (popup posts result, waits for an `ack` message from the opener, then closes
  itself; opener acks immediately on receipt): also removes the original race, but replaces it
  with a smaller one (the `ack` itself can be lost) and requires new message plumbing and a
  popup-side timeout in two directions. Rejected as more complex for an equivalent — not
  strictly better — outcome than having the opener just close the window it already holds a
  reference to.
- *Increase `closeGraceMs`*: cheaper, but does not remove the race, only shrinks its probability
  window; still nondeterministic and was the status quo's mitigation already. Rejected as not
  actually fixing the bug.

### Decision: popup-side safety-net auto-close timer

**Chosen approach:** after posting its result, the popup starts its own bounded timer (e.g. a
few seconds) and self-closes if it is still open when that timer fires. This only matters when
the opener cannot close it — the opener tab was closed or navigated away between login start and
message delivery. In the common case (opener present), the opener closes the popup well before
this timer would ever fire.

**Alternatives considered:**

- *No safety net*: simplest, but leaves an orphaned browser window/tab indefinitely if the
  opener disappears mid-flow. Rejected — poor UX, and the current behavior always closes the
  popup one way or another.

### Decision: no change to the `getToolset` re-check on `Cancelled`

The re-check stays as-is. It now only needs to cover cases outside this redesign's scope (opener
gone before it could close the popup, or the rare case where the opener's own channel is torn
down before the message arrives for reasons unrelated to popup-close timing). Its existing
silent-on-failure behavior for a **genuine** cancel is intentional and documented in code; this
change doesn't touch that judgment call.

### Decision: add the missing success notification for API-key login in the Editor

`AuthSection.tsx`'s API-key branch (`handleLogIn`) awaits `loginToolset` and updates
`isLoggedIn` on success but never calls `showNotification`, unlike its OAuth sibling branch and
unlike the Catalog's `CatalogView.tsx` login handler for the same auth type. This is a plain gap,
not a race — add the same success toast used elsewhere for consistency.

## Risks / Trade-offs

- **[Risk] Opener processing the message is itself delayed (e.g. main thread busy with other
  work) → the popup could sit open longer than today's ~50ms before it's closed.** → Mitigation:
  imperceptible in practice (typically well under a second) and strictly better than the current
  outcome, where the popup closes fast but the *login result* is lost; a slightly longer-lived
  popup is an acceptable trade for a correct outcome. The safety-net timer bounds the worst case.
- **[Risk] Opener tab is closed/backgrounded and heavily throttled by the browser right as the
  message arrives, delaying `popup.close()`.** → Mitigation: same class of delay the current
  `popup.closed` polling already tolerates (500ms poll interval); not a regression, and the
  safety-net timer provides an upper bound regardless.
- **[Risk] Multiple browser tabs/windows with the same origin could have more than one listener
  on channels with colliding names.** → Mitigation: unchanged from today — `flowId` is a
  `crypto.randomUUID()` scoped per login attempt, so channel names don't collide across
  concurrent flows; out of scope for this change.

## Migration Plan

Frontend-only change behind no feature flag; ships as a normal deploy. No data migration, no
backend contract change. Rollback is a plain revert of the two touched files
(`toolsets.ts`, `ToolsetAuthCallback.tsx`) plus the notification addition in `AuthSection.tsx`.

## Open Questions

- Exact safety-net timeout value for the popup's self-close fallback (proposed: 3–5s) — can be
  tuned during implementation/review without affecting the design.
