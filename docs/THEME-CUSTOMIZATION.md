# Theme Customization

You can tailor the appearance of your chat application using **themes** - a collection of static resources including images, fonts, and colors. DIAL Chat provides two pre-set themes - dark (which is the default theme) and light. However, you can deploy a specific service that allows you to modify the default themes or create and configure your own custom themes. This independent service allows you to alter themes without having to rebuild the the chat application Docker image.

**Note**: after making changes into themes, it is necessary to restart the chat application to apply changes.

> Refer to [DIAL Chat Themes](https://github.com/epam/ai-dial-chat-themes) to learn how to deploy and configure a special server for chat themes.

## Configuration

If you want to use any other than default themes, deploy `ai-dial-chat-themes` and create custom configurations.

When this service is deployed, provide a `THEMES_CONFIG_HOST` environment variable in the DIAL Chat configuration containing the URL to your nginx server with themes (can be both public and private). This ensures that the application fetches the configuration file with themes during loading. If the environment variable is not provided, [default themes and model icons](https://github.com/epam/ai-dial-chat-themes/blob/development/static/config.json) will be applied.

```bash
THEMES_CONFIG_HOST=https://your-config-host.com
```

After setting the `THEMES_CONFIG_HOST` environment variable, you can [add and customize themes](https://github.com/epam/ai-dial-chat-themes/blob/development/static/config.json).

> Please note that after making modifications, you need to redeploy the server with themes for the changes to take effect. There is a default cache period of 24 hours, after which the new settings will be applied automatically.

## Additional CSS

You can add `.css` files to an `additional_css` folder to inject extra stylesheets on every page. Files are loaded in alphabetical order by filename.

The folder is not created by the application. Add it only when you need custom CSS. If the folder is missing or empty, the application continues without additional stylesheets.

### Local development

Create `apps/chat/additional_css/` in the repository and add one or more `.css` files:

```
apps/chat/
  additional_css/
    overrides.css
    branding.css
```

Restart or refresh the dev server after adding or changing files.

### Docker

Mount your CSS directory into the running container at `/app/additional_css`:

```yaml
volumes:
  - ./apps/chat/additional_css:/app/additional_css:ro
```

No application rebuild is required. Mount the volume and restart the container to pick up new files.

### Configuration

By default, the application looks for `<process.cwd()>/additional_css`. If the default path is not suitable, set the `ADDITIONAL_CSS_DIR` environment variable to the absolute path of the directory containing `.css` files. Refer to the [Environment Variables](../apps/chat/README.md#environment-variables) section in the DIAL Chat README.
