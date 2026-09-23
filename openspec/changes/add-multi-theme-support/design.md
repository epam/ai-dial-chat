## Context

Theming today is one global palette resolved once at boot.
`ThemeProvider` (`apps/chat/src/context/ThemeContext.tsx`) fetches `GET /api/themes`, which
`ThemeService` proxies from `<THEMES_CONFIG_URL>/config.json`
(`apps/chat-api/src/themes/theme.service.ts:94`), and `applyThemeColors`
(`apps/chat/src/utils/apply-theme-colors.ts:9`) writes each `colors` entry as a CSS custom property
on `<html>`. Tailwind's config supplies light-theme hex fallbacks, so a missing key degrades rather
than breaks.

Three properties of that code shape everything below:

1. **It is write-only.** `applyThemeColors` never removes a property it previously set. Switching
   between two themes that declare the same key set is safe; switching between themes with
   different key sets leaks.
2. **The stored preference is not honoured.** `ThemeContext.tsx:93-107` reads
   `StorageKey.Theme`, uses it only as a truthiness gate, and then applies `config.themes[0].id` or
   `light`. The picker this change un-parks would appear not to work at all without fixing this.
3. **Only `light` and `dark` are reachable.** `applyResolvedTheme` picks the logo by comparing
   against `ThemeId.Dark`, and the parked picker enumerated the three known ids rather than the
   configured set.

On the application side, `AppsEditor` writes through `POST/PATCH /api/v1/applications`. Its General
step sends name/description/icon/version/topics/locales; its Settings step hands
`application_properties` to the schema's own editor iframe, which replaces that object wholesale on
every save (`openspec/specs/applications-write-api/spec.md:110-132`). Reads come back through
`GET /api/v1/deployments/{id}/details`, whose `applicationDetails` already exposes an allow-listed
`catalogProperties` projection of DIAL Core's `catalog_properties`
(`apps/chat-api/src/deployments/utils/deployment-mapper.util.ts:152-168`).

Constraints: no new persistence layer is available in `chat-api` — everything durable lives in DIAL
Core. `libs/*` must stay host-agnostic. WCAG 2.1 AAA applies to the new controls, including the
contrast of any colour a theme can produce for text.

## Goals / Non-Goals

**Goals**

- Make every theme in the configured themes host selectable, by whatever id it uses.
- Let an application author attach a themes-host URL to their application and have it repaint the
  whole chat while that application is open.
- Keep the outbound fetch of an author-supplied URL under operator control.
- Leave the application unchanged and unbroken when no themes host, no allowlist, or no app theme
  is configured.

**Non-Goals**

- Authoring or previewing theme colours inside DIAL. The author supplies a URL to a themes host they
  deploy themselves; DIAL renders it.
- A theme URL on toolsets, skills, prompts, or conversations. Only the AppsEditor application gets
  the field in this change.
- Per-app favicon. The favicon stays the operator's (`images.chat-favicon`) — see D7.
- Overriding an app theme from the overlay, or a new overlay protocol message.
- Validating theme colour keys. Unknown keys remain silently inert, as documented.
- Moving the theme preference from localStorage to the server-side user config.

## Decisions

### D1 — `themeUrl` lives in DIAL Core `catalog_properties`, not `application_properties`

`application_properties` is owned end-to-end by the schema editor iframe and replaced wholesale on
every Settings-step save. A General-step field written there survives exactly until the author opens
the Settings step. `catalog_properties` is a separate `MapStringObject` on DIAL Core's `Application`
schema that nothing in this repo writes and that the details path already reads through an
allowlist.

- *Alternative — a new top-level DIAL Core field.* Correct long-term home, but
  `components['schemas']['Application']` has no theme field; adding one is a DIAL Core change
  outside this repository and would block this work indefinitely.
- *Alternative — a chat-api side store.* `chat-api` has no database. A cache is not persistence, and
  the value must travel with the application when it is shared or published.

