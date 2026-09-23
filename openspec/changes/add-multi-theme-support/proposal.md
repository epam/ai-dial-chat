## Why

The chat can already be rebranded by pointing `THEMES_CONFIG_URL` at a themes host, but almost none
of that reaches a user. The picker that would let someone choose among the configured themes was
**written and commented out** in `apps/chat/src/pages/SettingsPage/PreferencesTab/PreferencesTab.tsx`,
parked "for an upcoming theming feature"; `useThemeOptions`
(`apps/chat/src/hooks/theme/useThemeOptions.ts`) had zero call sites, and four i18n keys
(`settings.theme*`) were unused.

Worse, the restore path was broken: `ThemeContext` read the stored preference only as a truthiness
gate and then applied `config.themes[0].id` or `light` regardless, so a user's choice did not
survive a reload. `docs/theme-customization.md` records the resulting limit: ids other than
`light`/`dark`/`system` can sit in the config file but are unreachable except through the overlay.

## What Changes

- **Fix the restore bug** in `ThemeContext` — the stored `StorageKey.Theme` value is honoured on
  load when it names a theme the configuration still contains, falling back to `light` otherwise.
  `light` stays the default for a user who has never chosen, whatever order the themes host lists
  its themes in (see the note below).
- **Re-enable the parked theme row** on the Settings → Preferences tab, generalized from the
  hardcoded light/dark/system triple to *every* entry in `GET /api/themes`. Labels come from i18n
  for the three known ids and from the theme's own `displayName` for any other id.
- `System` stays a synthetic option offered only when both `light` and `dark` are configured, which
  is what `docs/theme-customization.md` already documents.
- **Fix stale CSS custom properties**: `applyThemeColors`
  (`apps/chat/src/utils/apply-theme-colors.ts`) set properties but never removed the previous
  theme's. With two themes this is invisible; with N themes that declare different key sets, a
  switch leaves the previous theme's colors behind. Applied keys are now tracked and cleared first.

**Frontend only.** No backend change, no new endpoint, no environment variable, no feature flag.

### Removed from this change

An earlier revision also gave each application its own theme URL: a `Theme URL` field in the apps
editor, stored on the application's DIAL Core `catalog_properties`, plus a
`GET /api/v1/themes/remote` proxy behind an origin allowlist to fetch it. **The user removed that
scope**, so the application write/read API, the proxy, the `THEMES_ALLOWED_ORIGINS` variable, and
the four capabilities describing them are all gone. What remains is the Settings picker.

### Rollback

Reverting the frontend restores today's light/dark/system picker. The one behaviour change no
switch covers is the `ThemeContext` restore fix — that is a bug fix, and its observable effect is
that a stored preference is now honoured.

**Raised and settled during implementation:** the first draft of the resolution order fell back to
`config.themes[0].id` when nothing was stored, which would have flipped every never-chosen user to
dark on any deployment whose `config.json` lists `dark` first. Decided against: **`light` is the
default for a user who has never chosen**, whatever order the themes host uses. This keeps the
restore fix to exactly one observable effect and leaves the no-preference default identical to
today's. The `theme-selection` spec carries the rule and a scenario pinning it against a dark-first
configuration.

### Alternatives considered

| Option | Verdict |
| --- | --- |
| Leave the picker parked and only fix the restore bug | **Rejected.** The bug fix is invisible without a picker — there is no UI to choose a second theme with. |
| Enumerate ids in the picker (today's shape) rather than deriving them | **Rejected.** That is exactly what made ids beyond light/dark unreachable. |
| Keep `applyThemeColors` write-only | **Rejected.** Safe with two symmetric themes, leaks with N themes declaring different key sets. |

## Capabilities

### New Capabilities

- `theme-selection`: the user-facing theme preference — which options the picker offers for an
  arbitrary set of configured themes, how labels are resolved, how the stored selection is restored
  on load, and how CSS custom properties are swapped without leaking the previous theme's keys.

### Modified Capabilities

None.

## Impact

**Frontend** (`apps/chat`)

- `src/context/ThemeContext.tsx` — restore fix
- `src/utils/apply-theme-colors.ts` — clear previously applied custom properties
- `src/hooks/theme/useThemeOptions.ts` — generalized option list (first call site)
- `src/pages/SettingsPage/PreferencesTab/PreferencesTab.tsx` — theme row un-parked
- `src/pages/SettingsPage/tests/SettingsPage.spec.tsx` — mocks the newly-called hook

**Backend** — none.

**Contract** — none. No OpenAPI regeneration, no generated-client change.

**Docs** — `docs/theme-customization.md`: the "ids other than light/dark/system are unreachable"
limitation is lifted, and the picker's option rules change. `npm run validate:docs` afterwards.

**i18n** — no new strings. The four existing `settings.theme*` keys become used for the first time.

**Libs** — none.
