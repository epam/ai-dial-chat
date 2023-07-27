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
    "logo": "some url",
    "models": {
      "model-id": "some-url"
      // other models, assistants, applications ids with urls
    },
    "addons": {
      "addon-id": "some-url"
      // ...
    }
  }
}
```

### Configuring Colors Palette

Specify your custom colors within the `colorsPalette` object, using the desired color name as the key and the corresponding color value in RGB or HEX formats.

_Note: Ensure that color values are written without the "rgb" wrapper._

```json
  "colorsPalette": {
    "green": "#37BABC",
    "blue": "90 140 233",
    // ...
  }
```

### Customizing Dark and Light themes

Designate the custom colors for your theme by indicating the appropriate color names within the `dark` and `light` objects. Replace the existing semantic colors assignments with your custom color names from colors palette. Note that it is not possible to add a color palette directly inside the dark and light theme objects.

```json
  "dark": {
    // RGB
    "l1": "9 13 19",

    // HEX
    "dropdowns-hints": "#090D13",

    // The value will be used from the color palette
    // provided earlier
    "l2": "gray-800",
    // ...
  },
  "light": {
    "dropdowns-hints": "gray-100",
    "l1": "gray-300",
    // ...
  }
```

## 2. Customizing Semantic Colors

You can customize colors by modifying the color palettes (as demonstrated earlier) or by customizing the semantic colors directly. Customizing semantic colors is recommended because it allows you to target specific elements or components within the application, granting more fine-grained control over its appearance.

To customize semantic colors, modify the `dark` and `light` theme objects in the configuration file, designating the appropriate custom color names to the required interface elements.

```json
  "dark": {
    "error-text": "red-400",
    "error-bg": "red-900",
    // ...
  },
  "light": {
    "error-text": "red-800",
    "error-bg": "red-200",
    // ...
  }
```

### Available Semantic Colors

Below is a list of available semantic colors which you can customize within the `dark` and `light` theme objects. Replace the existing color assignments with your custom color names to modify these elements within the application.

- `dropdowns-hints`
- `l1`
- `l2`
- `l3`
- `l4`
- `icons-secondaryText`
- `text`
- `error-text`
- `error-bg`

For example, in the light theme:

```json
  "light": {
    "dropdowns-hints": "your-custom-color",
    "l1": "your-custom-color",
    "l2": "your-custom-color",
    "l3": "your-custom-color",
    "l4": "your-custom-color",
    "icons-secondaryText": "your-custom-color",
    "text": "your-custom-color",
    "error-text": "your-custom-color",
    "error-bg": "your-custom-color"
  }
```

Remember to use your custom color names, defined in the `colorsPalette`, as the values for each semantic color key.

## 3. Considering Color Format and Opacity

When specifying color values, use the RGB format without the "rgb" wrapper. This ensures that the default opacity for colors is applied correctly. If you use a different color format, opacity for colors may not be applied as expected and could result in unintended visual effects.

For example, use the RGB format like this:

```json
  "colorsPalette": {
    "green": "55, 186, 188",
    // ...
  }
```

Not like this:

```json
  "colorsPalette": {
    "green": "rgb(55, 186, 188)",
    // ...
  }
```

By adhering to these guidelines, you can effectively and safely customize the colors and image URLs of your theme.