**Re-litigated and confirmed during implementation.** The cost of this decision is real — it is the
only reason the application write/read API changed at all. The cheaper option was put back on the
table: store `themeUrl` inside `applicationProperties`, which both endpoints already accept as a
free-form object and already return verbatim, for **zero** API change. It was rejected again, by the
user, on the same ground: for a Quick App the embedded schema editor writes the application resource
itself and replaces `application_properties` with its own model, so the key would vanish on the
author's next Settings-step save. The requirement is that the theme is stored *with the
application*, reliably — not merely stored somewhere cheap. Do not "simplify" this back.

The write is additive: `createApplication`/`updateApplication` read the stored
`catalog_properties`, set or delete the single `themeUrl` key, and write the object back. Unlike
`application_properties`, this is a **merge, not a replacement** — chat does not own the other keys
in that map (`provider`, `vendor`, `license`, …) and must not drop them.

> **Verify first.** Whether DIAL Core validates `catalog_properties` against `catalogSchemaId` when
> that field is set is not answerable from this repo. Slice 4 proves the round-trip against a live
> DIAL Core before any UI depends on it. If unknown keys are rejected, the fallback is a namespaced
> key agreed with the DIAL Core team; the decision is recorded here before the slice continues.

### D2 — The frontend never fetches an app-supplied URL; `chat-api` proxies it behind an allowlist

A server-side fetch of a user-supplied URL is SSRF by construction, and a browser-side fetch of one
requires CORS on every themes host, breaks under HTTPS with a mixed-content URL, and hands an
application author a direct channel to every viewer's browser. Neither is acceptable unmitigated, so
the proxy carries the mitigation:

- `THEMES_ALLOWED_ORIGINS` — a comma-separated list of exact `https://host[:port]` origins.
  **Unset or empty means the feature is off**; every remote-theme request is rejected with 400.
  There is no wildcard and no suffix matching: `https://themes.example.com` does not admit
  `https://evil.themes.example.com.attacker.test`.
- The URL is parsed with `new URL()`, its protocol must be `https:`, and its **origin** must appear
  in the list by exact string equality. Path, query, and fragment on the supplied URL are discarded;
  the service always requests `<origin><path>/config.json`.
- Rejection happens before any socket is opened, and the rejection message names neither the
  resolved address nor the response — no SSRF oracle.
- Redirects are not followed (`redirect: 'manual'`); a 3xx is a 502. A redirect is how an
  allow-listed origin would otherwise become a stepping stone to an internal address.
- The same `THEMES_SERVICE_TIMEOUT_MS` timeout and `AbortController` pattern as
  `ThemeService.getThemes` applies, and responses are size-capped (D6).

*Alternative — shape validation only (no allowlist).* Rejected: `https://` and "looks like a
hostname" stop nothing that matters. *Alternative — an allowlist of hostnames rather than origins.*
Rejected: it silently permits `http://` downgrade and non-standard ports.

### D3 — New versioned routes on the existing themes domain; the legacy routes stay put

`ThemeController` is `@Controller('themes')` with `@Public()` — unversioned `/api/themes` and
`/api/themes/icon`, called by `ThemeProvider` before any session exists. That is grandfathered; it
is not re-pathed here, and `docs/architecture.md` continues to state what the code does.

The new endpoints are business endpoints and follow `apps/chat-api/AGENTS.md`: a second controller,
`@Controller({ path: 'themes', version: '1' })`, giving `/api/v1/themes/remote` and
`/api/v1/themes/remote/icon`, both registered by the existing `ThemesModule`. They are **not**
`@Public()` — fetching an arbitrary allow-listed origin on behalf of a caller is an authenticated
action, and an unauthenticated user has no application context that could supply a theme URL.

Handler names are `getRemoteTheme` and `getRemoteThemeIcon`, which is what `operationIdFactory`
turns into the generated SDK method names.

### D4 — Cache key includes the origin, not the full URL

`themes:remote:<sha256(origin+path)>` and `themes:remote:icon:<sha256(origin+path)>:<iconName>`,
both at the existing 5-minute TTL. Hashing keeps an arbitrary-length, arbitrary-character URL out of
the key space; including the path (not just the origin) means two applications pointing at different
directories on one host do not collide. Invalidation is TTL-only, matching
`ThemeService.getThemes` — a theme change takes up to five minutes to appear, and
`docs/theme-customization.md` already sets that expectation.

