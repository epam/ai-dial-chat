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
    },
    "dark": {
      // color assignments...
    },
    "light": {
      // color assignments...
    }
  },
  "images": {
    "app-logo": "",
    "default-model": "",
    "default-addon": ""
  }
}
```

### Configuring Colors Palette

Specify your custom colors within the `colorsPalette` object, using the desired color name as the key and the corresponding color value which should be valid in CSS. The colors palette is shared between dark and light themes, so you don't need to specify it twice.

```json
  "colorsPalette": {
    // HEX
    "green": "#37BABC",

    // RGB
    "blue": "rgb(90 140 233)",
    // ...
  }
```

### Customizing Dark and Light themes

Designate the custom colors for your theme by indicating the appropriate color names within the `dark` and `light` objects. Replace the existing semantic colors assignments with your custom color names from colors palette. Note that it is not possible to add a color palette directly inside the dark and light theme objects.

```json
  "dark": {
    // RGB
    "l1-divider": "rgb(9 13 19)",

    // HEX
    "dropdowns-hints": "#090D13",

    // The value will be used from the color palette
    // provided earlier
    "l2": "gray-800",
    // ...
  },
  "light": {
    "dropdowns-hints": "gray-100",
    "l1-divider": "gray-300",
    // ...
  }
```

## 2. Customizing Semantic Colors

You can customize colors by modifying the color palettes (as demonstrated earlier) or by customizing the semantic colors directly. Customizing semantic colors is recommended because it allows you to target specific elements or components within the application, granting more fine-grained control over its appearance. 

To customize semantic colors, modify the `dark` and `light` theme objects in the configuration file, designating the appropriate custom color names to the required interface elements or just their values (HEX, RGB, etc.).

```json
  "dark": {
    "errorText-errorStroke": "red-400",
    "error-bg": "red-900",
    // ...
  },
  "light": {
    "errorText-errorStroke": "red-800",
    "error-bg": "red-200",
    // ...
  }
```

### Available Semantic Colors

Below is a list of available semantic colors which you can customize within the `dark` and `light` theme objects. Replace the existing color assignments with your custom color names to modify these elements within the application.

- `dropdowns-hints`
- `l1-divider`
- `l2`
- `l3`
- `l4-stroke`
- `icons-secondaryText`
- `text`
- `errorText-errorStroke`
- `error-bg`
- `accent-main`
- `accent-bg-main`
- `accent-left-panel`
- `accent-bg-left-panel`
- `accent-right-panel`
- `accent-bg-right-panel`
- `divider-chat`
- `blackout`

For example, in the light theme:

```json
  "light": {
    "dropdowns-hints": "your-custom-color",
    "l1-divider": "your-custom-color",
    "l2": "your-custom-color",
    "l3": "your-custom-color",
    "l4-stroke": "your-custom-color",
    "icons-secondaryText": "your-custom-color",
    "text": "your-custom-color",
    "errorText-errorStroke": "your-custom-color",
    "error-bg": "your-custom-color",
    "accent-main": "your-custom-color",
    "accent-bg-main": "your-custom-color",
    "accent-left-panel": "your-custom-color",
    "accent-bg-left-panel": "your-custom-color",
    "accent-right-panel": "your-custom-color",
    "accent-bg-right-panel": "your-custom-color",
    "divider-chat": "your-custom-color",
    "blackout": "your-custom-color"
  }
```

Remember to use your custom color names, defined in the `colorsPalette`, as the values for each semantic color key.

## 3. Considering Color Format and Opacity

When specifying color values, you can use various color formats such as RGB, HEX, or even HEX with opacity. To add opacity to your colors, you can either create an appropriate color in the `colorsPalette` with the desired opacity or use a color value with opacity directly.

For example, you can use the RGB format with opacity like this:

```json
  "colorsPalette": {
    "green": "rgba(55, 186, 188, 0.5)",
    // ...
  }
```

Or use the HEX format with opacity like this:

```json
  "colorsPalette": {
    "green": "#37BABC80",
    // ...
  }
```

Alternatively, you can create a separate color in the `colorsPalette` with the desired opacity:

```json
  "colorsPalette": {
    "green": "#37BABC",
    "green-bg": "#37BABC26",
    // ...
  }
```

By following these guidelines, you can effectively and safely customize the colors and opacity of your theme.

## 4. Default Configuration

Below is the default configuration for the theme. This configuration includes the color palette, dark and light themes, and image URLs. You can use this as a starting point for customizing your own theme.

```json
{
  "themes": {
    "colorsPalette": {
      "green": "#37BABC",
      "green-bg": "#37BABC26",
      "blue": "#5A8CE9",
      "blue-bg": "#598BE833",
      "violet": "#9459F1",
      "violet-bg": "#945BF12B",
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
      "red-900": "#402027",
      "blackout-300": "#090D134C",
      "blackout-700": "#090D13B2"
    },
    "dark": {
      "dropdowns-hints": "black",
      "l1-divider": "gray-900",
      "l2": "gray-800",
      "l3": "gray-700",
      "l4-stroke": "gray-600",
      "icons-secondaryText": "gray-500",
      "text": "gray-200",
      "errorText-errorStroke": "red-400",
      "error-bg": "red-900",
      "accent-main": "blue",
      "accent-bg-main": "blue-bg",
      "accent-left-panel": "green",
      "accent-bg-left-panel": "green-bg",
      "accent-right-panel": "violet",
      "accent-bg-right-panel": "violet-bg",
      "divider-chat": "gray-700",
      "blackout": "blackout-700"
    },
    "light": {
      "dropdowns-hints": "gray-100",
      "l1-divider": "gray-300",
      "l2": "gray-200",
      "l3": "gray-100",
      "l4-stroke": "gray-400",
      "icons-secondaryText": "gray-500",
      "text": "gray-200",
      "errorText-errorStroke": "red-800",
      "error-bg": "red-200",
      "accent-main": "blue",
      "accent-bg-main": "blue-bg",
      "accent-left-panel": "green",
      "accent-bg-left-panel": "green-bg",
      "accent-right-panel": "violet",
      "accent-bg-right-panel": "violet-bg",
      "divider-chat": "gray-400",
      "blackout": "blackout-300"
    }
  },
  "images": {
    "app-logo": "",
    "default-model": "",
    "default-addon": ""
  }
}
```

Use this default configuration as a reference when customizing your theme. Modify the color palette, dark and light themes, and image URLs according to your preferences.