# Design

## Context

See `proposal.md` — Why. The relevant existing pieces:

- `libs/skills/src/components/ChatSkill/ChatSkill.tsx` already has one binary special-case tooltip: `isUnsupported` swaps `SkillInfoTooltipContent`'s description+"View details" content for a single fixed message (`unsupportedTooltipLabel`), with no button (`ChatSkill.tsx:82-93`, `SkillInfoTooltipContent.tsx:25-27`). This is the exact mechanism we extend — not a new one.
- `libs/skills/src/hooks/useSkillSelectorOverlay/useSkillSelectorOverlay.tsx` builds `skillByUrl` from `skills ∪ sharedWithMe ∪ publicSkills` (all three already passed in by the app from `useSkills()`) and falls back to `getSkillFallbackName(url)` — the url's last `/`-segment — when a url matches none of them (`useSkillSelectorOverlay.tsx:92-99`, `skill-url.ts`). This is where "resolved vs. not" is already decided today.
- `apps/chat/src/components/SkillSelector/useSkillSelectorOverlay.tsx` is the app-edge wrapper that supplies the lib hook's host-owned values (`skills`, `sharedWithMe`, `publicSkills`, labels, the details-panel component). The viewer's own bucket (`user.bucket`, from `UserContext`, populated once at the `/auth/me` bootstrap that gates every route via `RequireAuth`) is a value of exactly this kind — host-owned, resolved once, passed down — never read inside `libs/skills` itself.
- `libs/skills` has no dependency on `libs/chat-hooks` (confirmed: `libs/skills/package.json` lists no such dependency/peer) and must not gain one just to reuse `chat-hooks`'s `parseSkillResourceUrl`. The url shape `skills/{bucket}/{path}` is already parsed inline elsewhere in `libs/skills` (mention-matching); the bucket segment is one more trivial string split, not a reason to add a cross-lib dependency.

## Goals / Non-Goals

**Goals:**

- Give the unresolved case (today: dead-end tooltip, "View details" that opens nothing) an honest, actionable tooltip with two variants, computed from data already in memory.
- Keep the change inside the existing `isUnsupported`-style branch mechanism in `ChatSkill`/`SkillInfoTooltipContent`, rather than introducing a parallel rendering path.
- Preserve `libs/skills`'s host-agnosticism: no bucket/user/auth knowledge enters the lib as a *concept* — it receives a plain string (the viewer's bucket) and does its own local, already-established url parsing.

**Non-Goals:**

- Distinguishing "never shared" from "shared then revoked" from "shared then the skill itself was deleted" for a foreign-bucket skill — all three read identically from the viewer's side without an extra request, and the proposal's wording ("ask the chat owner") is deliberately correct for all three.
- Any change to the composer/selection flow, the "View details" side panel's own data-fetch behavior for *resolved* skills, or the message bubble's generic edit/delete hover actions (confirmed out of scope during exploration).
- Anonymous/public-link viewing — confirmed not to exist in this app (every conversation view is gated behind `RequireAuth`/`Authenticated`), so no code path needs a "no bucket at all" branch.

## Decisions

### Decision 1: Extend the existing `isUnsupported`-style branch, not a new component

`ChatSkillProps` gains an `unresolvedReason?: 'deleted' | 'not-shared'` prop (mutually exclusive with `isUnsupported` in practice — a skill is never both unsupported-by-model and unresolved, since the unsupported check only ever runs on the currently-selected, resolved skill in the live composer). `SkillInfoTooltipContentProps` gains an `unresolvedReason` pass-through, branching before the existing `unsupportedMessage != null` check:

```
if (unresolvedReason === 'deleted')   -> trash icon + fixed deleted message, no button
if (unresolvedReason === 'not-shared') -> lock icon + fixed not-shared message, no button
if (unsupportedMessage != null)        -> existing unsupported branch, unchanged
else                                    -> existing description + "View details" branch, unchanged
```

