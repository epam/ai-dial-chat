## Context

`persistFormIfChanged` (`ToolsetEditor.tsx:212-252`) already returns the toolset id as
`Promise<string | null>` — it resolves to the current/created id on success (including the
"nothing changed, no request sent" case) or `null` on failure. `handleEnsureSaved`
(`ToolsetEditor.tsx:268-271`), the callback passed to `AuthSection` as `onEnsureSaved`, discards
that id and hands `AuthSection` only a `boolean`:

```ts
const handleEnsureSaved = useCallback(
  async () => (await persistFormIfChanged()) != null,
  [persistFormIfChanged],
);
```

`AuthSection.handleLogIn` (`AuthSection.tsx:119-202`) then falls back to the `toolsetId` prop it
closed over at click time. For a brand-new toolset that prop is `''` at the moment "Log In" is
clicked (`ToolsetEditor.tsx:90-91`: `draftToolsetId` starts as `''`, and `setDraftToolsetId` from
inside `persistFormIfChanged` only takes effect on the next render). So the very first login
call — the OAuth popup's `initiateOAuthLogin(auth, toolsetId)` at `AuthSection.tsx:126`, or the
API-key `loginToolset(toolsetId, body)` at `AuthSection.tsx:192` — is sent with an empty id and
fails. The next click, on the re-rendered form, has the real `toolsetId` prop and succeeds. The
underlying id-returning plumbing is already in place; the only gap is that the id is thrown away
at the `onEnsureSaved` boundary and never reaches the code that needs it.

## Goals / Non-Goals

**Goals:**

- The first "Log In" click for a brand-new toolset succeeds without requiring a second click.
- `AuthSection` always authenticates against the id that was actually just persisted, not a
  value captured before persistence ran.

**Non-Goals:**

- No change to the OAuth redirect/callback handshake, popup mechanics, or logout flow.
- No change to `persistFormIfChanged`'s existing return type or unchanged-form short-circuit —
  it already returns the right value.
- No change to backend endpoints or DTOs.

## Decisions

- **Change `onEnsureSaved`'s contract from `Promise<boolean>` to `Promise<string | false>`.**
  `handleEnsureSaved` returns `(await persistFormIfChanged()) ?? false` instead of coercing to a
  boolean, so the id `persistFormIfChanged` already computes reaches the caller instead of being
  dropped. Chosen over adding a second callback (e.g. `getCurrentToolsetId`) or reading a ref,
  because the id is already the resolved value of the promise the caller awaits — no new state
  or plumbing is needed, just not discarding it.
- **`AuthSection.handleLogIn` uses the id returned by `onEnsureSaved()` for every call that
  follows it in the same invocation** — `initiateOAuthLogin(auth, savedId)`, the
  Cancelled-recheck `getToolset(savedId)`, and `loginToolset(savedId, body)` — instead of the
  `toolsetId` prop. The `toolsetId` prop remains used for anything evaluated *before* the
  persist step (e.g. `isEditMode`, `canLogIn`), where it is not stale.
- **`AuthSection`'s `Props.onEnsureSaved` type updates to `() => Promise<string | false>`** to
  match, keeping the "id or failure" contract explicit at the type level rather than relying on
  a truthy/falsy convention that previously hid the discarded id.

## Risks / Trade-offs

- [Call sites elsewhere assume `onEnsureSaved` returns a boolean] → Grep confirms `AuthSection`
  is the only consumer of this prop; no other change needed.
- [A `''` id could be mistaken for failure under the new `string | false` contract] →
  `persistFormIfChanged` never resolves to `''` — it resolves to a real backend-issued id or
  `null` (mapped to `false`), so an empty-string false-positive isn't reachable.
