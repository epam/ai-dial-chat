# DIAL Chat Visualizer Connector

DIAL Chat Visualizer Connector is a library for connecting custom visualizers - applications which could visualize some special type data (for example **plot data** for the **Plotly**).

## Public classes to use

`ChatVisualizerConnector` - class which provides needed methods for the **Visualizer**(rendered in the iframe) to interact with **DIAL Chat** (receive data to visualize).

## Prerequisites

For security reason your DIAL Chat application should configure sources where your custom visualizers hosted:

- `ALLOWED_IFRAME_SOURCES` - list of allowed iframe sources in `<source> <source>` format.

_Note: For development purposes you can set `*`_

```
ALLOWED_IFRAME_SOURCES=http://localhost:8000
```

## Visualizer Configuration

There are two ways to configure visualizers:

### 1. CUSTOM_VISUALIZERS (Single Attachment Mode)

Each attachment is rendered in its own iframe based on MIME type.

- `CUSTOM_VISUALIZERS` - list of the objects with custom visualizers properties.

```typescript
interface CustomVisualizer {
  title: string;
  description: string;
  icon: string;
  contentType: string;
  url: string;
  passAuthInfo?: boolean;
  passExplicitToken?: boolean;
}
```

```json
CUSTOM_VISUALIZERS=[
                    {
                      "title":"CUSTOM_VISUALIZER",
                      "description": "CUSTOM VISUALIZER to render images",
                      "icon":"data:image/svg+xml;base64,some-base64-image",
                      "contentType":"image/png,image/jpg",
                      "url":"http://localhost:8000"
                    }
                  ]
```

### 2. APPLICATION_VISUALIZERS (Grouped Attachments Mode)

All attachments from the same application are grouped and rendered in a single iframe.

- `APPLICATION_VISUALIZERS` - JSON dictionary mapping application IDs to visualizer configurations.

```typescript
interface ApplicationVisualizerConfig {
  title: string;
  description?: string;
  icon?: string;
  contentType?: string;
  url: string;
  expanded?: boolean;
  borderless?: boolean;
  withoutTitle?: boolean;
  passAuthInfo?: boolean;
  passExplicitToken?: boolean;
}
```

Optional `contentType` uses the same comma-separated MIME list style as `CUSTOM_VISUALIZERS`. When set, only attachments whose `type` is in that list (and with a URL) are passed to the grouped iframe; other attachments (for example `image/png`) are rendered with the default chat attachment UI. When omitted, every attachment with a URL is sent to the grouped visualizer.

```json
APPLICATION_VISUALIZERS={
  "applicationId": {
    "title": "GROUPED_VISUALIZER",
    "description": "Visualizer for grouped attachments",
    "contentType": "application/custom+json,application/content+json",
    "url": "http://localhost:8000",
    "expanded": true,
    "borderless": true,
    "withoutTitle": false
  }
}
```

**Key difference:** The key in `APPLICATION_VISUALIZERS` must match the `applicationId` (from `message.model.id`) that generates the attachments.

## Authentication Options

Both `CUSTOM_VISUALIZERS` and `APPLICATION_VISUALIZERS` support optional flags to forward auth information from DIAL Chat into the visualizer via `layout` fields.

### `passAuthInfo`

When `true`, the current user's session data is included in the layout sent to the visualizer:

| Layout field | Value                                     |
| ------------ | ----------------------------------------- |
| `logInHint`  | User's email address                      |
| `providerId` | OAuth provider ID from the active session |

### `passExplicitToken`

When `true`, the access token supplied by the parent application in [overlay mode](`signInOptions.explicitToken`) is forwarded to the visualizer:

| Layout field  | Value                              |
| ------------- | ---------------------------------- |
| `accessToken` | Bearer token from the overlay host |

This is useful when the visualizer itself needs to call DIAL APIs and the chat is embedded as an overlay widget authenticated via an explicit token from the parent app. If no overlay token is present (e.g. standalone mode), `accessToken` is omitted.

Both flags are independent and can be combined:

```json
{
  "applicationId": {
    "title": "MY_VISUALIZER",
    "url": "https://my-visualizer.example.com",
    "passAuthInfo": true,
    "passExplicitToken": true
  }
}
```

## Data Structures

### Single Attachment Data (CUSTOM_VISUALIZERS)

```typescript
export interface AttachmentData {
  mimeType: string;
  visualizerData: CustomVisualizerData;
}

export interface CustomVisualizerDataLayout {
  width: number;
  height: number;
  themeId?: string;
  logInHint?: string;
  providerId?: string;
  accessToken?: string;
  currentLocale?: string;
  dir?: 'ltr' | 'rtl';
}

export interface CustomVisualizerData {
  layout: CustomVisualizerDataLayout;
}
```

