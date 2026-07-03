## Context

Currently `DeploymentIcon` in `libs/chat-shared` renders a generic `FallbackEntityIcon` SVG when no image URL is available. `buildDeploymentIcon` in `libs/conversation-input` also falls back to the same `FallbackEntityIcon`. Every user-created application without a custom icon therefore shows an identical generic badge — offering no visual differentiation in the catalog, sidebar, or conversation header.

The change replaces `FallbackEntityIcon` entirely with `InitialsAvatar`: a rounded badge with a deterministic background color and 1–2 initials drawn from the deployment's display name. The generic SVG asset is deleted; `InitialsAvatar` renders in every code path where `FallbackEntityIcon` previously appeared. No backend changes are needed.

## Goals / Non-Goals

**Goals:**
- New `InitialsAvatar` component in `libs/chat-shared` — pure presentational, no side-effects, no i18n dependency.
- Two pure utility functions in `libs/chat-shared/src/utils/`:
  - `extractInitials(name: string): string` — returns 1–2 uppercase characters.
  - `pickAvatarColor(name: string): { background: string; text: string }` — deterministic, palette-based.
- `FallbackEntityIcon` (`libs/chat-shared/src/assets/fallback-entity-icon.svg`) is **deleted**; all imports are removed.
- `DeploymentIcon` removes the `FallbackEntityIcon` default fallback; accepts `initialsName?: string`; renders `<InitialsAvatar name={initialsName ?? ''} size={size} />` when no image is available.
- `buildDeploymentIcon` in `libs/conversation-input` removes its direct `FallbackEntityIcon` render path; always routes through `DeploymentIcon` with `initialsName`.
- All call sites in `apps/chat` and `libs/catalog` pass `displayName` so the initials badge is always shown when no icon image is set.

**Non-Goals:**
- No backend changes, no new API fields.
- No user-configurable color or initials override (deterministic only).
- No animation or loading skeleton — existing DeploymentIcon behavior unchanged.
- No support for emoji or non-Latin scripts in initials (simple `.slice(0,1)` is fine; a ≥2-byte codepoint in position 0 is acceptable edge-case behavior).

## Decisions

### D1 — InitialsAvatar lives in `libs/chat-shared`, not in the app

**Chosen:** `libs/chat-shared/src/components/InitialsAvatar/InitialsAvatar.tsx`

**Why:** `DeploymentIcon` already lives in `libs/chat-shared` and is consumed by both `libs/conversation-input` and `apps/chat`. Keeping `InitialsAvatar` in the same lib avoids a cross-lib import.

**Alternative considered:** place it in `libs/conversation-input`. Rejected because `DeploymentIcon` would then need to import across lib boundaries.

### D2 — Initials extraction algorithm

```
words = name.trim().split(/\s+/).filter(Boolean)
firstLetter = (word) => word.match(/\p{L}/u)?.[0] ?? ''
if words.length >= 2: initials = (firstLetter(words[0]) + firstLetter(words[1])).toUpperCase()
else:                 initials = words[0].replace(/[^\p{L}]/gu, '').slice(0, 2).toUpperCase()
return initials || '?'
```

Single-word names → first two Unicode letters ("Summarizer" → "SU"). Multi-word → first Unicode letter of each of the first two words ("My App" → "MA"). Non-letter characters (brackets, punctuation) at the start of a word are skipped via `\p{L}` Unicode letter class (`[StatGPT] Global Trusted` → "SG"). Empty string → "?" fallback.

**Why:** Consistent with avatar conventions across major products (Google, Slack, GitHub). Unicode letter regex handles names with leading brackets or punctuation — a real-world pattern in deployment names.

### D3 — Color palette and hash function

A fixed 8-colour palette of background/text pairs is defined as a constant in `libs/chat-shared/src/utils/avatar-color.ts`. The color is selected by `charCodeSum(name) % palette.length` (sum of char codes). This is stable across renders, deterministic per string, and requires zero dependencies.

