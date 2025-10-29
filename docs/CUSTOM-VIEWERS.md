# Custom Viewers

## Overview

Custom Viewers provide the capability to implement and configure specialized viewing interfaces tailored to specific application requirements.

## Custom Viewer Configuration

There are two methods you can use to configure Custom Viewers for applications:

- **Application Type Schema Configuration**: Applications utilizing an application type schema reference the schema through the `application_type_schema_id` field, which contains a `dial:applicationTypeViewerUrl` field. Refer to [DIAL Docs](https://github.com/epam/ai-dial/blob/main/docs/platform/3.core/7.apps.md#schema-rich-applications) to learn more about schema-rich applications.
- **Direct URL Configuration**: Applications that do not utilize an application type schema specify a viewer URL directly through the `viewer_url` field. Refer to [DIAL Core documentation](https://github.com/epam/ai-dial-core/blob/development/docs/dynamic-settings/applications.md) and [DIAL Core API reference](https://dialx.ai/dial_api#tag/Applications/operation/saveCustomApplication) to learn more and see examples.

## Custom Viewer Implementation

The Custom Viewer functionality is built upon the DIAL Chat Visualizer Connector framework (package: `@epam/ai-dial-chat-visualizer-connector`), originally developed for Custom Visualizers. Comprehensive documentation is available [here](../libs/chat-visualizer-connector/README.md).

From a technical perspective, Custom Viewers are rendered within an iframe element. DIAL Chat awaits receipt of a `<title>/READY_TO_INTERACT` event before dismissing the loading indicator. The `title` parameter corresponds to either the schema display name or the application display name, determined by the Custom Viewer configuration method employed.

A reference implementation demonstrating Custom Viewer functionality is available [here](../apps/custom-viewer-test/README.md).
