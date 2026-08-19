# Theme Customization

The appearance of DIAL Chat is controlled by a **theme**: a set of colors,
logos, and icons served by an external themes service and applied at runtime as
CSS custom properties. Themes are deployment configuration, not a rebuild — the
same application image can be rebranded by pointing it at a different themes
service.

This document covers configuring a theme for a deployment, and migrating a
theme from the legacy DIAL Chat. Styling of the reusable components in `libs/*`
is a separate concern — see [Styling libraries](#styling-libraries).

## Configuration

### Point the deployment at a themes service

Themes are served by a standalone static host, as in the legacy chat — see
[DIAL Chat Themes](https://github.com/epam/ai-dial-chat-themes) for deploying
one. Configure `chat-api` with its base URL:

```dotenv
THEMES_CONFIG_URL=https://your-themes-host.example.com
THEMES_SERVICE_TIMEOUT_MS=5000
```

`THEMES_SERVICE_TIMEOUT_MS` is optional and defaults to `5000`.

The frontend never talks to the themes host directly. `chat-api` fetches
`<THEMES_CONFIG_URL>/config.json` and exposes it at `/api/themes`; image assets
are proxied through `/api/themes/icon?iconName=<name>`, which validates the name
against path traversal. Both responses are cached for 5 minutes, so a change on
the themes host takes up to 5 minutes (plus that host's own cache) to appear.

When `THEMES_CONFIG_URL` is unset, the configuration request fails, the
application logs the failure and continues with its built-in palette: the
light-theme hex fallbacks compiled into `tailwind.config.js`. The user menu then
offers no theme entries at all.

### Configuration file format

```json
{
  "themes": [
    {
      "id": "light",
      "displayName": "Light",
      "colors": {
        "bg-layer-base": "#F5F7FA",
        "text-primary": "#161B2D"
      },
      "app-logo": "logo-light.svg"
    },
    {
      "id": "dark",
      "displayName": "Dark",
      "colors": {
        "bg-layer-base": "#0C101D",
        "text-primary": "#F3F4F6"
      },
      "app-logo": "logo-dark.svg"
    }
  ],
  "images": {
    "chat-logo-light": "logo-light.svg",
    "chat-logo-dark": "logo-dark.svg",
    "chat-favicon": "favicon.png"
  }
}
```

Each entry in `colors` is applied verbatim as a CSS custom property on the
`<html>` element: key `bg-layer-base` becomes `--bg-layer-base`. Do not write
the `--` prefix in the file.

Keys are not validated. An unrecognized key is set as a CSS variable that
nothing reads — the theme still loads, and the misspelled color silently has no
effect. A recognized key that a theme omits falls back to the built-in light
value. This is the single most common way a theme "half applies".

### Theme ids and the theme picker

The picker in the user menu is driven by the ids present in the configuration:

| Configured ids     | Picker shows            |
| ------------------ | ----------------------- |
| `light` and `dark` | Light, Dark, and System |
| only one of them   | just that one entry     |
| neither            | no theme entries        |

`System` is offered only when both `light` and `dark` exist; it follows
`prefers-color-scheme` and re-resolves when the OS setting changes. The
selection is stored in the browser's local storage, so it is per user and per
device.

Ids other than `light`, `dark`, and `system` can be present in the file, but the
picker has no entry for them. They are reachable only through the overlay's
`theme` option (see below).

### Logos and icons

The application reads exactly three image fields:

| Field                    | Used for                                           |
| ------------------------ | -------------------------------------------------- |
| `images.chat-logo-light` | Header logo while the resolved theme is not `dark` |
| `images.chat-logo-dark`  | Header logo while the resolved theme is `dark`     |
| `images.chat-favicon`    | Browser tab favicon (PNG, 32×32 recommended)       |

The remaining fields carried by the configuration contract — `themes[].app-logo`,
`images.favicon`, `images.default-addon`, `images.default-model` — are accepted
and ignored. Keep them in the file if the legacy chat is still served from the
same themes host; do not expect them to change anything here.

Values are file names relative to the themes host; they are fetched through the
`/api/themes/icon` proxy, so only characters allowed by its validation
(alphanumerics, dash, underscore, dot) are usable.

### Setting the theme from an embedding host

An embedded overlay selects the theme by id, both at construction and at
runtime:

```ts
const overlay = new ChatOverlay('#chat-root', {
  domain: 'https://chat.example.com',
  theme: 'dark',
});

await overlay.setOverlayOptions({ theme: 'light' });
```

The id must exist in the deployment's configuration file. See the
[Chat Overlay Migration Guide](chat-overlay-migration-guide.md).

### Fonts are not themeable

`--theme-font` exists, but `apps/chat/src/styles.scss` declares it on `html`,
`body`, and `#root`. A value supplied through a theme's `colors` map lands on
`<html>` only and is shadowed for everything inside `#root`, so it has no
practical effect. Changing the application font currently requires editing that
stylesheet.

## Color tokens

These are the CSS custom properties the application reads. Anything else in
`colors` is inert.

**Surfaces**

```text
bg-layer-sunken   bg-layer-base     bg-layer-raised
bg-backdrop       bg-error          bg-warning
bg-info           bg-success
```

**Controls**

```text
bg-control-accent              bg-control-accent-alpha
bg-control-accent-alpha-hover  bg-control-accent-alpha-active
bg-control-neutral             bg-control-neutral-hover
bg-control-neutral-active      bg-control-error
bg-control-error-hover         bg-control-error-active
bg-control-error-alpha-hover   bg-control-error-alpha-active
bg-control-disable
```

**Decorative fills**

```text
bg-visual-blue      bg-visual-green-1   bg-visual-green-2
bg-visual-brown     bg-visual-red       bg-visual-violet-1
bg-visual-violet-2
```

**Text**

```text
text-primary       text-secondary       text-tertiary
text-accent
text-error         text-warning         text-warning-icon
text-info          text-success
text-control-permanent      text-control-blue-hover
text-control-blue-active    text-control-disable-alpha
text-control-disable-beta
text-visual-blue     text-visual-brown-1   text-visual-brown-2
text-visual-green-1  text-visual-green-2   text-visual-green-3
text-visual-red      text-visual-violet-1  text-visual-violet-2
```

**Strokes**

```text
stroke-primary     stroke-secondary    stroke-tertiary
stroke-error       stroke-error-alpha  stroke-warning
stroke-info        stroke-success      stroke-accent-alpha
stroke-hover-alpha stroke-focus-black  stroke-focus-blue
```

**Shadows**

```text
shadow-default   shadow-blue-500   shadow-grey-1000
```

**Transitional — do not build a theme on these**

`tailwind.config.js` still exposes `bg-layer-1`, `bg-layer-4`, `bg-layer-6`,
`bg-layer-7`, `bg-overlay`, `bg-inverted`, `bg-accent-primary-alpha`,
`bg-accent-tertiary-alpha`, and `text-accent-secondary`, grouped in the config
as pending removal. They are honored today and will disappear without a
replacement token.

## Migrating a theme from the legacy chat

A legacy `config.json` loads without an error but produces mostly the built-in
palette: the environment variable, the token names, and the default color scheme
all changed.

### Deployment configuration

| Legacy                                            | New                                            |
| ------------------------------------------------- | ---------------------------------------------- |
| `THEMES_CONFIG_HOST`                              | `THEMES_CONFIG_URL`                            |
| —                                                 | `THEMES_SERVICE_TIMEOUT_MS` (optional, `5000`) |
| `/api/themes/listing`, `/api/themes/image/[name]` | `/api/themes`, `/api/themes/icon?iconName=`    |
| Default theme: dark                               | Default theme: light                           |
| 24-hour cache on the themes host                  | 5-minute cache in `chat-api`                   |

The flipped default matters even for a faithful port: any token the theme omits
now resolves to a **light** fallback, so a partially migrated dark theme renders
as light patches rather than as approximately-dark.

### Token mapping

The palette was redesigned, not renamed, so treat this as a starting point
rather than a mechanical substitution. Colors carried over unchanged (same name,
same role) are omitted: `bg-error`, `bg-warning`, `bg-info`, `bg-success`,
`stroke-primary`, `stroke-secondary`, `stroke-tertiary`, `stroke-error`,
`stroke-warning`, `stroke-info`, `stroke-success`, `text-primary`,
`text-secondary`, `text-error`, `text-warning`, `text-warning-icon`,
`text-info`, `text-success`.

| Legacy token                                                                                                             | Closest new token                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `bg-layer-0` … `bg-layer-4`                                                                                              | `bg-layer-sunken`, `bg-layer-base`, `bg-layer-raised` — five elevation steps collapsed into three |
| `bg-blackout`                                                                                                            | `bg-backdrop`                                                                                     |
| `controls-bg-accent`, `bg-accent-primary`                                                                                | `bg-control-accent`                                                                               |
| `controls-bg-accent-hover`                                                                                               | No solid hover token; the new controls use `bg-control-accent-alpha-hover` / `-active`            |
| `controls-bg-disable`, `controls-bg-disable-accent`                                                                      | `bg-control-disable`                                                                              |
| `controls-text-permanent`                                                                                                | `text-control-permanent`                                                                          |
| `controls-text-disable`, `controls-text-primary-disable`, `controls-text-accent-disable`                                 | `text-control-disable-alpha`, `text-control-disable-beta` — three states collapsed into two       |
| `text-accent-primary`                                                                                                    | `text-accent`                                                                                     |
| `stroke-hover`                                                                                                           | `stroke-hover-alpha`                                                                              |
| `stroke-accent-primary`                                                                                                  | `stroke-accent-alpha`, plus `stroke-focus-blue` for focus rings                                   |
| `bg-accent-secondary`, `bg-accent-tertiary`, `stroke-accent-secondary`, `stroke-accent-tertiary`, `text-accent-tertiary` | No equivalent — the three-accent scheme became a single accent                                    |
| `bg-auth-layer-0`, `bg-auth-layer-1`                                                                                     | No equivalent — the login page uses the shared surface tokens                                     |
| `bg-model-icon`                                                                                                          | No equivalent                                                                                     |
| `border-radius`                                                                                                          | No equivalent — radii are Tailwind classes, not a themeable variable                              |
| `codeblock-font`, `theme-font`                                                                                           | No equivalent in practice — see [Fonts are not themeable](#fonts-are-not-themeable)               |

New token groups with no legacy counterpart — `bg-visual-*`, `text-visual-*`,
`bg-control-neutral*`, `bg-control-error*`, `text-control-blue-*`,
`stroke-focus-black`, `stroke-error-alpha`, and `shadow-*` — start at their
built-in light values until the theme sets them. A dark theme that leaves them
alone will show light chips, focus rings, and shadows.

### Images

Replace `themes[].app-logo` with `images.chat-logo-light` and
`images.chat-logo-dark`, and `images.favicon` with `images.chat-favicon`. The
legacy fields are ignored rather than rejected, which is why a migrated theme
can render with no logo at all and no error.

### Features with no replacement

- **`additional_css` / `ADDITIONAL_CSS_DIR`.** The legacy chat injected
  arbitrary stylesheets from a mounted directory. 1.0 replaces that with two
  supported channels: deployment-wide colors through the theme tokens above, and
  anything a token does not cover through the libs' own styling props —
  `styles={{ colors, typography }}` at the call site, described in
  [Styling libraries](#styling-libraries). Both survive an upgrade; a stylesheet
  targeting generated class names does not.
- **The `custom-logo` UI feature flag.** The logo now always comes from the
  theme configuration; the flag no longer exists.

## Styling libraries

Components in `libs/*` are consumed both by this application and by external
projects, so they do not depend on this theme. Each themeable value resolves
through a three-tier chain — per-instance prop override, then the application
theme token described above, then a hard-coded hex fallback:

```scss
background: var(--ci-bg, var(--bg-layer-sunken, #eef1f7));
```

Inside this application the middle tier resolves, so libs pick up the deployment
theme automatically. In a project without these tokens the hex fallback applies,
and a host can still override individual values through each component's
`styles={{ colors, typography }}` prop.

The full convention — variable naming, what belongs in `.module.scss` versus
Tailwind, the `buildCssVars` helper, and the checks that catch styles which
silently do nothing — is in
[`openspec/lib-styling-guide.md`](../openspec/lib-styling-guide.md).