### Grouped Attachments Data (APPLICATION_VISUALIZERS)

```typescript
export interface GroupedAttachmentsData {
  attachments: AttachmentItem[];
  layout: CustomVisualizerDataLayout;
}

export interface AttachmentItem {
  url: string;
  mimeType: string;
  contentType: string;
  visualizerData: CustomVisualizerData;
}
```

## Integration Guide

### 1. Install library

```bash
npm i @epam/ai-dial-chat-visualizer-connector
```

### 2. Import required modules

```typescript
import { AttachmentData, ChatVisualizerConnector, CustomVisualizerDataLayout, GroupedAttachmentsData } from '@epam/ai-dial-chat-visualizer-connector';
```

### 3. Configure host and app name

```typescript
// DIAL CHAT host (one or multiple)
const dialHost = 'https://hosted-dial-chat-domain.com';
// Or multiple hosts:
// const dialHost = ['https://hosted-dial-chat-domain.com', 'https://backup-dial-chat-domain.com'];

// Visualizer title - must match 'title' in CUSTOM_VISUALIZERS or APPLICATION_VISUALIZERS
const appName = 'CUSTOM_VISUALIZER';
```

### 4. Create ChatVisualizerConnector instance

#### Option A: Single Attachment Mode (backward compatible)

```typescript
const [data, setData] = useState<AttachmentData>();
const chatVisualizerConnector = useRef<ChatVisualizerConnector | null>(null);

useEffect(() => {
  if (!chatVisualizerConnector.current && dialHost && appName) {
    // Pass callback function directly (original API)
    chatVisualizerConnector.current = new ChatVisualizerConnector(dialHost, appName, setData);

    return () => {
      chatVisualizerConnector.current?.destroy();
      chatVisualizerConnector.current = null;
    };
  }
}, [appName, dialHost]);
```

#### Option B: Support Both Single and Grouped Attachments

```typescript
const [data, setData] = useState<AttachmentData>();
const [groupedData, setGroupedData] = useState<GroupedAttachmentsData>();
const chatVisualizerConnector = useRef<ChatVisualizerConnector | null>(null);

useEffect(() => {
  if (!chatVisualizerConnector.current && dialHost && appName) {
    // Pass callbacks object to handle both modes
    chatVisualizerConnector.current = new ChatVisualizerConnector(dialHost, appName, {
      onData: setData, // Called for CUSTOM_VISUALIZERS (single attachment)
      onGroupedData: setGroupedData, // Called for APPLICATION_VISUALIZERS (grouped)
    });

    return () => {
      chatVisualizerConnector.current?.destroy();
      chatVisualizerConnector.current = null;
    };
  }
}, [appName, dialHost]);
```

### 5. Send ready events

```typescript
useEffect(() => {
  if (appName && dialHost) {
    chatVisualizerConnector.current?.sendReady();
    // Make some actions if needed (login, etc.)
    chatVisualizerConnector.current?.sendReadyToInteract();
  }
}, [dialHost, appName]);
```

### 6. Process received data

```typescript
const content = useMemo(() => {
  // Handle grouped attachments (APPLICATION_VISUALIZERS)
  if (groupedData?.attachments) {
    return groupedData.attachments.map((att) => ({
      url: att.url,
      mimeType: att.mimeType,
      contentType: att.contentType,
      data: att.visualizerData,
    }));
  }

  // Handle single attachment (CUSTOM_VISUALIZERS)
  if (data?.visualizerData) {
    return [data];
  }

  return [];
}, [data, groupedData]);
```

### 7. Render data

```tsx
<div>
  {content.map((item, index) => (
    <div key={index}>{/* Render your visualization */}</div>
  ))}
</div>
```

## Full React Example (Supporting Both Modes)