**Why simple hash over MD5/SHA:** No crypto dependency, no async, no bundle size cost, sufficient uniqueness for a small palette.

**Palette:** Colours are chosen to meet WCAG AA contrast ratio (≥4.5:1) with their paired text colour. Concrete values picked during implementation; representative set:
- Teal bg / white text
- Violet bg / white text
- Amber bg / dark text
- Rose bg / white text
- Emerald bg / white text
- Sky bg / white text
- Orange bg / dark text
- Indigo bg / white text

### D4 — `initialsName` on `DeploymentIcon` is **required**; `FallbackEntityIcon` default removed entirely

`DeploymentIcon` already has a generic `fallback?: ReactNode` prop whose default was `FallbackEntityIcon`. The new default is `<InitialsAvatar name={initialsName} size={size} className="shrink-0" />`.

**Chosen:** add `initialsName: string` (required) to `DeploymentIcon` and make `InitialsAvatar` the unconditional fallback. When `initialsName` is empty the avatar renders `"?"` — still visually distinct from a broken image.

**Why:** Making the prop required prevents call sites from silently omitting it and ending up with a `"?"` avatar. The TypeScript compiler enforces that every callsite supplies a name.

**Alternative considered:** keep `initialsName` optional with `initialsName?: string`. Rejected — optional allows silent omission; all call sites are known and can be updated.

### D5 — `buildDeploymentIcon` `displayName` is **required** and 3rd positional parameter

Remove the branch that renders `FallbackEntityIcon` directly. `displayName: string` is the 3rd positional parameter (placed before the optional `size` and `tooltip`). This makes it required at the TypeScript level without breaking calls that don't pass `size`.

Signature: `buildDeploymentIcon(resolvedIconUrl, type, displayName, size?, tooltip?)`.

When `resolvedIconUrl` is present the image is shown; `displayName` is set but unused until the image errors, at which point the initials badge appears as the error fallback.

## Risks / Trade-offs

- [Initials may be duplicated for many apps] → Deterministic color assignment means apps with the same initials get the same color. Acceptable given catalog-level visual context (name is always shown alongside the icon).
- [Non-Latin / emoji names produce unexpected initials] → `name[0]` of a surrogate pair is half a character. For the foreseeable user base this is a rare edge case; a follow-up can add proper Unicode segmentation if needed.
- [Color palette may clash with theme] → Palette colors are defined as raw hex values, not CSS tokens. If the theme changes drastically the palette may need updating. Mitigation: keep the palette in a single constant file that is easy to update.
- [`buildDeploymentIcon` parameter order] → `displayName` was moved to 3rd position (before `size`) to satisfy TypeScript's rule that required params precede optional ones. All call sites were updated.

## Migration Plan

1. Add `InitialsAvatar`, `extractInitials`, `pickAvatarColor` to `libs/chat-shared`.
2. Swap `DeploymentIcon` default fallback from `FallbackEntityIcon` to `InitialsAvatar`; add `initialsName` prop.
3. Remove `FallbackEntityIcon` import from `DeploymentIcon`; delete the SVG asset once no imports remain.
4. Update `buildDeploymentIcon` — remove direct `FallbackEntityIcon` render; add `displayName` param.
5. Update all call sites in `libs/catalog` and `apps/chat` to pass `displayName`.
6. Lint + typecheck across affected projects; delete `fallback-entity-icon.svg`.

Rollback: restore the SVG asset from git and revert the four changed files — no data migration needed.

## Open Questions

- Should models (non-application deployments) also benefit from initials avatars, or only user-created apps? *Proposal scopes to apps; defer models to a follow-up.*
- Should the palette be defined as Tailwind classes (e.g. `bg-teal-500`) or hardcoded hex? Tailwind classes simplify theming but Tailwind purges classes it can't statically analyze. Use inline style for background and a fixed text-color class, driven by the palette constant.