**Alternative considered:** a wholly separate `UnresolvedSkillTooltip` component/prop path. Rejected — it would duplicate `InteractiveTooltip` wiring (`ChatSkill.tsx:74-93`) and the `detailsTrigger`/`tooltipGeneration` mechanics for no benefit; the existing branch already does "swap tooltip content, drop the button" for exactly this shape of case.

### Decision 2: Resolution + reason computed once, in the lib-level history-rendering hook, not per-render inside `ChatSkill`

`useSkillSelectorOverlay.tsx`'s `renderHistorySkillSegments`/`renderHistorySkills` already look up `skillByUrl.get(url)` per entry (lines ~236-283, ~290-314). Add, immediately alongside that lookup:

```
resolved = skillByUrl.get(url)
if (resolved == null) {
  reason = urlBucketSegment(url) === viewerBucket ? 'deleted' : 'not-shared'
}
```

`viewerBucket: string` becomes a new required parameter of the lib-level `useSkillSelectorOverlay` hook (alongside the existing `skills`/`sharedWithMe`/`publicSkills`), supplied by the app-level wrapper as `user.bucket` from `UserContext`. `urlBucketSegment` is a small local helper in `libs/skills` (the same `skills/{bucket}/{path}` split the lib already performs elsewhere) — not an import from `chat-hooks`.

**Alternative considered:** compute the reason at the app edge and pass a `Map<url, reason>` or a resolver callback into the lib hook. Rejected as needless indirection — the lib hook already has the url and the (now-passed-in) bucket at the exact point it decides the fallback name; a callback would just re-enter the lib to do the same one-line comparison the lib can do inline.

**Alternative considered:** pass `parseSkillResourceUrl` itself down from `chat-hooks` as a callback prop. Rejected — it exports a `{ bucket, path } | null` shape for a concern (full resource-url parsing) broader than the one field this change needs; a private local helper keeps `libs/skills`'s existing url-handling self-contained.

### Decision 3: `not-shared` covers "foreign bucket," full stop — no distinction between never-shared, unshared, and deleted-by-owner

Stated in the spec delta and Non-Goals above. Any attempt to narrow this further needs a request this change is explicitly avoiding, so the three foreign-bucket cases collapse into one reason and one message.

### Decision 4: Symmetric application via the existing shared call sites

`renderHistorySkillSegments` (user messages) and `renderHistorySkills` (assistant messages) already resolve through the same `skillByUrl` map and already pass the same `onViewDetails` callback (confirmed during exploration — no existing asymmetry). Adding the `reason` computation to both, from the one shared lookup point, keeps them symmetric by construction rather than requiring a separate check in two places.

## Risks / Trade-offs

- **[Risk] A skill created after the "own bucket" check with a bucket string that doesn't exactly match `user.bucket`'s casing/format** → Mitigation: both values come from the same DIAL Core-issued bucket identifier used identically elsewhere (`SkillEditor.tsx`'s `personalBucket = user?.bucket` comparison against `parseSkillResourceUrl`'s bucket), so no new normalization risk is introduced beyond what already exists.
- **[Risk] Future reuse of `ChatSkillProps.isUnsupported` and the new `unresolvedReason` together on the same chip (e.g. a model-unsupported check running on a chip that is also unresolved)** → Mitigation: document on both props that `unresolvedReason` takes precedence when both are somehow set, matching the branch order in Decision 1; in practice `isUnsupported` only ever applies to the live, resolved, currently-selected composer chip, never to a history chip, so the two do not co-occur today.
- **[Trade-off] `not-shared` cannot tell the user whether asking the owner will actually help (skill might be truly gone)** → Accepted per Decision 3 and the proposal's Non-Goals; asking the owner is still the only actionable, honest next step available without a new request.

## Migration Plan

Purely additive/branching UI logic behind new optional props with no default that changes existing call sites' behavior (`unresolvedReason` defaults to `undefined`, which falls through to today's existing branches unchanged). No data migration, no persisted shape change, no endpoint change. Ships and rolls back as an ordinary frontend deploy; reverting removes the new branch and prop, restoring today's dead-end tooltip with no other side effects.