### D5 — Theme composition: the app theme replaces the base theme, matched by id

When an app theme is active, the host resolves which of the app configuration's themes to use:

1. the theme whose `id` equals the user's currently **resolved** theme id (so a user in dark mode
   sees the app's dark theme), else
2. the app configuration's first theme.

The chosen theme's `colors` are applied **instead of** the base theme's, not merged over them.
Merging would produce a chimera whose contrast nobody validated — an app that ships a dark
background but omits `text-primary` would inherit the operator's near-black text on it. Full
replacement means an incomplete app theme falls back to the Tailwind light-theme defaults, which is
the same degradation the operator theme already has and which `docs/theme-customization.md` already
documents as "the single most common way a theme half applies".

The **user's selected theme id is never changed** by an app theme. `selectedTheme` still reflects
the Settings choice, the Preferences picker still shows it, and leaving the app restores the base
palette with no further user action.

### D6 — Stale custom properties are tracked and cleared

`applyThemeColors` gains a module-scoped record of the keys it last wrote to a given element and
removes them (`style.removeProperty`) before writing the next set. Without this, switching from an
app theme that declares 40 keys back to a base theme that declares 12 leaves 28 of the app's colours
on `<html>`.

The remote-theme response is also bounded before it can reach the DOM: a configuration larger than
256 KB is a 502, `themes` must be a non-empty array, and each `colors` entry must be a string whose
key matches `^[a-zA-Z0-9-]+$`. A key containing `;` or `}` written through `style.setProperty` is
inert in every current browser, but the allowlist removes the question rather than relying on that.

### D7 — Logo yes, favicon no

An app theme swaps the header logo (`images.chat-logo-light` / `chat-logo-dark`, fetched through
`/api/v1/themes/remote/icon`) because that is the strongest brand signal inside the window the user
is looking at. It does **not** swap the favicon: the browser tab identifies the DIAL deployment
across all of a user's tabs, and letting one application repaint it is a phishing surface for very
little gain. `useFavicon` keeps taking the operator's `images.chat-favicon`.

### D8 — "The app is open" is two surfaces, resolved in `ThemeContext`

`ThemeProvider` exposes `setAppThemeUrl(url | null)`, and exactly two callers drive it:

| Surface | Sets | Clears |
| --- | --- | --- |
| `/apps-editor` editing an app that has a `themeUrl` | on mount / after a save that changes it | on unmount |
| A conversation whose selected deployment declares a `themeUrl` | on deployment resolution | on deployment change to one without a theme, or on leaving the conversation |

A single `useEffect` with a cleanup covers both; `null` restores the base theme synchronously (the
base config is already in memory, so the revert never flashes). If both could apply at once they
cannot — the editor and a conversation are different routes — so no precedence rule is needed, and
a last-writer-wins `string | null` is the whole state machine.

The conversation surface reads `themeUrl` from the deployment details response, which the chat
already fetches per deployment. No new frontend request is added beyond the theme fetch itself.

### D9 — The picker's option set is derived, not enumerated

`useThemeOptions` returns `{ options, selectedTheme, setTheme }` where `options` is every configured
theme plus a synthetic `system` entry appended only when both `light` and `dark` are present.
Labels: `settings.themeLight` / `settings.themeDark` / `settings.themeSystem` for the three known
ids, the theme's own `displayName` for everything else. A server-supplied `displayName` is not
translatable, which is the accepted cost of supporting arbitrary ids — the three ids that ship with
every DIAL themes host stay translated.

The row is hidden when fewer than two options exist, preserving today's behaviour on a
single-theme deployment.

### D10 — The AppsEditor field is rendered in `apps/chat`, not in `@epam/ai-dial-builder-form`

