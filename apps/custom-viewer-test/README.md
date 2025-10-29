# Custom Viewer page

This is a test page for the custom viewer.

Before starting apps, need to specify the `NEXT_PUBLIC_VIEWER_HOST` env variable that refers to the DIAL chat host launched for custom viewer and the `NEXT_PUBLIC_APP_NAME` variable that corresponds to application name for which viewer should be displayed.

Run the following command to start sandbox: `nx run custom-viewer-test:serve`. The Custom Viewer page will be hosted on <http://localhost:5500> and you can configure your application to use it (see [Custom Viewer Configuration](../../docs/CUSTOM-VIEWERS.md)) i.e.

- `"dial:applicationTypeViewerUrl": "http://localhost:5500/"` for `Application Type Schema Configuration`
- `"viewerUrl": "http://localhost:5500/"` for `Direct URL Configuration`
