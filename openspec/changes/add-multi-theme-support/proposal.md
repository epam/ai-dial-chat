## Why

The chat can already be rebranded by pointing `THEMES_CONFIG_URL` at a themes host, but almost
none of that reaches a user. The picker that would let someone choose among the configured themes
is **written and commented out** (`apps/chat/src/pages/SettingsPage/PreferencesTab/PreferencesTab.tsx:26-47`,
`:92-107`, parked "for an upcoming theming feature"), `useThemeOptions`
(`apps/chat/src/hooks/theme/useThemeOptions.ts`) has zero call sites, and four i18n keys
(`settings.theme*`, `apps/chat/src/i18n/locales/en.json:606-609`) are unused. Worse, the restore
path is broken: `ThemeContext` reads the stored preference only as a truthiness gate and then
applies `config.themes[0].id` or `light` regardless
(`apps/chat/src/context/ThemeContext.tsx:93-107`) — a user's choice does not survive a reload.
`docs/theme-customization.md:94` records the resulting limit: ids other than `light`/`dark`/`system`
can sit in the config file but are unreachable except through the overlay.

Separately, an application author has no way to give their app a look of its own. Apps are branded
through their icon and nothing else, while the surrounding chat stays in the operator's palette.

## What Changes

### 1. Every theme the configured themes host serves becomes selectable

- **Fix the restore bug** in `ThemeContext` — the stored `StorageKey.Theme` value is honoured on
  load when it names a theme the configuration still contains, falling back to `light` when it does
  not. `light` is also the default for a user who has never chosen, whatever order the themes host
  lists its themes in (see the note below).
- **Re-enable the parked theme row** on the Settings → Preferences tab, generalized from the
  hardcoded light/dark/system triple to *every* entry in `GET /api/themes`. Labels come from i18n
  for the three known ids and from the theme's own `displayName` for any other id.
- `System` stays a synthetic option offered only when both `light` and `dark` are configured, which
  is what `docs/theme-customization.md:85-92` already documents.
- **Fix stale CSS custom properties**: `applyThemeColors`
  (`apps/chat/src/utils/apply-theme-colors.ts:9`) sets properties but never removes the previous
  theme's. With two themes this is invisible; with N themes that declare different key sets, a
  switch leaves the previous theme's colors behind. Applied keys are tracked and cleared first.

### 2. An application can carry its own theme URL

- **New `themeUrl` field on the AppsEditor General step** (`apps/chat/src/pages/AppsEditor/GeneralForm.tsx`):
  an optional `https://` URL of a themes host, saved with the application alongside name, icon and
  version. Validated client-side and server-side; only `https` origins on an operator allowlist are
  accepted.
- **Stored in DIAL Core's `catalog_properties.themeUrl`**, not `application_properties`. The
  Settings-step schema editor owns `application_properties` and replaces it wholesale on every save
  (`openspec/specs/applications-write-api/spec.md:110-132`), so anything the General step wrote
  there would be destroyed on the next Settings save. `catalog_properties` is already read back
  through an allowlist mapper on the details path
  (`apps/chat-api/src/deployments/utils/deployment-mapper.util.ts:152-168`).
- **New backend write path**: `themeUrl` on `CreateApplicationBodyDto` / `UpdateApplicationBodyDto`,
  and a new read entry in `mapCatalogProperties` so `GET /api/v1/deployments/{id}/details` returns it.

### 3. An app's theme repaints the whole window while that app is open

- **New backend proxy** `GET /api/v1/themes/remote?themeUrl=…` and
  `GET /api/v1/themes/remote/icon?themeUrl=…&iconName=…`, mirroring today's `/api/themes` and
  `/api/themes/icon` but for an allow-listed external origin. The frontend never fetches an
  app-supplied URL directly.
- **Origin allowlist** (`THEMES_ALLOWED_ORIGINS`) is mandatory — an unlisted or non-`https` origin is
  rejected with 400 and no outbound request is made. Without the variable the whole per-app theming
  feature is off.