```typescript
import { FC, useState, useRef, useEffect, useMemo } from 'react';
import {
  AttachmentData,
  GroupedAttachmentsData,
  ChatVisualizerConnector,
  CustomVisualizerDataLayout
} from '@epam/ai-dial-chat-visualizer-connector';

interface YourVisualizerLayout extends CustomVisualizerDataLayout {
  // Add any additional layout properties
}

export const Module: FC = () => {
  const [data, setData] = useState<AttachmentData>();
  const [groupedData, setGroupedData] = useState<GroupedAttachmentsData>();

  const chatVisualizerConnector = useRef<ChatVisualizerConnector | null>(null);

  // DIAL CHAT host
  const dialHost = 'https://hosted-dial-chat-domain.com';

  // Visualizer title - must match configuration
  const appName = 'CUSTOM_VISUALIZER';

  useEffect(() => {
    if (!chatVisualizerConnector.current && dialHost && appName) {
      chatVisualizerConnector.current = new ChatVisualizerConnector(
        dialHost,
        appName,
        {
          onData: (payload) => {
            console.log('[Visualizer] Received single attachment:', payload);
            setData(payload);
          },
          onGroupedData: (payload) => {
            console.log('[Visualizer] Received grouped attachments:', payload);
            setGroupedData(payload);
          }
        }
      );

      return () => {
        chatVisualizerConnector.current?.destroy();
        chatVisualizerConnector.current = null;
      };
    }
  }, [appName, dialHost]);

  useEffect(() => {
    if (appName && dialHost) {
      chatVisualizerConnector.current?.sendReady();
      chatVisualizerConnector.current?.sendReadyToInteract();
    }
  }, [dialHost, appName]);

  // Process data from either mode
  const items = useMemo(() => {
    // Grouped mode (APPLICATION_VISUALIZERS)
    if (groupedData?.attachments) {
      return groupedData.attachments.map(att => ({
        mimeType: att.mimeType,
        visualizerData: att.visualizerData as unknown as {
          dataToRender: string;
          layout: YourVisualizerLayout;
        }
      }));
    }

    // Single mode (CUSTOM_VISUALIZERS)
    if (data?.visualizerData) {
      return [{
        mimeType: data.mimeType,
        visualizerData: data.visualizerData as unknown as {
          dataToRender: string;
          layout: YourVisualizerLayout;
        }
      }];
    }

    return [];
  }, [data, groupedData]);

  return (
    <div>
      {items.map((item, index) => (
        <div key={index}>
          {item.visualizerData?.dataToRender && (
            <div>{item.visualizerData.dataToRender}</div>
          )}
        </div>
      ))}
    </div>
  );
};
```

## API Reference

### ChatVisualizerConnector

#### Constructor

```typescript
constructor(
  dialHost: string | string[],
  appName: string,
  dataCallback: ((visualizerData: AttachmentData) => void) | ChatVisualizerCallbacks
)
```

**Parameters:**

- `dialHost` - DIAL CHAT host URL(s)
- `appName` - Visualizer name (must match `title` in configuration)
- `dataCallback` - Either a single callback function or a `ChatVisualizerCallbacks` object

#### ChatVisualizerCallbacks

```typescript
interface ChatVisualizerCallbacks {
  onData?: (visualizerData: AttachmentData) => void;
  onGroupedData?: (groupedData: GroupedAttachmentsData) => void;
}
```

#### Methods

| Method                               | Description                                               |
| ------------------------------------ | --------------------------------------------------------- |
| `sendReady()`                        | Notify DIAL Chat that visualizer is loaded (hides loader) |
| `sendReadyToInteract()`              | Notify DIAL Chat that visualizer is ready to receive data |
| `sendMessage(content: string)`       | Send a message to the chat                                |
| `send({ type, payload, dialHost? })` | Send custom event to DIAL Chat                            |
| `destroy()`                          | Clean up event listeners                                  |

### Sending to a particular host when multiple were passed

```typescript
chatVisualizerConnector.current?.send({
  type: VisualizerConnectorEvents.sendMessage,
  payload: { message: 'hello from visualizer' },
  dialHost: 'https://hosted-dial-chat-domain.com',
});
```

If `dialHost` is **not** provided in `send(...)`, the connector will send the message to **all** hosts passed in the constructor.

## Troubleshooting

### Timeout Error

```
[VisualizerConnector] Request APP_NAME/SEND_GROUPED_VISUALIZE_DATA failed. Timeout 10000
```

**Cause:** The visualizer is not responding to the data request.

**Solutions:**

1. Ensure `appName` matches the `title` in your configuration
2. Verify you're using the callbacks object format with `onGroupedData` for grouped mode
3. Check browser console for any errors in the visualizer

### PostMessage Origin Error

```
Failed to execute 'postMessage' on 'DOMWindow': The target origin provided does not match...
```

**Cause:** The `dialHost` parameter doesn't match the actual DIAL Chat origin.

**Solutions:**

1. Ensure `dialHost` is set to the DIAL Chat URL (not the visualizer URL)
2. Verify the visualizer is running inside an iframe from DIAL Chat

### No Data Received

**Checklist:**

1. `appName` must match `title` in `CUSTOM_VISUALIZERS` or `APPLICATION_VISUALIZERS`
2. For `APPLICATION_VISUALIZERS`, the key must match the `applicationId` from messages
3. `sendReady()` and `sendReadyToInteract()` must be called after connector creation
