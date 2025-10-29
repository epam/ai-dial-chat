# Custom Viewer Page

This is a test page for the [Custom Viewer](../../docs/CUSTOM-VIEWERS.md).

## Step 1

Before starting, configure these environment variables for this custom viewer test application:

* `NEXT_PUBLIC_VIEWER_HOST`: refers to the DIAL Chat host where you are going to test application.
* `NEXT_PUBLIC_APP_NAME`: corresponds to DIAL application name for which viewer should be displayed.

## Step 2

1. Run the following command to start the test application: `nx run custom-viewer-test:serve`. 
2. The Custom Viewer page will be hosted on <http://localhost:5500> and you can configure your DIAL application to use it (see [Custom Viewer Configuration](../../docs/CUSTOM-VIEWERS.md)) i.e.

- `"dial:applicationTypeViewerUrl": "http://localhost:5500/"` for `Application Type Schema Configuration`
- `"viewer_url": "http://localhost:5500/"` for `Direct URL Configuration`
