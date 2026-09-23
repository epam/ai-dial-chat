## ADDED Requirements

### Requirement: ThemeContext owns the active app theme

`ThemeProvider` (`apps/chat/src/context/ThemeContext.tsx`) SHALL own the app-theme overlay. No new
React context is introduced.

Its value SHALL gain:

| Member | Type | Meaning |
| --- | --- | --- |
| `appThemeUrl` | `string \| null` | The theme URL currently in effect, or `null`. |
| `setAppThemeUrl` | `(url: string \| null) => void` | Sets or clears the app theme. |
| `isAppThemeActive` | `boolean` | Whether an app theme's colors are currently applied. |

`setAppThemeUrl` SHALL be wrapped in `useCallback` and the context value SHALL stay wrapped in
`useMemo`, so that adding these members does not re-render every consumer on each parent render.
`useTheme` SHALL keep throwing when used outside the provider.

The state is a single last-writer-wins `string | null`. No stack, no precedence rule: the two
surfaces that set it (see below) are different routes and cannot be mounted at once.

There is no client feature flag gating the overlay. Whether a theme can load at all is decided
server-side by `THEMES_ALLOWED_ORIGINS`: an application whose origin the operator has not
allow-listed gets a `400`, the base theme stays, and nothing else changes.

#### Scenario: Setting an app theme applies it

- **WHEN** `setAppThemeUrl('https://themes.contoso.example.com')` is called and the flag is on
- **THEN** the configuration is fetched through `GET /api/v1/themes/remote`, a theme from it is
  applied to `<html>`, and `isAppThemeActive` is `true`

#### Scenario: Clearing restores the base theme

- **WHEN** `setAppThemeUrl(null)` is called while an app theme is active
- **THEN** the user's selected base theme's colors are reapplied from the already-loaded base
  configuration, `isAppThemeActive` is `false`, and no network request is made

#### Scenario: An application with no theme URL

- **WHEN** `setAppThemeUrl` is called with `null` for an application that declares no theme
- **THEN** no request is made, the base theme stays applied, and `isAppThemeActive` is `false`

#### Scenario: Consumers do not re-render on unrelated parent renders

- **WHEN** `ThemeProvider`'s parent re-renders with no theme state change
- **THEN** the context value is referentially stable

---

### Requirement: An app theme is chosen by matching the user's resolved theme id

When an app theme configuration has been fetched, the host SHALL select which of its themes to
apply:

1. the theme whose `id` equals `currentTheme` — the user's **resolved** id, so `system` resolved to
   `dark` matches the app's `dark` theme;
2. otherwise the configuration's first theme.

The chosen theme's `colors` SHALL be applied **instead of** the base theme's, not merged over them.
`applyThemeColors` clears the previous theme's custom properties first (see the `theme-selection`
spec), so the result is exactly that theme plus the built-in Tailwind fallbacks for anything it
omits.

`selectedTheme` and the value stored under `StorageKey.Theme` SHALL NOT change while an app theme
is active. The Preferences picker continues to show the user's own choice.

Changing the base theme while an app theme is active SHALL re-run the selection against the app
configuration, so switching Light → Dark inside a themed app moves to that app's dark theme.

#### Scenario: The app's dark theme is chosen for a dark user

- **WHEN** the user's resolved theme is `dark` and the app configuration contains `light` and `dark`
- **THEN** the app's `dark` colors are applied

#### Scenario: No id matches

- **WHEN** the user's resolved theme is `dark` and the app configuration contains only
  `contoso-brand`
- **THEN** `contoso-brand`'s colors are applied

#### Scenario: Colors are replaced, not merged

- **WHEN** the base theme declares `text-primary` and the app theme does not
- **THEN** `--text-primary` is not set on `<html>` while the app theme is active, and the element
  falls back to the Tailwind light-theme value

#### Scenario: The user's stored preference is untouched

- **WHEN** an app theme is active and the user opens Settings → Preferences
- **THEN** the theme picker shows the user's own selection, not the app's theme

#### Scenario: Switching the base theme inside a themed app

- **WHEN** the user switches from Light to Dark while an app theme is active
- **THEN** the app configuration's `dark` theme is applied, without refetching the app configuration

---

### Requirement: The app's logo replaces the header logo; the favicon does not change

While an app theme is active, `currentThemeLogo` SHALL resolve to the app configuration's
`images.chat-logo-dark` when the resolved theme id is `dark` and `images.chat-logo-light`
otherwise, expressed as a `/api/v1/themes/remote/icon?themeUrl=…&iconName=…` URL built by the app —
the same shape `resolveCatalogIconUrl` already builds for `/api/themes/icon`.

When the app configuration declares no matching image, `currentThemeLogo` SHALL fall back to the
base configuration's logo rather than rendering nothing.

`currentThemeFavicon` and `useFavicon` SHALL keep using the **operator's** `images.chat-favicon`.
An application SHALL NOT be able to change the browser tab's icon: the tab identifies the DIAL
deployment across a user's tabs, and repainting it from application-owned data is a phishing
surface.

#### Scenario: The app logo is shown in the header

- **WHEN** an app theme whose configuration declares `chat-logo-dark` is active and the resolved
  theme is `dark`
- **THEN** the header logo is fetched through `/api/v1/themes/remote/icon` with that icon name

#### Scenario: The app declares no logo

- **WHEN** the app configuration has no `images` entry for the resolved theme
- **THEN** the operator's logo continues to render