`DeploymentCreationForm` comes from `@epam/ai-dial-builder-form`. Adding a theme URL field to that
lib would mean the lib either knows about themes hosts or grows a generic extra-fields slot; neither
earns its keep for one consumer. The field is rendered by `GeneralForm.tsx` beneath the lib's form,
using the ui-kit `Input`, and flows through the existing `TriggerSaveGeneralPayload`
(`apps/chat/src/types/apps-editor.ts`).

If it ever moves into the lib, the boundary contract is: the lib receives a labelled string value,
an `onChange`, and an already-computed validation message. The endpoint path, the allowlist, and
DIAL `catalog_properties` stay in `apps/chat`.

### D11 — Client-side validation mirrors, but does not replace, the server's

The editor field shows an inline error for anything that is not a parseable `https://` URL. It does
**not** try to check the origin against the allowlist — the allowlist is server-side configuration
and exposing it to the client would be leaking operator topology for a marginal UX gain. An
allow-listed-origin failure surfaces on save as the 400's message.

## Risks / Trade-offs

- **DIAL Core rejects unknown `catalog_properties` keys for schema-typed applications** → Proven in
  slice 4 against a live DIAL Core before any UI depends on it; the namespaced-key fallback and the
  decision are recorded in this document before the slice continues. The three frontend slices ahead
  of it do not depend on the answer.
- **An operator never sets `THEMES_ALLOWED_ORIGINS`** → The editor still offers the field, but every
  remote theme request 400s and the base theme stays. The failure is visible in the logs and
  invisible to users, which is the right way round. The cost of having no second switch is that an
  author can save a theme URL on a deployment where it can never load; the benefit is that there is
  no state where the feature is "on" but unusable.
- **An app theme ships unreadable contrast** → Nothing in the pipeline can prevent it; it is the
  same exposure the operator theme already has. The blast radius is bounded by D5 (replacement, not
  merge, so the result is *that theme* rather than a hybrid) and by the app-scoped lifetime — leaving
  the app restores a readable palette without the user having to find a picker they cannot see.
- **A themes host is slow** → The fetch is timeout-bounded and non-blocking: the app renders in the
  base theme and repaints when (if) the configuration arrives. The repaint is visible; that is
  accepted over holding the route.
- **Theme thrash when switching conversations between two themed apps** → Each switch is a full CSS
  custom-property rewrite on `<html>`. Measured in slice 6; if it is perceptible, the mitigation is a
  short debounce on `setAppThemeUrl`, not a structural change.
- **Five-minute cache vs. an author iterating on their theme** → Documented, not fixed. Same
  behaviour as the operator theme today.

## Migration Plan

No data migration. Deployment order:

1. Backend first (`themeUrl` write/read, remote proxy, env, feature flag) — inert until the flag is
   on. Safe to ship alone.
2. Regenerate the OpenAPI spec and `@epam/ai-dial-chat-api-client`; publish before the frontend
   slices that consume the new operations.
3. Frontend picker slices (1–2) — independent of the flag and of the backend change; shippable on
   their own.
4. Frontend app-theme slices — inert until `THEMES_ALLOWED_ORIGINS` names an origin.

**Rollback**: unset `THEMES_ALLOWED_ORIGINS`. Stored `themeUrl` values are ignored but not deleted,
so re-enabling is lossless. A full frontend revert restores today's
light/dark/system picker; the only unguarded behaviour change is the `ThemeContext` restore fix,
which reverts with it.

## Open Questions

1. **Does DIAL Core validate `catalog_properties` against `catalogSchemaId`?** Resolved in slice 4
   against a live DIAL Core — see D1. Blocks only slices 4+.
2. **Should a published/shared application's theme apply to viewers, or only to its owner?** The
   value lives on the application resource, so it travels with a share by default. Treated as
   intended: a brand is for the audience. Flagged for product confirmation before slice 7; if the
   answer is owner-only, the check is one condition on the deployment's `isMy` flag.
3. **Does the app theme apply to the app's preview chat inside the editor** (`AppPreviewChat`), or
   only to the surrounding editor chrome? Assumed *both*, since the preview lives inside the same
   document and the CSS custom properties are on `<html>`. Excluding it would require scoping the
   properties to a subtree, which is a larger change than this design carries.
