# Theme Customization

This documentation will guide you through customizing the colors and image URLs of a theme using a configuration file. Follow each section to correctly modify and apply your desired customizations.

## 1. Setting up custom themes configuration

To apply a custom theme configuration, provide a `THEMES_CONFIG_HOST` environment variable containing the URL to your nginx server with the configuration and images. This ensures that the application fetches your configuration file during loading. If the environment variable is not provided, default themes and model icons will be applied.

```bash
THEMES_CONFIG_HOST=https://your-config-host.com
```

After setting the `THEMES_CONFIG_HOST` environment variable, proceed with the next steps to customize colors and image URLs.

### Customizing colors and image URLs

The application enables you to customize color palettes and image URLs using a configuration file. To achieve this, create a configuration file with the following structure:

```json
{
  "themes": [
    // defined themes as an array
  ],
  "images": {
    // common for all themes image urls
    "default-model": "",
    "default-addon": "",
    "favicon": "favicon.png"
  }
}
```

The url for app logo will be recognized as relative url and transformed into {{host}}/app-logo.svg. You can also specify full path to your images like `https://some-path.svg`, if you are hosting image somewhere else.

### Configuring theme

To declare new theme you should create an object inside your themes property and fill all required fields:

```json
  // defined themes as an array
  "themes": [
    {
      "displayName": "Light",   // Displayed name in settings modal
      "id": "light",            // Some kebab case id name
      "app-logo": "logo.svg",   // Url for website logo displayed
      "colors": {
        // Semantic colors which commonly used across entire application.
        // See default configuration to check available colors
      },
      "font-family":"Inter" //Font for the theme
    },
    // Other themes
  ],
```

You should specify hex value in colors (See [link](https://developer.mozilla.org/en-US/docs/Web/CSS/hex-color)).

_NOTE_: First theme in array will be used as default one for new users.

## 2. Default Configuration

Below is the default configuration for the theme. This configuration includes the color palettes for dark and light themes, and image URLs. You can use this as a starting point for customizing your own theme.

```json
{
  "themes": [
    {
      "displayName": "Light",
      "id": "light",
      "app-logo": "logo.svg",
      "font-family": "",
      "colors": {
        "bg-layer-0": "#FCFCFC",
        "bg-layer-1": "#EAEDF0",
        "bg-layer-2": "#F3F4F6",
        "bg-layer-3": "#FCFCFC",
        "bg-layer-4": "#DDE1E6",
        "bg-blackout": "#090D134D",
        "bg-error": "#F3D6D8",
        "bg-accent-primary": "#2764d9",
        "bg-accent-secondary": "#009D9F",
        "bg-accent-tertiary": "#843EF3",
        "bg-accent-primary-alpha": "#2764d91A",
        "bg-accent-secondary-alpha": "#009D9F1A",
        "bg-accent-tertiary-alpha": "#843EF31A",

        "text-primary": "#141A23",
        "text-secondary": "#7F8792",
        "text-error": "#AE2F2F",
        "text-accent-primary": "#2764D9",
        "text-accent-secondary": "#009D9F",
        "text-accent-tertiary": "#843EF3",

        "stroke-primary": "#DDE1E6",
        "stroke-secondary": "#DDE1E6",
        "stroke-tertiary": "#EAEDF0",
        "stroke-hover": "#141A23",
        "stroke-error": "#AE2F2F",
        "stroke-accent-primary": "#2764D9",
        "stroke-accent-secondary": "#009D9F",
        "stroke-accent-tertiary": "#843EF3",

        "controls-bg-accent": "#5C8DEA",
        "controls-bg-accent-hover": "#4878D2",
        "controls-bg-disable": "#7F8792",

        "controls-text-permanent": "#FCFCFC",
        "controls-text-disable": "#DDE1E6"
      }
    },
    {
      "displayName": "Dark",
      "id": "dark",
      "app-logo": "logo-dark.svg",
      "font-family": "",
      "colors": {
        "bg-layer-0": "#000000",
        "bg-layer-1": "#090D13",
        "bg-layer-2": "#141A23",
        "bg-layer-3": "#222932",
        "bg-layer-4": "#333942",
        "bg-blackout": "#090D13B3",
        "bg-error": "#402027",
        "bg-accent-primary": "#5C8DEA",
        "bg-accent-secondary": "#37BABC",
        "bg-accent-tertiary": "#A972FF",
        "bg-accent-primary-alpha": "#5C8DEA2B",
        "bg-accent-secondary-alpha": "#37BABC26",
        "bg-accent-tertiary-alpha": "#A972FF2B",

        "text-primary": "#F3F4F6",
        "text-secondary": "#7F8792",
        "text-error": "#F76464",
        "text-accent-primary": "#5C8DEA",
        "text-accent-secondary": "#37BABC",
        "text-accent-tertiary": "#A972FF",

        "stroke-primary": "#333942",
        "stroke-secondary": "#222932",
        "stroke-tertiary": "#090D13",
        "stroke-error": "#F76464",
        "stroke-hover": "#F3F4F6",
        "stroke-accent-primary": "#5C8DEA",
        "stroke-accent-secondary": "#37BABC",
        "stroke-accent-tertiary": "#A972FF",

        "controls-bg-accent": "#5C8DEA",
        "controls-bg-accent-hover": "#4878D2",
        "controls-bg-disable": "#7F8792",

        "controls-text-permanent": "#FCFCFC",
        "controls-text-disable": "#333942"
      }
    }
  ],
  "images": {
    "default-model": "",
    "default-addon": "",
    "favicon": "favicon.png"
  }
}
```

Use this default configuration as a reference when customizing your theme. Modify the color palette and image URLs according to your preferences.