- **`ThemeContext` gains an app-theme overlay**: when the active application declares a `themeUrl`,
  its configuration is fetched, the theme whose id matches the user's currently resolved theme id is
  applied on top of the base theme (falling back to that configuration's first theme), and the app's
  logo replaces the header logo. Leaving the app restores the base theme. Any failure — bad URL,
  rejected origin, timeout, malformed payload — leaves the base theme in place and logs; the user
  sees no error.
- Surfaces that count as "the app is open": the `/apps-editor` page editing that app, and a
  conversation whose selected deployment is that app.

### 4. Gating, docs, rollback

- **No client feature flag.** `THEMES_ALLOWED_ORIGINS` is the only switch: unset or empty, every
  remote theme request is rejected, so a stored theme URL never applies and the editor field is
  harmless. A second switch would only add a state where the field is offered but no theme could
  ever load. (Dropped during implementation at the user's request — an earlier draft had an
  `APP_THEMES_ENABLED` flag.)
- **Rollback**: non-breaking in both directions. Unset `THEMES_ALLOWED_ORIGINS` and every stored
  `themeUrl` becomes inert — the field still shows, but no theme loads and the base palette stays.
  Reverting the frontend alone leaves the picker showing light/dark/system as today. The one
  behaviour change no switch covers is the `ThemeContext` restore fix — that is a bug fix, and its
  observable effect is that a stored preference is now honoured.

  **Raised and settled during implementation (slice 1):** the first draft of the resolution order
  fell back to `config.themes[0].id` when nothing was stored, which would have flipped every
  never-chosen user to dark on any deployment whose `config.json` lists `dark` first. Decided
  against: **`light` is the default for a user who has never chosen**, whatever order the themes
  host uses. This keeps the restore fix to exactly one observable effect — a stored preference is
  now honoured — and leaves the no-preference default identical to today's. The `theme-selection`
  spec carries the rule and a scenario pinning it against a dark-first configuration.

### Alternatives considered

| Option | Verdict |
| --- | --- |
| Store `themeUrl` in `application_properties` | **Rejected.** The Settings-step editor replaces that object wholesale on every save; the field would silently vanish. DIAL Core may also validate it against the app type schema. |
| A first-class DIAL Core `themeUrl` field | **Rejected.** `components['schemas']['Application']` has no such field; adding one is a DIAL Core change outside this repo. |
| Fetch the app's theme URL from the browser | **Rejected.** Requires CORS on every themes host, exposes users to mixed content, and gives an app author a direct channel to every viewer's browser with no operator control. The proxy + allowlist is the only shape an operator can reason about. |
| No allowlist, validate the URL shape only | **Rejected.** A server-side fetch of a user-supplied URL is SSRF by construction. |
| Ship only the Settings picker now, app themes later | **Considered, viable.** Kept as the slice boundary instead of a scope cut: tasks 1–2 deliver the picker end to end and can ship alone. |

## Capabilities

### New Capabilities

- `theme-selection`: the user-facing theme preference — which options the picker offers for an
  arbitrary set of configured themes, how labels are resolved, how the stored selection is restored
  on load, and how CSS custom properties are swapped without leaking the previous theme's keys.
- `app-theme-url`: the per-application theme URL — its field in the AppsEditor General step, its
  validation, its storage in `catalog_properties.themeUrl`, and its exposure on the deployment
  details response.
- `remote-theme-proxy`: the backend `GET /api/v1/themes/remote*` endpoints — origin allowlist, DTO
  validation, caching, error mapping, and the environment variables that configure them.
- `active-app-theme`: the runtime overlay — which surfaces count as "this app is open", how an app
  theme is composed with the user's selected theme, and what happens on failure or exit.

### Modified Capabilities

- `themes-module`: the module gains the versioned remote-theme controller alongside today's
  unversioned `/api/themes` routes.
- `applications-write-api`: `CreateApplicationBodyDto` and `UpdateApplicationBodyDto` accept
  `themeUrl`, persisted to `catalog_properties` rather than `application_properties`.
- `deployment-details-api`: `applicationDetails.catalogProperties` gains `themeUrl`.
- `app-editor-flow`: the General step renders and submits the theme URL field.

## Impact

**Frontend** (`apps/chat`)
- `src/context/ThemeContext.tsx` — restore fix, app-theme overlay, new context surface
- `src/utils/apply-theme-colors.ts` — clear previously applied custom properties
- `src/hooks/theme/useThemeOptions.ts` — generalized option list (first call site)
- `src/pages/SettingsPage/PreferencesTab/PreferencesTab.tsx` — theme row un-parked
- `src/pages/AppsEditor/GeneralForm.tsx` — theme URL field; `src/types/apps-editor.ts` payload
- `src/server-api/base.ts` — `ApiEndpoints.THEMES_REMOTE`, `THEMES_REMOTE_ICON`
- `src/i18n/locales/en.json` — existing `settings.theme*` keys become used; new
  `appsEditor.generalForm.themeUrl*` keys

**Backend** (`apps/chat-api`)
- `src/themes/` — remote-theme controller, service methods, DTOs, origin allowlist validator
- `src/applications/` — `themeUrl` on both write DTOs and in the DIAL body mapping
- `src/deployments/utils/deployment-mapper.util.ts` + `dto/deployment-details.dto.ts` — read path
- `src/config/environment.config.ts` — `THEMES_ALLOWED_ORIGINS`

**Contract** — `npm run openapi` regeneration and a `@epam/ai-dial-chat-api-client` rebuild; the
generated operations `getRemoteTheme` / `getRemoteThemeIcon` are new, and the application write DTOs
gain a field.

**Docs** — `docs/theme-customization.md` (the "ids other than light/dark/system are unreachable"
limitation is lifted; new per-app section), `docs/architecture.md` (new `ApiEndpoints` members and
backend routes), `apps/chat-api/README.md` + `.env.template` (two new variables),
`docs/ENABLED_FEATURES_ROLES.md` (new flag). `npm run validate:docs` after.

**i18n** — yes, new user-visible strings (see the key table in the specs).

**Libs** — none. No `libs/*` package is touched: the theme URL is resolved by the app and the
AppsEditor form field is rendered in `apps/chat`. If the field is later moved into
`@epam/ai-dial-builder-form`'s `DeploymentCreationForm`, the lib must receive it as a labelled,
validated value through props — no knowledge of `/api/v1/themes/remote` or of DIAL
`catalog_properties` may cross the boundary.

**Open question for implementation** — whether DIAL Core validates `catalog_properties` against
`catalogSchemaId` when that field is set. Verified in the first backend slice against a live DIAL
Core; if it does reject unknown keys, the fallback is a chat-api-owned key namespace inside
`catalog_properties` agreed with the DIAL Core team, recorded in `design.md` before proceeding.
