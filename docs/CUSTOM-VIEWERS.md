# Custom Viewers

## Overview

Custom Viewers provide the capability to implement and configure specialized viewing interfaces tailored to specific application requirements.

## Custom Viewer Configuration

Custom Viewers can be configured for applications through two methods:

- **Application Type Schema Configuration**: Applications utilizing an application type schema reference the schema through the `application_type_schema_id` field, which contains a `dial:applicationTypeViewerUrl` field
- **Direct URL Configuration**: Applications specify a viewer URL directly through the `viewer_url` field

## Custom Viewer Implementation

The Custom Viewer functionality is built upon the DIAL Chat Visualizer Connector framework (package: `@epam/ai-dial-chat-visualizer-connector`), originally developed for Custom Visualizers. Comprehensive documentation is available [here](../libs/chat-visualizer-connector/README.md).

From a technical perspective, Custom Viewers are rendered within an iframe element. DIAL Chat awaits receipt of a `<title>/READY_TO_INTERACT` event before dismissing the loading indicator. The `title` parameter corresponds to either the schema display name or the application display name, determined by the Custom Viewer configuration method employed.

A reference implementation demonstrating Custom Viewer functionality is available [here](../apps/custom-viewer-test/README.md).