#### Scenario: The favicon is never the app's

- **WHEN** an app theme is active and its configuration declares `chat-favicon`
- **THEN** the browser tab icon remains the operator's favicon

---

### Requirement: Two surfaces activate an app theme

Exactly two callers SHALL drive `setAppThemeUrl`, each through a single `useEffect` with a cleanup
that clears it:

| Surface | Set when | Cleared when |
| --- | --- | --- |
| `/apps-editor` editing an application that has a `themeUrl` | the application's details resolve, and again after a save that changes the value | the route unmounts |
| A conversation whose selected deployment declares a `themeUrl` | the deployment's details resolve | the selected deployment changes to one without a `themeUrl`, or the conversation route unmounts |

The value is read from `applicationDetails.catalogProperties.themeUrl` on a deployment details
response. The conversation surface introduces **no** additional request: `DeploymentsContext`
already fetches `getDeploymentDetails(resolvedSelectedDeploymentId)` for the selected deployment
(`apps/chat/src/context/DeploymentsContext.tsx:551-585`) and SHALL expose the theme URL from that
existing `selectedDeploymentDetails`. The editor surface does add one request, because its
`existingDeployment` comes from the deployments **list**, which carries no `catalogProperties` —
see the `app-editor-flow` spec.

Every other surface — catalog, settings, prompts, scheduled tasks, skills, toolsets — SHALL render
in the user's base theme.

#### Scenario: Opening a themed app's editor applies its theme

- **WHEN** an author opens `/apps-editor` for an application with a `themeUrl`
- **THEN** the editor and its preview render in that application's theme

#### Scenario: Leaving the editor restores the base theme

- **WHEN** the author navigates from `/apps-editor` back to the catalog
- **THEN** the base theme is reapplied before the catalog renders

#### Scenario: A conversation with a themed agent

- **WHEN** the user opens a conversation whose selected deployment declares a `themeUrl`
- **THEN** the whole window renders in that application's theme

#### Scenario: Switching to an unthemed agent

- **WHEN** the user changes the conversation's deployment to one with no `themeUrl`
- **THEN** the base theme is reapplied

#### Scenario: Saving a new theme URL in the editor takes effect

- **WHEN** the author enters a new `themeUrl` and saves
- **THEN** the editor repaints in the newly saved theme without a reload

#### Scenario: Other routes are unaffected

- **WHEN** the user navigates from a themed conversation to Settings
- **THEN** Settings renders in the user's base theme

---

### Requirement: An app theme never blocks or breaks the surface it themes

Loading an app theme SHALL be non-blocking: the surface renders immediately in the base theme and
repaints if and when the configuration arrives.

Every failure mode — an unparseable URL, a `400` from a non-allow-listed origin, a `404`, a `502`, a
`503` timeout, an aborted request, or a malformed payload — SHALL leave the base theme applied,
SHALL log to the console (matching `ThemeContext`'s existing handling of a failed configuration
fetch), and SHALL NOT surface a notification, a toast, or an error boundary to the user. An
application's branding failing to load is not a problem the viewer can act on.

The fetch SHALL follow the established async-effect pattern: a `cancelled` flag (or
`AbortController`) so a route change mid-flight neither applies a stale theme nor sets state after
unmount.

A successfully fetched configuration SHALL be held in memory keyed by its URL for the lifetime of
the provider, so returning to the same application does not refetch.

#### Scenario: A rejected origin leaves the base theme

- **WHEN** the proxy responds `400` because the origin is not allow-listed
- **THEN** the surface stays in the base theme, a console error is logged, and no notification is
  shown

#### Scenario: A slow themes host does not hold the route

- **WHEN** the themes host takes four seconds to respond
- **THEN** the surface renders immediately in the base theme and repaints when the configuration
  arrives

#### Scenario: Navigating away mid-flight

- **WHEN** the user leaves the surface before the configuration resolves
- **THEN** the in-flight response is discarded, no colors are applied, and no state is set after
  unmount

#### Scenario: Returning to the same app does not refetch

- **WHEN** the user opens a themed conversation, leaves, and returns within the session
- **THEN** the cached configuration is reused and no request is made

---

### Requirement: The app theme surface is accessible and direction-agnostic

The app-theme overlay SHALL introduce no new ARIA attributes and SHALL require no RTL handling.

It changes colours, not structure: it introduces no new interactive control, no new focus
target, and no new text. Therefore it adds no ARIA attributes and needs no direction handling —
**RTL impact: none**.

Two accessibility obligations still apply and SHALL be met:

- The header logo `<img>` SHALL keep its existing accessible name when its `src` changes to an app
  logo; swapping the source SHALL NOT drop the `alt` text.
- The repaint SHALL NOT move focus. Applying or clearing an app theme mutates custom properties on
  `<html>` only, and SHALL NOT remount the subtree.

Colour contrast inside an app-supplied theme cannot be enforced by the host. This is the same
exposure the operator theme already carries and is stated in the design's risk list; the mitigation
is that the theme is replaced rather than merged, and that leaving the application restores a
palette the operator validated.

#### Scenario: The logo keeps its accessible name

- **WHEN** the header logo's `src` changes to the app's logo
- **THEN** its `alt` text is unchanged and the image remains announced

#### Scenario: Focus is preserved across a repaint

- **WHEN** a control is focused and an app theme is applied or cleared
- **THEN** focus stays on that control
