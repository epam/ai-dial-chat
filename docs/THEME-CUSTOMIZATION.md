# Theme Customization

This documentation will guide you through customizing the colors and image URLs of a theme using a configuration file. Follow each section to correctly modify and apply your desired customizations.

## 1. Setting up custom themes configuration

To apply a custom theme configuration, provide a `THEMES_CONFIG_HOST` environment variable containing the URL to your nginx server with the configuration and images. This ensures that the application fetches your configuration file during loading. If the environment variable is not provided, default themes and logos will be applied.

```bash
THEMES_CONFIG_HOST=https://your-config-host.com
```

After setting the `THEMES_CONFIG_HOST` environment variable, proceed with the next steps to customize colors and image URLs.

### Customizing colors and image URLs

The application enables you to customize color palettes and image URLs using a configuration file. To achieve this, create a configuration file with the following structure:

```json
{
  "themes": {
    "colorsPalette": {
      // color values...
    }
  },
  "images": {
    // image urls
    "app-logo": "app-logo.svg",
    "app-logo-dark": "",
    "default-model": "",
    "default-addon": "",
    "favicon": "favicon.png"
  }
}
```

The url for app logo will be recognized as relative url and transformed into {{host}}/app-logo.svg. You can also specify full path to your images like `https://some-path.svg`, if you are hosting image somewhere else.

### Configuring Colors Palette

Specify your custom colors within the `colorsPalette` object, using the desired color name as the key and the corresponding color value which should be valid in CSS. The colors palette is shared between dark and light themes, so you don't need to specify it twice.

```json
  "colorsPalette": {
    // HEX
    "green": "#37BABC",

    // RGB
    "blue-500": "90 140 233",
    // ...
  }
```

You should specify hex value or inner rgb values without opacity values.

By following these guidelines, you can effectively and safely customize the colors and opacity of your theme.

## 2. Default Configuration

Below is the default configuration for the theme. This configuration includes the color palette, dark and light themes, and image URLs. You can use this as a starting point for customizing your own theme.

```json
{
  "themes": {
    "colorsPalette": {
      "green": "#37BABC",
      "blue-500": "#5A8CE9",
      "blue-700": "#4878D2",
      "violet": "#9459F1",
      "gray-100": "#FCFCFC",
      "gray-200": "#F3F4F6",
      "gray-300": "#EAEDF0",
      "gray-400": "#DDE1E6",
      "gray-500": "#7F8792",
      "gray-600": "#333942",
      "gray-700": "#222932",
      "gray-800": "#141A23",
      "gray-900": "#090D13",
      "black": "#000000",
      "red-200": "#F3D6D8",
      "red-400": "#F76464",
      "red-800": "#AE2F2F",
      "red-900": "#402027"
    }
  },
  "images": {
    "app-logo": "",
    "app-logo-dark": "",
    "default-model": "",
    "default-addon": "",
    "favicon": "favicon.png"
  }
}
```

Use this default configuration as a reference when customizing your theme. Modify the color palette and image URLs according to your preferences.
