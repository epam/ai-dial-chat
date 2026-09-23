## Context

Theming is one global palette resolved once at boot. `ThemeProvider`
(`apps/chat/src/context/ThemeContext.tsx`) fetches `GET /api/themes`, which `ThemeService` proxies
from `<THEMES_CONFIG_URL>/config.json`, and `applyThemeColors`
(`apps/chat/src/utils/apply-theme-colors.ts`) writes each `colors` entry as a CSS custom property
on `<html>`. Tailwind's config supplies light-theme hex fallbacks, so a missing key degrades rather
than breaks.

Three properties of that code shaped this change:

1. **It was write-only.** `applyThemeColors` never removed a property it had previously set.
   Switching between two themes that declare the same key set is safe; switching between themes
   with different key sets leaks.
2. **The stored preference was not honoured.** The restore effect read `StorageKey.Theme`, used it
   only as a truthiness gate, and then applied `config.themes[0].id` or `light`. The picker this
   change un-parks would have appeared not to work at all without fixing this.
3. **Only `light` and `dark` were reachable.** The parked picker enumerated the three known ids
   rather than the configured set.

Constraints: `libs/*` stays host-agnostic (nothing here touches a lib). WCAG 2.1 AAA applies to the
new control.

## Goals / Non-Goals

**Goals**

- Make every theme in the configured themes host selectable, by whatever id it uses.
- Make a chosen theme survive a reload.
- Swap themes without leaving the previous theme's custom properties behind.

**Non-Goals**

- Per-application themes. An earlier revision of this change gave each application its own theme
  URL, stored on DIAL Core `catalog_properties`, with a `GET /api/v1/themes/remote` proxy behind an
  origin allowlist. **The user removed that scope**; the code, the endpoint, the environment
  variable and the four capabilities describing it were deleted rather than left dormant.
- Authoring theme colours inside DIAL. The operator deploys a themes host; DIAL renders it.
- Validating theme colour keys. An unknown key remains silently inert, as documented.
- Moving the theme preference from localStorage to the server-side user config.
- Any backend change.

## Decisions

### D1 — `light` is the default, not the first configured theme

When nothing is stored, the resolution order ends at `ThemeId.Light` rather than
`config.themes[0].id`. Configuration order is not a statement about which theme a first-time
visitor should get, and treating it as one would silently flip every never-chosen user to dark on
any deployment whose `config.json` happens to list `dark` first.

A deployment that serves no `light` theme therefore renders in the built-in Tailwind light palette
until the user picks something — unchanged from today's behaviour, since the pre-fix code fell
through to `ThemeId.Light` in every case.

*Alternative — fall back to the first configured theme.* Drafted first, rejected by the user: it
turns a bug fix into a visible default change for existing users.

### D2 — A stored id that the configuration no longer offers is discarded, not erased

The stored value is left in localStorage untouched when it names a theme the current configuration
lacks. A themes host that temporarily drops a theme, or a transient configuration fetch, must not
permanently destroy the user's preference — they get `light` for that session and their choice back
when the theme returns.

### D3 — Stale custom properties are tracked and cleared

`applyThemeColors` keeps a module-scoped `WeakMap` of the property names it last wrote per element
and removes them with `style.removeProperty` before writing the next set. Without this, switching
from a theme declaring 40 keys to one declaring 12 leaves 28 of the first theme's colours on
`<html>`.

A `WeakMap` rather than a data attribute or a module-level variable: the bookkeeping stays off the
element, it is per-element so two targets cannot interfere, and a detached element can still be
collected. Properties the function never wrote are never removed, so a custom property set by
anything else survives.

### D4 — The picker's option set is derived, not enumerated

`useThemeOptions` returns every configured theme in configuration order, plus a synthetic `system`
entry appended **only when both `light` and `dark` are present** — `system` resolves to one of those
two, so offering it when only one exists would be a control with nothing to switch between.

Labels: i18n for `light`/`dark`/`system`, the theme's own `displayName` for any other id, falling
back to the id when `displayName` is empty. A server-supplied `displayName` is not translatable;
that is the accepted cost of supporting arbitrary ids, and the three ids every DIAL themes host
ships stay translated.

The row is hidden below two options, preserving today's behaviour on a single-theme deployment: a
select whose only action is to reselect the current value is noise.

## Risks / Trade-offs

- **A custom theme's `displayName` is untranslatable** → Accepted, and confined to ids beyond the
  three known ones. The alternative — requiring operators to ship translations through the themes
  config — is a much larger contract for a rare case.
- **A theme with poor contrast** → Nothing in the pipeline can prevent it; this is the exposure the
  operator theme already carries, and the operator controls the themes host.
- **The default-theme decision is not behind a switch** → It is deliberately a no-op: `light`
  before, `light` after. Only the *restore* behaviour changes, which is the bug being fixed.

## Migration Plan

No data migration, no deployment ordering, no environment variable. A stored `StorageKey.Theme`
value written by the previous code is still read by the new code; a value naming a theme that is
not configured resolves to `light` without being rewritten.

**Rollback**: revert the frontend commit. The picker returns to light/dark/system and the restore
bug returns with it.

## Open Questions

None. The two that this change opened — where a per-application theme URL should be stored, and
whether a published application's theme should apply to viewers — were closed by removing that
scope.
